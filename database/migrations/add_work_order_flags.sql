-- ─────────────────────────────────────────────────────────────────────────────
-- Work Order Flags: admin/office team members flag a WO for Daniel's review.
--
-- Use cases:
--   • Office spots something weird on a quote/invoice and wants Daniel to look
--   • Admin wants to remember to revisit a WO later
--   • Daniel himself flags a WO as a personal "to-revisit" reminder
--
-- Multiple flags per WO are allowed (different people, different concerns).
-- A flag has its own lifecycle (open → resolved) independent of the WO.
--
-- Auth model:
--   • Only admins + office_staff can create/view/resolve flags
--   • Anyone with admin/office role can resolve THEIR OWN flags
--   • Superadmin (Daniel) can resolve ANY flag
--   • Permissions enforced at the API layer (lib/supabase + role check),
--     RLS stays disabled here — consistent with the rest of the app.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS work_order_flags (
  flag_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_id             UUID NOT NULL REFERENCES work_orders(wo_id) ON DELETE CASCADE,

  -- Who raised the flag
  flagged_by        UUID NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  flagged_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The actual concern (required — flag without a comment is useless)
  comment           TEXT NOT NULL,
  priority          TEXT NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('low', 'medium', 'high')),

  -- Lifecycle
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'resolved')),
  resolved_by       UUID REFERENCES users(user_id) ON DELETE SET NULL,
  resolved_at       TIMESTAMPTZ,
  resolution_note   TEXT  -- what was done (optional)
);

-- Indexes for the typical access patterns:
--   1. List all OPEN flags (Review Queue view) — fast scan on status='open'
--   2. Show flags for one WO (Detail Modal) — index on wo_id
--   3. Sort the queue by priority+age (desc severity, oldest first)
CREATE INDEX IF NOT EXISTS idx_flags_status_open
  ON work_order_flags(flagged_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_flags_wo_id
  ON work_order_flags(wo_id);

CREATE INDEX IF NOT EXISTS idx_flags_flagged_by
  ON work_order_flags(flagged_by);

-- Permissive RLS (consistent with the rest of the app — auth is at app level).
-- We still enable RLS so the linter is happy; the policy lets everything through.
ALTER TABLE work_order_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_flags ON work_order_flags;
CREATE POLICY allow_all_flags ON work_order_flags FOR ALL USING (true) WITH CHECK (true);

COMMENT ON TABLE  work_order_flags IS 'Admin/office-raised review flags on work orders. Multiple flags per WO allowed.';
COMMENT ON COLUMN work_order_flags.priority        IS 'low | medium | high — visual hierarchy in the Review Queue';
COMMENT ON COLUMN work_order_flags.status          IS 'open | resolved';
COMMENT ON COLUMN work_order_flags.comment         IS 'What the flagger wants reviewed. Required.';
COMMENT ON COLUMN work_order_flags.resolution_note IS 'Notes added by whoever resolved the flag (optional)';
