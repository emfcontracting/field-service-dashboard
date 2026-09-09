-- ============================================================================
-- 2026-09-09: clear the approval queue of forms CBRE cannot act on
-- ----------------------------------------------------------------------------
-- The producers ran before the guards existed (596bd97 for completions,
-- 82de426 for NTE requests) and queued two kinds of form that go nowhere:
--
--   1. Completion reports for work orders CBRE has already closed. Six sit in
--      Pending: C2876328, C2876481, C2879312, C2879589, C2911985, PJ2876508 —
--      all escalated, all closed by CBRE for inactivity or cancelled, all
--      waiting for a sub work order. Telling CBRE a closed work order is
--      complete does nothing.
--   2. NTE increases for work orders CBRE has posted (CPW and later). The
--      portal freezes the NTE at posting; the vendor form still accepts the
--      submission and mails a confirmation back, which is why three went out
--      overnight and a fourth this morning for nothing.
--
-- Rejected, not deleted: the row stays in History with a reason, so it is
-- visible why the form was pulled.
-- Re-runnable.
-- ============================================================================

begin;

-- ── 1) completion reports for escalated work orders ─────────────────────────
update public.approval_requests a
   set status = 'rejected',
       decided_at = now(),
       reject_reason = 'Work order is escalated (' || w.dispute_status ||
                       ') and closed at CBRE — the completion cannot be reported. '
                       'The work is billed on a sub work order instead.'
  from public.work_orders w
 where w.wo_id = a.wo_id
   and a.kind = 'cbre_complete'
   and a.status in ('pending', 'approved')
   and w.dispute_status in ('open', 'escalated', 'sub_wo_requested', 'superseded');

-- ── 2) NTE increases on work orders CBRE has posted ─────────────────────────
update public.approval_requests a
   set status = 'rejected',
       decided_at = now(),
       reject_reason = 'Posted at CBRE (' ||
                       coalesce(w.cbre_posting_status, w.cbre_status) ||
                       ') — the portal takes no NTE increase after posting. '
                       'This amount can only come back on a sub work order.'
  from public.work_orders w
 where w.wo_id = a.wo_id
   and a.kind = 'cbre_nte'
   and a.status in ('pending', 'approved')
   and ( w.cbre_posting_status in ('CPW', 'CIS', 'CA1', 'CA2', 'CIR', 'CMP')
      or w.cbre_status         in ('CPW', 'CIS', 'CA1', 'CA2', 'CIR', 'CMP') );

commit;

-- Check: nothing actionable left that CBRE cannot act on
select a.kind, a.status, a.wo_number, w.dispute_status,
       coalesce(w.cbre_posting_status, '-') as posting, coalesce(w.cbre_status, '-') as cbre_status
  from public.approval_requests a
  join public.work_orders w on w.wo_id = a.wo_id
 where a.status in ('pending', 'approved')
 order by a.kind, a.wo_number;
