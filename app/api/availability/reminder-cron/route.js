// app/api/availability/reminder-cron/route.js
// Automated daily reminder - reads settings from automated_messages table
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// SMS Gateway addresses for carriers
const SMS_GATEWAYS = {
  verizon: 'vtext.com',
  att: 'txt.att.net',
  tmobile: 'tmomail.net',
  sprint: 'messaging.sprintpcs.com',
  boost: 'sms.myboostmobile.com',
  cricket: 'sms.cricketwireless.net',
  metro: 'mymetropcs.com',
  uscellular: 'email.uscc.net',
  virgin: 'vmobl.com',
  republic: 'text.republicwireless.com',
  googlefi: 'msg.fi.google.com',
  straight_talk: 'vtext.com',
  bellsouth: 'sms.bellsouth.com',
};

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'emfcbre@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

// Format phone number to 10 digits
const formatPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  if (digits.length === 10) {
    return digits;
  }
  return null;
};

// Build SMS email address
const buildSmsEmail = (phone, carrier) => {
  const formattedPhone = formatPhone(phone);
  const gateway = SMS_GATEWAYS[carrier];
  if (!formattedPhone || !gateway) return null;
  return `${formattedPhone}@${gateway}`;
};

// Get current EST time info
const getESTInfo = () => {
  const now = new Date();
  const estOffset = -5 * 60;
  const utcOffset = now.getTimezoneOffset();
  const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000);
  
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = days[estTime.getDay()];
  const hours = estTime.getHours().toString().padStart(2, '0');
  const minutes = estTime.getMinutes().toString().padStart(2, '0');
  const currentTime = `${hours}:${minutes}`;
  const todayDate = estTime.toISOString().split('T')[0];
  
  return { dayName, currentTime, todayDate, estTime };
};

