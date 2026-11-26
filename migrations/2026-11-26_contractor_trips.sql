-- =============================================================================
-- 2026-11-26  Mileage log: the subcontractor's own trips
-- -----------------------------------------------------------------------------
-- Miles on EMF work orders come from daily_hours_log; here the sub logs other
-- business trips (other clients, supply runs). Same access as the other
-- contractor tables: RLS staff_all, no anon; the portal goes through
-- /api/contractor/trips with the service role.
-- RUN BEFORE the deploy. Re-runnable.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contractor_trips (
  trip_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  trip_date   date NOT NULL,
  miles       numeric(8,1) NOT NULL CHECK (miles > 0 AND miles < 5000),
  purpose     text NOT NULL,
  from_place  text,
  to_place    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contractor_trips_user_date_idx ON public.contractor_trips (user_id, trip_date);

ALTER TABLE public.contractor_trips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_all ON public.contractor_trips;
CREATE POLICY staff_all ON public.contractor_trips FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
REVOKE ALL ON public.contractor_trips FROM anon;

-- Check
SELECT relrowsecurity AS rls_on, has_table_privilege('anon', 'public.contractor_trips', 'SELECT') AS anon_can_select
FROM pg_class WHERE oid = 'public.contractor_trips'::regclass;
