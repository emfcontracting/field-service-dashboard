-- =============================================================================
-- 2026-11-25  Subcontractor portal lockdown (Phase 1)
-- -----------------------------------------------------------------------------
-- RUN ONLY AFTER the code deploy that moves the portal onto /api/contractor/*.
-- Before that deploy the portal still reads these tables with the anon key and
-- would break.
--
-- After this:
--   anon (browser without login)  → no access to subcontractor_* / contractor_tax_*
--   authenticated staff (dashboard, users.role admin/office/office_staff)
--                                 → full access (admin invoice review, Settings → Subcontractors)
--   service role (API routes)     → unchanged, bypasses RLS
-- Re-runnable.
-- =============================================================================

-- 1) Staff check for the signed-in Supabase Auth user -------------------------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.auth_id = auth.uid()
      AND u.role IN ('admin', 'office_staff', 'office')
      AND COALESCE(u.is_active, true)
  );
$$;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- 2) RLS on + one staff policy per table --------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'subcontractor_profiles',
    'subcontractor_invoices',
    'subcontractor_invoice_items',
    'contractor_tax_records',
    'contractor_tax_categories'
  ] LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      RAISE NOTICE 'skip %, table not found', t;
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS staff_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY staff_all ON public.%I FOR ALL TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- 3) Invoice number function: server only -------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.next_subcontractor_invoice_number(uuid,text)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.next_subcontractor_invoice_number(uuid, text) FROM PUBLIC, anon, authenticated;
  ELSE
    RAISE NOTICE 'next_subcontractor_invoice_number(uuid,text) not found — check its signature';
  END IF;
END $$;

-- 4) Check ---------------------------------------------------------------------
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_on,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_select,
       (SELECT count(*) FROM pg_policies p WHERE p.tablename = c.relname) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE c.relname IN ('subcontractor_profiles','subcontractor_invoices','subcontractor_invoice_items',
                    'contractor_tax_records','contractor_tax_categories')
ORDER BY 1;
