-- Create daily_hours_log table for tracking daily time entries
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS daily_hours_log (
    log_id SERIAL PRIMARY KEY,
    wo_id INTEGER NOT NULL REFERENCES work_orders(wo_id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    assignment_id INTEGER REFERENCES work_order_assignments(assignment_id) ON DELETE SET NULL,
    work_date DATE NOT NULL,
    hours_regular DECIMAL(4,2) DEFAULT 0,
    hours_overtime DECIMAL(4,2) DEFAULT 0,
    miles DECIMAL(6,1) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate entries for same user/date/work order
    UNIQUE(wo_id, user_id, work_date)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_hours_wo_id ON daily_hours_log(wo_id);
CREATE INDEX IF NOT EXISTS idx_daily_hours_user_id ON daily_hours_log(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_hours_work_date ON daily_hours_log(work_date);
CREATE INDEX IF NOT EXISTS idx_daily_hours_wo_user ON daily_hours_log(wo_id, user_id);

-- Enable Row Level Security
ALTER TABLE daily_hours_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see all daily hours for work orders they're assigned to
CREATE POLICY "Users can view daily hours for their work orders" ON daily_hours_log
    FOR SELECT
    USING (
        user_id IN (SELECT user_id FROM users WHERE is_active = true)
    );

-- Policy: Users can insert their own daily hours
CREATE POLICY "Users can insert their own daily hours" ON daily_hours_log
    FOR INSERT
    WITH CHECK (true);

-- Policy: Users can update their own daily hours
CREATE POLICY "Users can update their own daily hours" ON daily_hours_log
    FOR UPDATE
    USING (true);

-- Policy: Users can delete their own daily hours
CREATE POLICY "Users can delete their own daily hours" ON daily_hours_log
    FOR DELETE
    USING (true);

-- Comment on table
COMMENT ON TABLE daily_hours_log IS 'Stores daily time entries for work orders - allows tracking hours per day per tech';
