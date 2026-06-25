-- database/migrations/add_nte_increase_chain.sql
-- ============================================================
-- Sequential / cumulative NTE increase requests
-- ============================================================
-- Problem this fixes:
--   Follow-up NTE increases were saved as independent rows that did NOT carry
--   the previous increase's NTE forward. A second request created while the
--   first was still pending (work_orders.nte not yet bumped) ignored the first
--   request's amount entirely.
--
-- Approach (chosen): DECKEN-BASIERT (ceiling-based), cumulative, chained.
--   - sequence_number:     position of the increase within its work order (1 = first)
--   - supersedes_quote_id:  the prior increase this one builds on (the chain link)
--   - submitted_at/by:      records when a written NTE was uploaded to CBRE
--                           (the new 'submitted' status between pending and approved)
--
-- Safe to run multiple times (all IF NOT EXISTS).

-- 1) New chain + CBRE-submission columns
ALTER TABLE work_order_quotes
  ADD COLUMN IF NOT EXISTS sequence_number      INTEGER,
  ADD COLUMN IF NOT EXISTS supersedes_quote_id  UUID REFERENCES work_order_quotes(quote_id),
  ADD COLUMN IF NOT EXISTS submitted_at         TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS submitted_by         VARCHAR(255);

-- 2) Ensure every column the app relies on exists. Some of these were added
--    directly in Supabase and are not present in earlier migration files, so we
--    re-assert them here (idempotent) to keep fresh environments consistent.
ALTER TABLE work_order_quotes
  ADD COLUMN IF NOT EXISTS nte_status             VARCHAR(30) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS new_nte_amount         DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS original_nte           DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS current_costs_snapshot DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS labor_total            DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS materials_with_markup  DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS equipment_with_markup  DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS rental_with_markup     DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS trailer_with_markup    DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS mileage_total          DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS approved_at            TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS approved_by            VARCHAR(255);

-- 3) Backfill sequence_number for existing rows, chronologically per work order.
WITH seq AS (
  SELECT quote_id,
         ROW_NUMBER() OVER (PARTITION BY wo_id ORDER BY created_at ASC) AS rn
  FROM work_order_quotes
)
UPDATE work_order_quotes q
SET sequence_number = seq.rn
FROM seq
WHERE q.quote_id = seq.quote_id
  AND q.sequence_number IS NULL;

-- 4) Index for fast chain lookups
CREATE INDEX IF NOT EXISTS idx_quotes_wo_seq
  ON work_order_quotes(wo_id, sequence_number);

-- 5) Documentation
COMMENT ON COLUMN work_order_quotes.sequence_number IS
  'Position of this NTE increase within its work order (1 = first, 2 = first follow-up, ...).';
COMMENT ON COLUMN work_order_quotes.supersedes_quote_id IS
  'The prior NTE increase this one builds on. New NTE = that increase''s new_nte_amount + this request''s additional work (cumulative chain).';
COMMENT ON COLUMN work_order_quotes.submitted_at IS
  'Timestamp when this written NTE increase was uploaded to CBRE (nte_status = submitted).';
COMMENT ON COLUMN work_order_quotes.submitted_by IS
  'Who uploaded this written NTE increase to CBRE.';
