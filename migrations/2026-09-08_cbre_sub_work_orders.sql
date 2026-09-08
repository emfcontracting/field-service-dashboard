-- ============================================================================
-- 2026-09-08: CBRE issued 15 sub work orders (Adriana Davis) for the aged-out
-- work of request mails 1 (NTE aged out, 8 WOs) and 3 (cancelled by aging,
-- 7 WOs). All 15 came in with NTE $350 and "BILLING PURPOSES ONLY".
-- ----------------------------------------------------------------------------
-- What this does, per pair (original → sub):
--   1. links them (original.dispute_sub_wo = sub, note on both sides);
--   2. carries the original's lead tech, costs, check-in/out, completion date
--      and technician comments over to the sub WO and marks it completed;
--   3. MOVES the hours (daily_hours_log + work_order_assignments) and the
--      draft invoice to the sub WO — the original is dead at CBRE, the sub WO
--      is what gets invoiced, and moving (not copying) keeps hours counted once;
--   4. zeroes the cost fields on the original (they now live on the sub WO);
--   5. inserts a pending NTE quote on the sub WO for the amount requested in
--      the mail, so /api/cbre/queue-nte-requests queues "Submit NTE Request"
--      for all 15 (Adriana: "You will need to resubmit your NTE requests").
-- Once CBRE approves the NTE, the sub WO becomes "ready" in CBRE Data Entry
-- (cost ≤ NTE) and the Complete request is queued automatically.
-- Request mail 2 (8 WOs, $12,148.33) was refused ("conveyor — contact UPS")
-- and is handled separately (block B below).
-- Re-runnable: every step is guarded.
-- ============================================================================

begin;

drop table if exists _pairs;
create temp table _pairs (orig text, sub text, amount numeric, grp text);
insert into _pairs values
  -- mail 1: NTE increase requests cancelled after 60 days
  ('C2756337', 'C3297218',  1332.25, 'A'),
  ('C2819670', 'B3297226',  6449.50, 'A'),
  ('C2836430', 'C3297237',  2335.00, 'A'),
  ('C2836437', 'C3297241',  1774.70, 'A'),
  ('C2858986', 'C3297245',  2374.75, 'A'),
  ('C2876216', 'B3297249',  1235.36, 'A'),
  ('C2902222', 'B3297271',   450.00, 'A'),
  ('C2947050', 'C3297286', 13843.33, 'A'),
  -- mail 3: completed work cancelled by aging (within original NTE)
  ('C2854850', 'C3297322',   808.00, 'B'),
  ('C2854854', 'C3297330',   384.00, 'B'),
  ('C2875986', 'B3297333',  1184.50, 'B'),
  ('C2879633', 'C3297334',   820.00, 'B'),
  ('C2893978', 'B3297337',  1268.00, 'B'),
  ('P2956259', 'B3297352',   500.00, 'B'),
  ('P2956262', 'B3297357',   498.00, 'B');

-- sanity: all 30 work orders must exist
do $$
declare missing text;
begin
  select string_agg(x, ', ') into missing from (
    select orig as x from _pairs where not exists (select 1 from public.work_orders where wo_number = _pairs.orig)
    union all
    select sub from _pairs where not exists (select 1 from public.work_orders where wo_number = _pairs.sub)
  ) m;
  if missing is not null then raise exception 'missing work orders: %', missing; end if;
end $$;

-- 1) link + notes
update public.work_orders o
   set dispute_sub_wo = p.sub,
       dispute_notes  = concat_ws(E'\n', nullif(btrim(o.dispute_notes), ''),
         '2026-09-08: CBRE issued sub work order ' || p.sub || ' (Adriana Davis, reply to request mail ' || case p.grp when 'A' then '1' else '3' end || '). Hours, costs and the draft invoice were moved to the sub WO; NTE request $' || to_char(p.amount, 'FM999,999.00') || ' queued there.')
  from _pairs p
 where o.wo_number = p.orig
   and o.dispute_sub_wo is distinct from p.sub;

-- 2) carry the original's data over to the sub WO
update public.work_orders s
   set lead_tech_id       = coalesce(s.lead_tech_id, o.lead_tech_id),
       client_type        = coalesce(s.client_type, o.client_type),
       material_cost      = coalesce(o.material_cost, 0),
       emf_equipment_cost = coalesce(o.emf_equipment_cost, 0),
       rental_cost        = coalesce(o.rental_cost, 0),
       trailer_cost       = coalesce(o.trailer_cost, 0),
       time_in            = coalesce(s.time_in, o.time_in),
       time_out           = coalesce(s.time_out, o.time_out),
       date_completed     = coalesce(o.date_completed, (o.time_out at time zone 'America/New_York')::date, o.date_entered),
       status             = 'completed',
       cbre_nte           = coalesce(s.cbre_nte, s.nte, 350),
       comments           = concat_ws(E'\n\n',
                              nullif(btrim(s.comments), ''),
                              '[SUB WORK ORDER — 2026-09-08] Billing sub work order for ' || o.wo_number || ' (' || coalesce(o.building, '') || '). Work performed ' || coalesce(to_char(o.date_completed, 'MM/DD/YYYY'), '—') || '. Hours, costs, check-in/out and the draft invoice were moved here from ' || o.wo_number || '. Requested amount $' || to_char(p.amount, 'FM999,999.00') || '.',
                              case when nullif(btrim(o.comments), '') is not null then '--- Technician comments from ' || o.wo_number || ' ---' || E'\n' || o.comments end)
  from _pairs p
  join public.work_orders o on o.wo_number = p.orig
 where s.wo_number = p.sub
   and (s.comments is null or s.comments not like '%[SUB WORK ORDER — 2026-09-08]%');

