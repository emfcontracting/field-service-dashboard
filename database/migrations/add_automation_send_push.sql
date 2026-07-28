-- Add "Send to App (Push)" as a delivery channel for automated messages,
-- alongside the existing send_sms / send_email options.
-- Run once in the Supabase SQL Editor.

ALTER TABLE automated_messages
  ADD COLUMN IF NOT EXISTS send_push BOOLEAN DEFAULT true;

-- Existing rows: default to sending push (preserves the current behavior where
-- the availability reminder already pushes to the app). Toggle per automation
-- in Settings → Automations.
UPDATE automated_messages SET send_push = true WHERE send_push IS NULL;
