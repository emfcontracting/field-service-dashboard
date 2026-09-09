-- ============================================================================
-- 2026-09-09: C3297218 lost its work order number
-- ----------------------------------------------------------------------------
-- work_orders.c00c5d75-3802-4db1-b5a2-94fb4fb4c588 had wo_number = '' — the
-- WO# input in the detail modal saves on blur and had no empty check, so
-- clearing the field wrote an empty string (the guard is in the matching build).
-- Identity is certain: C2756337.dispute_sub_wo = 'C3297218', both approval
-- requests on this wo_id carry wo_number 'C3297218', building SCSMV, imported
-- 2026-09-08. Its draft invoice INV-2026-00342 hangs on this row.
-- Re-runnable (only touches the row while it is still blank).
-- ============================================================================

update public.work_orders
   set wo_number = 'C3297218'
 where wo_id = 'c00c5d75-3802-4db1-b5a2-94fb4fb4c588'
   and coalesce(btrim(wo_number), '') = '';

-- Check: must return exactly one row, C3297218.
select wo_number, building, status, nte, date_entered
  from public.work_orders
 where wo_id = 'c00c5d75-3802-4db1-b5a2-94fb4fb4c588';

-- And: no work order may be left without a number.
select count(*) as work_orders_without_number
  from public.work_orders
 where coalesce(btrim(wo_number), '') = '';
