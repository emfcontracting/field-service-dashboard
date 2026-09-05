-- ============================================================================
-- KPI data foundation: CBRE targets + target history + stop-the-clock pauses.
--
-- CBRE measures EMF against Target Response / Target Completion from the
-- dispatch mails — and can CHANGE them (re-dispatch / priority change / grid).
-- KPIs must therefore measure against the LATEST target, and time windows in
-- which EMF cannot act (quote awaiting CBRE approver, equipment on backorder,
-- return trip waiting on parts) must not count against EMF. Two views result:
-- "CBRE view" (raw) and "adjusted" (pauses subtracted) — the pause rows with
-- reason/source/note double as the compliance defense trail.
--
-- Safe to run twice.
-- ============================================================================

-- ── Current targets on the WO (the ones KPIs measure against) ───────────────
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS target_response_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS target_completion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS waiting_reason       TEXT,        -- open pause mirror (equipment_backorder, cbre_approval, parts, site_access)
  ADD COLUMN IF NOT EXISTS waiting_since        TIMESTAMPTZ;

-- ── Manual KPI exclusion ────────────────────────────────────────────────────
-- Some tickets must not distort the statistics (CBRE errors, duplicates,
-- disputes, billable:no). Excluding always requires a reason (audit trail).
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS kpi_excluded        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kpi_excluded_reason TEXT,
  ADD COLUMN IF NOT EXISTS kpi_excluded_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kpi_excluded_by     TEXT;

-- ── Every target/priority change, in order ──────────────────────────────────
create table if not exists public.work_order_target_history (
  history_id           uuid primary key default gen_random_uuid(),
  wo_id                uuid not null references public.work_orders(wo_id) on delete cascade,
  priority             text,
  target_response_at   timestamptz,
  target_completion_at timestamptz,
  source               text not null
                       check (source in ('dispatch_email','redispatch_email','grid_import','csv_sync','manual','backfill')),
  note                 text,
  effective_at         timestamptz not null default now(),
  created_at           timestamptz not null default now()
);

create index if not exists idx_wo_target_history_wo
  on public.work_order_target_history (wo_id, effective_at desc);

-- ── Stop-the-clock windows ──────────────────────────────────────────────────
-- A row with ended_at IS NULL is an OPEN pause (clock stopped right now).
create table if not exists public.work_order_clock_pauses (
  pause_id    uuid primary key default gen_random_uuid(),
  wo_id       uuid not null references public.work_orders(wo_id) on delete cascade,
  reason      text not null
              check (reason in ('cbre_approval','equipment_backorder','parts_ordered','site_access','return_trip_wait','other')),
  source      text not null
              check (source in ('email_sync','grid_import','csv_sync','office','tech','backfill')),
  note        text,                       -- REQUIRED in the app for manual pauses (Pflicht-Grund)
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  created_by  uuid references public.users(user_id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_wo_clock_pauses_wo
  on public.work_order_clock_pauses (wo_id, started_at);

-- One OPEN pause per WO+reason (a cron running twice must not double-open).
create unique index if not exists uq_wo_clock_pauses_open
  on public.work_order_clock_pauses (wo_id, reason)
  where ended_at is null;

comment on table public.work_order_target_history is
  'Every CBRE target/priority change per WO. KPIs measure against the latest row; work_orders.target_* mirrors it.';
comment on table public.work_order_clock_pauses is
  'Stop-the-clock windows that must not count against EMF KPIs. Open pause = ended_at IS NULL. Doubles as compliance defense trail.';

-- Same access model as the rest of the schema (anon key client-side).
grant select, insert, update on public.work_order_target_history to anon, authenticated;
grant select, insert, update on public.work_order_clock_pauses  to anon, authenticated;
