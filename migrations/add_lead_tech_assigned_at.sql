-- Migration: Add lead_tech_assigned_at column to work_orders table
-- Run this in Supabase SQL Editor

-- Add the lead_tech_assigned_at column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'work_orders' 
        AND column_name = 'lead_tech_assigned_at'
    ) THEN
        ALTER TABLE work_orders 
        ADD COLUMN lead_tech_assigned_at TIMESTAMP WITH TIME ZONE;
        
        -- Backfill existing records: set lead_tech_assigned_at to date_entered for work orders that have a lead_tech
        UPDATE work_orders 
        SET lead_tech_assigned_at = date_entered 
        WHERE lead_tech_id IS NOT NULL 
        AND lead_tech_assigned_at IS NULL;
        
        -- Add a comment explaining the column
        COMMENT ON COLUMN work_orders.lead_tech_assigned_at IS 'Timestamp when lead tech was assigned to this work order (used for aging calculations)';
        
        RAISE NOTICE 'lead_tech_assigned_at column added successfully!';
    ELSE
        RAISE NOTICE 'lead_tech_assigned_at column already exists.';
    END IF;
END $$;

-- Create a trigger to automatically set lead_tech_assigned_at when lead_tech_id is set
CREATE OR REPLACE FUNCTION set_lead_tech_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
    -- If lead_tech_id is being set (from NULL to a value) and lead_tech_assigned_at is not already set
    IF NEW.lead_tech_id IS NOT NULL 
       AND (OLD.lead_tech_id IS NULL OR OLD.lead_tech_id IS DISTINCT FROM NEW.lead_tech_id)
       AND NEW.lead_tech_assigned_at IS NULL THEN
        NEW.lead_tech_assigned_at = NOW();
    END IF;
    
    -- If lead_tech_id is being cleared, optionally clear the assigned_at
    -- Uncomment the next line if you want to reset the timestamp when unassigned
    -- IF NEW.lead_tech_id IS NULL THEN NEW.lead_tech_assigned_at = NULL; END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS trigger_set_lead_tech_assigned_at ON work_orders;

CREATE TRIGGER trigger_set_lead_tech_assigned_at
    BEFORE INSERT OR UPDATE ON work_orders
    FOR EACH ROW
    EXECUTE FUNCTION set_lead_tech_assigned_at();

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'work_orders' 
AND column_name = 'lead_tech_assigned_at';
