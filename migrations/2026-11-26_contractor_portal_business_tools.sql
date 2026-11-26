-- =============================================================================
-- 2026-11-26  Subcontractor portal: business tools
--   1. profile: own tax set-aside %  (1040-ES reminder uses it)
--   2. invoices: correction of a rejected invoice, customer link, part
--      payments total, payment reminders, link to an estimate
--   3. contractor_customers        saved customers (other clients)
--   4. contractor_invoice_payments  payments received (also part payments)
--   5. contractor_time_entries      timer / hours for other clients
--   6. contractor_estimates (+ _items)  estimates → invoice
-- All new tables like the other contractor tables: RLS staff_all, no anon;
-- the portal goes through /api/contractor/* with the service role.
-- RUN BEFORE the deploy. Re-runnable.
-- =============================================================================

-- 1 ── profile ────────────────────────────────────────────────────────────────
ALTER TABLE public.subcontractor_profiles
  ADD COLUMN IF NOT EXISTS tax_set_aside_pct numeric(5,2)
    CHECK (tax_set_aside_pct IS NULL OR (tax_set_aside_pct >= 0 AND tax_set_aside_pct <= 60)),
  ADD COLUMN IF NOT EXISTS reminder_days integer NOT NULL DEFAULT 14
    CHECK (reminder_days BETWEEN 3 AND 90);

-- 3 ── customers (before the invoice FK) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contractor_customers (
  customer_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  name         text NOT NULL,
  address      text,
  city         text,
  state        text,
  zip          text,
  email        text,
  phone        text,
  hourly_rate  numeric(10,2) CHECK (hourly_rate IS NULL OR hourly_rate >= 0),
  notes        text,
  archived     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contractor_customers_user_idx ON public.contractor_customers (user_id, archived, name);

-- 6 ── estimates (before the invoice FK) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contractor_estimates (
  estimate_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  estimate_number  text NOT NULL,
  customer_id      uuid REFERENCES public.contractor_customers(customer_id) ON DELETE SET NULL,
  client_name      text NOT NULL,
  client_address   text,
  client_city      text,
  client_state     text,
  client_zip       text,
  client_email     text,
  title            text,
  notes            text,
  valid_until      date,
  total            numeric(12,2) NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'invoiced')),
  sent_at          timestamptz,
  sent_to_email    text,
  decided_at       timestamptz,
  invoice_id       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, estimate_number)
);
CREATE INDEX IF NOT EXISTS contractor_estimates_user_idx ON public.contractor_estimates (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.contractor_estimate_items (
  item_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id  uuid NOT NULL REFERENCES public.contractor_estimates(estimate_id) ON DELETE CASCADE,
  position     integer NOT NULL DEFAULT 0,
  description  text NOT NULL,
  quantity     numeric(12,2) NOT NULL DEFAULT 1,
  rate         numeric(12,2) NOT NULL DEFAULT 0,
  amount       numeric(12,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS contractor_estimate_items_est_idx ON public.contractor_estimate_items (estimate_id, position);

-- 2 ── invoices ──────────────────────────────────────────────────────────────
ALTER TABLE public.subcontractor_invoices
  ADD COLUMN IF NOT EXISTS replaces_invoice_id uuid REFERENCES public.subcontractor_invoices(invoice_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.contractor_customers(customer_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estimate_id uuid REFERENCES public.contractor_estimates(estimate_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS subcontractor_invoices_replaces_idx ON public.subcontractor_invoices (replaces_invoice_id) WHERE replaces_invoice_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contractor_estimates_invoice_fk') THEN
    ALTER TABLE public.contractor_estimates
      ADD CONSTRAINT contractor_estimates_invoice_fk FOREIGN KEY (invoice_id)
      REFERENCES public.subcontractor_invoices(invoice_id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4 ── payments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contractor_invoice_payments (
  payment_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id  uuid NOT NULL REFERENCES public.subcontractor_invoices(invoice_id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  amount      numeric(12,2) NOT NULL CHECK (amount > 0),
  paid_on     date NOT NULL,
  method      text,          -- check, zelle, ach, cash, card, other
  reference   text,          -- check no., transaction id
  note        text,
  auto        boolean NOT NULL DEFAULT false,   -- written by "Mark as paid" for the remainder
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contractor_invoice_payments_inv_idx ON public.contractor_invoice_payments (invoice_id);
CREATE INDEX IF NOT EXISTS contractor_invoice_payments_user_idx ON public.contractor_invoice_payments (user_id, paid_on);

-- Existing paid invoices: one payment for the full amount on the paid day,
-- so income by payment date stays as it was.
INSERT INTO public.contractor_invoice_payments (invoice_id, user_id, amount, paid_on, method, auto, note)
SELECT i.invoice_id, i.user_id, i.grand_total,
       COALESCE((i.paid_at AT TIME ZONE 'America/New_York')::date, i.period_end, CURRENT_DATE),
       NULL, true, 'backfill: marked paid before payments were tracked'
FROM public.subcontractor_invoices i
WHERE i.status = 'paid' AND COALESCE(i.grand_total, 0) > 0
  AND NOT EXISTS (SELECT 1 FROM public.contractor_invoice_payments p WHERE p.invoice_id = i.invoice_id);

UPDATE public.subcontractor_invoices i
SET amount_paid = s.total
FROM (SELECT invoice_id, SUM(amount) AS total FROM public.contractor_invoice_payments GROUP BY invoice_id) s
WHERE s.invoice_id = i.invoice_id AND i.amount_paid IS DISTINCT FROM s.total;

-- 5 ── time entries ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.contractor_time_entries (
  entry_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  customer_id  uuid NOT NULL REFERENCES public.contractor_customers(customer_id) ON DELETE CASCADE,
  started_at   timestamptz NOT NULL,
  ended_at     timestamptz,                     -- NULL = timer running
  minutes      integer CHECK (minutes IS NULL OR (minutes >= 0 AND minutes <= 1440)),
  description  text,
  rate         numeric(10,2) CHECK (rate IS NULL OR rate >= 0),
  invoice_id   uuid REFERENCES public.subcontractor_invoices(invoice_id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX IF NOT EXISTS contractor_time_entries_user_idx ON public.contractor_time_entries (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS contractor_time_entries_open_idx ON public.contractor_time_entries (customer_id) WHERE invoice_id IS NULL;
-- one running timer per sub
CREATE UNIQUE INDEX IF NOT EXISTS contractor_time_entries_one_running ON public.contractor_time_entries (user_id) WHERE ended_at IS NULL;

-- ── access: like the other contractor tables ────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contractor_customers', 'contractor_invoice_payments', 'contractor_time_entries',
                           'contractor_estimates', 'contractor_estimate_items'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS staff_all ON public.%I', t);
    EXECUTE format('CREATE POLICY staff_all ON public.%I FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

-- ── check ───────────────────────────────────────────────────────────────────
SELECT c.relname AS table_name, c.relrowsecurity AS rls_on,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_select,
       (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) AS policies
FROM pg_class c
WHERE c.relname IN ('contractor_customers', 'contractor_invoice_payments', 'contractor_time_entries',
                    'contractor_estimates', 'contractor_estimate_items')
ORDER BY 1;
