-- migrations/add_cbre_sync_rls.sql (OPTIONAL)
-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS on the 3 new CBRE tables.
-- These are admin-only tables (no mobile PIN conflict), so RLS is safe here.
-- Run ONLY if you want extra DB-level security beyond the app-level checks.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enable RLS
ALTER TABLE cbre_status_mappings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbre_sync_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE cbre_sync_changes     ENABLE ROW LEVEL SECURITY;

-- 2. Helper function: check if current auth user is admin
--    (uses your existing users table → role column)
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 3. Policies — admins can do everything, no one else has access
CREATE POLICY "Admin full access on cbre_status_mappings"
  ON cbre_status_mappings FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Admin full access on cbre_sync_log"
  ON cbre_sync_log FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

CREATE POLICY "Admin full access on cbre_sync_changes"
  ON cbre_sync_changes FOR ALL
  TO authenticated
  USING (is_admin_user())
  WITH CHECK (is_admin_user());

-- ─────────────────────────────────────────────────────────────────────────────
-- DONE. Now only authenticated users with role='admin' can read/write these.
-- ─────────────────────────────────────────────────────────────────────────────
