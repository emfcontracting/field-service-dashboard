-- Fix invoices_status_check constraint
-- The 'accepted' and 'paid' statuses were missing from the original constraint
-- Run this in Supabase SQL Editor

-- Step 1: Drop the existing constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Step 2: Recreate it with all valid statuses
ALTER TABLE invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'approved', 'accepted', 'synced', 'paid', 'rejected'));
