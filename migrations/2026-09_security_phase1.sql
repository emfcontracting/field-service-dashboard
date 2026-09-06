-- ============================================================================
-- Security Phase 1 (System-Audit September 2026)
-- Run in Supabase SQL editor AFTER the matching dashboard deploy and the
-- native-app EAS update are live (the new login route reads user_pins first
-- and falls back to users.pin, so ordering is forgiving — but old app builds
-- that still verify users.pin in the client stop working once step 1 nulls it).
-- Re-runnable.
-- ============================================================================

-- 1) Technician PINs move out of the anon-readable users table -------------
CREATE TABLE IF NOT EXISTS public.user_pins (
  user_id    uuid PRIMARY KEY REFERENCES public.users(user_id) ON DELETE CASCADE,
  pin        text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_pins FROM anon, authenticated;
-- (no policies on purpose: only the service role — i.e. the API routes — can read/write)

INSERT INTO public.user_pins (user_id, pin)
SELECT user_id, pin FROM public.users
WHERE pin IS NOT NULL AND btrim(pin) <> ''
ON CONFLICT (user_id) DO NOTHING;

-- Blank the legacy column so the anon key can no longer read anyone's PIN.
UPDATE public.users SET pin = NULL
WHERE pin IS NOT NULL
  AND user_id IN (SELECT user_id FROM public.user_pins);

-- 2) QuickBooks tokens: no client access at all --------------------------
ALTER TABLE public.quickbooks_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quickbooks_settings FROM anon, authenticated;
-- Exactly one active connection (callback now deactivates old rows first).
UPDATE public.quickbooks_settings s SET is_active = false
WHERE is_active = true
  AND connected_at < (SELECT max(connected_at) FROM public.quickbooks_settings WHERE is_active = true);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quickbooks_settings_one_active
  ON public.quickbooks_settings ((is_active)) WHERE is_active = true;

-- 3) QuickBooks invoice PDFs: private bucket, signed links only -----------
UPDATE storage.buckets SET public = false WHERE id = 'invoice-pdfs';
-- Existing rows stored the public URL; the qb-pdf route understands both the
-- old URL form and the new plain storage path, so no data rewrite is needed.

-- 4) Sanity report --------------------------------------------------------
SELECT
  (SELECT count(*) FROM public.user_pins)                                   AS pins_moved,
  (SELECT count(*) FROM public.users WHERE pin IS NOT NULL)                 AS users_pin_left,
  (SELECT count(*) FROM public.quickbooks_settings WHERE is_active = true)  AS qb_active_rows,
  (SELECT public FROM storage.buckets WHERE id = 'invoice-pdfs')            AS invoice_pdfs_public;
