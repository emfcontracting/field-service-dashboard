-- ============================================================================
-- 2026-09-09: invoices that should not exist yet are withdrawn
-- ----------------------------------------------------------------------------
-- An invoice may only exist once CBRE has been told the work order is complete
-- (acknowledged) and nothing is escalated on it. Two groups break that today:
--
--   A) 18 invoices on work orders with an open escalation. These belong in the
--      Escalations tab and nowhere else — CBRE will not pay against a work
--      order that is disputed, cancelled or posted with the NTE frozen.
--   B) 15 invoices sitting on the sub work orders. 2026-09-08_cbre_sub_work_orders.sql
--      moved them over from the originals, but a sub work order still has to run
--      acknowledge → report completion → lock before it can be billed.
--
-- Nothing is thrown away. Every invoice is copied into wo_invoice_archive with
-- its line items as JSON first. The line items are all generated types (labor,
-- mileage, material, equipment) that buildActualLineItems rebuilds from the
-- hours and costs still on the work order — except the "work performed" text,
-- which is written by hand. That is the reason for the archive: it prefills the
-- text again when the work order is finally billed.
--
-- Invoices with a QuickBooks number are never touched.
-- Re-runnable.
-- ============================================================================

-- ── The archive ─────────────────────────────────────────────────────────────
create table if not exists public.wo_invoice_archive (
  archive_id      uuid primary key default gen_random_uuid(),
  wo_id           uuid not null,
  wo_number       text,
  invoice_number  text,
  invoice_date    timestamptz,
  subtotal        numeric,
  total           numeric,
  status          text,
  notes           text,
  work_performed  text,          -- the hand-written description line, pulled out
  line_items      jsonb not null default '[]'::jsonb,
  invoice_row     jsonb,         -- the whole invoice, so nothing is lost at all
  withdrawn_at    timestamptz not null default now(),
  withdrawn_by    uuid,
  reason          text
);
create index if not exists idx_wo_invoice_archive_wo on public.wo_invoice_archive(wo_id);
create unique index if not exists idx_wo_invoice_archive_number on public.wo_invoice_archive(invoice_number);

begin;

-- ── Who gets withdrawn ──────────────────────────────────────────────────────
drop table if exists _withdraw;
create temp table _withdraw as
select i.invoice_id, i.wo_id, w.wo_number,
       case when w.dispute_status in ('open','escalated','sub_wo_requested','superseded')
            then 'work order is escalated — belongs in the Escalations tab, not in Invoicing'
            else 'completion not reported to CBRE yet (not acknowledged) — invoice created too early'
       end as reason
  from public.invoices i
  join public.work_orders w on w.wo_id = i.wo_id
 where i.status = 'draft'
   and coalesce(i.qb_invoice_number, i.qb_invoice_id, i.quickbooks_invoice_id) is null
   and ( w.dispute_status in ('open','escalated','sub_wo_requested','superseded')
      or coalesce(w.acknowledged, false) = false );

select count(*) as invoices_to_withdraw, sum(i.total) as total_value
  from _withdraw d join public.invoices i on i.invoice_id = d.invoice_id;

-- ── Archive first ───────────────────────────────────────────────────────────
insert into public.wo_invoice_archive
       (wo_id, wo_number, invoice_number, invoice_date, subtotal, total, status,
        notes, work_performed, line_items, invoice_row, reason)
select i.wo_id, d.wo_number, i.invoice_number, i.invoice_date, i.subtotal, i.total, i.status,
       i.notes,
       (select li.description from public.invoice_line_items li
         where li.invoice_id = i.invoice_id and li.line_type = 'description'
         order by li.line_item_id limit 1),
       coalesce((select jsonb_agg(to_jsonb(li) order by li.line_item_id)
                   from public.invoice_line_items li where li.invoice_id = i.invoice_id), '[]'::jsonb),
       to_jsonb(i),
       d.reason
  from _withdraw d join public.invoices i on i.invoice_id = d.invoice_id
 where not exists (select 1 from public.wo_invoice_archive a where a.invoice_number = i.invoice_number);

-- ── Then delete ─────────────────────────────────────────────────────────────
delete from public.invoice_line_items li using _withdraw d where li.invoice_id = d.invoice_id;
delete from public.invoices i using _withdraw d where i.invoice_id = d.invoice_id;

commit;

-- Check: what was archived, and nothing left behind
select a.wo_number, a.invoice_number, a.total, left(a.reason, 40) as reason,
       jsonb_array_length(a.line_items) as line_items,
       (a.work_performed is not null) as has_work_performed
  from public.wo_invoice_archive a
 order by a.invoice_number;

select count(*) as drafts_left_on_escalated_or_unacknowledged
  from public.invoices i join public.work_orders w on w.wo_id = i.wo_id
 where i.status = 'draft'
   and coalesce(i.qb_invoice_number, i.qb_invoice_id, i.quickbooks_invoice_id) is null
   and ( w.dispute_status in ('open','escalated','sub_wo_requested','superseded')
      or coalesce(w.acknowledged, false) = false );

drop table _withdraw;
