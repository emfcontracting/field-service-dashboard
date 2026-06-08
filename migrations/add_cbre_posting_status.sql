-- migrations/add_cbre_posting_status.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- CBRE POSTING STATUS
--
-- Adds a SEPARATE status track on work_orders for the CBRE-side processing
-- chain that happens AFTER a tech completes the work:
--
--   CPW → CIS → CIR → CA1 → CA2 → CMP
--
-- This is DISTINCT from work_orders.cbre_status (which is for ACTIVE tickets:
-- escalation, quote_approved, pending_quote, etc.). Do not confuse the two.
--
-- Populated by the weekly CBRE Sync sheet upload. Only meaningful once the WO
-- has been completed by the tech.
--
-- Run in Supabase SQL Editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS cbre_posting_status       TEXT,        -- CPW / CIS / CIR / CA1 / CA2 / CMP
  ADD COLUMN IF NOT EXISTS cbre_posting_label        TEXT,        -- full label from the sheet
  ADD COLUMN IF NOT EXISTS cbre_posting_updated_at   TIMESTAMPTZ, -- when this posting status was last set
  ADD COLUMN IF NOT EXISTS cmp_date                  DATE;        -- date CMP was first seen (payout = +75d)

-- Fast lookup / filtering by posting status
CREATE INDEX IF NOT EXISTS idx_work_orders_cbre_posting_status
  ON work_orders(cbre_posting_status)
  WHERE cbre_posting_status IS NOT NULL;

-- Fast lookup for CMP payout countdown
CREATE INDEX IF NOT EXISTS idx_work_orders_cmp_date
  ON work_orders(cmp_date)
  WHERE cmp_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verify
-- ─────────────────────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'work_orders'
  AND column_name IN ('cbre_posting_status', 'cbre_posting_label', 'cbre_posting_updated_at', 'cmp_date')
ORDER BY column_name;