export async function GET(request) {
  try {
    const { dayName, currentTime, todayDate } = getESTInfo();
    
    console.log(`Cron running: ${dayName} ${currentTime} EST, date: ${todayDate}`);

    // Get all enabled automations
    let automations = [];
    try {
      const { data, error } = await supabase
        .from('automated_messages')
        .select('*')
        .eq('is_enabled', true);
      
      if (!error && data) {
        automations = data;
      }
    } catch (e) {
      console.log('automated_messages table not found, using defaults');
    }

    // If no automations in DB, check if availability_reminder should run (default behavior)
    if (automations.length === 0) {
      // Default: run availability reminder at 7 PM on weekdays and Sunday
      const defaultDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'sunday'];
      if (defaultDays.includes(dayName)) {
        automations = [{
          automation_key: 'availability_reminder',
          name: 'Availability Reminder',
          target_roles: ['lead_tech', 'tech', 'helper'],
          send_sms: true,
          send_email: true,
          sms_message: 'EMF: Please submit your availability for tomorrow in the mobile app.',
          email_subject: '⏰ Daily Availability Reminder - EMF',
          condition_type: 'missing_submission',
          condition_table: 'daily_availability'
        }];
      }
    }

    // Filter automations that should run today
    const toRun = automations.filter(a => {
      const scheduleDays = a.schedule_days || [];
      return scheduleDays.includes(dayName);
    });

    if (toRun.length === 0) {
      return Response.json({
        success: true,
        message: `No automations scheduled for ${dayName}`,
        day: dayName,
        time: currentTime
      });
    }

    const allResults = [];

    for (const automation of toRun) {
      console.log(`Processing automation: ${automation.name}`);
      
      const result = await runAutomation(automation, todayDate);
      allResults.push({
        name: automation.name,
        ...result
      });

      // Update last_run_at
      if (automation.id) {
        await supabase
          .from('automated_messages')
          .update({ last_run_at: new Date().toISOString() })
          .eq('id', automation.id);
      }
    }

    return Response.json({
      success: true,
      day: dayName,
      time: currentTime,
      date: todayDate,
      automations_run: allResults.length,
      results: allResults
    });

  } catch (error) {
    console.error('Cron error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST handler for manual trigger
export async function POST(request) {
  return GET(request);
}

async function runAutomation(automation, todayDate) {
  const results = {
    sms_sent: 0,
    sms_failed: 0,
    email_sent: 0,
    email_failed: 0,
    skipped: 0,
    details: []
  };

  try {
    // Get target users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, email, phone, sms_carrier')
      .eq('is_active', true)
      .in('role', automation.target_roles || ['lead_tech', 'tech', 'helper']);

    if (usersError) throw usersError;
    if (!users || users.length === 0) {
      return { ...results, message: 'No target users found' };
    }

    let targetUsers = users;

    // Apply condition filtering
    if (automation.condition_type === 'missing_submission' && automation.condition_table === 'daily_availability') {
      // Only send to users who haven't submitted availability
      const { data: submissions } = await supabase
        .from('daily_availability')
        .select('user_id')
        .eq('availability_date', todayDate);

      const submittedIds = new Set((submissions || []).map(s => s.user_id));
      targetUsers = users.filter(u => !submittedIds.has(u.user_id));
      results.skipped = users.length - targetUsers.length;
    }

    if (targetUsers.length === 0) {
      return { ...results, message: 'All users already submitted / no users need notification' };
    }

    // Send notifications
    for (const user of targetUsers) {
      const userName = `${user.first_name} ${user.last_name}`;
      const userResult = { name: userName, sms: null, email: null };

      // Send SMS
      if (automation.send_sms && user.phone && user.sms_carrier) {
        const smsEmail = buildSmsEmail(user.phone, user.sms_carrier);
        if (smsEmail) {
          try {
            await transporter.sendMail({
              from: process.env.EMAIL_USER || 'emfcbre@gmail.com',
              to: smsEmail,
              subject: 'EMF',
              text: automation.sms_message || 'You have a notification from EMF.'
            });
            results.sms_sent++;
            userResult.sms = 'sent';
          } catch (e) {
            results.sms_failed++;
            userResult.sms = 'failed';
          }
        }
      }

      // Send Email
      if (automation.send_email && user.email) {
        try {
          await transporter.sendMail({
            from: `"EMF Contracting" <${process.env.EMAIL_USER || 'emfcbre@gmail.com'}>`,
            to: user.email,
            subject: automation.email_subject || 'EMF Notification',
            html: buildEmailHtml(automation, user)
          });
          results.email_sent++;
          userResult.email = 'sent';
        } catch (e) {
          results.email_failed++;
          userResult.email = 'failed';
        }
      }

      results.details.push(userResult);
    }

    // Log to message_log
    try {
      await supabase.from('message_log').insert({
        message_type: automation.automation_key,
        message_text: automation.sms_message,
        recipient_count: targetUsers.length,
        sent_count: results.sms_sent + results.email_sent,
        failed_count: results.sms_failed + results.email_failed,
        automation_id: automation.id || null,
        sent_at: new Date().toISOString()
      });
    } catch (e) {
      console.log('Could not log message');
    }

    return results;

  } catch (error) {
    console.error(`Error in automation ${automation.name}:`, error);
    return { ...results, error: error.message };
  }
}

function buildEmailHtml(automation, user) {
  const iconColors = {
    '📅': '#f59e0b',
    '⏱️': '#3b82f6',
    '⚠️': '#ef4444',
    '📋': '#8b5cf6',
    '📨': '#10b981'
  };
  
  const headerColor = iconColors[automation.icon] || '#3b82f6';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; background-color: #1f2937; color: #ffffff; padding: 20px; }
        .container { max-width: 500px; margin: 0 auto; background-color: #111827; border-radius: 8px; overflow: hidden; }
        .header { background-color: ${headerColor}; padding: 20px; text-align: center; }
        .header h1 { margin: 0; color: white; font-size: 20px; }
        .content { padding: 20px; }
        .btn { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
        .footer { padding: 15px; text-align: center; background-color: #1f2937; font-size: 12px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${automation.icon || '📨'} ${automation.name}</h1>
        </div>
        <div class="content">
          <p>Hi ${user.first_name},</p>
          <p>${automation.sms_message || 'You have a notification from EMF Contracting.'}</p>
          <div style="text-align: center; margin: 25px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://field-service-dashboard.vercel.app'}/mobile" class="btn">
              📱 Open Mobile App
            </a>
          </div>
        </div>
        <div class="footer">
          <p>EMF Contracting LLC</p>
          <p>Automated message</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
