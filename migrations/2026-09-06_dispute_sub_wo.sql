-- ============================================================================
-- 2026-09-06: UPS Escalation — "Sub-WO requested" state + sub-WO link
-- ----------------------------------------------------------------------------
-- Work orders that CBRE cancelled or closed without an invoice can only be
-- billed through a sub work order issued by CBRE. That wait is its own state
-- between "open" and "resolved", and the sub-WO must be linked to the
-- original so the recovery can be tracked. Also adds two dispute reasons
-- (NTE rejected / NTE pending at CBRE-UPS) — reasons are free text, so this
-- is documentation only.
-- Run BEFORE deploying the matching dashboard build. Re-runnable.
-- ============================================================================

alter table public.work_orders
  add column if not exists dispute_requested_at timestamptz,   -- when the sub-WO was requested from CBRE
  add column if not exists dispute_sub_wo       text;          -- WO number of the sub work order CBRE issued

alter table public.work_orders
  drop constraint if exists work_orders_dispute_status_check;
alter table public.work_orders
  add constraint work_orders_dispute_status_check
  check (dispute_status is null or dispute_status in ('open', 'escalated', 'sub_wo_requested', 'resolved', 'written_off'));

create index if not exists idx_wo_dispute_sub_wo
  on public.work_orders (dispute_sub_wo)
  where dispute_sub_wo is not null;

comment on column public.work_orders.dispute_requested_at is 'UPS Escalation: when a sub work order was requested from CBRE (status sub_wo_requested)';
comment on column public.work_orders.dispute_sub_wo is 'UPS Escalation: wo_number of the sub work order CBRE issued for this disputed WO';

notify pgrst, 'reload schema';
