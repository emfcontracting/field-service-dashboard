-- ============================================================================
-- 2026-09-06: Restore Matthew Sweet's team hours lost in the 2025-12-02 migration
-- ----------------------------------------------------------------------------
-- Finding: 18 invoices carry more labor hours than the work orders hold today.
-- Every other technician's legacy work_order_assignments hours were copied into
-- daily_hours_log on 2025-12-02 ('[MIGRATED] Legacy total hours from team');
-- Matthew Sweet (helper, now inactive) got 0 rows for his 29 assignments and
-- none were added later. He is the only technician without a log row on 17 of
-- the 18 work orders (ST2827656 is the exception — see block B).
-- Block A re-creates his hours as the difference invoiced − currently logged
-- (per WO, one row on the completion date). Invoices themselves are untouched.
-- Block B lists the WOs where another tech is also missing a row — decide by hand.
-- Re-runnable: rows are tagged '[RESTORED 2026-09-06]' and skipped if present.
-- ============================================================================

-- Block A — automatic
insert into public.daily_hours_log (wo_id, user_id, work_date, hours_regular, hours_overtime, miles, notes)
select v.wo_id::uuid, '0373f7de-2f2e-43a3-a95b-094487522d0c'::uuid, v.work_date::date, v.rt, v.ot, v.mi,
       '[RESTORED 2026-09-06] Team hours lost in the 2025-12-02 migration (inactive user); = invoice ' || v.inv || ' minus logged hours'
from (values
  ('e0dd5bde-4d58-4677-9216-db6bc099015c', '2025-10-15', 5.0, 0.0, 25.0, 'INV-2025-00005'),   -- C2863812 (paid)
  ('c2b2c2d8-3c99-4fe7-946b-dbb809c30951', '2025-11-14', 9.0, 2.5, 344.0, 'INV-2025-00009'),   -- C2899423 (accepted)
  ('431e3559-9bbd-4324-b5bc-f62998ca4370', '2025-11-07', 3.0, 0.5, 116.0, 'INV-2025-00023'),   -- C2890984 (accepted)
  ('ed831f55-b96b-4193-8c3a-ac6cad023725', '2025-11-11', 6.5, 0.0, 66.0, 'INV-2025-00034'),   -- C2892614 (accepted)
  ('72e4877d-273d-4b9c-9118-b1ace1fcb138', '2025-11-20', 3.5, 0.0, 116.0, 'INV-2025-00036'),   -- C2891001 (accepted)
  ('e9fd3598-da1c-4e4f-bfbc-462ab769facd', '2026-01-29', 5.75, 0.0, 232.0, 'INV-2026-00334'),   -- C2893978 (draft)
  ('083805f2-dd9c-4471-b056-fb50e4daf5de', '2026-01-13', 17.5, 4.75, 683.0, 'INV-2026-00328'),   -- C2876302 (draft)
  ('3a155dcb-646d-466f-82de-67ffa8d7621f', '2025-12-06', 17.5, 1.0, 580.0, 'INV-2026-00370'),   -- C2891401 (draft)
  ('6e280aa7-35b9-41b3-bd90-3a4cde89d464', '2026-05-12', 16.5, 2.25, 502.0, 'INV-2026-00380'),   -- C2872271 (accepted)
  ('8bb38fc9-7c8e-479d-b3a7-c82ce614d28f', '2026-03-04', 7.5, 0.5, 374.0, 'INV-2026-00385'),   -- C2907735 (accepted)
  ('cd49f959-8d5c-460b-af03-088867c84c83', '2025-10-14', 23.75, 5.0, 767.0, 'INV-2026-00427')   -- PJ2862254 (accepted)
) as v(wo_id, work_date, rt, ot, mi, inv)
where not exists (select 1 from public.daily_hours_log d where d.wo_id = v.wo_id::uuid and d.user_id = '0373f7de-2f2e-43a3-a95b-094487522d0c'::uuid and d.notes like '[RESTORED 2026-09-06]%');

-- Block B — manual decision (missing RT / OT / miles; who else has no log row)
--   ST2827656  INV-2025-00012 (accepted): missing 5.0 RT / 5.0 OT / 225.0 mi — candidates: none (assignment rows deleted?)
--   C2879338   INV-2025-00031 (accepted): missing 17.5 RT / 2.75 OT / 440.0 mi — candidates: Matthew J White, Brad Glover, Matthew Sweet
--   C2854850   INV-2026-00335 (draft): missing 6.0 RT / 0.0 OT / 168.0 mi — candidates: Matthew Sweet, Michael Bell
--   C2879589   INV-2026-00333 (draft): missing 5.5 RT / 2.75 OT / 407.0 mi — candidates: Matthew Sweet, Daniel Jones
--   C2836437   INV-2026-00359 (draft): missing 8.5 RT / 1.5 OT / 50.0 mi — candidates: Matthew J White, Matthew Sweet, ADMIN
--   C2836430   INV-2026-00375 (draft): missing 16.75 RT / 0.0 OT / 125.0 mi — candidates: Matthew J White, Matthew Sweet, Daniel Jones
--   C2895639   INV-2026-00382 (accepted): missing 0.25 RT / 0.0 OT / 0.0 mi — candidates: Matthew Sweet, Daniel Jones

-- Check
select w.wo_number, sum(d.hours_regular) rt, sum(d.hours_overtime) ot, sum(d.miles) mi
from public.daily_hours_log d join public.work_orders w on w.wo_id = d.wo_id
where d.notes like '[RESTORED 2026-09-06]%' group by 1 order by 1;
