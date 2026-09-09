-- migrations/2026-09-09_hold_reporting_and_cia.sql
-- ============================================================================
-- Gaps 3, 4 and 6 from the Supplier Training Guide reconciliation.
--
-- Only one thing here needs the database: the stamp that stops the hold
-- reporter re-queueing a work order whose target date has already been moved at
-- CBRE. P7 and CIA are code-side (lib/priorityCodes.js, lib/cbrePostingStatus.js,
-- lib/cbreStatusMapping.js) — no schema involved, because both are values that
-- already fit in the columns that hold them.
--
-- Safe to run twice.
-- ============================================================================

alter table public.work_orders
  add column if not exists cbre_hold_reported_at timestamptz,
  add column if not exists cbre_hold_reported_by uuid;

comment on column public.work_orders.cbre_hold_reported_at is
  'When a hold (awaiting material / awaiting CBRE approval) was reported to CBRE as a completion-target-date extension. Stops the queue-holds producer re-queueing. NULL means CBRE has never been told this work order is standing still.';

-- The producer looks for work orders that are waiting and not yet reported.
create index if not exists idx_wo_hold_pending
  on public.work_orders (waiting_since)
  where waiting_reason is not null and cbre_hold_reported_at is null;

-- ── CIA sanity check (no schema change, just a look) ─────────────────────────
-- cbre_posting_status is free text, so CIA needs no migration to be storable.
-- This just reports whether any row already carries it, so the first sighting
-- in the UI is not a surprise. Zero is the expected answer today.
select count(*) as work_orders_already_in_cia
from public.work_orders
where upper(coalesce(cbre_posting_status, '')) = 'CIA'
   or upper(coalesce(cbre_status, '')) = 'CIA';

notify pgrst, 'reload schema';

-- ── CBRE's close-out warning e-mail ─────────────────────────────────────────
-- si-noreply@cbre.com sends "…Will Be Closed in 7 Days" once a work order is 53
-- days past its target completion date. That e-mail has been arriving and being
-- ignored. app/api/cbre/import-closeout-notices reads it (read-only, no IMAP
-- flags touched) and puts CBRE's own deadline here, where lib/agingRisk.js uses
-- it in place of any reckoning of ours.
alter table public.work_orders
  add column if not exists cbre_closeout_flagged_at       timestamptz,
  add column if not exists cbre_closeout_deadline         timestamptz,
  add column if not exists cbre_closeout_days_past_target integer;

comment on column public.work_orders.cbre_closeout_deadline is
  'The date CBRE itself said this work order will be closed for age, from its warning e-mail. After it passes the work order cannot be reopened for billing. NULL means no warning has been received.';

create index if not exists idx_wo_closeout_deadline
  on public.work_orders (cbre_closeout_deadline)
  where cbre_closeout_deadline is not null;

notify pgrst, 'reload schema';
