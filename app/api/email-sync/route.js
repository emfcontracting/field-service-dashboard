// app/api/email-sync/route.js
// Syncs CBRE status updates from Gmail labels (Escalation, Quote Approval, Quote Rejected, Quote Submitted, Reassignment)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Gmail label to CBRE status mapping
const LABEL_STATUS_MAP = {
  'escalation': { cbre_status: 'escalation', notify: true, notifyRoles: ['admin', 'office'] },
  'quote-approval': { cbre_status: 'quote_approved', billing_status: 'quote_approved', notify: false },
  'quote-rejected': { cbre_status: 'quote_rejected', notify: true, notifyRoles: ['admin', 'office'] },
  'quote-submitted': { cbre_status: 'quote_submitted', billing_status: 'quoted', notify: false },
  'reassignment-of': { cbre_status: 'reassigned', notify: true, notifyRoles: ['admin', 'office'] },
};

// Get a fresh access token using refresh token
async function getAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(`OAuth error: ${data.error_description || data.error}`);
  }
  return data.access_token;
}

// Decode base64url encoded content
function decodeBase64Url(data) {
  if (!data) return '';
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padding = base64.length % 4;
  const padded = padding ? base64 + '='.repeat(4 - padding) : base64;
  
  try {
    return Buffer.from(padded, 'base64').toString('utf-8');
  } catch (e) {
    return '';
  }
}

// Get email body
function getEmailBody(message) {
  let body = '';
  
  if (message.payload?.body?.data) {
    body = decodeBase64Url(message.payload.body.data);
  } else if (message.payload?.parts) {
    for (const part of message.payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        body = decodeBase64Url(part.body.data);
        break;
      } else if (part.mimeType === 'text/plain' && part.body?.data) {
        body = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        for (const subPart of part.parts) {
          if (subPart.mimeType === 'text/html' && subPart.body?.data) {
            body = decodeBase64Url(subPart.body.data);
            break;
          }
        }
      }
    }
  }
  
  return body;
}

// Extract WO number from email subject or body
function extractWONumber(subject, body) {
  // Try subject first - common patterns:
  // "Work Order C2926480" or "WO# C2926480" or just "C2926480"
  const patterns = [
    /Work Order\s+([A-Z]?\d{6,})/i,
    /WO#?\s*([A-Z]?\d{6,})/i,
    /\b([A-Z]\d{6,})\b/,  // C2926480 pattern
    /\b(\d{7,})\b/,       // Just numbers
  ];

  for (const pattern of patterns) {
    const match = (subject || '').match(pattern);
    if (match) return match[1];
  }

  // Try body if not found in subject
  const cleanBody = (body || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');

  for (const pattern of patterns) {
    const match = cleanBody.match(pattern);
    if (match) return match[1];
  }

  return null;
}

// Mark email as read
async function markAsRead(accessToken, messageId) {
  await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        removeLabelIds: ['UNREAD']
      })
    }
  );
}

