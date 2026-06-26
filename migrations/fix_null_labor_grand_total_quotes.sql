-- ============================================================================
-- Fix NTE increase quotes where labor_total / grand_total were saved as NULL
-- ============================================================================
-- Root cause: calculateQuoteTotals() (mobile/services/quoteService.js) and
-- calcAdditional() (dashboard/components/NTEIncreaseModal.js) used bare
-- parseFloat() on the hours/cost inputs WITHOUT a `|| 0` guard. When a user
-- left a field blank (e.g. typed only OT hours and left RT empty),
-- parseFloat("") returns NaN, and NaN + anything = NaN. That NaN flowed into
-- labor_total and grand_total, and Supabase writes NaN to a numeric column as
-- NULL.
--
-- new_nte_amount was NOT affected: it comes from the page's projected_total,
-- whose own calc already guarded NaN with `|| 0`. That is why a quote can show
-- a correct new_nte_amount (e.g. 2264.00) while labor_total / grand_total are
-- NULL, and the dashboard card then recomputes a WRONG "NEW NTE" from the NULL
-- line items (treated as 0).
--
-- Code is now fixed (every parseFloat guarded). This backfill repairs existing
-- rows by recomputing labor_total and grand_total from the stored hours +
-- already-correct markup line items.
--
-- Idempotent + safe: only touches rows where labor_total or grand_total is NULL,
-- and never a reconciliation quote (those use a different, already-guarded calc).
-- Labor rates: RT $64/hr, OT $96/hr.
-- ============================================================================

UPDATE work_order_quotes
SET
  labor_total = (COALESCE(estimated_rt_hours, 0) * COALESCE(estimated_techs, 1) * 64)
              + (COALESCE(estimated_ot_hours, 0) * COALESCE(estimated_techs, 1) * 96),
  grand_total = (COALESCE(estimated_rt_hours, 0) * COALESCE(estimated_techs, 1) * 64)
              + (COALESCE(estimated_ot_hours, 0) * COALESCE(estimated_techs, 1) * 96)
              + COALESCE(materials_with_markup, 0)
              + COALESCE(equipment_with_markup, 0)
              + COALESCE(rental_with_markup, 0)
              + COALESCE(trailer_with_markup, 0)
              + COALESCE(mileage_total, 0)
WHERE (labor_total IS NULL OR grand_total IS NULL)
  AND (request_type IS NULL OR request_type <> 'reconciliation');

-- ---------------------------------------------------------------------------
-- Verify (optional): the affected WO should now show labor_total = 1536.00 and
-- grand_total = 2136.00, matching new_nte_amount = 2264.00 (128 snapshot + 2136).
-- ---------------------------------------------------------------------------
-- SELECT quote_id, estimated_rt_hours, estimated_ot_hours, estimated_techs,
--        labor_total, grand_total, current_costs_snapshot, new_nte_amount
-- FROM work_order_quotes
-- WHERE wo_id = (SELECT wo_id FROM work_orders WHERE wo_number = 'C3180828');
