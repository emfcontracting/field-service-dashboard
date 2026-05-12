-- ============================================================
-- Add Reconciliation Mode to NTE Increase Requests
-- ============================================================
-- Adds support for after-the-fact NTE increase requests where
-- the work has already been completed and we need to reconcile
-- final actual costs against the original NTE.
--
-- - request_type:        'estimate' (default, existing behavior)
--                        OR 'reconciliation' (new, after-the-fact)
-- - actual_final_total:  the final total cost (with markup) of completed work
-- - actual_*:            broken-down actual cost values (for audit trail)
-- ============================================================

ALTER TABLE work_order_quotes
  ADD COLUMN IF NOT EXISTS request_type VARCHAR(20) DEFAULT 'estimate',
  ADD COLUMN IF NOT EXISTS actual_final_total DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS actual_rt_hours DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS actual_ot_hours DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS actual_miles DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS actual_material_cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS actual_equipment_cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS actual_rental_cost DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS actual_trailer_cost DECIMAL(10,2);

-- Backfill existing rows to 'estimate' (safe default)
UPDATE work_order_quotes
  SET request_type = 'estimate'
  WHERE request_type IS NULL;

-- Index for filtering / reporting
CREATE INDEX IF NOT EXISTS idx_quotes_request_type
  ON work_order_quotes(request_type);

COMMENT ON COLUMN work_order_quotes.request_type IS
  'Type of NTE request: ''estimate'' (forward-looking, default) or ''reconciliation'' (after-the-fact, work already completed)';

COMMENT ON COLUMN work_order_quotes.actual_final_total IS
  'For reconciliation mode: the final actual total cost (with markup applied) of completed work';
