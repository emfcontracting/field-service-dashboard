-- migrations/add_invoice_paid_at.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Adds paid_at timestamp to invoices so we can track WHEN payment was recorded
-- (useful for year-end reporting and audit trails).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Backfill: existing paid invoices get their created_at as a reasonable estimate
UPDATE invoices
SET paid_at = COALESCE(created_at, NOW())
WHERE status = 'paid' AND paid_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_paid_at
  ON invoices(paid_at DESC)
  WHERE paid_at IS NOT NULL;
