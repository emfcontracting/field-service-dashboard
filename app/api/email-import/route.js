// app/api/email-import/route.js
// Fetches work order emails from Gmail and parses CBRE dispatch format
// Supports both regular dispatch and PM (Preventive Maintenance) work orders
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

// Parse CBRE work order email (supports both regular dispatch and PM work orders)
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

  // Detect if this is a PM (Preventive Maintenance) work order
  const isPM = (subject || '').toLowerCase().includes('pm work order') || 
               (body || '').toLowerCase().includes('preventive maintenance description');

  // Clean the content - handle quoted-printable encoding
  const cleanBody = (body || '')
    .replace(/=\r?\n/g, '')           // Remove soft line breaks
    .replace(/=3D/g, '=')             // Decode =3D to =
    .replace(/=20/g, ' ')             // Decode =20 to space
    .replace(/=2F/g, '/')             // Decode =2F to /
    .replace(/=2C/g, ',')             // Decode =2C to comma
    .replace(/<[^>]+>/g, ' ')         // Remove HTML tags
    .replace(/&nbsp;/g, ' ')          // Replace &nbsp;
    .replace(/&amp;/g, '&')           // Replace &amp;
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .trim();

  // Extract WO number from subject
  // Regular: "Dispatch of Work Order C2926480 - Priority: P1-Emergency"
  // PM: "Dispatch of PM Work Order P2919408"
  const woMatch = (subject || '').match(/(?:PM\s+)?Work Order\s+([A-Z]?\d+)/i);
  if (woMatch) {
    workOrder.wo_number = woMatch[1];
  }

  // Extract Priority - handle both formats
  // Regular: "Priority: P1-Emergency" or "Priority: P2"
  // PM: "Priority: P10 - 1 Month" or "Priority: P5 - 1 Week"
  const priorityMatch = cleanBody.match(/Priority[:\s]*(P\d+)[\s\-]*([^<\n]*)/i) || 
                        (subject || '').match(/Priority[:\s]*(P\d+)/i);
  if (priorityMatch) {
    const pCode = priorityMatch[1].toUpperCase();
    const pText = (priorityMatch[2] || '').toLowerCase();
    const pNum = parseInt(pCode.replace('P', ''));
    
    if (pNum === 1 || pText.includes('emergency')) {
      workOrder.priority = 'emergency';
    } else if (pNum === 2 || pText.includes('urgent') || pText.includes('24 hour')) {
      workOrder.priority = 'high';
    } else if (pNum === 3 || pNum === 4 || pText.includes('48 hour') || pText.includes('72 hour')) {
      workOrder.priority = 'medium';
    } else {
      // P5+ (1 week, 1 month, etc.) = low priority
      workOrder.priority = 'low';
    }
  }

  // Extract Date Entered - handle various formats
  // "Date Entered: Dec  2 2025  8:17AM UTC-05"
  // "Date Entered: January 15 2025 10:30 AM"
  const dateMatch = cleanBody.match(/Date Entered:\s*([A-Za-z]+\s+\d+\s+\d+\s+[\d:]+\s*[AP]?M?)/i);
  if (dateMatch) {
    try {
      const dateStr = dateMatch[1].replace(/\s+/g, ' ').trim();
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        workOrder.date_entered = parsed.toISOString();
      }
    } catch (e) {
      console.log('Date parse error:', e);
    }
  }

  // Extract Building
  const buildingMatch = cleanBody.match(/Building:\s*([^<\n]+?)(?=\s*Floor|\s*Area|\s*Country|$)/i);
  if (buildingMatch) {
    workOrder.building = buildingMatch[1].trim().substring(0, 200);
  }

  // Extract Address - handle PM format: "Address: 124 CREEKSIDE ROAD, , WEST COLUMBIA, SC, 29172,"
  const addressMatch = cleanBody.match(/Address:\s*([^<\n]+?)(?=\s*Country|\s*Building|$)/i);
  if (addressMatch) {
    // Clean up extra commas and spaces
    workOrder.address = addressMatch[1].replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim();
  }

  // Extract City, State - handle both formats
  // "Country, St, City: USA, ME, Portland"
  // "Country, St, City: US, SC, West Columbia"
  const locationMatch = cleanBody.match(/Country,?\s*St,?\s*City[:\s]*(?:USA?),?\s*([A-Z]{2}),?\s*([A-Za-z\s]+)/i);
  if (locationMatch) {
    workOrder.state = locationMatch[1].trim();
    workOrder.city = locationMatch[2].trim();
  }

  // Extract Requestor/Site Contact
  // Regular: "Work Order Requestor Name and Phone: Warren Newton, 207-341-3521"
  // PM: "UPS Site Contact: Adriana Davis (980-298-0331) Adriana.Davis@cbre.com"
  let requestorMatch = cleanBody.match(/Work Order Requestor Name and Phone:\s*([^,<\n]+),?\s*([\d\-\(\)\s]+)?/i);
  if (!requestorMatch) {
    // Try PM format - UPS Site Contact
    requestorMatch = cleanBody.match(/UPS Site Contact:\s*([^(<\n]+)\s*\(?([\d\-]+)\)?/i);
  }
  if (requestorMatch) {
    workOrder.requestor = requestorMatch[1].trim();
    if (requestorMatch[2]) {
      workOrder.requestor_phone = requestorMatch[2].replace(/[^\d\-]/g, '').trim();
    }
  }

  // Extract NTE - "should not exceed 500.00 USD" or "should not exceed 2500.00 USD"
  const nteMatch = cleanBody.match(/should not exceed\s*\*?\*?([\d,]+\.?\d*)\s*USD\*?\*?/i);
  if (nteMatch) {
    workOrder.nte = parseFloat(nteMatch[1].replace(/,/g, '')) || 0;
  }

  // Extract Description - try multiple patterns
  let description = '';
  
  // Try regular dispatch format first
  let descMatch = cleanBody.match(/Problem Description:\s*(.+?)(?=Assignment Name|Notes to Vendor|Service Location|$)/is);
  
  // Try PM format if regular didn't match
  if (!descMatch || !descMatch[1].trim()) {
    descMatch = cleanBody.match(/Preventive Maintenance Description:\s*(.+?)(?=Service Location|Asset|PM Action|$)/is);
  }
  
  // Also try to get PM Action Steps for additional context
  const pmActionMatch = cleanBody.match(/PM Action Steps:\s*[-]+\s*(.+?)(?=If you have any questions|Assignment Name|$)/is);
  
  if (descMatch && descMatch[1]) {
    description = descMatch[1].replace(/\s+/g, ' ').trim();
  }
  
  // Append PM Action if found and different
  if (pmActionMatch && pmActionMatch[1]) {
    const pmAction = pmActionMatch[1].replace(/\s+/g, ' ').trim();
    if (pmAction && !description.includes(pmAction)) {
      description = description ? `${description}\n\nPM Action: ${pmAction}` : pmAction;
    }
  }
  
  workOrder.work_order_description = description.substring(0, 2000);

  // Build comments with additional info
  const comments = [];
  
  // Add work order type indicator
  if (isPM) {
    comments.push('[PM - Preventive Maintenance]');
  }
  
  if (workOrder.address) comments.push(`Address: ${workOrder.address}`);
  if (workOrder.city && workOrder.state) comments.push(`Location: ${workOrder.city}, ${workOrder.state}`);
  if (workOrder.requestor_phone) comments.push(`Contact Phone: ${workOrder.requestor_phone}`);
  
  // Extract Target Completion if available
  const targetMatch = cleanBody.match(/Target Completion:\s*([A-Za-z]+\s+\d+\s+\d+)/i);
  if (targetMatch) {
    comments.push(`Target Completion: ${targetMatch[1].trim()}`);
  }
  
  // Extract Asset/Tag info for PM orders
  const tagMatch = cleanBody.match(/Tag Number:\s*(\d+)/i);
  if (tagMatch) {
    comments.push(`Asset Tag: ${tagMatch[1]}`);
  }
  
  comments.push(`[Imported from CBRE ${isPM ? 'PM ' : ''}email on ${new Date().toLocaleString()}]`);
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
    // Check for query params
    const { searchParams } = new URL(request.url);
    const includeRead = searchParams.get('includeRead') === 'true';
    const days = parseInt(searchParams.get('days')) || 3;
    
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
    
    // Search for emails with "dispatch" label
    // If includeRead is true, search recent emails regardless of read status
    let query;
    if (includeRead) {
      // Get emails from the last N days with dispatch label
      const afterDate = new Date();
      afterDate.setDate(afterDate.getDate() - days);
      const afterTimestamp = Math.floor(afterDate.getTime() / 1000);
      query = encodeURIComponent(`label:dispatch after:${afterTimestamp}`);
    } else {
      query = encodeURIComponent('is:unread label:dispatch');
    }
    
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

    // Get existing WO numbers to check for duplicates
    const { data: existingWOs } = await supabase
      .from('work_orders')
      .select('wo_number');
    const existingWONumbers = new Set((existingWOs || []).map(wo => wo.wo_number));

    // Fetch full message details for each email
    const emails = [];
    const duplicates = [];
    
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

        // Check if this WO already exists
        if (workOrder.wo_number && existingWONumbers.has(workOrder.wo_number)) {
          duplicates.push({
            wo_number: workOrder.wo_number,
            building: workOrder.building,
            subject
          });
          continue; // Skip duplicates
        }

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
      message: emails.length > 0 
        ? `Found ${emails.length} new work order email(s)${duplicates.length > 0 ? ` (${duplicates.length} duplicates skipped)` : ''}`
        : duplicates.length > 0 
          ? `All ${duplicates.length} email(s) are duplicates of existing work orders`
          : 'No new work order emails found',
      emails,
      duplicates
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
