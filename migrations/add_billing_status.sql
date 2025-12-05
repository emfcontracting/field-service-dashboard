-- Migration: Add billing_status column to work_orders table
-- This creates a separate billing/quote status independent of work completion status
-- Run this in Supabase SQL Editor

-- Add billing_status column
ALTER TABLE work_orders 
ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT NULL;

-- Add constraint to ensure only valid values
-- Options: NULL (no flag), 'pending_cbre_quote', 'quoted', 'quote_approved'
-- Note: Run this separately if the constraint already exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'billing_status_check'
    ) THEN
        ALTER TABLE work_orders
        ADD CONSTRAINT billing_status_check 
        CHECK (billing_status IS NULL OR billing_status IN ('pending_cbre_quote', 'quoted', 'quote_approved'));
    END IF;
END $$;

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_work_orders_billing_status 
ON work_orders(billing_status) 
WHERE billing_status IS NOT NULL;

-- Optional: Add comment for documentation
COMMENT ON COLUMN work_orders.billing_status IS 
'Tracks billing/quoting status separate from work status. NULL=no flag, pending_cbre_quote=needs CBRE quote, quoted=quote submitted to CBRE, quote_approved=quote approved by CBRE';
