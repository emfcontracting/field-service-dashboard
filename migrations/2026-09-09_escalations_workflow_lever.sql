-- ============================================================================
-- 2026-09-09: escalations get their own workflow lever
-- ----------------------------------------------------------------------------
-- Until now a work order was kept out of the dashboard only by acknowledged +
-- is_locked — the INVOICING lever. The 15 originals that were replaced by a sub
-- work order were pushed out that way on 2026-09-08: they read as "reported to
-- CBRE and invoiced", which is the opposite of what happened to them.
--
-- From this commit an open escalation is what hides a work order: the dashboard,
-- CBRE Data Entry and the Invoicing "Ready" list all skip
-- dispute_status in ('open','escalated','sub_wo_requested','superseded').
-- So the flags can be honest again.
--
-- Block 1: the 15 originals with a linked sub work order → 'superseded'
--          (closed, replaced — NOT 'resolved', no money has come back yet;
--          the sub work order carries the invoice) and their acknowledged /
--          is_locked flags are cleared.
-- Block 2: safety net — no work order with an open escalation may still carry
--          the invoicing flags unless it actually has an invoice.
-- Re-runnable.
-- ============================================================================

begin;

-- ── Block 1 — originals replaced by a sub work order ────────────────────────
update public.work_orders w
   set dispute_status = 'superseded',
       dispute_notes  = case
         when coalesce(w.dispute_notes, '') like '%Closed — replaced by sub work order%'
           then w.dispute_notes
         else concat_ws(E'\n', nullif(btrim(w.dispute_notes), ''),
              to_char(now(), 'FMMM/FMDD/YYYY') || ' — Closed — replaced by sub work order ' || w.dispute_sub_wo || '. Hours, costs and the invoice live on the sub; this work order stays for the history only.')
       end,
       acknowledged = false, acknowledged_at = null,
       is_locked = false, locked_at = null, locked_by = null
 where w.dispute_sub_wo is not null
   and w.dispute_status in ('sub_wo_requested', 'open', 'escalated')
   and not exists (select 1 from public.invoices i where i.wo_id = w.wo_id);

-- ── Block 2 — no escalated work order keeps the invoicing flags ─────────────
-- (only where nothing was actually invoiced on it, so a real invoice is never
--  unlocked by accident)
update public.work_orders w
   set acknowledged = false, acknowledged_at = null,
       is_locked = false, locked_at = null, locked_by = null
 where w.dispute_status in ('open', 'escalated', 'sub_wo_requested', 'superseded')
   and (w.acknowledged or w.is_locked)
   and not exists (select 1 from public.invoices i where i.wo_id = w.wo_id);

commit;

-- Check
select dispute_status, count(*) as wos,
       count(*) filter (where acknowledged) as still_acknowledged,
       count(*) filter (where is_locked)    as still_locked,
       count(*) filter (where dispute_sub_wo is not null) as with_sub
  from public.work_orders
 where dispute_status is not null
 group by dispute_status
 order by dispute_status;