// Send notification to office/admin staff
async function sendNotification(type, workOrder, emailSubject) {
  try {
    // Get office/admin users with phone and carrier
    const { data: users } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, phone, sms_carrier, email')
      .in('role', ['admin', 'office']);

    const recipients = (users || []).filter(u => u.phone && u.sms_carrier);
    
    if (recipients.length === 0) {
      console.log('No office/admin users configured for SMS notifications');
      return;
    }

    // Build SMS message based on type
    let message = '';
    switch (type) {
      case 'escalation':
        message = `🚨 ESCALATION: WO ${workOrder.wo_number} - ${workOrder.building} requires immediate attention!`;
        break;
      case 'quote_rejected':
        message = `❌ QUOTE REJECTED: WO ${workOrder.wo_number} - ${workOrder.building}. Review needed.`;
        break;
      case 'reassigned':
        message = `🔄 REASSIGNED: WO ${workOrder.wo_number} - ${workOrder.building} has been reassigned by CBRE.`;
        break;
      default:
        message = `📋 CBRE Update: WO ${workOrder.wo_number} - Status: ${type}`;
    }

    // Send via notifications API
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'cbre_status_update',
        recipients,
        message,
        workOrder: {
          wo_number: workOrder.wo_number,
          building: workOrder.building,
          cbre_status: type
        }
      })
    });

    const result = await response.json();
    console.log('Notification result:', result);
    
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// GET: Fetch and process status update emails from all CBRE labels
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const labelFilter = searchParams.get('label'); // Optional: sync specific label only
    const dryRun = searchParams.get('dryRun') === 'true'; // Preview without updating
    
    // Check Gmail credentials
    if (!process.env.GMAIL_CLIENT_ID || !process.env.GMAIL_CLIENT_SECRET || !process.env.GMAIL_REFRESH_TOKEN) {
      return Response.json({ success: false, error: 'Gmail not configured' }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    
    // Labels to check (exclude 'dispatch' as that's handled by email-import)
    const labelsToCheck = labelFilter 
      ? [labelFilter.toLowerCase()]
      : Object.keys(LABEL_STATUS_MAP);
    
    const results = {
      processed: 0,
      updated: 0,
      notFound: 0,
      errors: [],
      updates: []
    };

    for (const label of labelsToCheck) {
      const labelConfig = LABEL_STATUS_MAP[label];
      if (!labelConfig) continue;

      // Search for unread emails with this label
      const query = encodeURIComponent(`is:unread label:${label}`);
      
      const listResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const listData = await listResponse.json();
      
      if (listData.error) {
        results.errors.push(`${label}: ${listData.error.message}`);
        continue;
      }

      if (!listData.messages || listData.messages.length === 0) {
        continue;
      }

      // Process each email
      for (const msg of listData.messages) {
        try {
          results.processed++;

          const msgResponse = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const msgData = await msgResponse.json();

          if (msgData.error) continue;

          // Get subject
          const subjectHeader = msgData.payload?.headers?.find(h => h.name.toLowerCase() === 'subject');
          const subject = subjectHeader?.value || '';

          // Get body
          const body = getEmailBody(msgData);

          // Extract WO number
          const woNumber = extractWONumber(subject, body);

          if (!woNumber) {
            results.errors.push(`Could not find WO# in: ${subject.substring(0, 50)}`);
            // Still mark as read to avoid reprocessing
            if (!dryRun) await markAsRead(accessToken, msg.id);
            continue;
          }

          // Find the work order in database
          const { data: workOrder, error: woError } = await supabase
            .from('work_orders')
            .select('wo_id, wo_number, building, cbre_status, billing_status, comments')
            .eq('wo_number', woNumber)
            .single();

          if (woError || !workOrder) {
            results.notFound++;
            results.errors.push(`WO ${woNumber} not found in system`);
            // Still mark as read
            if (!dryRun) await markAsRead(accessToken, msg.id);
            continue;
          }

          // Build update object
          const updateData = {
            cbre_status: labelConfig.cbre_status,
            cbre_status_updated_at: new Date().toISOString()
          };

          // Also update billing_status if specified
          if (labelConfig.billing_status) {
            updateData.billing_status = labelConfig.billing_status;
          }

          // Add to comments
          const timestamp = new Date().toLocaleString();
          const newComment = `[CBRE ${labelConfig.cbre_status.toUpperCase()}] ${timestamp}\nEmail: ${subject}`;
          const updatedComments = workOrder.comments 
            ? `${workOrder.comments}\n\n${newComment}`
            : newComment;

          updateData.comments = updatedComments;

          if (!dryRun) {
            // Update work order
            const { error: updateError } = await supabase
              .from('work_orders')
              .update(updateData)
              .eq('wo_id', workOrder.wo_id);

            if (updateError) {
              results.errors.push(`Failed to update ${woNumber}: ${updateError.message}`);
              continue;
            }

            // Mark email as read
            await markAsRead(accessToken, msg.id);

            // Send notification if needed
            if (labelConfig.notify) {
              await sendNotification(labelConfig.cbre_status, workOrder, subject);
            }
          }

          results.updated++;
          results.updates.push({
            wo_number: woNumber,
            building: workOrder.building,
            label: label,
            new_status: labelConfig.cbre_status,
            subject: subject.substring(0, 80),
            notified: labelConfig.notify
          });

        } catch (msgErr) {
          results.errors.push(`Error processing message: ${msgErr.message}`);
        }
      }
    }

    return Response.json({
      success: true,
      message: `Processed ${results.processed} emails, updated ${results.updated} work orders`,
      dryRun,
      ...results
    });

  } catch (error) {
    console.error('Email sync error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// POST: Manually trigger sync for specific label or all
export async function POST(request) {
  try {
    const body = await request.json();
    const { label } = body;

    // Redirect to GET with params
    const url = new URL(request.url);
    if (label) url.searchParams.set('label', label);
    
    const response = await GET(new Request(url.toString()));
    return response;

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
