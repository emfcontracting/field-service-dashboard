-- migrations/add_work_order_wo_number_unique.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- BUG FIX / HARDENING: Prevent duplicate work orders at the database level.
--
-- Background:
--   All email-import paths (cron, manual-by-WO, email-import POST, backfill)
--   deduplicate by doing SELECT-then-INSERT in application code. That has a
--   race window: if two import paths run concurrently (e.g. the 10-min cron
--   overlapping a backfill POST), the same wo_number can pass both existence
--   checks before either INSERT lands -> duplicate row.
--
--   wo_number is the CBRE work order number — a globally unique external
--   identifier — so a UNIQUE constraint is the correct, permanent guard.
--
-- This migration:
--   1. (Run the detection queries below FIRST — see header of the chat message)
--   2. Adds a UNIQUE constraint on work_orders.wo_number (idempotent)
--
-- NOTE: Postgres UNIQUE allows multiple NULLs, so legacy rows with NULL
--       wo_number are fine. Multiple rows with wo_number = '' would NOT be —
--       clean those up first if the detection query shows any.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Safety pre-check: abort with a clear message if duplicates still exist ──
DO $$
DECLARE
  dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT wo_number
    FROM work_orders
    WHERE wo_number IS NOT NULL AND wo_number <> ''
    GROUP BY wo_number
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'Cannot add UNIQUE constraint: % duplicate wo_number value(s) still exist. Resolve them first (see detection query).', dup_count;
  END IF;
END $$;

-- ─── Add the UNIQUE constraint (only if not already present) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_work_orders_wo_number'
  ) THEN
    ALTER TABLE work_orders
    ADD CONSTRAINT uq_work_orders_wo_number UNIQUE (wo_number);
    RAISE NOTICE 'Added UNIQUE constraint uq_work_orders_wo_number on work_orders(wo_number)';
  ELSE
    RAISE NOTICE 'Constraint uq_work_orders_wo_number already exists — nothing to do';
  END IF;
END $$;

COMMENT ON CONSTRAINT uq_work_orders_wo_number ON work_orders IS
  'Guarantees one work order per CBRE wo_number. Backstops the app-level dedup in all email-import paths against race conditions.';
