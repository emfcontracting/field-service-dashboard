// app/api/email-import/cron/route.js
// Automatic email import cron job - runs every 10 minutes
// Fetches unread dispatch emails via IMAP, imports them automatically, and notifies office via email

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Email transporter for notifications
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

        // Search for unread emails with "Work Order" or "Dispatch" in subject
        // Only from last 7 days to avoid importing old emails
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        // Format date for IMAP (expects "DD-MMM-YYYY" format like "05-Jan-2026")
        const formatIMAPDate = (date) => {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const day = date.getDate().toString().padStart(2, '0');
          const month = months[date.getMonth()];
          const year = date.getFullYear();
          return `${day}-${month}-${year}`;
        };
        
        const sinceDate = formatIMAPDate(sevenDaysAgo);
        console.log(`Searching for emails since: ${sinceDate}`);

        imap.search([
          'UNSEEN',
          ['SINCE', sinceDate],
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

          const parsePromises = []; // Track all parse operations

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
              // Create a promise for each parse operation
              const parsePromise = new Promise((resolveParser) => {
                simpleParser(buffer, (err, parsed) => {
                  if (err) {
                    console.error('Parse error:', err);
                    resolveParser(); // Resolve even on error
                    return;
                  }

                  emails.push({
                    uid,
                    subject: parsed.subject || '',
                    from: parsed.from?.text || '',
                    date: parsed.date || new Date(),
                    body: parsed.html || parsed.textAsHtml || parsed.text || ''
                  });
                  resolveParser();
                });
              });
              parsePromises.push(parsePromise);
            });
          });

          fetch.once('error', (err) => {
            imap.end();
            reject(err);
          });

          fetch.once('end', async () => {
            // Wait for all parse operations to complete
            await Promise.all(parsePromises);
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
  // Handle multiple formats:
  // - "Dispatch of Work Order C2959324 - Priority: P2-Urgent"
  // - "Dispatch_of_Work_Order_C2959324_-_Priority__P2-Urgent" (underscores)
  // - "PM Work Order P2919408"
  const woMatch = (subject || '').match(/(?:PM[\s_]+)?Work[\s_]+Order[\s_]+([A-Z]?\d+)/i);
  if (woMatch) {
    workOrder.wo_number = woMatch[1];
  }

  // Extract Priority
  const priorityMatch = cleanBody.match(/Priority[:\s_]*(P\d+)[\s\-_]*([^<\n]*)/i) || 
                        (subject || '').match(/Priority[:\s_]*(P\d+)/i);
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

// Send email notification to office staff
async function sendOfficeNotification(importedWOs) {
  try {
    const { data: officeUsers, error } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, email, role')
      .in('role', ['admin', 'operations'])
      .eq('is_active', true)
      .not('email', 'is', null);

    if (error || !officeUsers || officeUsers.length === 0) {
      console.log('No office users configured for email notifications');
      return { sent: 0 };
    }

    const count = importedWOs.length;
    const emergencyCount = importedWOs.filter(wo => wo.priority === 'emergency').length;
    
    // Build work order list
    const woList = importedWOs.map(wo => {
      const priorityEmoji = wo.priority === 'emergency' ? '🔴' : 
                           wo.priority === 'high' ? '🟠' : 
                           wo.priority === 'medium' ? '🟡' : '🟢';
      return `${priorityEmoji} <strong>${wo.wo_number}</strong> - ${wo.building} (${wo.priority.toUpperCase()})`;
    }).join('<br>');

    const subject = emergencyCount > 0 
      ? `🚨 EMERGENCY: ${count} New Work Order${count > 1 ? 's' : ''} Auto-Imported`
      : `📧 ${count} New Work Order${count > 1 ? 's' : ''} Auto-Imported`;

    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${emergencyCount > 0 ? '#dc2626' : '#2563eb'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
          .wo-list { background: white; padding: 15px; border-radius: 6px; margin: 15px 0; }
          .footer { background: #1f2937; color: #9ca3af; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; font-size: 12px; }
          .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2 style="margin: 0;">${emergencyCount > 0 ? '🚨 EMERGENCY ALERT' : '📧 New Work Orders'}</h2>
          </div>
          <div class="content">
            <p><strong>${count} work order${count > 1 ? 's have' : ' has'} been automatically imported from email.</strong></p>
            ${emergencyCount > 0 ? '<p style="color: #dc2626; font-weight: bold;">⚠️ ' + emergencyCount + ' EMERGENCY work order' + (emergencyCount > 1 ? 's' : '') + ' require immediate attention!</p>' : ''}
            <div class="wo-list">
              ${woList}
            </div>
            <p>Please log in to the dashboard to review and assign these work orders.</p>
            <a href="https://field-service-dashboard.vercel.app/dashboard" class="button">Open Dashboard</a>
          </div>
          <div class="footer">
            EMF Contracting LLC - PCS FieldService<br>
            Automated notification - Do not reply
          </div>
        </div>
      </body>
      </html>
    `;

    let sent = 0;
    for (const user of officeUsers) {
      if (!user.email) continue;
      
      try {
        await transporter.sendMail({
          from: `"EMF FieldService" <${process.env.EMAIL_USER || 'emfcbre@gmail.com'}>`,
          to: user.email,
          subject: subject,
          html: htmlBody
        });
        sent++;
        console.log(`Email sent to ${user.first_name} ${user.last_name} (${user.email})`);
      } catch (e) {
        console.error(`Failed to send email to ${user.first_name}:`, e.message);
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
        log_type: 'email_import',
        message: results.message || 'Email import completed',
        status: results.success ? 'success' : 'failed',
        metadata: results
      });
  } catch (e) {
    console.log('Could not log activity:', e.message);
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
    
    // Safety check: if manual trigger, allow large imports. If auto-cron, limit to 50 emails
    const maxAutoImport = 50;
    if (!isManual && rawEmails.length > maxAutoImport) {
      results.message = `Found ${rawEmails.length} emails - too many for automatic import. Please use manual import or mark old emails as read in Gmail.`;
      results.skipped = rawEmails.length;
      results.success = false;
      console.log(`⚠️ Skipping automatic import: ${rawEmails.length} emails exceeds safety limit of ${maxAutoImport}`);
      
      // Log this warning
      await logImportActivity(results);
      
      return Response.json(results);
    }
    
    if (rawEmails.length === 0) {
      results.message = 'No new dispatch emails found';
      await logImportActivity(results);
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
