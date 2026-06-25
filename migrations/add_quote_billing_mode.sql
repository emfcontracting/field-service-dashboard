-- add_quote_billing_mode.sql
--
-- Adds billing_mode to work_order_quotes so the invoice team knows whether a
-- quote is a FIXED price (bill the quote amount regardless of actual costs) or
-- an ESTIMATE / T&M (bill actual costs, capped by the NTE).
--
--   'actual' (DEFAULT) = bill actual costs — today's behavior, zero risk to
--                        existing rows.
--   'fixed'            = bill the quote's stored amount (new_nte_amount) as-is.
--
-- Source of truth for an invoice = the newest non-rejected quote on the WO.
-- No WO-level flag is needed: with no increase, billing is always actual; a
-- fixed price only ever comes from a quote.

ALTER TABLE work_order_quotes
  ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'actual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'work_order_quotes_billing_mode_chk'
  ) THEN
    ALTER TABLE work_order_quotes
      ADD CONSTRAINT work_order_quotes_billing_mode_chk
      CHECK (billing_mode IN ('fixed','actual'));
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
