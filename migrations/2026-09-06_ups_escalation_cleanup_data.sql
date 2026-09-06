-- ============================================================================
-- 2026-09-06: UPS Escalation — one-time data cleanup after the CBRE reconciliation
-- ----------------------------------------------------------------------------
-- Requires 2026-09-06_dispute_sub_wo.sql (status 'sub_wo_requested', columns
-- dispute_requested_at / dispute_sub_wo). Each block is self-contained; run the
-- Mail-2 / Mail-3 blocks on the day those e-mails go out. Re-runnable.
-- Source: C:\FSM\docs\UPS-Escalation-Abgleich-2026-09-06.xlsx
-- ============================================================================

-- ============================================================================
-- Block 1 — Group A: NTE request → cancelled by aging. Mail 1 to Adriana Davis
-- was sent 2026-09-06. dispute_amount = amount requested in that e-mail.
-- ============================================================================
with amt(wo_number, requested) as (values
  ('C2756337', 1332.25), ('C2819670', 6449.50), ('C2836430', 2335.00), ('C2836437', 1774.70),
  ('C2858986', 2374.75), ('C2876216', 1235.36), ('C2902222',  450.00), ('C2947050', 13843.33))
update public.work_orders w
   set dispute_status       = 'sub_wo_requested',
       dispute_reason       = 'closed_inactivity',
       dispute_requested_at = coalesce(w.dispute_requested_at, '2026-09-06'::timestamptz),
       dispute_amount       = a.requested,
       dispute_notes        = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
         '9/6/2026 — Cancelled by CBRE "aging past 60 days" after our NTE increase request. Sub-WO requested from Adriana Davis (e-mail 1, 8 WOs, $29,794.89). Requested: $' || to_char(a.requested, 'FM999,999.00'))
  from amt a
 where w.wo_number = a.wo_number
   and w.dispute_status is distinct from 'resolved';

-- ============================================================================
-- Block 2 — Group C: closed for inactivity >90 days, CMP without invoice.
-- >>> Run on the day Mail 2 (8 WOs, $12,148.33) is sent. <<<
-- ============================================================================
update public.work_orders w
   set dispute_status       = 'sub_wo_requested',
       dispute_reason       = 'closed_inactivity',
       dispute_requested_at = coalesce(w.dispute_requested_at, now()),
       dispute_notes        = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
         to_char(now(), 'FMMM/FMDD/YYYY') || ' — Closed by CBRE "Inactivity > 90 days" (CMP, no invoice, not on Invoicing page). Sub-WO requested from Adriana Davis (e-mail 2, 8 WOs, $12,148.33).')
 where w.wo_number in ('C2874605','C2876302','C2876328','C2876481','C2879312','C2879589','C2880455','C2911985')
   and w.dispute_status is distinct from 'resolved';

-- ============================================================================
-- Block 3 — Group B: cancelled by aging, no NTE request, hours logged.
-- >>> Run on the day Mail 3 (7 WOs, $5,462.50) is sent. <<<
-- ============================================================================
update public.work_orders w
   set dispute_status       = 'sub_wo_requested',
       dispute_reason       = 'closed_inactivity',
       dispute_requested_at = coalesce(w.dispute_requested_at, now()),
       dispute_notes        = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
         to_char(now(), 'FMMM/FMDD/YYYY') || ' — Cancelled by CBRE "aging past 60 days" 4/8/2026, work was completed. Sub-WO requested from Adriana Davis (e-mail 3, 7 WOs, $5,462.50).')
 where w.wo_number in ('C2854850','C2854854','C2875986','C2879633','C2893978','P2956259','P2956262')
   and w.dispute_status is distinct from 'resolved';

-- Two cancelled WOs that need a look before anyone asks CBRE for a sub-WO:
update public.work_orders w
   set dispute_reason = 'cbre_cancelled',
       dispute_notes  = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
         '9/6/2026 — CBRE cancelled 11/18/2025: "Vendor is using C2899423 for the issue". C2899423 is invoiced (INV-2026-00009, $2,550 accepted). Verify whether the 11.5 h logged 12/8/2025 belong to C2899423 before requesting anything.')
 where w.wo_number = 'C2902272';
