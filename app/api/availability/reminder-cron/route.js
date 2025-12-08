// app/api/availability/reminder-cron/route.js
// Automated daily reminder for techs who haven't submitted availability
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

// Get tomorrow's date in YYYY-MM-DD format (EST timezone)
const getTomorrowDate = () => {
  const now = new Date();
  // Convert to EST
  const estOffset = -5 * 60; // EST is UTC-5
  const utcOffset = now.getTimezoneOffset();
  const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000);
  
  // Add one day for tomorrow
  estTime.setDate(estTime.getDate() + 1);
  
  return estTime.toISOString().split('T')[0];
};

// Get today's date in YYYY-MM-DD format (EST timezone)
const getTodayDate = () => {
  const now = new Date();
  const estOffset = -5 * 60;
  const utcOffset = now.getTimezoneOffset();
  const estTime = new Date(now.getTime() + (utcOffset + estOffset) * 60 * 1000);
  return estTime.toISOString().split('T')[0];
};

export async function GET(request) {
  // Verify cron secret for security (optional but recommended)
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow without auth for testing, but log warning
    console.warn('Cron request without valid auth - allowing for now');
  }

  try {
    const tomorrowDate = getTomorrowDate();
    const todayDate = getTodayDate();
    
    console.log(`Running availability reminder check for: ${todayDate}`);

    // Get all active field workers
    const { data: fieldWorkers, error: usersError } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, email, phone, sms_carrier')
      .eq('is_active', true)
      .in('role', ['lead_tech', 'tech', 'helper']);

    if (usersError) throw usersError;

    if (!fieldWorkers || fieldWorkers.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No active field workers found',
        reminders_sent: 0 
      });
    }

    console.log(`Found ${fieldWorkers.length} active field workers`);

    // Get today's availability submissions
    const { data: submissions, error: submissionsError } = await supabase
      .from('daily_availability')
      .select('user_id')
      .eq('availability_date', todayDate);

    if (submissionsError) throw submissionsError;

    const submittedUserIds = new Set((submissions || []).map(s => s.user_id));

    // Find workers who haven't submitted
    const needsReminder = fieldWorkers.filter(w => !submittedUserIds.has(w.user_id));

    console.log(`${needsReminder.length} workers need reminder`);

    if (needsReminder.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'All field workers have submitted availability',
        reminders_sent: 0,
        total_workers: fieldWorkers.length
      });
    }

    // Send reminders
    const results = {
      sms_sent: 0,
      sms_failed: 0,
      email_sent: 0,
      email_failed: 0,
      details: []
    };

    for (const worker of needsReminder) {
      const workerName = `${worker.first_name} ${worker.last_name}`;
      const workerResult = { name: workerName, sms: null, email: null };

      // Send SMS if phone and carrier are set
      if (worker.phone && worker.sms_carrier) {
        const smsEmail = buildSmsEmail(worker.phone, worker.sms_carrier);
        if (smsEmail) {
          try {
            await transporter.sendMail({
              from: process.env.EMAIL_USER || 'emfcbre@gmail.com',
              to: smsEmail,
              subject: 'Availability',
              text: `EMF: Please submit your availability for tomorrow in the mobile app.`
            });
            results.sms_sent++;
            workerResult.sms = 'sent';
          } catch (smsError) {
            console.error(`SMS failed for ${workerName}:`, smsError.message);
            results.sms_failed++;
            workerResult.sms = 'failed';
          }
        }
      } else {
        workerResult.sms = 'no_carrier';
      }

      // Send email if email is set
      if (worker.email) {
        try {
          await transporter.sendMail({
            from: `"EMF Contracting" <${process.env.EMAIL_USER || 'emfcbre@gmail.com'}>`,
            to: worker.email,
            subject: '⏰ Daily Availability Reminder - EMF',
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; background-color: #1f2937; color: #ffffff; padding: 20px; }
                  .container { max-width: 500px; margin: 0 auto; background-color: #111827; border-radius: 8px; overflow: hidden; }
                  .header { background-color: #f59e0b; padding: 20px; text-align: center; }
                  .header h1 { margin: 0; color: white; font-size: 20px; }
                  .content { padding: 20px; }
                  .btn { display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
                  .footer { padding: 15px; text-align: center; background-color: #1f2937; font-size: 12px; color: #6b7280; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>⏰ Availability Reminder</h1>
                  </div>
                  <div class="content">
                    <p>Hi ${worker.first_name},</p>
                    <p>You haven't submitted your availability for tomorrow yet.</p>
                    <p>Please open the EMF mobile app and submit your status so we can plan accordingly.</p>
                    <div style="text-align: center; margin: 25px 0;">
                      <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://field-service-dashboard.vercel.app'}/mobile" class="btn">
                        📱 Open Mobile App
                      </a>
                    </div>
                    <p style="color: #9ca3af; font-size: 13px;">This helps us schedule jobs and ensure we have proper coverage.</p>
                  </div>
                  <div class="footer">
                    <p>EMF Contracting LLC</p>
                    <p>Automated reminder sent at 7 PM EST</p>
                  </div>
                </div>
              </body>
              </html>
            `
          });
          results.email_sent++;
          workerResult.email = 'sent';
        } catch (emailError) {
          console.error(`Email failed for ${workerName}:`, emailError.message);
          results.email_failed++;
          workerResult.email = 'failed';
        }
      } else {
        workerResult.email = 'no_email';
      }

      results.details.push(workerResult);
    }

    // Log the reminder batch
    try {
      await supabase.from('message_log').insert({
        message_type: 'availability_reminder_auto',
        message_text: 'Automated 7 PM availability reminder',
        recipient_count: needsReminder.length,
        sent_count: results.sms_sent + results.email_sent,
        failed_count: results.sms_failed + results.email_failed,
        sent_at: new Date().toISOString()
      });
    } catch (logError) {
      console.log('Could not log reminder (table may not exist)');
    }

    console.log('Reminder results:', results);

    return Response.json({
      success: true,
      message: `Sent reminders to ${needsReminder.length} workers`,
      date_checked: todayDate,
      total_workers: fieldWorkers.length,
      already_submitted: submittedUserIds.size,
      needs_reminder: needsReminder.length,
      results
    });

  } catch (error) {
    console.error('Availability reminder error:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
