-- =============================================================================
-- 2026-11-26  Subcontractor invoices to other clients are stored too
-- -----------------------------------------------------------------------------
-- Until now an "Other Client" invoice in the portal only produced a PDF and was
-- never saved — no list entry, no paid status, missing from the tax report.
-- client_type 'emf' (default, every existing row) | 'other' + addressee.
-- EMF's admin review only shows client_type 'emf'.
-- RUN BEFORE the deploy. Re-runnable.
-- =============================================================================

ALTER TABLE public.subcontractor_invoices
  ADD COLUMN IF NOT EXISTS client_type    text NOT NULL DEFAULT 'emf',
  ADD COLUMN IF NOT EXISTS client_name    text,
  ADD COLUMN IF NOT EXISTS client_address text,
  ADD COLUMN IF NOT EXISTS client_city    text,
  ADD COLUMN IF NOT EXISTS client_state   text,
  ADD COLUMN IF NOT EXISTS client_zip     text,
  ADD COLUMN IF NOT EXISTS client_email   text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subcontractor_invoices_client_type_chk') THEN
    ALTER TABLE public.subcontractor_invoices
      ADD CONSTRAINT subcontractor_invoices_client_type_chk
      CHECK (client_type IN ('emf', 'other') AND (client_type = 'emf' OR client_name IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS subcontractor_invoices_user_client_idx
  ON public.subcontractor_invoices (user_id, client_type);

-- Check
SELECT client_type, count(*) AS invoices FROM public.subcontractor_invoices GROUP BY 1 ORDER BY 1;
