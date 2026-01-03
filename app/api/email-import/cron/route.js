// app/api/email-import/cron/route.js
// Automatic email import cron job - runs every 15 minutes
// Fetches unread CBRE dispatch emails via IMAP, imports them automatically, and notifies office

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

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

// Connect to Gmail via IMAP
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

// Fetch emails from IMAP - search INBOX for CBRE dispatch emails
async function fetchEmails() {
  return new Promise((resolve, reject) => {
    const imap = connectIMAP();
    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          imap.end();
          return reject(new Error(`Could not open INBOX: ${err.message}`));
        }

        // Search for unread emails from UPSHelp@cbre.com with "Work Order" or "Dispatch" in subject
        imap.search([
          'UNSEEN',
          ['FROM', 'UPSHelp@cbre.com'],
          ['OR', ['SUBJECT', 'Work Order'], ['SUBJECT', 'Dispatch']]
        ], (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (!results || results.length === 0) {
            imap.end();
            return resolve([]);
          }

          const fetch = imap.fetch(results, {
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

                emails.push({
                  uid,
                  subject: parsed.subject || '',
                  from: parsed.from?.text || '',
                  date: parsed.date || new Date(),
                  body: parsed.html || parsed.textAsHtml || parsed.text || ''
                });
              });
            });
          });

          fetch.once('error', (err) => {
            imap.end();
            reject(err);
          });

          fetch.once('end', () => {
            imap.end();
            resolve(emails);
          });
        });
      });
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
}

// Mark email as read in INBOX
async function markAsRead(uid) {
  return new Promise((resolve, reject) => {
    const imap = connectIMAP();

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        imap.addFlags(uid, ['\\Seen'], (err) => {
          imap.end();
          if (err) return reject(err);
          resolve();
        });
      });
    });

    imap.once('error', (err) => {
      reject(err);
    });

    imap.connect();
  });
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
  const woMatch = (subject || '').match(/(?:PM\s+)?Work Order\s+([A-Z]?\d+)/i);
  if (woMatch) {
    workOrder.wo_number = woMatch[1];
  }

  // Extract Priority
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

  // Extract Date Entered
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

  // Extract Address
  const addressMatch = cleanBody.match(/Address:\s*([^<\n]+?)(?=\s*Country|\s*Building|$)/i);
  if (addressMatch) {
    workOrder.address = addressMatch[1].replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim();
  }

  // Extract City, State
  const locationMatch = cleanBody.match(/Country,?\s*St,?\s*City[:\s]*(?:USA?),?\s*([A-Z]{2}),?\s*([A-Za-z\s]+)/i);
  if (locationMatch) {
    workOrder.state = locationMatch[1].trim();
    workOrder.city = locationMatch[2].trim();
  }

  // Extract Requestor/Site Contact
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

  // Extract NTE
  const nteMatch = cleanBody.match(/should not exceed\s*\*?\*?([\d,]+\.?\d*)\s*USD\*?\*?/i);
  if (nteMatch) {
    workOrder.nte = parseFloat(nteMatch[1].replace(/,/g, '')) || 0;
  }

  // Extract Description
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

  // Build comments
  const comments = [];
  if (isPM) comments.push('[PM - Preventive Maintenance]');
  if (workOrder.address) comments.push(`Address: ${workOrder.address}`);
  if (workOrder.city && workOrder.state) comments.push(`Location: ${workOrder.city}, ${workOrder.state}`);
  if (workOrder.requestor_phone) comments.push(`Contact Phone: ${workOrder.requestor_phone}`);
  const targetMatch = cleanBody.match(/Target Completion:\s*([A-Za-z]+\s+\d+\s+\d+)/i);
  if (targetMatch) comments.push(`Target Completion: ${targetMatch[1].trim()}`);
  const tagMatch = cleanBody.match(/Tag Number:\s*(\d+)/i);
  if (tagMatch) comments.push(`Asset Tag: ${tagMatch[1]}`);
  comments.push(`[Auto-imported from CBRE ${isPM ? 'PM ' : ''}email on ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST]`);
  workOrder.comments = comments.join('\n');

  return workOrder;
}

// Send SMS notification to office staff
async function sendOfficeNotification(importedWOs) {
  try {
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

    const count = importedWOs.length;
    const emergencyCount = importedWOs.filter(wo => wo.priority === 'emergency').length;
    
    let message;
    if (emergencyCount > 0) {
      message = `🚨 EMF: ${count} new WO(s) auto-imported! ${emergencyCount} EMERGENCY. Check dashboard now!`;
    } else {
      message = `📧 EMF: ${count} new WO(s) auto-imported from email. Check dashboard to assign.`;
    }

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
    console.log('Could not log activity (table may not exist):', e.message);
  }
}

// Main cron handler
export async function GET(request) {
  const startTime = Date.now();
  console.log('=== Auto Email Import Cron Started (IMAP) ===');
  console.log('Timestamp:', new Date().toISOString());
  
  // Verify cron secret if configured
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const isManual = searchParams.get('manual') === 'true';
  
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    if (!isManual) {
      console.log('Unauthorized cron request');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('Manual trigger allowed');
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
    // Check if IMAP is configured
    const email = process.env.EMAIL_IMPORT_USER;
    const password = process.env.EMAIL_IMPORT_PASSWORD;

    if (!email || !password) {
      results.success = false;
      results.errors.push('IMAP not configured');
      return Response.json(results, { status: 400 });
    }

    // Check if auto-import is disabled
    if (process.env.AUTO_EMAIL_IMPORT_DISABLED === 'true') {
      results.message = 'Auto-import is disabled';
      return Response.json(results);
    }

    console.log('Fetching emails via IMAP...');
    const rawEmails = await fetchEmails();
    
    console.log(`Found ${rawEmails.length} unread dispatch email(s)`);
    
    if (rawEmails.length === 0) {
      results.message = 'No new dispatch emails found';
      return Response.json(results);
    }

    // Get existing WO numbers
    const { data: existingWOs } = await supabase
      .from('work_orders')
      .select('wo_number');
    const existingWONumbers = new Set((existingWOs || []).map(wo => wo.wo_number));

    // Process each email
    const importedWOs = [];
    
    for (const email of rawEmails) {
      try {
        // Parse CBRE format
        const workOrder = parseCBREEmail(email.subject, email.body);

        // Skip if no WO number found
        if (!workOrder.wo_number) {
          console.log('Could not extract WO number, skipping');
          results.skipped++;
          await markAsRead(email.uid);
          continue;
        }

        // Check if duplicate
        if (existingWONumbers.has(workOrder.wo_number)) {
          console.log(`WO ${workOrder.wo_number} already exists, skipping`);
          results.duplicates++;
          await markAsRead(email.uid);
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
        existingWONumbers.add(workOrder.wo_number);

        // Mark as read
        await markAsRead(email.uid);

      } catch (msgErr) {
        console.error('Error processing message:', msgErr);
        results.errors.push(`Message processing error: ${msgErr.message}`);
      }
    }

    // Send notifications if any WOs imported
    if (importedWOs.length > 0) {
      results.notifications = await sendOfficeNotification(importedWOs);
    }

    // Log activity
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

// POST handler for manual trigger
export async function POST(request) {
  const url = new URL(request.url);
  url.searchParams.set('manual', 'true');
  
  return GET(new Request(url, {
    headers: request.headers
  }));
}
