-- ============================================================
-- backfill_tech_material_drafts.sql
--
-- FIX: backfill missing tech-material on DRAFT invoices only.
--
-- Background: the invoice PREVIEW path (app/invoices/page.js
-- generateInvoicePreview) used to bill only EMF material
-- (work_orders.material_cost) and ignored tech material logged in
-- daily_hours_log.tech_material_cost. The server path
-- (/api/invoices/generate) already included it. This script repairs
-- the gap on invoices that are still DRAFT (not yet at CBRE).
--
-- SAFETY:
--   - Touches ONLY status = 'draft'. Anything approved/accepted/
--     synced/paid is already at CBRE and must NOT be changed here.
--   - Idempotent: guarded by the "Materials (tech-supplied)" marker,
--     so re-running does nothing.
--   - Adds the under-billed amount as a line item, then re-syncs the
--     invoice subtotal + total from the line items.
-- ============================================================

-- Step 1 — add the corrective material line to under-billed drafts
WITH tech_mat AS (
  SELECT wo_id, COALESCE(SUM(tech_material_cost), 0) AS tech_material
  FROM daily_hours_log
  GROUP BY wo_id
),
billed_mat AS (
  SELECT invoice_id, COALESCE(SUM(amount), 0) AS material_billed
  FROM invoice_line_items
  WHERE line_type = 'material'
  GROUP BY invoice_id
),
to_fix AS (
  SELECT
    i.invoice_id,
    ROUND(
      (COALESCE(wo.material_cost, 0) + COALESCE(tm.tech_material, 0)) * 1.25
      - COALESCE(bm.material_billed, 0)
    , 2) AS shortfall
  FROM invoices i
  JOIN work_orders  wo ON wo.wo_id = i.wo_id
  LEFT JOIN tech_mat   tm ON tm.wo_id = i.wo_id
  LEFT JOIN billed_mat bm ON bm.invoice_id = i.invoice_id
  WHERE i.status = 'draft'
    AND (COALESCE(wo.material_cost, 0) + COALESCE(tm.tech_material, 0)) * 1.25
        - COALESCE(bm.material_billed, 0) > 0.01
    AND NOT EXISTS (
      SELECT 1 FROM invoice_line_items li
      WHERE li.invoice_id = i.invoice_id
        AND li.description = 'Materials (tech-supplied)'
    )
)
INSERT INTO invoice_line_items (invoice_id, description, quantity, unit_price, amount, line_type)
SELECT invoice_id, 'Materials (tech-supplied)', 1, shortfall, shortfall, 'material'
FROM to_fix;

-- Step 2 — re-sync subtotal + total on the drafts we just touched
UPDATE invoices i
SET subtotal = sub.s,
    total    = sub.s + COALESCE(i.tax, 0)
FROM (
  SELECT invoice_id, ROUND(SUM(amount), 2) AS s
  FROM invoice_line_items
  GROUP BY invoice_id
) sub
WHERE sub.invoice_id = i.invoice_id
  AND i.status = 'draft'
  AND EXISTS (
    SELECT 1 FROM invoice_line_items li
    WHERE li.invoice_id = i.invoice_id
      AND li.description = 'Materials (tech-supplied)'
  );
