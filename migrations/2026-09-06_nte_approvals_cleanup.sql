-- ============================================================================
-- 2026-09-06: Approvals cleanup after the NTE-producer fix
-- ----------------------------------------------------------------------------
-- The first version of /api/cbre/queue-nte-requests keyed on
-- cbre_status = 'quote_submitted'. That status is set by CBRE's own
-- "Quote Submitted" confirmation e-mail AFTER the NTE request was submitted in
-- the Vendor Activity Website, so every row it queued (53 on 2026-09-06) was a
-- duplicate of a request CBRE already had. Reject them and record the
-- submission on the work orders so nothing is re-queued.
-- Re-runnable; run once in the Supabase SQL editor.
-- ============================================================================

with rej as (
  update public.approval_requests
     set status        = 'rejected',
         decided_at    = now(),
         reject_reason = 'Auto-cleanup 2026-09-06: NTE was already submitted to CBRE via VAWS (cbre_status quote_submitted is set by CBRE''s confirmation). Producer condition fixed.'
   where kind = 'cbre_nte' and status = 'pending'
   returning approval_id
), st as (
  -- Everything CBRE has a quote for today was uploaded by hand; record "now" as
  -- the last submission so only quotes written AFTER this cleanup get queued.
  update public.work_orders
     set cbre_nte_submitted_at = now()
   where cbre_status in ('quote_submitted', 'quote_approved') and cbre_nte_submitted_at is null
   returning wo_id
)
select (select count(*) from rej) as rejected_requests,
       (select count(*) from st)  as work_orders_stamped;
