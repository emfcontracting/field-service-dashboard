// app/api/notifications/route.js
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase for fetching push subscriptions
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Configure web-push with VAPID keys
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:emfcbre@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Create email transporter using Gmail
const createTransporter = () => {
  const emailUser = process.env.EMAIL_USER || 'emfcbre@gmail.com';
  const emailPass = process.env.EMAIL_PASS;
  
  if (!emailPass) {
    console.warn('EMAIL_PASS not configured - email notifications will fail');
  }
  
  console.log(`Creating email transporter for ${emailUser}`);
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass
    },
    debug: true, // Enable debug logging
    logger: true  // Log to console
  });
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
          <div style="background-color: ${isEmergency ? '#dc2626' : '#1d4ed8'}; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">
              ${isEmergency ? '🚨 EMERGENCY WORK ORDER' : '📋 New Work Order Assigned'}
            </h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 20px; color: white;">
            <p style="margin: 0 0 15px 0; font-size: 16px;">
              Hi ${recipientName},
            </p>
            <p style="margin: 0 0 20px 0; color: #9ca3af;">
              ${isEmergency 
                ? 'You have been assigned an EMERGENCY work order that requires immediate attention!'
                : 'You have been assigned a new work order.'}
            </p>
            
            <!-- Work Order Details -->
            <div style="background-color: #374151; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #9ca3af; width: 100px;">WO #:</td>
                  <td style="padding: 8px 0; color: white; font-weight: bold;">${workOrder.wo_number}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #9ca3af;">Building:</td>
                  <td style="padding: 8px 0; color: white;">${workOrder.building || 'Not specified'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #9ca3af;">Priority:</td>
                  <td style="padding: 8px 0;">
                    <span style="background-color: ${priorityColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold;">
                      ${priorityLabel}
                    </span>
                  </td>
                </tr>
                ${workOrder.work_order_description ? `
                <tr>
                  <td style="padding: 8px 0; color: #9ca3af; vertical-align: top;">Description:</td>
                  <td style="padding: 8px 0; color: #d1d5db;">${workOrder.work_order_description.substring(0, 200)}${workOrder.work_order_description.length > 200 ? '...' : ''}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            <!-- CTA Button -->
            <div style="text-align: center; margin: 25px 0;">
              <a href="https://field-service-dashboard.vercel.app/mobile" 
                 style="background-color: ${isEmergency ? '#dc2626' : '#2563eb'}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                ${isEmergency ? '🚨 VIEW EMERGENCY NOW' : '📱 Open Mobile App'}
              </a>
            </div>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #111827; padding: 15px; text-align: center; border-top: 1px solid #374151;">
            <p style="margin: 0; color: #6b7280; font-size: 12px;">
              EMF Contracting LLC | Field Service Management
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Build plain text email
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

// Send push notification to a user
const sendPushNotification = async (userId, payload) => {
  try {
    // Check if VAPID keys are configured
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.log('VAPID keys not configured - skipping push notification');
      return { success: false, reason: 'vapid_not_configured' };
    }

    // Get user's push subscription from database
    // FIXED: Use subscription_json column (not 'subscription')
    const { data: subscriptionData, error } = await supabase
      .from('push_subscriptions')
      .select('subscription_json, is_active')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();

    if (error || !subscriptionData) {
      console.log(`No active push subscription for user ${userId}`);
      return { success: false, reason: 'no_subscription' };
    }

    // Parse the subscription JSON
    let pushSubscription;
    try {
      pushSubscription = typeof subscriptionData.subscription_json === 'string' 
        ? JSON.parse(subscriptionData.subscription_json) 
        : subscriptionData.subscription_json;
    } catch (parseError) {
      console.error(`Error parsing subscription for user ${userId}:`, parseError);
      return { success: false, reason: 'invalid_subscription_format' };
    }

    if (!pushSubscription || !pushSubscription.endpoint) {
      console.log(`Invalid subscription data for user ${userId}`);
      return { success: false, reason: 'invalid_subscription' };
    }
    
    await webpush.sendNotification(
      pushSubscription,
      JSON.stringify(payload)
    );

    console.log(`✅ Push notification sent to user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error(`Push notification failed for user ${userId}:`, error.message);
    
    // If subscription is invalid/expired, mark it inactive
    if (error.statusCode === 410 || error.statusCode === 404) {
      await supabase
        .from('push_subscriptions')
        .update({ is_active: false })
        .eq('user_id', userId);
      console.log(`Marked expired subscription as inactive for user ${userId}`);
    }
    
    return { success: false, reason: error.message };
  }
};

