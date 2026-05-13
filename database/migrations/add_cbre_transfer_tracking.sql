-- ============================================================
-- CBRE Manual Data Transfer Tracking
-- ============================================================
-- Tracks two types of transfers that the office assistant manually
-- enters into the CBRE web portal:
--
-- 1. DAILY CHECK-OUTS: Each daily_hours_log entry needs to be transferred
--    to CBRE (check-in/check-out times + hours). One pending per log entry.
--
-- 2. COMPLETIONS: When a work order is marked completed, CBRE needs to be
--    notified. One pending per work_order.
--
-- All existing data starts as NOT transferred (per Daniel's request 1c).
-- Office staff will sort through manually.
-- ============================================================

-- Daily hours log: per-entry transfer tracking
ALTER TABLE daily_hours_log
  ADD COLUMN IF NOT EXISTS cbre_transferred       BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cbre_transferred_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cbre_transferred_by    UUID        REFERENCES users(user_id);

-- Work orders: completion transfer tracking
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS completion_transferred       BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS completion_transferred_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completion_transferred_by    UUID        REFERENCES users(user_id);

-- Partial indexes for fast "pending" counts (only index FALSE rows)
CREATE INDEX IF NOT EXISTS idx_daily_hours_cbre_pending
  ON daily_hours_log (work_date DESC)
  WHERE cbre_transferred = FALSE;

CREATE INDEX IF NOT EXISTS idx_work_orders_completion_pending
  ON work_orders (date_completed DESC)
  WHERE completion_transferred = FALSE AND status = 'completed';

-- Column comments for clarity
COMMENT ON COLUMN daily_hours_log.cbre_transferred IS
  'TRUE once the office assistant has entered this check-out into the CBRE web portal.';
COMMENT ON COLUMN work_orders.completion_transferred IS
  'TRUE once the office assistant has notified CBRE that the work order is completed.';
