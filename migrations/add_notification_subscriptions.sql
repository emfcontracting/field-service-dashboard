-- ============================================================
-- NOTIFICATION SUBSCRIPTIONS
-- Per-user, per-event toggle for who gets auto-notifications.
-- Replaces the hardcoded "all admin/office_staff" lookup.
--
-- is_default_subscriber: TRUE means this row was auto-created
-- because the user has an office/admin role. UI hides the
-- [Remove] button for these to prevent accidentally removing
-- the default cc list. Users can still toggle individual events
-- off/on, but cannot be deleted entirely from the table.
--
-- This script is idempotent: safe to re-run.
-- ============================================================

-- Base table
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  is_default_subscriber BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, notification_type)
);

-- Defensive: add the column if the table was created in a partial
-- earlier run that pre-dated this column.
ALTER TABLE notification_subscriptions 
  ADD COLUMN IF NOT EXISTS is_default_subscriber BOOLEAN NOT NULL DEFAULT false;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notif_subs_lookup 
  ON notification_subscriptions(notification_type, enabled) 
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_notif_subs_user 
  ON notification_subscriptions(user_id);

-- Auto-seed: every existing admin/office user gets subscribed to all current events
INSERT INTO notification_subscriptions (user_id, notification_type, enabled, is_default_subscriber)
SELECT 
  u.user_id, 
  t.notification_type, 
  true,
  true
FROM users u
CROSS JOIN (
  VALUES 
    ('missing_data_flagged'),
    ('missing_data_fixed'),
    ('work_order_completed'),
    ('work_orders_imported')
) AS t(notification_type)
WHERE u.role IN ('admin', 'office_staff', 'operations', 'office')
  AND u.is_active = true
ON CONFLICT (user_id, notification_type) DO NOTHING;

-- Verify
SELECT 
  u.first_name || ' ' || u.last_name AS person,
  u.role,
  COUNT(s.subscription_id) AS subscribed_to_events
FROM users u
LEFT JOIN notification_subscriptions s ON s.user_id = u.user_id AND s.enabled = true
WHERE u.is_active = true
GROUP BY u.user_id, u.first_name, u.last_name, u.role
ORDER BY u.role, u.first_name;
