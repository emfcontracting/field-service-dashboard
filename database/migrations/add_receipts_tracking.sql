-- ─────────────────────────────────────────────────────────────────────────────
-- Add receipts tracking to work_orders (mirrors photos_received and writeups_received)
--
-- Photos and PMI write-ups already had DB tracking + verify APIs since the
-- mobile app's completion checklist enforced them. Receipts were sent via
-- email but never tracked, so the office (and now the dashboard) had no way
-- to see whether a tech had submitted material receipts.
--
-- These columns are written by:
--   • /api/verify-receipts/[woNumber] — IMAP search of emfcbre@gmail.com inbox
--   • Manual override POST to the same endpoint
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS receipts_received      BOOLEAN     DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS receipts_verified_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS receipts_email_subject TEXT;

-- Helpful index for dashboard filtering (e.g. "show WOs missing receipts")
CREATE INDEX IF NOT EXISTS idx_work_orders_receipts_received
  ON work_orders(receipts_received)
  WHERE receipts_received = FALSE;

COMMENT ON COLUMN work_orders.receipts_received      IS 'TRUE once material receipts have been emailed to emfcbre@gmail.com (verified via IMAP)';
COMMENT ON COLUMN work_orders.receipts_verified_at   IS 'Last time the receipts inbox was checked for this WO (cache invalidation)';
COMMENT ON COLUMN work_orders.receipts_email_subject IS 'Subject of the most recent receipts email found (for traceability)';
