-- migrations/add_wo_dispute_tracking.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- UPS Escalation / CBRE Dispute Tracking
-- Adds parallel dispute lifecycle to work_orders so we can track WOs where
-- CBRE cancelled / closed without paying — these need follow-up via UPS direct.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS dispute_status        TEXT,          -- null | 'open' | 'escalated' | 'resolved' | 'written_off'
  ADD COLUMN IF NOT EXISTS dispute_reason        TEXT,          -- 'cbre_cancelled' | 'closed_inactivity' | 'other'
  ADD COLUMN IF NOT EXISTS dispute_notes         TEXT,          -- free text notes / UPS communication log
  ADD COLUMN IF NOT EXISTS dispute_opened_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_escalated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_resolved_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispute_amount        NUMERIC,       -- captured estimated $ at dispute time (for stats)
  ADD COLUMN IF NOT EXISTS dispute_recovered_amount NUMERIC;    -- actual recovered (filled in when marking resolved)

-- Constraint: dispute_status only allows valid values
ALTER TABLE work_orders
  DROP CONSTRAINT IF EXISTS work_orders_dispute_status_check;

ALTER TABLE work_orders
  ADD CONSTRAINT work_orders_dispute_status_check
  CHECK (dispute_status IS NULL OR dispute_status IN ('open', 'escalated', 'resolved', 'written_off'));

-- Index for the UPS Escalation view query
CREATE INDEX IF NOT EXISTS idx_wo_dispute_status
  ON work_orders(dispute_status)
  WHERE dispute_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wo_dispute_opened_at
  ON work_orders(dispute_opened_at DESC)
  WHERE dispute_opened_at IS NOT NULL;
