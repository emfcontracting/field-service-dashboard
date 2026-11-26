-- =============================================================================
-- 2026-11-25  Subcontractor invoices: EMF review + EMF payment, separate from
--             the subcontractor's own status
-- -----------------------------------------------------------------------------
-- status (draft / sent / paid)  = the subcontractor's own bookkeeping; the sub
--                                 sets "paid" himself, for EMF and other clients.
-- emf_review_status             = EMF's answer: accepted / rejected (+ note)
-- emf_paid_at                   = EMF recorded its payment
-- The two sides never overwrite each other.
--
-- Backfill: until now the admin page's "Mark Paid" set status='paid' WITHOUT
-- paid_at; the portal's own button set paid_at. So paid rows with no paid_at
-- were marked by EMF → emf_paid_at = updated_at (fallback created_at).
-- Re-runnable. Safe to run before or after the deploy.
-- =============================================================================

ALTER TABLE public.subcontractor_invoices
  ADD COLUMN IF NOT EXISTS emf_review_status text,
  ADD COLUMN IF NOT EXISTS emf_review_note   text,
  ADD COLUMN IF NOT EXISTS emf_reviewed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS emf_reviewed_by   uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS emf_paid_at       timestamptz,
  ADD COLUMN IF NOT EXISTS emf_paid_by       uuid REFERENCES public.users(user_id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subcontractor_invoices_emf_review_status_chk') THEN
    ALTER TABLE public.subcontractor_invoices
      ADD CONSTRAINT subcontractor_invoices_emf_review_status_chk
      CHECK (emf_review_status IS NULL OR emf_review_status IN ('accepted', 'rejected'));
  END IF;
END $$;

-- Backfill EMF payments made through the old admin button
UPDATE public.subcontractor_invoices
SET emf_paid_at = COALESCE(updated_at, created_at)
WHERE status = 'paid'
  AND paid_at IS NULL
  AND emf_paid_at IS NULL;

-- Check
SELECT status,
       count(*)                                   AS invoices,
       count(*) FILTER (WHERE emf_paid_at IS NOT NULL) AS emf_paid,
       count(*) FILTER (WHERE paid_at IS NOT NULL)     AS sub_marked_paid
FROM public.subcontractor_invoices
GROUP BY status
ORDER BY status;
