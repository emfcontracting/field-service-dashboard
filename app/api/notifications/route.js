// app/api/notifications/route.js
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import {
  buildCbreNteSubmittedSubject,
  buildCbreNteSubmittedEmailText,
  buildCbreNteSubmittedEmailHTML
} from '@/lib/cbreNteEmail';

// Initialize Supabase for fetching push subscriptions
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
  googlefi: 'msg.fi.google.com',
  straight_talk: 'vtext.com',
  bellsouth: 'sms.bellsouth.com',
};

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

// ============================================================
// MISSING DATA FIXED  — tech says they've completed the fix,
// office should review and click Resolve.
// ============================================================
const buildMissingDataFixedEmailHTML = (workOrder, recipientName, actorName, items) => {
  const itemLabels = {
    photos: '📷 Photos',
    writeup: '✍️ Write-up',
    daily_hours: '⏱️ Daily Hours',
    material_costs: '💲 Material costs',
    signature: '✒️ Signature',
    checkin_checkout: '🚪 Check-in/out',
    other: '❓ Other'
  };
  const itemsList = Array.isArray(items) && items.length
    ? items.map(i => itemLabels[i] || i).join(', ')
    : 'See WO for details';

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="background-color:#1f2937;border-radius:8px;overflow:hidden;">
          <div style="background-color:#059669;padding:20px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:22px;">✅ Tech Fixed Missing Data</h1>
          </div>
          <div style="padding:20px;color:white;">
            <p style="margin:0 0 15px 0;font-size:16px;">Hi ${recipientName},</p>
            <p style="margin:0 0 20px 0;color:#9ca3af;">
              <strong>${actorName || 'A tech'}</strong> just marked the missing data on this work order as fixed.
              Please review and click <strong>✅ Resolve</strong> in the dashboard banner to restore the original status.
            </p>
            <div style="background-color:#374151;border-radius:8px;padding:15px;margin-bottom:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#9ca3af;width:120px;">WO #:</td><td style="padding:6px 0;color:white;font-weight:bold;">${workOrder.wo_number}</td></tr>
                <tr><td style="padding:6px 0;color:#9ca3af;">Building:</td><td style="padding:6px 0;color:white;">${workOrder.building || 'Not specified'}</td></tr>
                <tr><td style="padding:6px 0;color:#9ca3af;vertical-align:top;">Was flagged for:</td><td style="padding:6px 0;color:#d1d5db;">${itemsList}</td></tr>
              </table>
            </div>
            <div style="text-align:center;margin:25px 0;">
              <a href="https://field-service-dashboard.vercel.app/dashboard"
                 style="background-color:#059669;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                📊 Open Dashboard
              </a>
            </div>
          </div>
          <div style="background-color:#111827;padding:15px;text-align:center;border-top:1px solid #374151;">
            <p style="margin:0;color:#6b7280;font-size:12px;">EMF Contracting LLC | Field Service Management</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

const buildMissingDataFixedEmailText = (workOrder, recipientName, actorName, items) => {
  const itemsList = Array.isArray(items) && items.length ? items.join(', ') : 'See WO for details';
  return `
✅ Tech Fixed Missing Data

Hi ${recipientName},

${actorName || 'A tech'} just marked the missing data on this work order as fixed.
Please review and click Resolve in the dashboard banner.

Work Order Details:
- WO#: ${workOrder.wo_number}
- Building: ${workOrder.building || 'Not specified'}
- Was flagged for: ${itemsList}

Open the dashboard:
https://field-service-dashboard.vercel.app/dashboard

---
EMF Contracting LLC
  `.trim();
};

// ============================================================
// WORK ORDER COMPLETED  — status changed to 'completed'.
// ============================================================
const buildCompletedEmailHTML = (workOrder, recipientName, actorName) => {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="background-color:#1f2937;border-radius:8px;overflow:hidden;">
          <div style="background-color:#16a34a;padding:20px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:22px;">✅ Work Order Completed</h1>
          </div>
          <div style="padding:20px;color:white;">
            <p style="margin:0 0 15px 0;font-size:16px;">Hi ${recipientName},</p>
            <p style="margin:0 0 20px 0;color:#9ca3af;">
              <strong>${actorName || 'Someone'}</strong> just marked this work order as completed. It's ready for acknowledgement and invoicing.
            </p>
            <div style="background-color:#374151;border-radius:8px;padding:15px;margin-bottom:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#9ca3af;width:120px;">WO #:</td><td style="padding:6px 0;color:white;font-weight:bold;">${workOrder.wo_number}</td></tr>
                <tr><td style="padding:6px 0;color:#9ca3af;">Building:</td><td style="padding:6px 0;color:white;">${workOrder.building || 'Not specified'}</td></tr>
                <tr><td style="padding:6px 0;color:#9ca3af;">NTE:</td><td style="padding:6px 0;color:white;">${(workOrder.nte || 0).toFixed(2)}</td></tr>
                ${workOrder.work_order_description ? `<tr><td style="padding:6px 0;color:#9ca3af;vertical-align:top;">Description:</td><td style="padding:6px 0;color:#d1d5db;">${workOrder.work_order_description.substring(0, 200)}${workOrder.work_order_description.length > 200 ? '...' : ''}</td></tr>` : ''}
              </table>
            </div>
            <div style="text-align:center;margin:25px 0;">
              <a href="https://field-service-dashboard.vercel.app/dashboard"
                 style="background-color:#16a34a;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                📊 Open Dashboard
              </a>
            </div>
          </div>
          <div style="background-color:#111827;padding:15px;text-align:center;border-top:1px solid #374151;">
            <p style="margin:0;color:#6b7280;font-size:12px;">EMF Contracting LLC | Field Service Management</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

const buildCompletedEmailText = (workOrder, recipientName, actorName) => {
  return `
✅ Work Order Completed

Hi ${recipientName},

${actorName || 'Someone'} just marked this work order as completed. It's ready for acknowledgement and invoicing.

Work Order Details:
- WO#: ${workOrder.wo_number}
- Building: ${workOrder.building || 'Not specified'}
- NTE: ${(workOrder.nte || 0).toFixed(2)}
${workOrder.work_order_description ? `- Description: ${workOrder.work_order_description.substring(0, 200)}...` : ''}

Open the dashboard:
https://field-service-dashboard.vercel.app/dashboard

---
EMF Contracting LLC
  `.trim();
};

// ============================================================
// UPDATE REQUIRED FOLLOWED UP  — tech followed up on the status
// update items, office should review and click Resolve.
// ============================================================
const buildUpdateRequiredFollowedUpEmailHTML = (workOrder, recipientName, actorName, items) => {
  const itemLabels = {
    nte_status: '📞 NTE Status with CBRE',
    material_delivery: '📦 Material Delivery',
    quote_status: '💰 Quote Status',
    other: '❓ Other'
  };
  const itemsList = Array.isArray(items) && items.length
    ? items.map(i => itemLabels[i] || i).join(', ')
    : 'See WO for details';

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="background-color:#1f2937;border-radius:8px;overflow:hidden;">
          <div style="background-color:#2563eb;padding:20px;text-align:center;">
            <h1 style="color:white;margin:0;font-size:22px;">🔵 Tech Followed Up</h1>
          </div>
          <div style="padding:20px;color:white;">
            <p style="margin:0 0 15px 0;font-size:16px;">Hi ${recipientName},</p>
            <p style="margin:0 0 20px 0;color:#9ca3af;">
              <strong>${actorName || 'A tech'}</strong> just followed up on the status update for this work order.
              Please review and click <strong>✅ Resolve</strong> in the dashboard banner to restore the original status.
            </p>
            <div style="background-color:#374151;border-radius:8px;padding:15px;margin-bottom:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:6px 0;color:#9ca3af;width:120px;">WO #:</td><td style="padding:6px 0;color:white;font-weight:bold;">${workOrder.wo_number}</td></tr>
                <tr><td style="padding:6px 0;color:#9ca3af;">Building:</td><td style="padding:6px 0;color:white;">${workOrder.building || 'Not specified'}</td></tr>
                <tr><td style="padding:6px 0;color:#9ca3af;vertical-align:top;">Was flagged for:</td><td style="padding:6px 0;color:#d1d5db;">${itemsList}</td></tr>
              </table>
            </div>
            <div style="text-align:center;margin:25px 0;">
              <a href="https://field-service-dashboard.vercel.app/dashboard"
                 style="background-color:#2563eb;color:white;padding:14px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                📊 Open Dashboard
              </a>
            </div>
          </div>
          <div style="background-color:#111827;padding:15px;text-align:center;border-top:1px solid #374151;">
            <p style="margin:0;color:#6b7280;font-size:12px;">EMF Contracting LLC | Field Service Management</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

const buildUpdateRequiredFollowedUpEmailText = (workOrder, recipientName, actorName, items) => {
  const itemsList = Array.isArray(items) && items.length ? items.join(', ') : 'See WO for details';
  return `
🔵 Tech Followed Up

Hi ${recipientName},

${actorName || 'A tech'} just followed up on the status update for this work order.
Please review and click Resolve in the dashboard banner.

Work Order Details:
- WO#: ${workOrder.wo_number}
- Building: ${workOrder.building || 'Not specified'}
- Was flagged for: ${itemsList}

Open the dashboard:
https://field-service-dashboard.vercel.app/dashboard

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
    const { type, recipients, workOrder, quote, customMessage, deliveryMethod = 'email', actorName, missingDataItems, updateRequiredItems } = await request.json();
    
    if (!type || !recipients || recipients.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const transporter = createTransporter();
    const results = {
      email: { sent: [], failed: [] },
      sms: { sent: [], failed: [] },
      push: { sent: [], failed: [] }
    };

    // Type-based flags
    const isAssignment = type === 'work_order_assigned' || type === 'emergency_work_order';
    const isMissingDataFixed = type === 'missing_data_fixed';
    const isCompleted = type === 'work_order_completed';
    const isUpdateRequiredFollowedUp = type === 'update_required_followed_up';
    // CBRE NTE submitted: EMAIL ONLY, to selected subscribers. Never SMS/push.
    const isCbreNteSubmitted = type === 'cbre_nte_submitted';

    // For work order assignments and the new office-bound types, always use email (not SMS)
    const useEmail = deliveryMethod === 'email' || isAssignment || isMissingDataFixed || isCompleted || isUpdateRequiredFollowedUp || isCbreNteSubmitted;
    const useSMS = deliveryMethod === 'sms' && !isAssignment && !isMissingDataFixed && !isCompleted && !isUpdateRequiredFollowedUp && !isCbreNteSubmitted;

    for (const recipient of recipients) {
      const { user_id, email, phone, sms_carrier, first_name, last_name } = recipient;
      const recipientName = first_name || 'Team Member';
      const isEmergency = type === 'emergency_work_order' || workOrder?.priority === 'emergency';

      // === SEND EMAIL ===
      if (useEmail && email) {
        try {
          let subject, textMessage, htmlMessage;
          
          if (isAssignment && workOrder) {
            // Work order assignment email
            subject = isEmergency 
              ? `🚨 EMERGENCY: WO ${workOrder.wo_number} Assigned` 
              : `📋 New Work Order Assigned: ${workOrder.wo_number}`;
            
            textMessage = buildAssignmentEmailText(workOrder, recipientName, isEmergency);
            htmlMessage = buildAssignmentEmailHTML(workOrder, recipientName, isEmergency);
          } else if (isMissingDataFixed && workOrder) {
            // Tech finished fixing missing data — office should review and Resolve
            subject = `✅ Tech Fixed Missing Data: WO ${workOrder.wo_number}`;
            textMessage = buildMissingDataFixedEmailText(workOrder, recipientName, actorName, missingDataItems);
            htmlMessage = buildMissingDataFixedEmailHTML(workOrder, recipientName, actorName, missingDataItems);
          } else if (isCompleted && workOrder) {
            // WO was just marked as completed
            subject = `✅ Work Order Completed: WO ${workOrder.wo_number}`;
            textMessage = buildCompletedEmailText(workOrder, recipientName, actorName);
            htmlMessage = buildCompletedEmailHTML(workOrder, recipientName, actorName);
          } else if (isUpdateRequiredFollowedUp && workOrder) {
            // Tech followed up on status update — office should review and Resolve
            subject = `🔵 Tech Followed Up: WO ${workOrder.wo_number}`;
            textMessage = buildUpdateRequiredFollowedUpEmailText(workOrder, recipientName, actorName, updateRequiredItems);
            htmlMessage = buildUpdateRequiredFollowedUpEmailHTML(workOrder, recipientName, actorName, updateRequiredItems);
          } else if (isCbreNteSubmitted && workOrder) {
            // CBRE NTE submitted — admin must handle all CBRE contact
            subject = buildCbreNteSubmittedSubject(workOrder, quote);
            textMessage = buildCbreNteSubmittedEmailText(workOrder, quote, actorName, recipientName);
            htmlMessage = buildCbreNteSubmittedEmailHTML(workOrder, quote, actorName, recipientName);
          } else if (customMessage) {
            // Custom message email
            subject = '💬 Message from EMF Contracting';
            textMessage = customMessage;
            htmlMessage = `
              <!DOCTYPE html>
              <html>
              <head><meta charset="utf-8"></head>
              <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                  <div style="background-color: #1f2937; border-radius: 8px; overflow: hidden;">
                    <div style="background-color: #2563eb; padding: 20px; text-align: center;">
                      <h1 style="color: white; margin: 0; font-size: 24px;">💬 Message from EMF Contracting</h1>
                    </div>
                    <div style="padding: 20px; color: white;">
                      <p style="margin: 0 0 15px 0; font-size: 16px;">Hi ${recipientName},</p>
                      <div style="background-color: #374151; border-radius: 8px; padding: 15px; margin-bottom: 20px; white-space: pre-wrap;">
                        ${customMessage}
                      </div>
                      <div style="text-align: center; margin: 25px 0;">
                        <a href="https://field-service-dashboard.vercel.app/mobile" 
                           style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                          📱 Open Mobile App
                        </a>
                      </div>
                    </div>
                    <div style="background-color: #111827; padding: 15px; text-align: center; border-top: 1px solid #374151;">
                      <p style="margin: 0; color: #6b7280; font-size: 12px;">EMF Contracting LLC</p>
                    </div>
                  </div>
                </div>
              </body>
              </html>
            `;
          } else {
            // Skip if no content
            continue;
          }

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
      }

      // === SEND SMS (Messages page only) ===
      if (useSMS && phone && sms_carrier) {
        try {
          const cleanPhone = phone.replace(/\D/g, '');
          const gateway = SMS_GATEWAYS[sms_carrier];
          
          if (!gateway || cleanPhone.length !== 10) {
            results.sms.failed.push({ 
              name: `${first_name} ${last_name}`, 
              error: 'Invalid phone or carrier' 
            });
            continue;
          }

          const smsEmail = `${cleanPhone}@${gateway}`;
          const smsMessage = customMessage || `EMF: ${first_name}, you have a message. Check the mobile app for details.`;

          await transporter.sendMail({
            from: process.env.EMAIL_USER || 'emfcbre@gmail.com',
            to: smsEmail,
            subject: '',
            text: smsMessage.substring(0, 160) // SMS limit
          });

          results.sms.sent.push({ name: `${first_name} ${last_name}`, phone });
          console.log(`✅ SMS sent to ${first_name} ${last_name} (${phone})`);
        } catch (smsError) {
          console.error(`❌ SMS failed for ${first_name} ${last_name}:`, smsError.message);
          results.sms.failed.push({ 
            name: `${first_name} ${last_name}`, 
            phone,
            error: smsError.message 
          });
        }
      }

      // === SEND PUSH NOTIFICATION (only for work order notifications) ===
      // CBRE NTE submitted is EMAIL ONLY by policy — never push.
      if (user_id && workOrder && !isCbreNteSubmitted) {
        let pushPayload;

        if (isMissingDataFixed) {
          pushPayload = {
            title: `✅ Missing Data Fixed: ${workOrder.wo_number}`,
            body: `${actorName || 'Tech'} marked the fix as done. Review and resolve.`,
            icon: '/emf-logo.png',
            badge: '/emf-logo.png',
            tag: `wo-${workOrder.wo_number}-md-fixed`,
            data: {
              url: '/dashboard',
              wo_id: workOrder.wo_id,
              wo_number: workOrder.wo_number
            }
          };
        } else if (isCompleted) {
          pushPayload = {
            title: `✅ WO Completed: ${workOrder.wo_number}`,
            body: `${workOrder.building || 'No location'} — ready for invoicing`,
            icon: '/emf-logo.png',
            badge: '/emf-logo.png',
            tag: `wo-${workOrder.wo_number}-completed`,
            data: {
              url: '/dashboard',
              wo_id: workOrder.wo_id,
              wo_number: workOrder.wo_number
            }
          };
        } else if (isUpdateRequiredFollowedUp) {
          pushPayload = {
            title: `🔵 Tech Followed Up: ${workOrder.wo_number}`,
            body: `${actorName || 'Tech'} followed up. Review and resolve.`,
            icon: '/emf-logo.png',
            badge: '/emf-logo.png',
            tag: `wo-${workOrder.wo_number}-ur-followed`,
            data: {
              url: '/dashboard',
              wo_id: workOrder.wo_id,
              wo_number: workOrder.wo_number
            }
          };
        } else {
          pushPayload = {
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
        }

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
      } else if (user_id && customMessage) {
        // Custom message push notification
        const pushPayload = {
          title: '💬 Message from EMF Contracting',
          body: customMessage.substring(0, 100) + (customMessage.length > 100 ? '...' : ''),
          icon: '/emf-logo.png',
          badge: '/emf-logo.png',
          tag: 'custom-message',
          data: {
            url: '/mobile'
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
      sent: results.email.sent.length + results.sms.sent.length,
      failed: results.email.failed.length + results.sms.failed.length,
      summary: {
        email: { sent: results.email.sent.length, failed: results.email.failed.length },
        sms: { sent: results.sms.sent.length, failed: results.sms.failed.length },
        push: { sent: results.push.sent.length, failed: results.push.failed.length }
      },
      details: results,
      errors: [...results.email.failed, ...results.sms.failed]
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
