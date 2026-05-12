-- ============================================================
-- Fix existing C3011610 NTE quote that was created BEFORE
-- Reconciliation Mode existed in the UI.
--
-- Context:
--   - Original NTE: $2,500.00
--   - Final actual costs from work performed: $3,021.95
--   - Overage (additional needed): $521.95
--   - New NTE required: $3,021.95
--
-- The quote was incorrectly saved as 'estimate' mode where Daniel
-- entered the final totals into the "Additional Work" fields,
-- which led to the confusing PDF showing the same number twice.
--
-- This migration:
--   1. Flips request_type to 'reconciliation'
--   2. Copies the totals into the actual_* columns
--   3. Sets actual_final_total = $3021.95
--   4. Sets grand_total = the overage ($521.95)
--
-- NOTE: wo_id is UUID in this schema (not INTEGER)
-- ============================================================

DO $$
DECLARE
  v_quote_id UUID;
  v_wo_id UUID;
  v_final_total DECIMAL(10,2);
  v_original_nte DECIMAL(10,2);
  v_overage DECIMAL(10,2);
BEGIN
  -- Find the work order
  SELECT wo_id INTO v_wo_id
    FROM work_orders
    WHERE wo_number = 'C3011610'
    LIMIT 1;

  IF v_wo_id IS NULL THEN
    RAISE NOTICE 'Work order C3011610 not found. Aborting.';
    RETURN;
  END IF;

  -- Find the latest NTE quote for that WO
  SELECT quote_id INTO v_quote_id
    FROM work_order_quotes
    WHERE wo_id = v_wo_id
    ORDER BY created_at DESC
    LIMIT 1;

  IF v_quote_id IS NULL THEN
    RAISE NOTICE 'No NTE quote found for C3011610. Aborting.';
    RETURN;
  END IF;

  -- Final actual total = the previously-stored value (could be in any of these fields)
  SELECT
    COALESCE(current_costs_snapshot, grand_total, new_nte_amount, 0),
    COALESCE(original_nte, 2500)
  INTO v_final_total, v_original_nte
  FROM work_order_quotes
  WHERE quote_id = v_quote_id;

  v_overage := GREATEST(0, v_final_total - v_original_nte);

  RAISE NOTICE 'Fixing quote % for WO C3011610:', v_quote_id;
  RAISE NOTICE '  Final Actual Total: $%', v_final_total;
  RAISE NOTICE '  Original NTE:       $%', v_original_nte;
  RAISE NOTICE '  Overage:            $%', v_overage;

  UPDATE work_order_quotes
  SET
    request_type           = 'reconciliation',

    -- Store the actual totals in the actual_* columns
    actual_final_total     = v_final_total,
    actual_rt_hours        = COALESCE(estimated_rt_hours, 0),
    actual_ot_hours        = COALESCE(estimated_ot_hours, 0),
    actual_miles           = COALESCE(estimated_miles, 0),
    actual_material_cost   = COALESCE(material_cost, 0),
    actual_equipment_cost  = COALESCE(equipment_cost, 0),
    actual_rental_cost     = COALESCE(rental_cost, 0),
    actual_trailer_cost    = COALESCE(trailer_cost, 0),

    -- new_nte_amount = the final total (this is the new budget required)
    new_nte_amount         = v_final_total,

    -- grand_total = the OVERAGE (the actual NTE increase being requested)
    grand_total            = v_overage,

    -- Make sure original_nte is set
    original_nte           = v_original_nte,

    updated_at             = NOW()
  WHERE quote_id = v_quote_id;

  RAISE NOTICE 'Quote % updated to reconciliation mode.', v_quote_id;
END $$;

-- Verify the fix
SELECT
  wq.quote_id,
  wo.wo_number,
  wq.request_type,
  wq.original_nte,
  wq.actual_final_total,
  wq.new_nte_amount,
  wq.grand_total                              AS overage_requested,
  wq.is_verbal_nte,
  wq.nte_status
FROM work_order_quotes wq
JOIN work_orders wo ON wo.wo_id = wq.wo_id
WHERE wo.wo_number = 'C3011610'
ORDER BY wq.created_at DESC;
