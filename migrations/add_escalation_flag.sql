-- migrations/add_escalation_flag.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Splits "escalation" out of cbre_status into its own independent overlay flag.
--
-- Problem this fixes:
--   escalation was one of the possible values of the single cbre_status field.
--   The Gmail label sync applies "newest email wins" to cbre_status, so an
--   incoming Escalation email would OVERWRITE a real lifecycle status that must
--   be kept (e.g. quote_approved). Escalation is not a lifecycle state — it is a
--   priority flag that can be true alongside ANY status. So it gets its own
--   column and never touches cbre_status again.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Flag columns
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS escalation                 BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalation_updated_at      TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS escalation_acknowledged_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN work_orders.escalation IS
  'Priority/attention overlay flag. Independent of cbre_status — an escalation never overwrites the lifecycle status.';
COMMENT ON COLUMN work_orders.escalation_updated_at IS
  'When the escalation flag was last raised (set true).';
COMMENT ON COLUMN work_orders.escalation_acknowledged_at IS
  'When office acknowledged / cleared the escalation. Compared with escalation_updated_at for the unacknowledged marker.';

-- 2. Backfill: any WO currently parked at cbre_status = 'escalation' had its real
--    lifecycle status clobbered by an escalation email. Raise the flag and clear
--    the polluted status. The prior lifecycle status is unrecoverable here, but
--    the next Gmail sync + the new sticky-rank logic will keep it correct going
--    forward, and escalation will no longer destroy it.
UPDATE work_orders
SET escalation                 = true,
    escalation_updated_at      = COALESCE(cbre_status_updated_at, NOW()),
    escalation_acknowledged_at = cbre_status_acknowledged_at,
    cbre_status                = NULL
WHERE cbre_status = 'escalation';

-- 3. Partial index for fast "show me all escalated WOs" lookups
CREATE INDEX IF NOT EXISTS idx_work_orders_escalation
  ON work_orders (escalation)
  WHERE escalation = true;