-- 3) move hours, team assignments and draft invoices
update public.daily_hours_log d
   set wo_id = s.wo_id
  from _pairs p
  join public.work_orders o on o.wo_number = p.orig
  join public.work_orders s on s.wo_number = p.sub
 where d.wo_id = o.wo_id;

update public.work_order_assignments a
   set wo_id = s.wo_id
  from _pairs p
  join public.work_orders o on o.wo_number = p.orig
  join public.work_orders s on s.wo_number = p.sub
 where a.wo_id = o.wo_id
   and not exists (select 1 from public.work_order_assignments x where x.wo_id = s.wo_id and x.user_id = a.user_id);

update public.invoices i
   set wo_id = s.wo_id,
       notes = concat_ws(E'\n', nullif(btrim(i.notes), ''), 'Re-pointed 2026-09-08 from ' || o.wo_number || ' to CBRE sub work order ' || s.wo_number || '.')
  from _pairs p
  join public.work_orders o on o.wo_number = p.orig
  join public.work_orders s on s.wo_number = p.sub
 where i.wo_id = o.wo_id
   and i.status = 'draft';

-- 4) the originals no longer carry cost (it moved)
update public.work_orders o
   set material_cost = 0, emf_equipment_cost = 0, rental_cost = 0, trailer_cost = 0
  from _pairs p
 where o.wo_number = p.orig
   and (coalesce(o.material_cost,0) + coalesce(o.emf_equipment_cost,0) + coalesce(o.rental_cost,0) + coalesce(o.trailer_cost,0)) > 0;

-- 5) pending NTE quote on every sub WO (→ Approvals tab via queue-nte-requests)
insert into public.work_order_quotes
  (wo_id, created_by, is_verbal_nte, estimated_techs, estimated_rt_hours, estimated_ot_hours,
   material_cost, equipment_cost, rental_cost, trailer_cost, estimated_miles,
   labor_total, materials_with_markup, equipment_with_markup, rental_with_markup, trailer_with_markup, mileage_total,
   grand_total, new_nte_amount, original_nte, sequence_number, nte_status, request_type, description, notes)
select s.wo_id,
       (select user_id from public.users where email = 'jones.emfcontracting@gmail.com' limit 1),
       false, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
       round((p.amount - coalesce(s.nte, 350))::numeric, 2),
       p.amount,
       coalesce(s.nte, 350),
       coalesce((select max(sequence_number) from public.work_order_quotes x where x.wo_id = s.wo_id), 0) + 1,
       'pending', 'estimate',
       'NTE request on CBRE sub work order for completed work — original ' || p.orig || ' (request mail ' || case p.grp when 'A' then '1' else '3' end || ', sub WOs issued 2026-09-08)',
       'Amount as requested from CBRE on 2026-09-05. Sub WO issued with NTE $350; CBRE asked us to resubmit the NTE request.'
  from _pairs p
  join public.work_orders s on s.wo_number = p.sub
 where not exists (select 1 from public.work_order_quotes x
                    where x.wo_id = s.wo_id and x.nte_status in ('pending','submitted') and x.new_nte_amount = p.amount);

-- ── Block B: request mail 2 refused ("conveyor related — contact UPS") ────────
update public.work_orders w
   set dispute_status = 'escalated',
       dispute_reason = 'nte_rejected',
       dispute_notes  = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
         '2026-09-08: CBRE (Adriana Davis) refused a sub work order: "These are all conveyor related issues. You will need to contact UPS for resolution." → escalate to UPS (BaSE / plant engineering).')
 where w.wo_number in ('C2874605','C2876302','C2876328','C2876481','C2879312','C2879589','C2880455','C2911985')
   and (w.dispute_notes is null or w.dispute_notes not like '%2026-09-08: CBRE (Adriana Davis) refused%');

commit;

-- Check
select p.grp, p.orig, p.sub, p.amount,
       s.status, s.nte, s.date_completed,
       (select count(*) from public.daily_hours_log d where d.wo_id = s.wo_id) as hours_rows,
       (select count(*) from public.invoices i where i.wo_id = s.wo_id) as invoices,
       (select count(*) from public.work_order_quotes q where q.wo_id = s.wo_id and q.nte_status = 'pending') as pending_quotes
  from _pairs p join public.work_orders s on s.wo_number = p.sub
 order by p.grp, p.orig;

drop table _pairs;
