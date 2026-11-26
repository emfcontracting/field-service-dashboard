-- =============================================================================
-- 2026-11-26  Recurring line items per subcontractor
-- -----------------------------------------------------------------------------
-- Lines a sub adds to every EMF invoice (e.g. Admin Hours 10 × $47). They are
-- put on the Friday draft, the one-click invoice and pre-filled on New Invoice;
-- the sub can still change or remove them on each draft.
--   [{ "description": "Admin Hours", "quantity": 10, "rate": 47 }]
-- RUN BEFORE the deploy. Re-runnable.
-- =============================================================================

ALTER TABLE public.subcontractor_profiles
  ADD COLUMN IF NOT EXISTS recurring_lines jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subcontractor_profiles_recurring_lines_chk') THEN
    ALTER TABLE public.subcontractor_profiles
      ADD CONSTRAINT subcontractor_profiles_recurring_lines_chk
      CHECK (jsonb_typeof(recurring_lines) = 'array' AND jsonb_array_length(recurring_lines) <= 20);
  END IF;
END $$;

-- Check
SELECT count(*) AS profiles,
       count(*) FILTER (WHERE jsonb_array_length(recurring_lines) > 0) AS with_recurring
FROM public.subcontractor_profiles;
