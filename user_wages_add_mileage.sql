-- Add mileage_rate to user_wages table
-- Run in Supabase SQL Editor

ALTER TABLE user_wages
  ADD COLUMN IF NOT EXISTS mileage_rate numeric(10,2) NOT NULL DEFAULT 0.55;
