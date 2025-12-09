// app/api/notifications/route.js
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// SMS Gateway addresses for major carriers
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
  straight_talk: 'vtext.com', // Uses Verizon network typically
  bellsouth: 'sms.bellsouth.com',
  aerial: 'voicestream.net', // Aerial Communications
};

// Create email transporter using Gmail
// Uses same credentials as aging alerts
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'emfcbre@gmail.com',
      pass: process.env.EMAIL_PASS
    }
  });
};

// Format phone number to 10 digits
const formatPhone = (phone) => {
  if (!phone) return null;
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // Handle 11-digit numbers starting with 1
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  // Return 10-digit number
  if (digits.length === 10) {
    return digits;
  }
  return null;
};

// Build SMS email address from phone and carrier
const buildSmsEmail = (phone, carrier) => {
  const formattedPhone = formatPhone(phone);
  const gateway = SMS_GATEWAYS[carrier];
  
  if (!formattedPhone || !gateway) {
    return null;
  }
  
  return `${formattedPhone}@${gateway}`;
};

export async function POST(request) {
  try {
    const { type, recipients, workOrder, customMessage } = await request.json();
    
    if (!type || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const transporter = createTransporter();
    const results = [];
    const errors = [];

    for (const recipient of recipients) {
      const { phone, sms_carrier, first_name, last_name } = recipient;
      
      // Build SMS email address
      const smsEmail = buildSmsEmail(phone, sms_carrier);
      
      if (!smsEmail) {
        errors.push({
          name: `${first_name} ${last_name}`,
          error: 'Missing phone number or carrier'
        });
        continue;
      }

      // Build message based on notification type
      let subject = '';
      let message = '';
      
      switch (type) {
        case 'work_order_assigned':
          subject = 'New Work Order';
          message = `EMF: New WO ${workOrder.wo_number} assigned.\n${workOrder.building || 'No location'}\nPriority: ${workOrder.priority?.toUpperCase() || 'NORMAL'}`;
          break;
          
        case 'emergency_work_order':
          subject = 'EMERGENCY WO';
          message = `EMF EMERGENCY!\nWO: ${workOrder.wo_number}\n${workOrder.building || 'No location'}\nCheck app NOW!`;
          break;
          
        case 'status_update':
          subject = 'WO Update';
          message = `EMF: WO ${workOrder.wo_number} status changed to ${workOrder.status?.toUpperCase()}`;
          break;

        case 'custom':
          subject = 'EMF Message';
          message = customMessage || 'You have a new message from EMF Contracting.';
          break;
          
        default:
          subject = 'EMF Notification';
          message = customMessage || 'You have a new notification from EMF Contracting.';
      }

      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER || 'emfcbre@gmail.com',
          to: smsEmail,
          subject: subject,
          text: message
        });

        results.push({
          name: `${first_name} ${last_name}`,
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

// GET endpoint to return available carriers
export async function GET() {
  const carriers = Object.keys(SMS_GATEWAYS).map(key => ({
    value: key,
    label: key.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }));
  
  return NextResponse.json({ carriers });
}
