-- migrations/add_cbre_sync.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- CBRE Sync Migration
-- Adds tracking for CBRE Service Insight status codes + sync log infrastructure
-- COMPATIBLE with existing add_cbre_status_acknowledged.sql migration
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add CBRE tracking columns to invoices (NEW — invoices didn't have CBRE tracking before)
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS cbre_status                  TEXT,
  ADD COLUMN IF NOT EXISTS cbre_status_label            TEXT,
  ADD COLUMN IF NOT EXISTS cbre_status_updated_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cbre_status_acknowledged_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cmp_date                     DATE,
  ADD COLUMN IF NOT EXISTS cbre_last_synced_at          TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_invoices_cbre_status ON invoices(cbre_status);
CREATE INDEX IF NOT EXISTS idx_invoices_cmp_date    ON invoices(cmp_date);
CREATE INDEX IF NOT EXISTS idx_invoices_cbre_unack
  ON invoices(cbre_status_updated_at, cbre_status_acknowledged_at)
  WHERE cbre_status_updated_at IS NOT NULL;

-- 2. Add missing columns on work_orders (idempotent — some may already exist
--    from add_cbre_status_acknowledged.sql)
ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS cbre_status            TEXT,
  ADD COLUMN IF NOT EXISTS cbre_status_label      TEXT,
  ADD COLUMN IF NOT EXISTS cbre_status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cbre_last_synced_at    TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_work_orders_cbre_status ON work_orders(cbre_status);

-- 3. Mapping overrides (defaults live in code, this is for user-overrides only)
CREATE TABLE IF NOT EXISTS cbre_status_mappings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cbre_code       TEXT UNIQUE NOT NULL,
  cbre_label      TEXT,
  target_type     TEXT NOT NULL CHECK (target_type IN ('invoice', 'wo', 'pending_invoice', 'ignore')),
  target_status   TEXT,
  set_cmp_date    BOOLEAN DEFAULT FALSE,
  notes           TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Sync log (one row per file upload)
CREATE TABLE IF NOT EXISTS cbre_sync_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at       TIMESTAMPTZ DEFAULT NOW(),
  file_name       TEXT,
  total_rows      INTEGER,
  matched_count   INTEGER,
  updated_count   INTEGER,
  unmatched_count INTEGER,
  user_id         UUID,
  summary         JSONB
);

CREATE INDEX IF NOT EXISTS idx_cbre_sync_log_synced_at ON cbre_sync_log(synced_at DESC);

-- 5. Sync changes detail (one row per individual change)
CREATE TABLE IF NOT EXISTS cbre_sync_changes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_log_id    UUID REFERENCES cbre_sync_log(id) ON DELETE CASCADE,
  wo_number      TEXT,
  field_changed  TEXT,
  old_value      TEXT,
  new_value      TEXT,
  applied_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cbre_sync_changes_log_id ON cbre_sync_changes(sync_log_id);
CREATE INDEX IF NOT EXISTS idx_cbre_sync_changes_wo     ON cbre_sync_changes(wo_number);

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE
-- After running, refresh PostgREST schema cache in Supabase if needed
-- ─────────────────────────────────────────────────────────────────────────────
