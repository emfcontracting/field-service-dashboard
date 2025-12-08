# SMS Messaging Setup Guide

## Overview
The messaging system sends SMS messages to technicians via email-to-SMS gateways. It uses the same Gmail credentials as the aging alert system.

## Environment Variables
The system uses the same credentials as aging alerts:
- `EMAIL_USER` - Gmail address (e.g., emfcbre@gmail.com)
- `EMAIL_PASS` - Gmail App Password

**These are already configured if your aging alerts work!**

## Database Setup (Optional)
For message history logging, run this SQL in Supabase SQL Editor:

```sql
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

CREATE INDEX IF NOT EXISTS idx_message_log_sent_at ON message_log(sent_at DESC);
```

## Supported Carriers
- Verizon
- AT&T
- T-Mobile
- Sprint
- Boost Mobile
- Cricket
- Metro PCS
- US Cellular
- Google Fi
- Straight Talk
- Virgin Mobile
- Republic Wireless

## Usage
1. Go to Dashboard → 💬 Messages button (teal)
2. Select recipients (must have phone + carrier set in User Management)
3. Choose message type:
   - **📝 Custom**: Write your own message (160 char limit)
   - **📋 Work Order**: Notify about assigned WO
   - **🚨 Emergency**: Urgent WO notification
   - **⏰ Hours Reminder**: Daily hours reminder
   - **📅 Availability**: Request availability submission
4. Preview message
5. Click Send

## How It Works
The system sends emails to carrier SMS gateways:
- Verizon: `{phone}@vtext.com`
- AT&T: `{phone}@txt.att.net`
- T-Mobile: `{phone}@tmomail.net`
- etc.

The carrier then delivers the email as an SMS to the phone.

## Troubleshooting

### User not appearing in recipient list
- Check User Management page
- Ensure user has phone number AND carrier set
- User must be active

### Messages not being received
- Verify carrier is correct (user can update in mobile app)
- Some carriers may delay delivery
- Check if message was marked as spam

### "Missing phone number or carrier" error
- User needs to set up their carrier:
  - In mobile app (first login prompts setup)
  - Or admin sets it in User Management page
