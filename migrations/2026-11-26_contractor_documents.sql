-- =============================================================================
-- 2026-11-26  Subcontractor documents (W-9, insurance certificate, …)
-- -----------------------------------------------------------------------------
-- Files in the PRIVATE bucket contractor-docs (<user_id>/<file>), uploaded and
-- viewed only through /api/contractor/documents (service role, signed links).
-- expires_on drives the reminders (portal Home, Settings → Subcontractors).
-- Same access as the other contractor tables: RLS staff_all, no anon.
-- RUN BEFORE the deploy. Re-runnable.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.contractor_documents (
  doc_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  doc_type    text NOT NULL CHECK (doc_type IN ('w9', 'coi', 'contract', 'license', 'other')),
  title       text,
  file_path   text NOT NULL,
  expires_on  date,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contractor_documents_user_idx ON public.contractor_documents (user_id, doc_type);

ALTER TABLE public.contractor_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_all ON public.contractor_documents;
CREATE POLICY staff_all ON public.contractor_documents FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
REVOKE ALL ON public.contractor_documents FROM anon;

-- Private bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('contractor-docs', 'contractor-docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Check
SELECT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.contractor_documents'::regclass) AS rls_on,
       has_table_privilege('anon', 'public.contractor_documents', 'SELECT')                     AS anon_can_select,
       (SELECT public FROM storage.buckets WHERE id = 'contractor-docs')                         AS bucket_public;
