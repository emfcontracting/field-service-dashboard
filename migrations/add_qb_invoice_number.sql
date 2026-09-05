-- migrations/add_qb_invoice_number.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- QuickBooks invoice number as a second, searchable invoice identifier.
-- QB is the invoicing system of record (bank-connected); FSM mirrors the QB
-- number so WOs/invoices are identifiable both ways, and tracks payment via
-- the CBRE Coupa "marked as Paid" emails (see /api/invoice-payments/cron).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS qb_invoice_number TEXT;

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS qb_invoice_number TEXT;

CREATE INDEX IF NOT EXISTS idx_invoices_qb_invoice_number
  ON invoices(qb_invoice_number)
  WHERE qb_invoice_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_qb_invoice_number
  ON work_orders(qb_invoice_number)
  WHERE qb_invoice_number IS NOT NULL;
