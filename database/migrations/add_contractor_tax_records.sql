-- migrations/add_contractor_tax_records.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Contractor Tax Records — manual personal/business expense tracking
-- for year-end tax preparation. Complements the existing tax-report which
-- only covers EMF-related income (hours, mileage, materials, hotel, food).
--
-- This adds the personal expense side (clothing, tools, mortgage, medical,
-- etc.) so contractors can hand both reports to their tax preparer.
--
-- Default categories are defined in lib/taxRecordCategories.js (26 from
-- the standard template). This table only stores user-defined CUSTOM
-- categories beyond the defaults.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Custom categories (user-defined only — defaults live in JS)
CREATE TABLE IF NOT EXISTS contractor_tax_categories (
  category_id      UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  category_name    VARCHAR(100) NOT NULL,
  color_hex        VARCHAR(7)   DEFAULT '#9CA3AF',
  display_order    INTEGER      DEFAULT 999,
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(user_id, category_name)
);

-- 2. Tax record entries — each receipt/expense entry
CREATE TABLE IF NOT EXISTS contractor_tax_records (
  record_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID         NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  tax_year         INTEGER      NOT NULL,
  entry_date       DATE         NOT NULL,
  invoice_ref      VARCHAR(100),
  category_name    VARCHAR(100) NOT NULL,  -- matches either a default or a custom category
  amount           DECIMAL(10,2) NOT NULL,
  notes            TEXT,
  receipt_url      TEXT,                    -- optional Supabase Storage URL
  created_at       TIMESTAMPTZ  DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tax_records_user_year
  ON contractor_tax_records(user_id, tax_year);

CREATE INDEX IF NOT EXISTS idx_tax_records_user_year_category
  ON contractor_tax_records(user_id, tax_year, category_name);

-- 3. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tax_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tax_records_updated_at ON contractor_tax_records;
CREATE TRIGGER trg_tax_records_updated_at
  BEFORE UPDATE ON contractor_tax_records
  FOR EACH ROW
  EXECUTE FUNCTION update_tax_records_updated_at();

-- Column comments for clarity
COMMENT ON TABLE  contractor_tax_records       IS 'Manual tax expense entries by subcontractors for year-end tax prep';
COMMENT ON TABLE  contractor_tax_categories    IS 'User-defined custom expense categories (defaults are in lib/taxRecordCategories.js)';
COMMENT ON COLUMN contractor_tax_records.invoice_ref IS 'Receipt or invoice number from the vendor (e.g., Home Depot receipt #)';
COMMENT ON COLUMN contractor_tax_records.receipt_url IS 'Optional photo of receipt stored in Supabase Storage';
