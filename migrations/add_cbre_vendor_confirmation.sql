-- migrations/add_cbre_vendor_confirmation.sql
-- ============================================================================
-- CBRE Vendor App confirmation tracking.
-- When Smartsheet emails back "Confirmation - Vendor App Submission (Production)",
-- the sync route (app/api/cbre/sync-vendor-confirmations) stamps the matching
-- approval_requests row so a "✓ CBRE confirmed" badge can show, and notes it on
-- the work order.
-- Safe to run twice.
-- ============================================================================

alter table public.approval_requests
  add column if not exists confirmed_at     timestamptz,
  add column if not exists confirmed_source text;

comment on column public.approval_requests.confirmed_at is
  'When CBRE/Smartsheet emailed back a confirmation for this submission.';

create index if not exists idx_approval_requests_confirmed
  on public.approval_requests (wo_id) where confirmed_at is not null;

notify pgrst, 'reload schema';
