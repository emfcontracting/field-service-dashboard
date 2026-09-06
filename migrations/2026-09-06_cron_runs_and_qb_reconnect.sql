-- ============================================================================
-- 2026-09-06: Observability — cron_runs + QuickBooks needs_reconnect
-- ----------------------------------------------------------------------------
-- cron_runs: one row per run of every scheduled job (and of the QuickBooks
-- token refresh / invoice push). Written server-side only (service role);
-- read by /api/cron/health-digest and by admins in the SQL editor.
-- quickbooks_settings.needs_reconnect: set when the refresh token is rejected
-- (expired / revoked); cleared by a successful OAuth callback. Surfaces as a
-- banner in the dashboard and in the digest instead of a generic 500.
-- Run BEFORE deploying the matching build. Re-runnable.
-- ============================================================================

create table if not exists public.cron_runs (
  run_id      bigint generated always as identity primary key,
  job         text        not null,                     -- e.g. 'email-sync', 'quickbooks/pull-payments'
  trigger     text        not null default 'cron',      -- cron | manual | hook
  status      text        not null default 'ok',        -- ok | error | skipped
  http_status integer,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  summary     jsonb,                                    -- compacted response body (counts, flags)
  error       text
);
create index if not exists idx_cron_runs_job_started on public.cron_runs (job, started_at desc);
create index if not exists idx_cron_runs_started      on public.cron_runs (started_at desc);

alter table public.cron_runs enable row level security;
revoke all on public.cron_runs from anon, authenticated;
-- (no policies on purpose: service role only)

-- Keep 90 days. Called by the digest after it has mailed.
create or replace function public.cron_runs_prune(keep_days integer default 90)
returns integer language sql security definer set search_path = public as $$
  with d as (delete from public.cron_runs where started_at < now() - make_interval(days => keep_days) returning 1)
  select count(*)::integer from d;
$$;
revoke all on function public.cron_runs_prune(integer) from public, anon, authenticated;

alter table public.quickbooks_settings
  add column if not exists needs_reconnect boolean not null default false,
  add column if not exists last_error      text,
  add column if not exists last_error_at   timestamptz;

comment on table  public.cron_runs is 'Run log for scheduled jobs; see lib/cronRun.js and /api/cron/health-digest';
comment on column public.quickbooks_settings.needs_reconnect is 'Refresh token rejected by Intuit — an admin must reconnect QuickBooks';

notify pgrst, 'reload schema';
