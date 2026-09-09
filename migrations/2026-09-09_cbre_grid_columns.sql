-- ============================================================================
-- 2026-09-09: remember where CBRE last had a work order on their open list
-- ----------------------------------------------------------------------------
-- The CBRE "grid" export lists everything still OPEN on their side. Comparing
-- it with FSM is how a missed dispatch shows up (13 work orders on 2026-08-27)
-- and, more expensively, how a work order that quietly LEFT the open list shows
-- up before it ages out at 60 days.
--
-- These three columns are what makes the comparison stick between imports:
-- without cbre_grid_seen_at there is no way to say "CBRE has not listed this as
-- open since August", which is exactly the warning that was missing.
--
-- The grid status codes (D, DAK, DAR, DEA, EBO, QUA, OVD) are the dispatch
-- lifecycle. They are kept in their own column on purpose — cbre_status carries
-- the quote/posting world (quote_submitted, CPW, CMP …) and mixing the two is
-- how "posted" and "dispatched" would start overwriting each other.
-- ============================================================================

alter table public.work_orders add column if not exists cbre_grid_status      text;
alter table public.work_orders add column if not exists cbre_grid_seen_at     timestamptz;
alter table public.work_orders add column if not exists cbre_past_target_days integer;

comment on column public.work_orders.cbre_grid_status is
  'Dispatch lifecycle status from the CBRE open-orders export (e.g. "DAK - Dispatched, Acknowledged"). Separate from cbre_status, which carries the quote/posting world.';
comment on column public.work_orders.cbre_grid_seen_at is
  'When this work order last appeared on a CBRE open-orders export. An old date on a work order we still have open is the aging warning.';
comment on column public.work_orders.cbre_past_target_days is
  'Days past CBRE target completion, as of the last open-orders export.';

create index if not exists idx_wo_cbre_grid_seen_at
  on public.work_orders(cbre_grid_seen_at)
  where cbre_grid_seen_at is not null;

select column_name, data_type
  from information_schema.columns
 where table_schema = 'public' and table_name = 'work_orders'
   and column_name in ('cbre_grid_status', 'cbre_grid_seen_at', 'cbre_past_target_days')
 order by column_name;
