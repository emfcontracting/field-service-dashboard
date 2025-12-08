// app/api/email-import/route.js
// Fetches work order emails from Gmail and parses CBRE dispatch format
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Get a fresh access token using refresh token
async function getAccessToken() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  console.log('Gmail config check:', {
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRefreshToken: !!refreshToken
  });

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Gmail credentials not configured');
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
  console.log('OAuth response:', data.error ? data : 'Success');
  
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

  // Extract WO number from subject: "Dispatch of Work Order C2926480 - Priority: P1-Emergency"
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
  const requestorMatch = cleanBody.match(/Requestor[^:]*:\s*([A-Za-z\s]+),?\s*([\d\-\(\)\s]+)?/i);
  if (requestorMatch) {
    workOrder.requestor = requestorMatch[1].trim();
    if (requestorMatch[2]) {
      workOrder.requestor_phone = requestorMatch[2].trim();
    }
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
  comments.push(`[Imported from CBRE email on ${new Date().toLocaleString()}]`);
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

// GET: Fetch and preview emails
export async function GET(request) {
  try {
    // Check if Gmail is configured
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return Response.json({
        success: false,
        error: 'Gmail API not configured. Please add GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN to environment variables.',
        debug: {
          hasClientId: !!clientId,
          hasClientSecret: !!clientSecret,
          hasRefreshToken: !!refreshToken
        }
      }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    
    // Search for unread emails with "Dispatch of Work Order" in subject
    const query = encodeURIComponent('is:unread subject:"Dispatch of Work Order"');
    
    const listResponse = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const listData = await listResponse.json();
    
    if (listData.error) {
      throw new Error(`Gmail API error: ${listData.error.message}`);
    }
    
    if (!listData.messages || listData.messages.length === 0) {
      return Response.json({
        success: true,
        message: 'No new work order emails found',
        emails: []
      });
    }

    // Fetch full message details for each email
    const emails = [];
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
          continue;
        }
        
        // Get subject
        const subjectHeader = msgData.payload?.headers?.find(h => h.name.toLowerCase() === 'subject');
        const subject = subjectHeader?.value || '';

        // Get body
        const body = getEmailBody(msgData);

        // Parse CBRE format
        const workOrder = parseCBREEmail(subject, body);

        emails.push({
          emailId: msgData.id,
          subject,
          receivedAt: new Date(parseInt(msgData.internalDate)).toISOString(),
          parsedData: workOrder
        });
      } catch (msgErr) {
        console.error('Error processing message:', msgErr);
      }
    }

    return Response.json({
      success: true,
      message: `Found ${emails.length} work order email(s)`,
      emails
    });

  } catch (error) {
    console.error('Email fetch error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// POST: Import selected emails as work orders OR parse pasted content
export async function POST(request) {
  try {
    const body = await request.json();
    
    // Handle paste/parse action (simple mode)
    if (body.action === 'parse') {
      const content = body.emailContent || '';
      const parsed = parseCBREEmail('', content);
      
      // Try to extract WO from content if not found
      if (!parsed.wo_number) {
        const woMatch = content.match(/work order[^\d]*([A-Z]?\d{5,})/i);
        if (woMatch) parsed.wo_number = woMatch[1];
      }
      
      return Response.json({ success: true, parsedData: parsed });
    }
    
    // Handle single import from paste
    if (body.action === 'import' && body.workOrder) {
      const wo = body.workOrder;
      
      if (!wo.wo_number) {
        return Response.json({ success: false, error: 'Work order number is required' }, { status: 400 });
      }
      
      // Check if exists
      const { data: existing } = await supabase
        .from('work_orders')
        .select('wo_id')
        .eq('wo_number', wo.wo_number)
        .single();

      if (existing) {
        return Response.json({ success: false, error: `Work order ${wo.wo_number} already exists` }, { status: 400 });
      }

      // Insert
      const { data, error } = await supabase
        .from('work_orders')
        .insert({
          wo_number: wo.wo_number,
          building: wo.building,
          priority: wo.priority,
          date_entered: wo.date_entered,
          work_order_description: wo.work_order_description,
          requestor: wo.requestor,
          status: 'pending',
          comments: wo.comments,
          nte: wo.nte || 0
        })
        .select()
        .single();

      if (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
      }

      return Response.json({ success: true, message: `Work order ${wo.wo_number} created!`, workOrder: data });
    }
    
    // Handle bulk import from Gmail
    const { emailIds, workOrders, markAsRead: shouldMarkRead = true } = body;

    if (!workOrders || workOrders.length === 0) {
      return Response.json({ success: false, error: 'No work orders provided' }, { status: 400 });
    }

    const accessToken = await getAccessToken();
    const results = { imported: 0, skipped: 0, errors: [] };

    for (let i = 0; i < workOrders.length; i++) {
      const wo = workOrders[i];
      const emailId = emailIds?.[i];

      try {
        // Check if WO already exists
        const { data: existing } = await supabase
          .from('work_orders')
          .select('wo_id')
          .eq('wo_number', wo.wo_number)
          .single();

        if (existing) {
          results.skipped++;
          results.errors.push(`${wo.wo_number}: Already exists`);
          continue;
        }

        // Insert work order
        const { error: insertError } = await supabase
          .from('work_orders')
          .insert({
            wo_number: wo.wo_number,
            building: wo.building,
            priority: wo.priority,
            date_entered: wo.date_entered,
            work_order_description: wo.work_order_description,
            requestor: wo.requestor,
            status: wo.status || 'pending',
            comments: wo.comments,
            nte: wo.nte || 0
          });

        if (insertError) {
          results.errors.push(`${wo.wo_number}: ${insertError.message}`);
          continue;
        }

        results.imported++;

        // Mark email as read if requested
        if (shouldMarkRead && emailId) {
          try {
            await markAsRead(accessToken, emailId);
          } catch (e) {
            console.log('Could not mark email as read:', e.message);
          }
        }

      } catch (err) {
        results.errors.push(`${wo.wo_number}: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      message: `Imported ${results.imported} work order(s), skipped ${results.skipped}`,
      ...results
    });

  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
