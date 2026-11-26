-- =============================================================================
-- 2026-11-26  Contractor expenses: vendor, WO, "bill to EMF"; receipts private
-- -----------------------------------------------------------------------------
-- contractor_tax_records (the portal's Expenses):
--   vendor             where it was bought (receipt scan fills it)
--   wo_id              optional work order the expense belongs to
--   bill_to_emf        reimbursable by EMF → goes onto the next EMF invoice
--   billed_invoice_id  the invoice it went onto (NULL = not billed yet)
-- Receipts: bucket tax-receipts becomes PRIVATE. receipt_url now holds the
-- storage path (<user_id>/<file>); the portal shows receipts through short-
-- lived signed links (/api/contractor/receipts). Existing public URLs are
-- converted to paths below.
-- RUN BEFORE the deploy. Re-runnable.
-- =============================================================================

ALTER TABLE public.contractor_tax_records
  ADD COLUMN IF NOT EXISTS vendor      text,
  ADD COLUMN IF NOT EXISTS bill_to_emf boolean NOT NULL DEFAULT false;

-- wo_id / billed_invoice_id with the same type as the referenced key
DO $$
DECLARE wo_t text; inv_t text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO wo_t
  FROM pg_attribute a WHERE a.attrelid = 'public.work_orders'::regclass AND a.attname = 'wo_id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO inv_t
  FROM pg_attribute a WHERE a.attrelid = 'public.subcontractor_invoices'::regclass AND a.attname = 'invoice_id';

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'contractor_tax_records' AND column_name = 'wo_id') THEN
    EXECUTE format('ALTER TABLE public.contractor_tax_records ADD COLUMN wo_id %s REFERENCES public.work_orders(wo_id) ON DELETE SET NULL', wo_t);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'contractor_tax_records' AND column_name = 'billed_invoice_id') THEN
    EXECUTE format('ALTER TABLE public.contractor_tax_records ADD COLUMN billed_invoice_id %s REFERENCES public.subcontractor_invoices(invoice_id) ON DELETE SET NULL', inv_t);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS contractor_tax_records_unbilled_idx
  ON public.contractor_tax_records (user_id, entry_date)
  WHERE bill_to_emf AND billed_invoice_id IS NULL;

-- Public receipt URLs → storage paths
UPDATE public.contractor_tax_records
SET receipt_url = regexp_replace(receipt_url, '^.*/storage/v1/object/public/tax-receipts/', '')
WHERE receipt_url LIKE '%/storage/v1/object/public/tax-receipts/%';

-- Bucket private (no-op if the bucket doesn't exist)
UPDATE storage.buckets SET public = false WHERE id = 'tax-receipts';

-- Check
SELECT
  (SELECT count(*) FROM public.contractor_tax_records)                                   AS records,
  (SELECT count(*) FROM public.contractor_tax_records WHERE receipt_url LIKE 'http%')   AS receipts_still_url,
  (SELECT count(*) FROM public.contractor_tax_records WHERE receipt_url IS NOT NULL AND receipt_url NOT LIKE 'http%') AS receipts_as_path,
  (SELECT public FROM storage.buckets WHERE id = 'tax-receipts')                         AS bucket_public;
