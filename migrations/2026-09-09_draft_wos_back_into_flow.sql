-- ============================================================================
-- 2026-09-09: work orders with a held draft invoice go back into the dashboard
-- ----------------------------------------------------------------------------
-- The invoicing flow is: dashboard → report completion to CBRE → acknowledge →
-- generate invoice → is_locked. Generating the invoice is what takes the work
-- order out of the dashboard AND out of CBRE Data Entry (both filter on
-- acknowledged/is_locked).
--
-- For a work order whose NTE increase is still pending that order is wrong: the
-- completion can only be reported to CBRE AFTER the NTE is approved, so the
-- work order has to stay in the dashboard until then. Locked early, it drops
-- out of the acknowledge → completion → lock logic entirely.
--
-- This puts every work order with a HELD draft invoice back to
-- "completed, quote submitted, not yet acknowledged":
--   • acknowledged / is_locked → false        (back in the dashboard + CBRE Data Entry)
--   • completion_transferred / cbre_completion_submitted_at → cleared
--   • cbre_status → 'quote_submitted' ONLY where an NTE quote is actually
--     submitted at CBRE. CPW is kept in cbre_posting_status (with its label),
--     so nothing is lost. Quotes still 'pending' keep their status — the
--     request has not left the Approvals tab yet.
-- The draft invoices are NOT touched: their line items, some edited by hand,
-- stay, and the invoice guard (lib/invoiceReadiness) holds them until CBRE is
-- ready. Invoices already in QuickBooks are left alone.
-- Re-runnable.
-- ============================================================================

begin;

drop table if exists _held;
create temp table _held as
select distinct w.wo_id, w.wo_number,
       exists (select 1 from public.work_order_quotes q
                where q.wo_id = w.wo_id and q.nte_status = 'submitted') as nte_at_cbre
  from public.invoices i
  join public.work_orders w on w.wo_id = i.wo_id
 where i.status = 'draft'
   -- already in QuickBooks → out of our hands, leave it locked
   and coalesce(i.qb_invoice_number, i.qb_invoice_id, i.quickbooks_invoice_id) is null
   -- held: NTE request open, invoice above the approved NTE, WO closed at CBRE,
   -- or an open dispute — the same rules as lib/invoiceReadiness.invoiceBlocker
   and (
        exists (select 1 from public.work_order_quotes q
                 where q.wo_id = w.wo_id and q.nte_status in ('pending', 'submitted'))
     or i.total > coalesce(w.cbre_nte, w.nte, 0) + 0.01
     or w.cbre_status in ('cancelled', 'CMP', 'CA1', 'CA2', 'CIR', 'CIS')
     or (w.dispute_status is not null and w.dispute_status not in ('resolved', 'written_off'))
   );

select count(*) as work_orders_going_back from _held;

update public.work_orders w
   set acknowledged     = false,
       acknowledged_at  = null,
       is_locked        = false,
       locked_at        = null,
       completion_transferred        = false,
       completion_transferred_at     = null,
       completion_transferred_by     = null,
       cbre_completion_submitted_at  = null,
       cbre_completion_submitted_by  = null,
       status = 'completed'
  from _held h
 where w.wo_id = h.wo_id
   and (w.acknowledged or w.is_locked or w.completion_transferred
        or w.cbre_completion_submitted_at is not null or w.status <> 'completed');

-- Only where the NTE request is demonstrably at CBRE.
update public.work_orders w
   set cbre_status = 'quote_submitted',
       cbre_status_updated_at = coalesce(w.cbre_status_updated_at, now())
  from _held h
 where w.wo_id = h.wo_id
   and h.nte_at_cbre
   and coalesce(w.cbre_status, '') not in ('quote_submitted', 'quote_approved');

commit;

-- Check: every one of these must read completed / not acknowledged / not locked.
select h.wo_number, w.status, w.cbre_status, w.cbre_posting_status,
       w.acknowledged, w.is_locked, w.completion_transferred,
       (select i.invoice_number from public.invoices i where i.wo_id = w.wo_id and i.status = 'draft' limit 1) as draft_invoice
  from _held h join public.work_orders w on w.wo_id = h.wo_id
 order by h.wo_number;

drop table _held;