update public.work_orders w
   set dispute_reason = 'cbre_cancelled',
       dispute_notes  = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
         '9/6/2026 — Cancelled by FM Patrick 11/13/2025 "Service no longer needed"; 2 h logged 2/18/2026 (Brad, Stephen). Check whether the hours belong to another WO. Not included in the sub-WO e-mails.')
 where w.wo_number = 'PJ2876508';

-- Missing from the tracker: aging-cancelled with 1 h logged (2 techs), no invoice.
update public.work_orders w
   set dispute_status    = coalesce(w.dispute_status, 'open'),
       dispute_reason    = coalesce(w.dispute_reason, 'closed_inactivity'),
       dispute_opened_at = coalesce(w.dispute_opened_at, now()),
       dispute_amount    = coalesce(w.dispute_amount, 0),
       dispute_notes     = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
         '9/6/2026 — Cancelled by CBRE "aging past 60 days" 4/8/2026; 1 h (Ariel, Federik) 12/17/2025, no invoice. Small — write off or add to a later sub-WO request.')
 where w.wo_number = 'C2935505';

-- ============================================================================
-- Block 4 — Group D: CPW (CBRE waits for our invoice) but NTE too low.
-- Not disputes: they go through the normal NTE-increase flow. A written
-- quote (nte_status = pending) is created per WO; the fixed producer queues
-- the "Submit NTE Request" form in the Approvals tab.
-- ============================================================================
-- FSM `nte` on these seven carries verbal approvals that never reached the
-- portal (e.g. C2876507: FSM 5,000 vs CBRE 1,680). cbre_nte = the NTE as CBRE
-- has it today (Est. Service Cost on ViewWODetails); the producer compares
-- against it.
with q(wo_number, cbre_nte, new_nte, note) as (values
  ('C3115553', 1000.00, 1604.00, 'NTE increase to cover invoice INV-2026-00374 ($1,604.00). No NTE request was ever filed at CBRE; WO is CPW (waiting for invoice).'),
  ('C2947395',  350.00, 1000.00, 'Verbal $1,000 NTE authorization by FM Patrick Perry is documented in CBRE''s own log comment of 12/31/2025. Invoice INV-2026-00349 is $672.00.'),
  ('C2967150',  350.00, 1121.15, 'NTE increase to cover invoice INV-2026-00348 ($1,121.15). No NTE request on file at CBRE; WO is CPW.'),
  ('C2968992',  350.00,  926.00, 'NTE increase to cover invoice INV-2026-00346 ($926.00). No NTE request on file at CBRE; WO is CPW.'),
  ('C2959782',  350.00, 1493.00, 'NTE increase to cover invoice INV-2026-00345 ($1,493.00). No NTE request on file at CBRE; WO is CPW.'),
  ('C3064316',  350.00, 1150.00, 'NTE increase to cover invoice INV-2026-00344 ($1,150.00). Matthew asked for $1,330 by phone 3/16/2026 (CBRE log); no formal request. WO is CPW.'),
  ('C2876507', 1680.00, 4695.15, 'NTE increase to cover invoice INV-2026-00331 ($4,695.15). No NTE request on file at CBRE; WO is CPW.')),
stamp as (
  update public.work_orders w set cbre_nte = q.cbre_nte
    from q where w.wo_number = q.wo_number
  returning w.wo_id)
insert into public.work_order_quotes
  (wo_id, created_by, is_verbal_nte, estimated_techs, estimated_rt_hours, estimated_ot_hours,
   material_cost, equipment_cost, rental_cost, trailer_cost, estimated_miles,
   labor_total, materials_with_markup, equipment_with_markup, rental_with_markup, trailer_with_markup, mileage_total,
   grand_total, new_nte_amount, original_nte, sequence_number, nte_status, request_type, description, notes)
select w.wo_id,
       (select user_id from public.users where email = 'jones.emfcontracting@gmail.com' limit 1),
       false, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
       round((q.new_nte - q.cbre_nte)::numeric, 2),   -- the increase over CBRE's NTE
       q.new_nte,                                      -- requested NTE (what the form sends)
       q.cbre_nte,
       coalesce((select max(sequence_number) from public.work_order_quotes x where x.wo_id = w.wo_id), 0) + 1,
       'pending', 'estimate',
       'NTE increase request for completed work (CPW) — created 9/6/2026 from the CBRE reconciliation',
       q.note
  from q join public.work_orders w on w.wo_number = q.wo_number
 where not exists (select 1 from public.work_order_quotes x
                    where x.wo_id = w.wo_id and x.nte_status = 'pending' and x.new_nte_amount = q.new_nte);

