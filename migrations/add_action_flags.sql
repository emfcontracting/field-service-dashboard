-- ============================================================
-- ACTION FLAGS: Lockout + Update Required Flag
--
-- Adds two complementary improvements to the flagging system:
--
-- 1. LOCKOUT for Missing Data "I fixed it" button
--    Tech can only click ONCE per flag cycle. After that, button stays
--    disabled until Office resolves the flag. Prevents techs from spamming
--    office with notifications to pressure them into reviewing faster.
--
-- 2. UPDATE REQUIRED flag (blue, parallel to Missing Data)
--    Lets office flag a WO when tech isn't following up on things:
--      - NTE status with CBRE (is it approved yet?)
--      - Material delivery tracking
--      - Quote status follow-up
--      - Other (free-form)
--
--    Same lockout behavior — tech can only mark "I followed up" once.
-- ============================================================

-- ─── Phase 1: Missing Data Lockout ───────────────────────────
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS missing_data_tech_marked_fixed_at TIMESTAMPTZ;
ALTER TABLE work_orders 
  ADD COLUMN IF NOT EXISTS missing_data_office_reminded_at TIMESTAMPTZ;

-- ─── Phase 2: Update Required Flag ───────────────────────────
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS update_required_items JSONB;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS update_required_comment TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS update_required_flagged_by UUID REFERENCES users(user_id);
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS update_required_flagged_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS update_required_snoozed_until TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS update_required_snooze_reason TEXT;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS update_required_tech_marked_done_at TIMESTAMPTZ;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS update_required_office_reminded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_work_orders_update_required 
  ON work_orders(status) 
  WHERE status = 'update_required';

-- ─── Phase 3: Auto-subscribe office/admin to new notification types ──
INSERT INTO notification_subscriptions (user_id, notification_type, enabled, is_default_subscriber)
SELECT 
  u.user_id, 
  t.notification_type, 
  true,
  true
FROM users u
CROSS JOIN (
  VALUES 
    ('update_required_flagged'),
    ('update_required_followed_up'),
    ('missing_data_reminder_24h')
) AS t(notification_type)
WHERE u.role IN ('admin', 'office_staff', 'operations', 'office')
  AND u.is_active = true
ON CONFLICT (user_id, notification_type) DO NOTHING;

-- ─── Verify ──────────────────────────────────────────────────
SELECT 
  column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'work_orders' 
  AND (column_name LIKE 'missing_data_%' OR column_name LIKE 'update_required_%')
ORDER BY column_name;
