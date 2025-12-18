// app/api/notifications/route.js
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// SMS Gateway addresses for major carriers (kept for future use)
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
  aerial: 'voicestream.net',
};

// Create email transporter using Gmail
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'emfcbre@gmail.com',
      pass: process.env.EMAIL_PASS
    }
  });
};

// Format phone number to 10 digits (for SMS - not currently used)
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

// Build SMS email address from phone and carrier (for SMS - not currently used)
const buildSmsEmail = (phone, carrier) => {
  const formattedPhone = formatPhone(phone);
  const gateway = SMS_GATEWAYS[carrier];
  
  if (!formattedPhone || !gateway) {
    return null;
  }
  
  return `${formattedPhone}@${gateway}`;
};

// Build HTML email template for work order assignments
const buildAssignmentEmailHTML = (workOrder, recipientName, isEmergency = false) => {
  const priorityColor = isEmergency ? '#dc2626' : 
    workOrder.priority === 'high' ? '#f97316' :
    workOrder.priority === 'medium' ? '#eab308' : '#3b82f6';
  
  const priorityLabel = workOrder.priority?.toUpperCase() || 'NORMAL';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #1f2937; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <div style="background-color: ${isEmergency ? '#dc2626' : '#1e40af'}; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">
              ${isEmergency ? '🚨 EMERGENCY WORK ORDER' : '📋 New Work Order Assigned'}
            </h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 24px; color: #e5e7eb;">
            <p style="margin: 0 0 16px 0; font-size: 16px;">
              Hi ${recipientName},
            </p>
            
            <p style="margin: 0 0 24px 0; font-size: 16px;">
              ${isEmergency 
                ? 'You have been assigned an <strong style="color: #fca5a5;">EMERGENCY</strong> work order that requires immediate attention!'
                : 'You have been assigned a new work order. Please check the mobile app for details.'}
            </p>
            
            <!-- Work Order Details Box -->
            <div style="background-color: #374151; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Work Order #</td>
                  <td style="padding: 8px 0; color: white; font-size: 16px; font-weight: bold; text-align: right;">
                    ${workOrder.wo_number}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Building</td>
                  <td style="padding: 8px 0; color: white; font-size: 14px; text-align: right;">
                    ${workOrder.building || 'Not specified'}
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #9ca3af; font-size: 14px;">Priority</td>
                  <td style="padding: 8px 0; text-align: right;">
                    <span style="background-color: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold;">
                      ${priorityLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </div>
            
            ${workOrder.work_order_description ? `
            <div style="background-color: #374151; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; color: #9ca3af; font-size: 14px;">Description:</p>
              <p style="margin: 0; color: white; font-size: 14px; line-height: 1.5;">
                ${workOrder.work_order_description.substring(0, 300)}${workOrder.work_order_description.length > 300 ? '...' : ''}
              </p>
            </div>
            ` : ''}
            
            <!-- Action Button -->
            <div style="text-align: center; margin-top: 24px;">
              <a href="https://field-service-dashboard.vercel.app/mobile" 
                 style="display: inline-block; background-color: ${isEmergency ? '#dc2626' : '#22c55e'}; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
                ${isEmergency ? '🚨 View Emergency WO Now' : '📱 Open Mobile App'}
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #111827; padding: 16px; text-align: center;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
              EMF Contracting LLC<br>
              This is an automated notification. Please do not reply to this email.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Build plain text email for work order assignments
const buildAssignmentEmailText = (workOrder, recipientName, isEmergency = false) => {
  return `
${isEmergency ? '🚨 EMERGENCY WORK ORDER ASSIGNED' : 'New Work Order Assigned'}

Hi ${recipientName},

${isEmergency 
  ? 'You have been assigned an EMERGENCY work order that requires immediate attention!'
  : 'You have been assigned a new work order.'}

Work Order Details:
- WO#: ${workOrder.wo_number}
- Building: ${workOrder.building || 'Not specified'}
- Priority: ${workOrder.priority?.toUpperCase() || 'NORMAL'}
${workOrder.work_order_description ? `- Description: ${workOrder.work_order_description.substring(0, 200)}...` : ''}

Please check the mobile app for full details:
https://field-service-dashboard.vercel.app/mobile

---
EMF Contracting LLC
  `.trim();
};

export async function POST(request) {
  try {
    const { type, recipients, workOrder, customMessage, notificationMethod = 'email' } = await request.json();
    
    if (!type || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const transporter = createTransporter();
    const results = [];
    const errors = [];

    for (const recipient of recipients) {
      const { email, phone, sms_carrier, first_name, last_name } = recipient;
      
      // Determine recipient address based on notification method
      let toAddress = null;
      
      if (notificationMethod === 'sms') {
        // SMS via email-to-SMS gateway
        toAddress = buildSmsEmail(phone, sms_carrier);
        if (!toAddress) {
          errors.push({
            name: `${first_name} ${last_name}`,
            error: 'Missing phone number or carrier for SMS'
          });
          continue;
        }
      } else {
        // Email notification (default)
        if (!email) {
          errors.push({
            name: `${first_name} ${last_name}`,
            error: 'Missing email address'
          });
          continue;
        }
        toAddress = email;
      }

      // Build message based on notification type
      let subject = '';
      let textMessage = '';
      let htmlMessage = '';
      const recipientName = first_name || 'Team Member';
      const isEmergency = type === 'emergency_work_order' || workOrder?.priority === 'emergency';
      
      switch (type) {
        case 'work_order_assigned':
        case 'emergency_work_order':
          subject = isEmergency 
            ? `🚨 EMERGENCY: WO ${workOrder.wo_number} Assigned` 
            : `📋 New Work Order Assigned: ${workOrder.wo_number}`;
          
          if (notificationMethod === 'sms') {
            // Short SMS message
            textMessage = isEmergency
              ? `EMF EMERGENCY!\nWO: ${workOrder.wo_number}\n${workOrder.building || 'No location'}\nCheck app NOW!`
              : `EMF: New WO ${workOrder.wo_number} assigned.\n${workOrder.building || 'No location'}\nPriority: ${workOrder.priority?.toUpperCase() || 'NORMAL'}`;
          } else {
            // Full email with HTML
            textMessage = buildAssignmentEmailText(workOrder, recipientName, isEmergency);
            htmlMessage = buildAssignmentEmailHTML(workOrder, recipientName, isEmergency);
          }
          break;
          
        case 'status_update':
          subject = `WO ${workOrder.wo_number} Status Update`;
          textMessage = `EMF: WO ${workOrder.wo_number} status changed to ${workOrder.status?.toUpperCase()}`;
          break;

        case 'custom':
          subject = 'EMF Contracting Notification';
          textMessage = customMessage || 'You have a new message from EMF Contracting.';
          break;
          
        default:
          subject = 'EMF Contracting Notification';
          textMessage = customMessage || 'You have a new notification from EMF Contracting.';
      }

      try {
        const mailOptions = {
          from: `"EMF Contracting" <${process.env.EMAIL_USER || 'emfcbre@gmail.com'}>`,
          to: toAddress,
          subject: subject,
          text: textMessage
        };
        
        // Add HTML for email notifications (not SMS)
        if (notificationMethod !== 'sms' && htmlMessage) {
          mailOptions.html = htmlMessage;
        }
        
        await transporter.sendMail(mailOptions);

        results.push({
          name: `${first_name} ${last_name}`,
          method: notificationMethod,
          status: 'sent'
        });
      } catch (emailError) {
        console.error(`Failed to send to ${first_name} ${last_name}:`, emailError);
        errors.push({
          name: `${first_name} ${last_name}`,
          error: emailError.message
        });
      }
    }

    return NextResponse.json({
      success: true,
      sent: results.length,
      failed: errors.length,
      results,
      errors
    });

  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint to return available carriers (for SMS)
export async function GET() {
  const carriers = Object.keys(SMS_GATEWAYS).map(key => ({
    value: key,
    label: key.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }));
  
  return NextResponse.json({ carriers });
}
