// app/api/email-import/cron/route.js
// Automatic email import cron job - runs every 15 minutes
// Fetches unread CBRE dispatch emails, imports them automatically, and notifies office

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

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

// Email transporter for SMS notifications
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'emfcbre@gmail.com',
    pass: process.env.EMAIL_PASS
  }
});

// Get a fresh access token using refresh token
async function getAccessToken() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  console.log('Gmail credentials check:', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRefreshToken: !!refreshToken,
    clientIdPrefix: clientId?.substring(0, 10) + '...',
  });

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail credentials not configured - missing: ' + 
      [!clientId && 'CLIENT_ID', !clientSecret && 'CLIENT_SECRET', !refreshToken && 'REFRESH_TOKEN'].filter(Boolean).join(', '));
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json();
  
  console.log('OAuth token response:', data.error ? data : 'Success - token obtained');
  
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
    console.error('Decode error:', e);
    return '';
  }
}

// Get email body from Gmail message
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

// Parse CBRE work order email
function parseCBREEmail(subject, body) {
  const workOrder = {
    wo_number: '',
    building: '',
    address: '',
    city: '',
    state: '',
    priority: 'medium',
    date_entered: new Date().toISOString(),
    work_order_description: '',
    requestor: '',
    requestor_phone: '',
    status: 'pending',
    comments: '',
    nte: 0
  };

  // Clean the content
  const cleanBody = (body || '')
    .replace(/=\r?\n/g, '')
    .replace(/=3D/g, '=')
    .replace(/=20/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract WO number from subject
  const woMatch = (subject || '').match(/Work Order\s+([A-Z]?\d+)/i);
  if (woMatch) {
    workOrder.wo_number = woMatch[1];
  }

  // Extract Priority
  const priorityMatch = (body || '').match(/Priority:\s*(P\d)[^a-z]*(\w*)/i) || (subject || '').match(/Priority:\s*(P\d)/i);
  if (priorityMatch) {
    const pCode = priorityMatch[1].toUpperCase();
    const pText = (priorityMatch[2] || '').toLowerCase();
    
    if (pCode === 'P1' || pText.includes('emergency')) {
      workOrder.priority = 'emergency';
    } else if (pCode === 'P2' || pText.includes('urgent')) {
      workOrder.priority = 'high';
    } else if (pCode === 'P3') {
      workOrder.priority = 'medium';
    } else {
      workOrder.priority = 'low';
    }
  }

  // Extract Date Entered
  const dateMatch = cleanBody.match(/Date Entered:\s*([A-Za-z]+\s+\d+\s+\d+\s+[\d:]+\s*[AP]M)/i);
  if (dateMatch) {
    try {
      const parsed = new Date(dateMatch[1].replace(/\s+/g, ' '));
      if (!isNaN(parsed.getTime())) {
        workOrder.date_entered = parsed.toISOString();
      }
    } catch (e) {}
  }

  // Extract Building
  const buildingMatch = cleanBody.match(/Building:\s*([^\n]+?)(?=Floor|Area|Country|$)/i);
  if (buildingMatch) {
    workOrder.building = buildingMatch[1].trim().substring(0, 200);
  }

  // Extract Address
  const addressMatch = cleanBody.match(/Address:\s*([^\n]+?)(?=Country|Building|$)/i);
  if (addressMatch) {
    workOrder.address = addressMatch[1].trim();
  }

  // Extract City, State
  const locationMatch = cleanBody.match(/Country,?\s*St,?\s*City[:\s]*[A-Z]+,?\s*([A-Z]{2}),?\s*([A-Z\s]+)/i);
  if (locationMatch) {
    workOrder.state = locationMatch[1].trim();
    workOrder.city = locationMatch[2].trim();
  }

  // Extract Requestor
  const requestorMatch = cleanBody.match(/Work Order Requestor Name and Phone:\s*([^,]+),?\s*([\d\-\(\)\s]+)/i);
  if (requestorMatch) {
    workOrder.requestor = requestorMatch[1].trim();
    if (requestorMatch[2]) {
      workOrder.requestor_phone = requestorMatch[2].trim();
    }
  }

  // Extract NTE
  const nteMatch = cleanBody.match(/should not exceed\s*([\d,]+\.?\d*)\s*USD/i);
  if (nteMatch) {
    workOrder.nte = parseFloat(nteMatch[1].replace(/,/g, '')) || 0;
  }

  // Extract Problem Description
  const descMatch = cleanBody.match(/Problem Description:\s*(.+?)(?=Assignment Name|Notes to Vendor|$)/is);
  if (descMatch) {
    workOrder.work_order_description = descMatch[1]
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 2000);
  }

  // Build comments
  const comments = [];
  if (workOrder.address) comments.push(`Address: ${workOrder.address}`);
  if (workOrder.city && workOrder.state) comments.push(`Location: ${workOrder.city}, ${workOrder.state}`);
  if (workOrder.requestor_phone) comments.push(`Requestor Phone: ${workOrder.requestor_phone}`);
  comments.push(`[Auto-imported from CBRE email on ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST]`);
  workOrder.comments = comments.join('\n');

  return workOrder;
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

// Send SMS notification to office staff
async function sendOfficeNotification(importedWOs) {
  try {
    // Get office users (admins and operations) with SMS enabled
    const { data: officeUsers, error } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, phone, sms_carrier, role')
      .in('role', ['admin', 'operations'])
      .eq('is_active', true)
      .not('phone', 'is', null)
      .not('sms_carrier', 'is', null);

    if (error || !officeUsers || officeUsers.length === 0) {
      console.log('No office users configured for SMS notifications');
      return { sent: 0 };
    }

    // Build notification message
    const count = importedWOs.length;
    const emergencyCount = importedWOs.filter(wo => wo.priority === 'emergency').length;
    
    let message;
    if (emergencyCount > 0) {
      message = `🚨 EMF: ${count} new WO(s) auto-imported! ${emergencyCount} EMERGENCY. Check dashboard now!`;
    } else {
      message = `📧 EMF: ${count} new WO(s) auto-imported from email. Check dashboard to assign.`;
    }

    // Add WO numbers if just 1-3
    if (count <= 3) {
      const woNumbers = importedWOs.map(wo => wo.wo_number).join(', ');
      message += `\nWO: ${woNumbers}`;
    }

    let sent = 0;
    for (const user of officeUsers) {
      const phone = user.phone?.replace(/\D/g, '');
      const gateway = SMS_GATEWAYS[user.sms_carrier];
      
      if (!phone || phone.length !== 10 || !gateway) continue;
      
      const smsEmail = `${phone}@${gateway}`;
      
      try {
        await transporter.sendMail({
          from: process.env.EMAIL_USER || 'emfcbre@gmail.com',
          to: smsEmail,
          subject: emergencyCount > 0 ? 'EMERGENCY WO' : 'New WO',
          text: message
        });
        sent++;
        console.log(`SMS sent to ${user.first_name} ${user.last_name}`);
      } catch (e) {
        console.error(`Failed to send SMS to ${user.first_name}:`, e.message);
      }
    }

    return { sent };
  } catch (e) {
    console.error('Error sending office notifications:', e);
    return { sent: 0, error: e.message };
  }
}

// Log import activity
async function logImportActivity(results) {
  try {
    await supabase
      .from('system_logs')
      .insert({
        log_type: 'auto_email_import',
        details: JSON.stringify(results),
        created_at: new Date().toISOString()
      });
  } catch (e) {
    // Table might not exist, that's okay
    console.log('Could not log activity (table may not exist):', e.message);
  }
}

// Main cron handler
export async function GET(request) {
  const startTime = Date.now();
  console.log('=== Auto Email Import Cron Started ===');
  console.log('Request URL:', request.url);
  console.log('Timestamp:', new Date().toISOString());
  
  // Verify cron secret if configured (Vercel cron protection)
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const isManual = searchParams.get('manual') === 'true';
  
  console.log('Auth check:', {
    hasCronSecret: !!process.env.CRON_SECRET,
    hasAuthHeader: !!authHeader,
    isManual
  });
  
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    // Allow manual trigger without secret for testing
    if (!isManual) {
      console.log('Unauthorized cron request - no manual flag and auth mismatch');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('Manual trigger allowed without CRON_SECRET');
  }

  const results = {
    success: true,
    timestamp: new Date().toISOString(),
    imported: 0,
    skipped: 0,
    duplicates: 0,
    errors: [],
    workOrders: [],
    notifications: { sent: 0 }
  };

  try {
    // Check if Gmail is configured
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      results.success = false;
      results.errors.push('Gmail API not configured');
      return Response.json(results, { status: 400 });
    }

    // Check if auto-import is enabled (can be disabled via env var)
    if (process.env.AUTO_EMAIL_IMPORT_DISABLED === 'true') {
      results.message = 'Auto-import is disabled via environment variable';
      return Response.json(results);
    }

    console.log('Getting Gmail access token...');
    const accessToken = await getAccessToken();
    console.log('Access token obtained successfully');
    
    // Search for unread emails with "dispatch" label
    const query = encodeURIComponent('is:unread label:dispatch');
    console.log('Gmail search query:', decodeURIComponent(query));
    
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const listData = await listResponse.json();
    
    console.log('Gmail API response:', {
      status: listResponse.status,
      error: listData.error || null,
      messageCount: listData.messages?.length || 0,
      resultSizeEstimate: listData.resultSizeEstimate
    });
    
    if (listData.error) {
      throw new Error(`Gmail API error: ${listData.error.message}`);
    }
    
    if (!listData.messages || listData.messages.length === 0) {
      results.message = 'No new dispatch emails found';
      console.log('No new emails to import - query returned 0 results');
      return Response.json(results);
    }

    console.log(`Found ${listData.messages.length} unread dispatch email(s)`);

    // Get existing WO numbers to check for duplicates
    const { data: existingWOs } = await supabase
      .from('work_orders')
      .select('wo_number');
    const existingWONumbers = new Set((existingWOs || []).map(wo => wo.wo_number));

    // Process each email
    const importedWOs = [];
    
    for (const msg of listData.messages) {
      try {
        const msgResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );
        const msgData = await msgResponse.json();
        
        if (msgData.error) {
          console.error('Error fetching message:', msgData.error);
          results.errors.push(`Email fetch error: ${msgData.error.message}`);
          continue;
        }
        
        // Get subject
        const subjectHeader = msgData.payload?.headers?.find(h => h.name.toLowerCase() === 'subject');
        const subject = subjectHeader?.value || '';

        // Get body
        const body = getEmailBody(msgData);

        // Parse CBRE format
        const workOrder = parseCBREEmail(subject, body);

        // Skip if no WO number found
        if (!workOrder.wo_number) {
          console.log('Could not extract WO number from email, skipping');
          results.skipped++;
          // Still mark as read to prevent re-processing
          await markAsRead(accessToken, msg.id);
          continue;
        }

        // Check if this WO already exists
        if (existingWONumbers.has(workOrder.wo_number)) {
          console.log(`WO ${workOrder.wo_number} already exists, skipping`);
          results.duplicates++;
          await markAsRead(accessToken, msg.id);
          continue;
        }

        // Insert work order
        const { data: insertedWO, error: insertError } = await supabase
          .from('work_orders')
          .insert({
            wo_number: workOrder.wo_number,
            building: workOrder.building,
            priority: workOrder.priority,
            date_entered: workOrder.date_entered,
            work_order_description: workOrder.work_order_description,
            requestor: workOrder.requestor,
            status: 'pending',
            comments: workOrder.comments,
            nte: workOrder.nte || 0
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting WO ${workOrder.wo_number}:`, insertError);
          results.errors.push(`${workOrder.wo_number}: ${insertError.message}`);
          continue;
        }

        console.log(`✓ Imported WO ${workOrder.wo_number}`);
        results.imported++;
        results.workOrders.push({
          wo_number: workOrder.wo_number,
          building: workOrder.building,
          priority: workOrder.priority
        });
        importedWOs.push(workOrder);
        
        // Add to existing set to prevent duplicate processing within same batch
        existingWONumbers.add(workOrder.wo_number);

        // Mark email as read
        await markAsRead(accessToken, msg.id);

      } catch (msgErr) {
        console.error('Error processing message:', msgErr);
        results.errors.push(`Message processing error: ${msgErr.message}`);
      }
    }

    // Send notifications if any WOs were imported
    if (importedWOs.length > 0) {
      results.notifications = await sendOfficeNotification(importedWOs);
    }

    // Log the activity
    await logImportActivity(results);

    results.message = results.imported > 0
      ? `Auto-imported ${results.imported} work order(s)`
      : 'No new work orders to import';
    
    results.duration = `${Date.now() - startTime}ms`;
    
    console.log('=== Auto Email Import Cron Complete ===');
    console.log(JSON.stringify(results, null, 2));

    return Response.json(results);

  } catch (error) {
    console.error('Cron error:', error);
    results.success = false;
    results.errors.push(error.message);
    results.duration = `${Date.now() - startTime}ms`;
    
    return Response.json(results, { status: 500 });
  }
}

// POST handler for manual trigger from dashboard
export async function POST(request) {
  // Forward to GET handler with manual flag
  const url = new URL(request.url);
  url.searchParams.set('manual', 'true');
  
  return GET(new Request(url, {
    headers: request.headers
  }));
}
