-- migrations/2026-11-03_archive_acknowledgement_queue.sql
-- ============================================================================
-- Keep archived work orders out of the acknowledgement queue.
--
-- The archive (work_orders.archived_at) landed on 2026-11-03. Every other
-- producer filters it in JavaScript; this one reads a view, so the clause has
-- to live in SQL. Without it, archiving a work order would not stop the queue
-- from asking the office to tell CBRE "we accept this work order" — for a
-- ticket we have just written off.
--
-- Otherwise unchanged from fix_cbre_acknowledgement_queue_unassigned.sql.
-- Safe to run twice.
-- ============================================================================

create or replace view public.cbre_acknowledgement_queue as
select
  wo_id,
  wo_number,
  building as ups_building_code,
  priority,
  status,
  date_entered,
  assigned_to_field_at,
  work_order_description,
  current_date - date_entered as days_since_dispatch
from public.work_orders w
where cbre_acknowledged_at is null
  and status::text <> 'cancelled'::text
  and coalesce(cbre_status, ''::character varying)::text <> 'cancelled'::text
  and archived_at is null
order by date_entered desc;

comment on view public.cbre_acknowledgement_queue is
  'Work orders CBRE has not been told we accepted. Intentionally includes UNASSIGNED work orders — acknowledgement happens at intake. Excludes archived work orders. Consumed by app/api/cbre/queue-acknowledgements.';

grant select on public.cbre_acknowledgement_queue to anon, authenticated;

notify pgrst, 'reload schema';
