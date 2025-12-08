-- Migration: Create message_log table for tracking sent SMS messages
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS message_log (
  log_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_type VARCHAR(50) NOT NULL,
  message_text TEXT NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  sent_by UUID REFERENCES users(user_id),
  wo_id UUID REFERENCES work_orders(wo_id),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_message_log_sent_at ON message_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_log_type ON message_log(message_type);

-- Add comment for documentation
COMMENT ON TABLE message_log IS 'Log of SMS messages sent to field technicians';