export async function POST(request) {
  try {
    const { type, recipients, workOrder, customMessage } = await request.json();
    
    if (!type || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const transporter = createTransporter();
    const results = {
      email: { sent: [], failed: [] },
      push: { sent: [], failed: [] }
    };

    for (const recipient of recipients) {
      const { user_id, email, first_name, last_name } = recipient;
      const recipientName = first_name || 'Team Member';
      const isEmergency = type === 'emergency_work_order' || workOrder?.priority === 'emergency';

      // === SEND EMAIL ===
      if (email) {
        try {
          const subject = isEmergency 
            ? `🚨 EMERGENCY: WO ${workOrder.wo_number} Assigned` 
            : `📋 New Work Order Assigned: ${workOrder.wo_number}`;
          
          const textMessage = buildAssignmentEmailText(workOrder, recipientName, isEmergency);
          const htmlMessage = buildAssignmentEmailHTML(workOrder, recipientName, isEmergency);

          await transporter.sendMail({
            from: `"EMF Contracting" <${process.env.EMAIL_USER || 'emfcbre@gmail.com'}>`,
            to: email,
            subject: subject,
            text: textMessage,
            html: htmlMessage
          });

          results.email.sent.push({ name: `${first_name} ${last_name}`, email });
          console.log(`✅ Email sent to ${first_name} ${last_name} (${email})`);
        } catch (emailError) {
          console.error(`❌ Email failed for ${first_name} ${last_name}:`, emailError.message);
          results.email.failed.push({ 
            name: `${first_name} ${last_name}`, 
            email,
            error: emailError.message 
          });
        }
      } else {
        results.email.failed.push({ 
          name: `${first_name} ${last_name}`, 
          error: 'No email address' 
        });
      }

      // === SEND PUSH NOTIFICATION ===
      if (user_id) {
        const pushPayload = {
          title: isEmergency 
            ? `🚨 EMERGENCY: ${workOrder.wo_number}` 
            : `📋 New WO: ${workOrder.wo_number}`,
          body: `${workOrder.building || 'No location'} - ${workOrder.priority?.toUpperCase() || 'NORMAL'} priority`,
          icon: '/emf-logo.png',
          badge: '/emf-logo.png',
          tag: `wo-${workOrder.wo_number}`,
          data: {
            url: '/mobile',
            wo_id: workOrder.wo_id,
            wo_number: workOrder.wo_number
          }
        };

        const pushResult = await sendPushNotification(user_id, pushPayload);
        
        if (pushResult.success) {
          results.push.sent.push({ name: `${first_name} ${last_name}`, user_id });
          console.log(`✅ Push sent to ${first_name} ${last_name}`);
        } else {
          results.push.failed.push({ 
            name: `${first_name} ${last_name}`, 
            user_id,
            reason: pushResult.reason 
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        email: { sent: results.email.sent.length, failed: results.email.failed.length },
        push: { sent: results.push.sent.length, failed: results.push.failed.length }
      },
      details: results
    });

  } catch (error) {
    console.error('Notification error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET endpoint to check notification status and configuration
export async function GET() {
  // Check push subscriptions count
  let subscriptionCount = 0;
  try {
    const { count } = await supabase
      .from('push_subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);
    subscriptionCount = count || 0;
  } catch (e) {
    console.error('Error counting subscriptions:', e);
  }

  return NextResponse.json({ 
    status: 'ok',
    email: {
      configured: !!process.env.EMAIL_PASS,
      user: process.env.EMAIL_USER || 'emfcbre@gmail.com'
    },
    push: {
      configured: !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      public_key_set: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      private_key_set: !!process.env.VAPID_PRIVATE_KEY,
      active_subscriptions: subscriptionCount
    }
  });
}
