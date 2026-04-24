-- migrations/add_cbre_status_acknowledged.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds CBRE status change acknowledgment tracking.
-- A work order has an "unacknowledged CBRE update" when:
--     cbre_status_updated_at > COALESCE(cbre_status_acknowledged_at, '-infinity')
-- The dashboard shows a persistent marker on these WOs until the user clicks
-- "Acknowledge" — the marker doesn't auto-dismiss like a toast.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add acknowledgment column
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS cbre_status_acknowledged_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN work_orders.cbre_status_acknowledged_at IS
  'Timestamp when office acknowledged the CBRE status change. Compared with cbre_status_updated_at to determine if a change is unacknowledged.';

-- 2. Backfill: existing CBRE statuses count as "already acknowledged" at install time
--    (otherwise every existing WO with a CBRE status would suddenly show as unacknowledged)
UPDATE work_orders
SET cbre_status_acknowledged_at = COALESCE(cbre_status_updated_at, NOW())
WHERE cbre_status_updated_at IS NOT NULL
  AND cbre_status_acknowledged_at IS NULL;

-- 3. Index for fast lookup of WOs with unacknowledged updates
CREATE INDEX IF NOT EXISTS idx_work_orders_cbre_unack
  ON work_orders(cbre_status_updated_at, cbre_status_acknowledged_at)
  WHERE cbre_status_updated_at IS NOT NULL;
