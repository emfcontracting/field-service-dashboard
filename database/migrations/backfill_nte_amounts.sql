-- ============================================================
-- Backfill: Recompute new_nte_amount for ALL existing quotes
-- to fix any stored values that became stale after line item edits.
--
-- Logic:
--   - For ESTIMATE mode quotes:
--       new_nte_amount = current_costs_snapshot + (sum of line items)
--       grand_total    = sum of line items (additional work only)
--
--   - For RECONCILIATION mode quotes:
--       new_nte_amount     = actual_final_total (or sum of line items if missing)
--       grand_total        = MAX(0, actual_final_total - original_nte)
--       actual_final_total = sum of line items (kept in sync)
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  v_line_items_total DECIMAL(10,2);
  v_snapshot DECIMAL(10,2);
  v_original_nte DECIMAL(10,2);
  v_new_nte DECIMAL(10,2);
  v_grand_total DECIMAL(10,2);
  v_count INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT
      quote_id,
      request_type,
      current_costs_snapshot,
      original_nte,
      labor_total,
      materials_with_markup,
      equipment_with_markup,
      rental_with_markup,
      trailer_with_markup,
      mileage_total,
      new_nte_amount AS old_new_nte,
      grand_total    AS old_grand_total
    FROM work_order_quotes
  LOOP
    -- Sum of line items
    v_line_items_total :=
      COALESCE(rec.labor_total, 0) +
      COALESCE(rec.materials_with_markup, 0) +
      COALESCE(rec.equipment_with_markup, 0) +
      COALESCE(rec.rental_with_markup, 0) +
      COALESCE(rec.trailer_with_markup, 0) +
      COALESCE(rec.mileage_total, 0);

    v_snapshot     := COALESCE(rec.current_costs_snapshot, 0);
    v_original_nte := COALESCE(rec.original_nte, 0);

    IF rec.request_type = 'reconciliation' THEN
      -- Reconciliation: line items = actual final breakdown
      v_new_nte     := v_line_items_total;
      v_grand_total := GREATEST(0, v_line_items_total - v_original_nte);

      UPDATE work_order_quotes
      SET new_nte_amount     = v_new_nte,
          grand_total        = v_grand_total,
          actual_final_total = v_line_items_total,
          updated_at         = NOW()
      WHERE quote_id = rec.quote_id;
    ELSE
      -- Estimate (or NULL → default): new_nte = snapshot + additional
      v_new_nte     := v_snapshot + v_line_items_total;
      v_grand_total := v_line_items_total;

      UPDATE work_order_quotes
      SET new_nte_amount = v_new_nte,
          grand_total    = v_grand_total,
          updated_at     = NOW()
      WHERE quote_id = rec.quote_id;
    END IF;

    -- Log only quotes that actually changed
    IF rec.old_new_nte IS DISTINCT FROM v_new_nte
       OR rec.old_grand_total IS DISTINCT FROM v_grand_total THEN
      v_count := v_count + 1;
      RAISE NOTICE 'Quote %: new_nte % -> %, grand_total % -> % (type: %)',
        rec.quote_id,
        COALESCE(rec.old_new_nte, 0),
        v_new_nte,
        COALESCE(rec.old_grand_total, 0),
        v_grand_total,
        COALESCE(rec.request_type, 'estimate');
    END IF;
  END LOOP;

  RAISE NOTICE '--- Done. % quotes updated. ---', v_count;
END $$;

-- Verify: show all quotes for the problematic WOs to confirm
SELECT
  wo.wo_number,
  wq.request_type,
  wq.current_costs_snapshot,
  wq.original_nte,
  (COALESCE(wq.labor_total, 0)
    + COALESCE(wq.materials_with_markup, 0)
    + COALESCE(wq.equipment_with_markup, 0)
    + COALESCE(wq.rental_with_markup, 0)
    + COALESCE(wq.trailer_with_markup, 0)
    + COALESCE(wq.mileage_total, 0))         AS line_items_total,
  wq.new_nte_amount,
  wq.grand_total,
  wq.actual_final_total
FROM work_order_quotes wq
JOIN work_orders wo ON wo.wo_id = wq.wo_id
WHERE wo.wo_number IN ('C3011610', 'C3132765')
ORDER BY wo.wo_number, wq.created_at DESC;
