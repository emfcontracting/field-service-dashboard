-- migrations/2026-09-09_cbre_arrival_reporting.sql
-- ============================================================================
-- Report site arrival to CBRE (DAR) — the missing half of the Response Rate.
--
-- CBRE calculates our Response Rate from the arrival time entered in VAWS
-- ("Site Arrival", 85% on-time target). We have never sent one: the 09.09 grid
-- export shows 1 of 105 work orders at DAR. The new producer
-- app/api/cbre/queue-arrivals turns the technician's first check-in
-- (work_orders.time_in) into a queued "Update Next Arrival Time" submission.
--
-- Two things this migration adds:
--   1) approval_requests.kind may be 'cbre_arrival'.
--      Without this the producer's INSERT fails on the check constraint.
--   2) work_orders.cbre_arrival_submitted_at / _by — the stamp that stops the
--      producer re-queueing a work order once the form has gone in. Mirrors
--      cbre_nte_submitted_at and cbre_completion_submitted_at.
--
-- Safe to run twice.
-- ============================================================================

-- 1) kind check ---------------------------------------------------------------
-- Rewritten whole rather than patched: a CHECK constraint cannot be extended in
-- place, and dropping the old one by name first is what makes this repeatable.
alter table public.approval_requests
  drop constraint if exists approval_requests_kind_check;

alter table public.approval_requests
  add constraint approval_requests_kind_check
  check (kind in (
    'cbre_acknowledge',
    'cbre_nte',
    'cbre_eta',
    'cbre_arrival',
    'cbre_comment',
    'cbre_decline',
    'cbre_complete',
    'cbre_target_date',
    'cbre_tag_equipment',
    'other'
  ));

-- 2) work-order stamp ---------------------------------------------------------
alter table public.work_orders
  add column if not exists cbre_arrival_submitted_at timestamptz,
  add column if not exists cbre_arrival_submitted_by uuid;

comment on column public.work_orders.cbre_arrival_submitted_at is
  'When the technician''s site arrival was reported to CBRE via the Vendor App form. Stops the arrivals producer re-queueing. NULL means CBRE has never been told we were on site.';

-- Finding the work orders the producer will look at.
create index if not exists idx_wo_arrival_pending
  on public.work_orders (created_at desc)
  where time_in is not null and cbre_arrival_submitted_at is null;

-- Let PostgREST pick up the new columns immediately.
notify pgrst, 'reload schema';
