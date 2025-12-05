-- Migration: Add scheduled_date column to work_orders table
-- Run this in Supabase SQL Editor

-- Add the scheduled_date column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'work_orders' 
        AND column_name = 'scheduled_date'
    ) THEN
        ALTER TABLE work_orders 
        ADD COLUMN scheduled_date DATE;
        
        -- Add an index for faster calendar queries
        CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_date 
        ON work_orders(scheduled_date);
        
        -- Add a comment explaining the column
        COMMENT ON COLUMN work_orders.scheduled_date IS 'The date this work order is scheduled to be performed';
        
        RAISE NOTICE 'scheduled_date column added successfully!';
    ELSE
        RAISE NOTICE 'scheduled_date column already exists.';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'work_orders' 
AND column_name = 'scheduled_date';
