-- migrations/add_cbre_vendor_app_actions.sql
-- ============================================================================
-- Extend the CBRE Vendor App integration from just "Acknowledge Work" to all the
-- other Actions the form supports.
--
-- 1) approval_requests.kind: allow the new kinds (Complete, Decline, Change
--    Target Date, Tag Equipment). Acknowledge / NTE / ETA(arrival) / Comment
--    already existed.
-- 2) The live-uniqueness index dropped 'sent' so a work order can get a FRESH
--    request of a repeatable kind (Add Comment, Update Arrival Time, ...) after
--    an earlier one was already submitted. Auto producers stay idempotent via
--    their own WO stamps, not this index, so this is safe for Acknowledge/NTE.
-- 3) Work-order stamps so the automatic producers (acknowledge already had its
--    own) stop re-queueing once a human has submitted the CBRE form.
--
-- Safe to run twice.
-- ============================================================================

-- 1) kind check ---------------------------------------------------------------
alter table public.approval_requests
  drop constraint if exists approval_requests_kind_check;

alter table public.approval_requests
  add constraint approval_requests_kind_check
  check (kind in (
    'cbre_acknowledge',
    'cbre_nte',
    'cbre_eta',
    'cbre_comment',
    'cbre_decline',
    'cbre_complete',
    'cbre_target_date',
    'cbre_tag_equipment',
    'other'
  ));

-- 2) live-uniqueness index: pending/approved only (was pending/approved/sent) --
drop index if exists uq_approval_requests_live;
create unique index if not exists uq_approval_requests_live
  on public.approval_requests (kind, wo_id)
  where status in ('pending','approved');

-- 3) work-order stamps for the automatic producers ---------------------------
alter table public.work_orders
  add column if not exists cbre_nte_submitted_at        timestamptz,
  add column if not exists cbre_nte_submitted_by        uuid,
  add column if not exists cbre_completion_submitted_at timestamptz,
  add column if not exists cbre_completion_submitted_by uuid;

comment on column public.work_orders.cbre_nte_submitted_at is
  'When an NTE Request was submitted to CBRE via the Vendor App form. Stops the NTE producer re-queueing.';
comment on column public.work_orders.cbre_completion_submitted_at is
  'When a Completion was reported to CBRE via the Vendor App form.';

-- Let PostgREST pick up the new columns immediately.
notify pgrst, 'reload schema';
