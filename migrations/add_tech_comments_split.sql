-- migrations/add_tech_comments_split.sql
-- ============================================================================
-- Split the work_orders.comments log into two fields:
--
--   tech_comments  NEW  — only what a PERSON wrote. This is what invoices bill
--                         from ("Work Performed") and what the CBRE dialog shows.
--   comments       OLD  — becomes the system/activity log (check-in/out,
--                         CBRE updates, sync markers).
--
-- This migration only ADDS the column. The historic split is done by
--   GET /api/admin/split-comments?key=CRON_SECRET&dryRun=true
-- which reuses the app's own classifier (lib/commentsSplit.js) — a regex this
-- delicate is safer in JS than in SQL, and dryRun lets you see it first.
--
-- Safe to run twice. Nothing is deleted: the backfill fills tech_comments and
-- rewrites comments to the system-only part, and it skips rows already split.
-- ============================================================================

alter table public.work_orders
  add column if not exists tech_comments          text,
  add column if not exists tech_comments_split_at timestamptz;

comment on column public.work_orders.tech_comments is
  'Human-written comments only (techs + office). Source for invoice "Work Performed". System events stay in comments.';
comment on column public.work_orders.tech_comments_split_at is
  'When the one-time comments/notes split ran for this row. Null = not split yet.';

notify pgrst, 'reload schema';
