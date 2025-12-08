-- Automated Messages Configuration Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS automated_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_key VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  schedule_time TIME NOT NULL DEFAULT '19:00',
  schedule_days TEXT[] DEFAULT ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  target_roles TEXT[] DEFAULT ARRAY['lead_tech', 'tech', 'helper'],
  send_sms BOOLEAN DEFAULT true,
  send_email BOOLEAN DEFAULT true,
  sms_message TEXT,
  email_subject VARCHAR(255),
  email_template TEXT,
  is_enabled BOOLEAN DEFAULT false,
  condition_type VARCHAR(50) DEFAULT 'always',
  condition_table VARCHAR(100),
  icon VARCHAR(10) DEFAULT '📨',
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_automated_messages_enabled ON automated_messages(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automated_messages_key ON automated_messages(automation_key);

-- Insert default automations
INSERT INTO automated_messages (automation_key, name, description, schedule_time, schedule_days, target_roles, send_sms, send_email, sms_message, email_subject, is_enabled, condition_type, condition_table, icon)
VALUES 
  ('availability_reminder', 'Availability Reminder', 'Reminds field techs to submit their daily availability', '19:00', ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'sunday'], ARRAY['lead_tech', 'tech', 'helper'], true, true, 'EMF: Please submit your availability for tomorrow in the mobile app.', '⏰ Daily Availability Reminder - EMF', true, 'missing_submission', 'daily_availability', '📅'),
  ('hours_reminder', 'Hours Entry Reminder', 'Reminds techs to log their hours for the day', '18:00', ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], ARRAY['lead_tech', 'tech', 'helper'], true, true, 'EMF: Please log your hours for today in the mobile app before EOD.', '⏰ Daily Hours Reminder - EMF', false, 'always', NULL, '⏱️'),
  ('aging_alert', 'Aging Work Order Alert', 'Alerts techs about work orders open 2+ days', '08:00', ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], ARRAY['lead_tech', 'tech'], false, true, 'EMF: You have aging work orders. Check your email or app for details.', '⚠️ Aging Work Orders Alert - EMF', false, 'has_aging_wo', 'work_orders', '⚠️'),
  ('weekly_schedule', 'Weekly Schedule Summary', 'Sends weekly schedule to all techs on Sunday evening', '18:00', ARRAY['sunday'], ARRAY['lead_tech', 'tech', 'helper'], false, true, 'EMF: Your weekly schedule has been sent to your email.', '📋 Your Week Ahead - EMF Schedule', false, 'always', NULL, '📋')
ON CONFLICT (automation_key) DO NOTHING;

-- Message log table for tracking sent messages (if not already created)
CREATE TABLE IF NOT EXISTS message_log (
  log_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_type VARCHAR(50) NOT NULL,
  message_text TEXT NOT NULL,
  recipient_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  sent_by UUID REFERENCES users(user_id),
  wo_id UUID REFERENCES work_orders(wo_id),
  automation_id UUID REFERENCES automated_messages(id),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_log_sent_at ON message_log(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_log_type ON message_log(message_type);
