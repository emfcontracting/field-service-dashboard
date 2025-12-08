// app/api/weather/alert/route.js
// Send weather alerts to field techs via SMS and email
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'emfcbre@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

const formatPhone = (phone) => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  if (digits.length === 10) return digits;
  return null;
};

const buildSmsEmail = (phone, carrier) => {
  const formattedPhone = formatPhone(phone);
  const gateway = SMS_GATEWAYS[carrier];
  if (!formattedPhone || !gateway) return null;
  return `${formattedPhone}@${gateway}`;
};

export async function POST(request) {
  try {
    const { alertType, alertMessage, alertDetails, severity } = await request.json();
    
    // Get all active field workers
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, email, phone, sms_carrier, role')
      .eq('is_active', true)
      .in('role', ['lead_tech', 'tech', 'helper', 'admin', 'office']);

    if (usersError) throw usersError;

    const results = {
      sms_sent: 0,
      sms_failed: 0,
      email_sent: 0,
      email_failed: 0,
      recipients: []
    };

    // Build SMS message (max 160 chars)
    const smsMessage = alertMessage.length > 160 
      ? alertMessage.slice(0, 157) + '...'
      : alertMessage;

    // Build email content
    const severityColors = {
      'Extreme': '#dc2626',
      'Severe': '#ea580c',
      'Moderate': '#ca8a04',
      'Minor': '#2563eb'
    };

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; background-color: #1f2937; color: #ffffff; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #111827; border-radius: 8px; overflow: hidden; }
          .header { background-color: ${severityColors[severity] || '#ca8a04'}; padding: 20px; text-align: center; }
          .header h1 { margin: 0; color: white; }
          .content { padding: 20px; }
          .alert-box { background-color: #374151; border-radius: 8px; padding: 15px; margin: 15px 0; }
          .footer { padding: 15px; text-align: center; background-color: #1f2937; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Weather Alert</h1>
          </div>
          <div class="content">
            <div class="alert-box">
              <h2 style="margin-top: 0; color: ${severityColors[severity] || '#ca8a04'};">${alertType || 'Weather Advisory'}</h2>
              <p>${alertMessage}</p>
              ${alertDetails ? `<p style="color: #9ca3af; font-size: 14px;">${alertDetails}</p>` : ''}
            </div>
            
            <h3>🦺 Safety Reminders:</h3>
            <ul style="color: #d1d5db;">
              <li>Check conditions before starting outdoor work</li>
              <li>Seek shelter during lightning - wait 30 min after last strike</li>
              <li>No ladder/lift work in high winds (25+ mph)</li>
              <li>Contact dispatch if conditions prevent safe work</li>
            </ul>
            
            <p style="margin-top: 20px;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://field-service-dashboard.vercel.app'}/weather" 
                 style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                📍 View Full Forecast
              </a>
            </p>
          </div>
          <div class="footer">
            <p>EMF Contracting LLC - Weather Alert System</p>
            <p>Sent: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</p>
          </div>
        </div>
      </body>
      </html>
    `;

    for (const user of users || []) {
      const userName = `${user.first_name} ${user.last_name}`;
      
      // Send SMS
      if (user.phone && user.sms_carrier) {
        const smsEmail = buildSmsEmail(user.phone, user.sms_carrier);
        if (smsEmail) {
          try {
            await transporter.sendMail({
              from: process.env.EMAIL_USER || 'emfcbre@gmail.com',
              to: smsEmail,
              subject: 'Weather',
              text: smsMessage
            });
            results.sms_sent++;
          } catch (e) {
            results.sms_failed++;
          }
        }
      }

      // Send Email
      if (user.email) {
        try {
          await transporter.sendMail({
            from: `"EMF Weather Alerts" <${process.env.EMAIL_USER || 'emfcbre@gmail.com'}>`,
            to: user.email,
            subject: `⚠️ EMF Weather Alert: ${alertType || 'Advisory'}`,
            html: emailHtml
          });
          results.email_sent++;
        } catch (e) {
          results.email_failed++;
        }
      }

      results.recipients.push(userName);
    }

    // Log the alert
    try {
      await supabase.from('message_log').insert({
        message_type: 'weather_alert',
        message_text: smsMessage,
        recipient_count: users?.length || 0,
        sent_count: results.sms_sent + results.email_sent,
        failed_count: results.sms_failed + results.email_failed,
        sent_at: new Date().toISOString()
      });
    } catch (e) {
      console.log('Could not log weather alert');
    }

    return Response.json({
      success: true,
      message: `Weather alert sent to ${users?.length || 0} team members`,
      results
    });

  } catch (error) {
    console.error('Weather alert error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
