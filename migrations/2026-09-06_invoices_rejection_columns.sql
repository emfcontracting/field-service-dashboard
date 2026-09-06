-- ============================================================================
-- 2026-09-06: invoices.rejected_at / rejection_reason
-- ----------------------------------------------------------------------------
-- email-sync has been writing these two columns on every "invoice rejected"
-- e-mail (app/api/email-sync/route.js) and the Performance view reads
-- rejected_at for the "Invoice rejected" signal — but the columns never
-- existed. The update failed silently (invoice status was never set to
-- rejected) and, since Phase 2's fetchAll surfaces query errors, the whole
-- Performance view came up empty. Re-runnable.
-- ============================================================================
alter table public.invoices
  add column if not exists rejected_at      timestamptz,
  add column if not exists rejection_reason text;

comment on column public.invoices.rejected_at is 'When CBRE rejected the invoice (set by email-sync from the rejection e-mail)';
comment on column public.invoices.rejection_reason is 'Subject of the CBRE rejection e-mail';

notify pgrst, 'reload schema';
