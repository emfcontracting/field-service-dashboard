-- migrations/fix_cbre_acknowledgement_queue_unassigned.sql
-- ============================================================================
-- BUGFIX: newly imported work orders never reached the Approvals tab.
--
-- The view required `assigned_to_field_at IS NOT NULL`, so a work order only
-- became acknowledgeable once a tech had been assigned. Acknowledging tells CBRE
-- "we have accepted this work order" — that belongs at INTAKE, not at dispatch.
-- In practice fresh tickets sat unacknowledged until they aged past the
-- producer's 14-day guard and were dropped as "tooOld".
--
-- Dropping the condition is safe: app/api/cbre/queue-acknowledgements only uses
-- assigned_to_field_at for the comment text and already falls back to
-- date_entered.
--
-- This view was previously only defined in Supabase and not in the repo — it is
-- version controlled from here on.
--
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
order by date_entered desc;

comment on view public.cbre_acknowledgement_queue is
  'Work orders CBRE has not been told we accepted. Intentionally includes UNASSIGNED work orders — acknowledgement happens at intake. Consumed by app/api/cbre/queue-acknowledgements.';

grant select on public.cbre_acknowledgement_queue to anon, authenticated;

notify pgrst, 'reload schema';
