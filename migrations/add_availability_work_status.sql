-- migrations/add_availability_work_status.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Two Daily-Availability additions.
--
-- 1. Saturday regular work — needs NO new column. It reuses `scheduled_work`:
--    the Friday 5pm prompt now also offers "Scheduled work (Saturday)", exactly
--    like weekdays offer "scheduled tomorrow". So a Friday row with
--    scheduled_work = true means the tech will take regular work on Saturday.
--
-- 2. "Have work / Need work" — when a tech is AVAILABLE (scheduled and/or
--    emergency, not "not available"), they say whether they already have work
--    (e.g. a return trip, waiting on material) or need work assigned. This lets
--    the office see at a glance who to dispatch to.
--
--    has_work:  true  = tech already has work
--               false = tech needs work
--               null  = n/a (not_available) or legacy rows
--    work_status_reason: 'return_trip' | 'waiting_material' | 'other'
--                        (set only when has_work = true)
--    work_status_note:   optional free-text detail (esp. for reason = 'other')
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE daily_availability
  ADD COLUMN IF NOT EXISTS has_work            BOOLEAN,
  ADD COLUMN IF NOT EXISTS work_status_reason  TEXT,
  ADD COLUMN IF NOT EXISTS work_status_note    TEXT;

-- Fast "who needs work today" lookup for the dispatch / Availability view.
CREATE INDEX IF NOT EXISTS idx_daily_availability_needs_work
  ON daily_availability (availability_date)
  WHERE has_work = false;

COMMENT ON COLUMN daily_availability.has_work IS
  'true = tech already has work; false = needs work; null = n/a (not_available). Only meaningful when the tech is available.';
COMMENT ON COLUMN daily_availability.work_status_reason IS
  'return_trip | waiting_material | other — why the tech already has work. Set only when has_work = true.';
COMMENT ON COLUMN daily_availability.work_status_note IS
  'Optional free-text detail for has_work (especially when reason = other).';
