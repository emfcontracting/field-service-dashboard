-- =============================================================================
-- 2026-11-26  Tax records filled automatically from what the system knows
-- -----------------------------------------------------------------------------
-- The portal's Expenses (contractor_tax_records) get entries generated from:
--   material  — daily_hours_log.tech_material_cost      (one per log entry)
--   mileage   — EMF miles + own trips, per month, at the IRS rate
--   hotel     — hotel/lodging lines on the sub's sent/paid invoices
-- source      'manual' (default) | 'material' | 'mileage' | 'hotel'
-- source_ref  stable key of the origin, unique per user (e.g. hours:123)
-- edited      the sub changed it → the sync never touches it again
-- dismissed   the sub deleted it → hidden, and the sync does not bring it back
-- RUN BEFORE the deploy. Re-runnable.
-- =============================================================================

ALTER TABLE public.contractor_tax_records
  ADD COLUMN IF NOT EXISTS source     text    NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS edited     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dismissed  boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contractor_tax_records_source_chk') THEN
    ALTER TABLE public.contractor_tax_records
      ADD CONSTRAINT contractor_tax_records_source_chk
      CHECK (source IN ('manual', 'material', 'mileage', 'hotel'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS contractor_tax_records_source_ref_uq
  ON public.contractor_tax_records (user_id, source_ref)
  WHERE source_ref IS NOT NULL;

NOTIFY pgrst, 'reload schema';

-- Check
SELECT source, count(*) FROM public.contractor_tax_records GROUP BY 1 ORDER BY 1;
