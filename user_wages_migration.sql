-- ══════════════════════════════════════════════════════════
--  user_wages — Admin-only wage table
--  Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_wages (
  wage_id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  hourly_rate_regular   numeric(10,2) NOT NULL DEFAULT 0,
  hourly_rate_overtime  numeric(10,2) NOT NULL DEFAULT 0,
  effective_date        date NOT NULL DEFAULT CURRENT_DATE,
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE(user_id)
);

-- ── RLS: ONLY admins can read/write ─────────────────────────────────────────
ALTER TABLE user_wages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_wages" ON user_wages
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.auth_id = auth.uid()
        AND users.role = 'admin'
        AND users.is_active = true
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_wages_updated_at ON user_wages;
CREATE TRIGGER update_user_wages_updated_at
  BEFORE UPDATE ON user_wages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
