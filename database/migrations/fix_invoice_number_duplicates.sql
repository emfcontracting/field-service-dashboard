-- migrations/fix_invoice_number_duplicates.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- BUG FIX: Subcontractor invoice numbers were generated via count(*) of a
-- user's existing invoices, which had three fatal flaws:
--   1. Race condition: two simultaneous creates → same number
--   2. Deletions break it: deleting #002 → next new invoice also gets #002
--   3. Year-agnostic: count includes prior years' invoices
--
-- This migration:
--   1. Detects and renumbers any existing duplicates
--   2. Adds a UNIQUE constraint on (user_id, invoice_number)
--   3. Creates an atomic function to generate the next invoice number,
--      driven by MAX(existing) instead of COUNT(*)
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Step 1: Renumber existing duplicates ───────────────────────────────────
-- For each (user_id, invoice_number) group with > 1 row, keep the oldest
-- (by created_at) with the original number; give the others fresh numbers
-- at the end of the sequence for their user/year/initials prefix.

DO $$
DECLARE
  dup RECORD;
  v_prefix TEXT;
  v_max_num INT;
  v_new_number TEXT;
BEGIN
  -- Loop through duplicate rows (rank > 1 = the duplicates to fix)
  FOR dup IN
    SELECT
      invoice_id,
      user_id,
      invoice_number,
      created_at,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, invoice_number
        ORDER BY created_at ASC
      ) AS rnk
    FROM subcontractor_invoices
  LOOP
    IF dup.rnk = 1 THEN
      CONTINUE;  -- oldest of the group keeps its number
    END IF;

    -- Extract the prefix (everything before the trailing -NNN)
    v_prefix := regexp_replace(dup.invoice_number, '\d+$', '');

    -- Find the highest existing number for that prefix
    SELECT COALESCE(MAX(
      CAST(SUBSTRING(invoice_number FROM LENGTH(v_prefix) + 1) AS INT)
    ), 0)
    INTO v_max_num
    FROM subcontractor_invoices
    WHERE user_id = dup.user_id
      AND invoice_number LIKE v_prefix || '%'
      AND SUBSTRING(invoice_number FROM LENGTH(v_prefix) + 1) ~ '^\d+$';

    v_new_number := v_prefix || LPAD((v_max_num + 1)::TEXT, 3, '0');

    UPDATE subcontractor_invoices
    SET invoice_number = v_new_number
    WHERE invoice_id = dup.invoice_id;

    RAISE NOTICE 'Renumbered % → % (invoice_id %)',
      dup.invoice_number, v_new_number, dup.invoice_id;
  END LOOP;
END $$;

-- ─── Step 2: Add UNIQUE constraint to prevent duplicates forever ────────────
-- This makes the race condition impossible at the DB level. If two
-- inserts race, the second one fails with constraint violation (23505),
-- and the client retries with the next number.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_subcontractor_invoice_user_number'
  ) THEN
    ALTER TABLE subcontractor_invoices
    ADD CONSTRAINT uq_subcontractor_invoice_user_number
    UNIQUE (user_id, invoice_number);
  END IF;
END $$;

-- ─── Step 3: Atomic invoice-number generator ────────────────────────────────
-- Uses MAX() instead of COUNT() so deletions don't cause collisions.
-- The year comes from EST timezone (matches the rest of the app).
-- Pattern: SUB-{YEAR}-{INITIALS}-{NNN}, e.g. SUB-2026-SJ-003

CREATE OR REPLACE FUNCTION next_subcontractor_invoice_number(
  p_user_id  UUID,
  p_initials TEXT
) RETURNS TEXT AS $$
DECLARE
  v_year       INT;
  v_prefix     TEXT;
  v_max_num    INT;
  v_next_num   INT;
  v_result     TEXT;
BEGIN
  -- Use EST (America/New_York) for the year, matching the rest of the app
  v_year   := EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'America/New_York'));
  v_prefix := 'SUB-' || v_year || '-' || UPPER(p_initials) || '-';

  -- Find the highest existing number with this user+year+initials prefix.
  -- Only consider rows whose suffix is purely numeric (defensive).
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM LENGTH(v_prefix) + 1) AS INT)
  ), 0)
  INTO v_max_num
  FROM subcontractor_invoices
  WHERE user_id = p_user_id
    AND invoice_number LIKE v_prefix || '%'
    AND SUBSTRING(invoice_number FROM LENGTH(v_prefix) + 1) ~ '^\d+$';

  v_next_num := v_max_num + 1;
  v_result   := v_prefix || LPAD(v_next_num::TEXT, 3, '0');

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION next_subcontractor_invoice_number IS
  'Generates the next subcontractor invoice number atomically using MAX() of existing numbers. Format: SUB-{YEAR-EST}-{INITIALS}-{NNN}';
