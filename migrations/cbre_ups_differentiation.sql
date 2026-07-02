-- ============================================================
-- cbre_ups_differentiation.sql
-- Part 1 + Part 2 schema for CBRE vs UPS handling and the improved
-- NTE Increase Request. Idempotent — safe to re-run.
-- Run this in the Supabase SQL editor.
-- ============================================================

-- ── WORK ORDERS: client type + admin-hours override ──────────────────────────
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS client_type text,
  ADD COLUMN IF NOT EXISTS include_admin_hours boolean;   -- NULL = client default

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_orders_client_type_chk'
  ) THEN
    ALTER TABLE work_orders
      ADD CONSTRAINT work_orders_client_type_chk
      CHECK (client_type IN ('CBRE','UPS') OR client_type IS NULL);
  END IF;
END $$;

-- Backfill client_type from the description prefix ("<code> - CBRE - ..." etc).
-- Anchored to the start so "CBRE"/"UPS" later in free text never mis-classifies.
UPDATE work_orders
   SET client_type = 'CBRE'
 WHERE client_type IS NULL
   AND work_order_description ~* '^\s*\d+\s*-\s*CBRE\b';

UPDATE work_orders
   SET client_type = 'UPS'
 WHERE client_type IS NULL
   AND work_order_description ~* '^\s*\d+\s*-\s*UPS\b';

-- ── WORK ORDER QUOTES: structured description + on-site + photo + ack ─────────
ALTER TABLE work_order_quotes
  ADD COLUMN IF NOT EXISTS troubleshooting_findings text,
  ADD COLUMN IF NOT EXISTS work_required            text,
  ADD COLUMN IF NOT EXISTS parts_materials          text,
  ADD COLUMN IF NOT EXISTS is_on_site               boolean,
  ADD COLUMN IF NOT EXISTS photo_url                text,
  ADD COLUMN IF NOT EXISTS photo_uploaded_at        timestamptz,
  ADD COLUMN IF NOT EXISTS no_contact_ack           boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_contact_ack_at        timestamptz;

-- ── APP SETTINGS: generic key/value store (CBRE holiday override lives here) ──
CREATE TABLE IF NOT EXISTS app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);

-- App-level auth (no RLS by design); permissive policy keeps the linter quiet.
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings'
      AND policyname = 'app_settings_all'
  ) THEN
    CREATE POLICY app_settings_all ON app_settings
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Seed the CBRE holiday override to OFF if absent.
INSERT INTO app_settings (key, value)
VALUES ('cbre_holiday_override', '{"enabled": false}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── NOTIFICATION SUBSCRIPTIONS: seed the new CBRE NTE event ───────────────────
-- Every existing office/admin user is subscribed by default (email-only event).
INSERT INTO notification_subscriptions (user_id, notification_type, enabled, is_default_subscriber)
SELECT u.user_id, 'cbre_nte_submitted', true, true
FROM users u
WHERE u.role IN ('admin','office_staff','operations','office')
  AND u.is_active = true
ON CONFLICT (user_id, notification_type) DO NOTHING;

NOTIFY pgrst, 'reload schema';

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT client_type, COUNT(*)
FROM work_orders
GROUP BY client_type
ORDER BY client_type NULLS LAST;
