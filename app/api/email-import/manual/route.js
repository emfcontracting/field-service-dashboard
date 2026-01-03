// app/api/email-import/manual/route.js
// Manual work order import by WO number - searches email regardless of read status
import { createClient } from '@supabase/supabase-js';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function connectIMAP() {
  const email = process.env.EMAIL_IMPORT_USER;
  const password = process.env.EMAIL_IMPORT_PASSWORD;

  if (!email || !password) {
    throw new Error('IMAP credentials not configured');
  }

  return new Imap({
    user: email,
    password: password,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });
}

// Search for email by WO number (regardless of read status)
async function findEmailByWO(woNumber) {
  return new Promise((resolve, reject) => {
    const imap = connectIMAP();
    let foundEmail = null;

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        // Search for emails from CBRE with this WO number in subject
        // Search last 30 days, regardless of read status
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        imap.search([
          ['SINCE', thirtyDaysAgo],
          ['FROM', 'UPSHelp@cbre.com'],
          ['SUBJECT', woNumber]
        ], (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (!results || results.length === 0) {
            imap.end();
            return resolve(null);
          }

          // Get the first matching email
          const fetch = imap.fetch([results[0]], {
            bodies: '',
            markSeen: false
          });

          fetch.on('message', (msg, seqno) => {
            let buffer = '';
            let uid;

            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
            });

            msg.once('attributes', (attrs) => {
              uid = attrs.uid;
            });

            msg.once('end', () => {
              simpleParser(buffer, (err, parsed) => {
                if (err) {
                  console.error('Parse error:', err);
                  return;
                }

                foundEmail = {
                  uid,
                  subject: parsed.subject || '',
                  from: parsed.from?.text || '',
                  date: parsed.date || new Date(),
                  body: parsed.html || parsed.textAsHtml || parsed.text || ''
                };
              });
            });
          });

          fetch.once('error', (err) => {
            imap.end();
            reject(err);
          });

          fetch.once('end', () => {
            imap.end();
            resolve(foundEmail);
          });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
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

  const isPM = (subject || '').toLowerCase().includes('pm work order') || 
               (body || '').toLowerCase().includes('preventive maintenance description');

  const cleanBody = (body || '')
    .replace(/=\r?\n/g, '')
    .replace(/=3D/g, '=')
    .replace(/=20/g, ' ')
    .replace(/=2F/g, '/')
    .replace(/=2C/g, ',')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  const woMatch = (subject || '').match(/(?:PM\s+)?Work Order\s+([A-Z]?\d+)/i);
  if (woMatch) {
    workOrder.wo_number = woMatch[1];
  }

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
      workOrder.priority = 'low';
    }
  }

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

  const buildingMatch = cleanBody.match(/Building:\s*([^<\n]+?)(?=\s*Floor|\s*Area|\s*Country|$)/i);
  if (buildingMatch) {
    workOrder.building = buildingMatch[1].trim().substring(0, 200);
  }

  const addressMatch = cleanBody.match(/Address:\s*([^<\n]+?)(?=\s*Country|\s*Building|$)/i);
  if (addressMatch) {
    workOrder.address = addressMatch[1].replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim();
  }

  const locationMatch = cleanBody.match(/Country,?\s*St,?\s*City[:\s]*(?:USA?),?\s*([A-Z]{2}),?\s*([A-Za-z\s]+)/i);
  if (locationMatch) {
    workOrder.state = locationMatch[1].trim();
    workOrder.city = locationMatch[2].trim();
  }

  let requestorMatch = cleanBody.match(/Work Order Requestor Name and Phone:\s*([^,<\n]+),?\s*([\d\-\(\)\s]+)?/i);
  if (!requestorMatch) {
    requestorMatch = cleanBody.match(/UPS Site Contact:\s*([^(<\n]+)\s*\(?([\d\-]+)\)?/i);
  }
  if (requestorMatch) {
    workOrder.requestor = requestorMatch[1].trim();
    if (requestorMatch[2]) {
      workOrder.requestor_phone = requestorMatch[2].replace(/[^\d\-]/g, '').trim();
    }
  }

  const nteMatch = cleanBody.match(/should not exceed\s*\*?\*?([\d,]+\.?\d*)\s*USD\*?\*?/i);
  if (nteMatch) {
    workOrder.nte = parseFloat(nteMatch[1].replace(/,/g, '')) || 0;
  }

  let description = '';
  let descMatch = cleanBody.match(/Problem Description:\s*(.+?)(?=Assignment Name|Notes to Vendor|Service Location|$)/is);
  if (!descMatch || !descMatch[1].trim()) {
    descMatch = cleanBody.match(/Preventive Maintenance Description:\s*(.+?)(?=Service Location|Asset|PM Action|$)/is);
  }
  const pmActionMatch = cleanBody.match(/PM Action Steps:\s*[-]+\s*(.+?)(?=If you have any questions|Assignment Name|$)/is);
  if (descMatch && descMatch[1]) {
    description = descMatch[1].replace(/\s+/g, ' ').trim();
  }
  if (pmActionMatch && pmActionMatch[1]) {
    const pmAction = pmActionMatch[1].replace(/\s+/g, ' ').trim();
    if (pmAction && !description.includes(pmAction)) {
      description = description ? `${description}\n\nPM Action: ${pmAction}` : pmAction;
    }
  }
  workOrder.work_order_description = description.substring(0, 2000);

  const comments = [];
  if (isPM) comments.push('[PM - Preventive Maintenance]');
  if (workOrder.address) comments.push(`Address: ${workOrder.address}`);
  if (workOrder.city && workOrder.state) comments.push(`Location: ${workOrder.city}, ${workOrder.state}`);
  if (workOrder.requestor_phone) comments.push(`Contact Phone: ${workOrder.requestor_phone}`);
  const targetMatch = cleanBody.match(/Target Completion:\s*([A-Za-z]+\s+\d+\s+\d+)/i);
  if (targetMatch) comments.push(`Target Completion: ${targetMatch[1].trim()}`);
  const tagMatch = cleanBody.match(/Tag Number:\s*(\d+)/i);
  if (tagMatch) comments.push(`Asset Tag: ${tagMatch[1]}`);
  comments.push(`[Manually imported from CBRE ${isPM ? 'PM ' : ''}email on ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST]`);
  workOrder.comments = comments.join('\n');

  return workOrder;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const woNumber = searchParams.get('wo');

  if (!woNumber) {
    return Response.json({
      success: false,
      error: 'Please provide a WO number using ?wo=C2958127'
    }, { status: 400 });
  }

  try {
    // Check if already exists
    const { data: existing } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, building, status')
      .eq('wo_number', woNumber)
      .single();

    if (existing) {
      return Response.json({
        success: false,
        error: `Work order ${woNumber} already exists`,
        existingWorkOrder: existing
      }, { status: 400 });
    }

    // Search for email
    const email = await findEmailByWO(woNumber);

    if (!email) {
      return Response.json({
        success: false,
        error: `No email found for work order ${woNumber} in last 30 days`
      }, { status: 404 });
    }

    // Parse the email
    const workOrder = parseCBREEmail(email.subject, email.body);

    // Verify WO number matches
    if (workOrder.wo_number !== woNumber) {
      return Response.json({
        success: false,
        error: `Email found but WO number doesn't match. Expected: ${woNumber}, Found: ${workOrder.wo_number}`,
        parsedData: workOrder
      }, { status: 400 });
    }

    // Import work order
    const { data: inserted, error: insertError } = await supabase
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
      return Response.json({
        success: false,
        error: insertError.message
      }, { status: 500 });
    }

    return Response.json({
      success: true,
      message: `Successfully imported work order ${woNumber}`,
      workOrder: inserted
    });

  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
