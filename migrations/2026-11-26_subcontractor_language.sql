-- =============================================================================
-- 2026-11-26  Portal language per subcontractor (en | es)
-- Used by the portal and by the Friday draft e-mail / push. Invoices (PDF to
-- EMF) stay in English. RUN BEFORE the deploy. Re-runnable.
-- =============================================================================
ALTER TABLE public.subcontractor_profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subcontractor_profiles_language_chk') THEN
    ALTER TABLE public.subcontractor_profiles
      ADD CONSTRAINT subcontractor_profiles_language_chk CHECK (language IN ('en', 'es'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT language, count(*) FROM public.subcontractor_profiles GROUP BY 1;