-- …and the seven leave the dispute tracker (history kept in the WO comments).
update public.work_orders w
   set comments = rtrim(coalesce(w.comments, '') || E'\n[9/6/2026] Removed from UPS Escalation — WO is CPW at CBRE; NTE increase request goes through Approvals (quote created). Previous dispute note: ' || coalesce(w.dispute_notes, '—')),
       dispute_status = null, dispute_reason = null, dispute_notes = null,
       dispute_opened_at = null, dispute_escalated_at = null, dispute_resolved_at = null,
       dispute_requested_at = null, dispute_sub_wo = null,
       dispute_amount = null, dispute_recovered_amount = null
 where w.wo_number in ('C3115553','C2947395','C2967150','C2968992','C2959782','C3064316','C2876507')
   and w.dispute_status is not null;

-- C3171074: NTE increase rejected twice (Chris Nobile 6/18, Adriana Davis 6/26:
-- "Rejected — bill for incurred $350.00 original NTE"). Bill $350, write off the rest.
update public.work_orders w
   set dispute_status           = 'written_off',
       dispute_reason           = 'nte_rejected',
       dispute_resolved_at      = now(),
       dispute_amount           = 550.00,
       dispute_recovered_amount = 350.00,
       dispute_notes            = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
         '9/6/2026 — NTE requests $3,606.50 (6/18) and $896 (6/25) both rejected: "bill for incurred $350.00 original NTE". Invoice $350.00 (no FSM invoice exists yet — create and submit), $550 written off. WO is CPW.')
 where w.wo_number = 'C3171074';

-- C2965174: NTE request $4,578 filed by CBRE 1/9/2026, still "Pending Approval from Michelle Hanington, UPS".
update public.work_orders w
   set dispute_status       = 'escalated',
       dispute_reason       = 'nte_pending',
       dispute_escalated_at = coalesce(w.dispute_escalated_at, now()),
       dispute_notes        = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
         '9/6/2026 — CBRE log: NTE increase $4,578 requested 1/9/2026, "Pending Approval from Michelle Hanington, UPS"; FM Patrick approved verbally (CBRE comment). Never decided. Ask Adriana to push the approval; WO is CPW and on the Invoicing page.')
 where w.wo_number = 'C2965174';

-- C2891401: NTE request $4,002 (12/2/2025) rejected by UPS 12/19/2025 "Not approved or submitted as peak request".
update public.work_orders w
   set dispute_status       = 'escalated',
       dispute_reason       = 'nte_rejected',
       dispute_escalated_at = coalesce(w.dispute_escalated_at, now()),
       dispute_notes        = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
         '9/6/2026 — CBRE log: NTE $4,002 requested 12/2/2025 (FM Patrick verbal ok per CBRE comment), rejected 12/19/2025 by Lisandro Ponce/UPS "Not approved or submitted as peak request". Clarify peak-request route with Adriana or bill $2,500. WO is CPW.')
 where w.wo_number = 'C2891401';

-- ============================================================================
-- Block 5 — Group E: stuck in quote_submitted at CBRE (neither open nor closed).
-- ============================================================================
update public.work_orders w
   set dispute_status       = 'escalated',
       dispute_reason       = 'nte_pending',
       dispute_escalated_at = coalesce(w.dispute_escalated_at, now()),
       dispute_notes        = concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
         '9/6/2026 — Not findable in CBRE Open or Closed Orders: NTE request ($1,836) sits in quote-submitted since 2/3/2026. Include in the "Waiting on CBRE" list for Adriana.')
 where w.wo_number = 'C2984604';

-- ============================================================================
-- Result
-- ============================================================================
select dispute_status, count(*) as wos, sum(dispute_amount) as amount
  from public.work_orders where dispute_status is not null
 group by dispute_status order by dispute_status;
