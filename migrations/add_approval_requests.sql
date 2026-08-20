-- ============================================================================
-- Approval queue — one table for everything that needs Daniel to say yes.
--
-- Deliberately GENERIC. CBRE acknowledgements, NTE submissions, ETA updates and
-- whatever comes later all become rows here with a different `kind`. The
-- dashboard tab renders them all, so adding a new kind never needs new UI.
--
-- Nothing leaves the building on its own: a row sits at 'pending' until a human
-- approves it, and only then may it be submitted — by hand, on CBRE's own form,
-- prefilled from payload. See app/dashboard/components/ApprovalsView.js.
--
-- Safe to run twice.
-- ============================================================================

create table if not exists public.approval_requests (
  approval_id   uuid primary key default gen_random_uuid(),

  -- What sort of thing this is. Keep the list short and explicit.
  kind          text not null
                check (kind in ('cbre_acknowledge','cbre_nte','cbre_eta','cbre_comment','other')),

  wo_id         uuid references public.work_orders(wo_id) on delete cascade,
  wo_number     text,

  title         text not null,          -- one line, shown in the list
  summary       text,                   -- optional detail line
  payload       jsonb not null default '{}'::jsonb,  -- the exact fields to submit

  status        text not null default 'pending'
                check (status in ('pending','approved','rejected','sent','failed','cancelled')),

  created_at    timestamptz not null default now(),
  created_by    uuid references public.users(user_id),

  decided_at    timestamptz,
  decided_by    uuid references public.users(user_id),
  reject_reason text,

  sent_at       timestamptz,
  send_error    text,
  notified_at   timestamptz             -- when we alerted that this needs a decision
);

-- The queue lookup, run on every dashboard poll.
create index if not exists idx_approval_requests_pending
  on public.approval_requests (created_at desc)
  where status = 'pending';

create index if not exists idx_approval_requests_wo
  on public.approval_requests (wo_id);

-- Never queue the same job twice. A WO can have one live acknowledgement
-- request, one live NTE request, and so on -- not five because a cron ran five
-- times. Statuses that are finished (rejected/cancelled/failed) don't block a
-- fresh attempt.
create unique index if not exists uq_approval_requests_live
  on public.approval_requests (kind, wo_id)
  where status in ('pending','approved','sent');

comment on table public.approval_requests is
  'Anything awaiting Daniel''s approval before it leaves the building. Generic by design: add a new kind, not a new table.';
comment on column public.approval_requests.payload is
  'The exact field values to be submitted, keyed by the target system''s own field ids. Used to prefill CBRE''s Vendor App form.';
comment on column public.approval_requests.status is
  'pending -> approved -> sent. rejected/cancelled are terminal. sent means a human submitted CBRE''s form and confirmed it here.';

-- The dashboard uses the anon key client-side, same as every other table here.
-- NOTE: this inherits the same weakness flagged on public.users -- the anon key
-- ships in the frontend bundle, so anything anon can read is effectively
-- public. Worth tightening across the board with RLS policies keyed to
-- auth.uid(), but that is a separate job and must not be half-done.
grant select, insert, update on public.approval_requests to anon, authenticated;

-- Badge count for the sidebar.
create or replace view public.approval_pending_summary as
select kind,
       count(*)          as pending_count,
       min(created_at)   as oldest_created_at
from public.approval_requests
where status = 'pending'
group by kind;

grant select on public.approval_pending_summary to anon, authenticated;
