// app/api/verify-writeups/[woNumber]/route.js
// Verifies that PMI write-ups have been sent to emfcbre@gmail.com for PM work orders
// Uses IMAP to search Gmail - looks for "PMI" or "Write-up" + WO number in subject
import { createClient } from '@supabase/supabase-js';
import Imap from 'imap';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Search Gmail via IMAP for PMI write-up emails
function searchForWriteups(woNumber) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.log('IMAP search timed out');
      resolve({ found: false, emails: [], error: 'Search timed out' });
    }, 12000);

    const imapConfig = {
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 8000,
      connTimeout: 8000
    };

    console.log('IMAP connecting as:', imapConfig.user);
    console.log('Looking for: "PMI" + "' + woNumber + '" in subject');

    const imap = new Imap(imapConfig);

    let results = {
      found: false,
      emails: [],
      error: null
    };

    function cleanup() {
      clearTimeout(timeoutId);
      try { imap.end(); } catch (e) {}
    }

    imap.once('ready', () => {
      console.log('IMAP connected');
      
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          console.error('Mailbox error:', err.message);
          results.error = err.message;
          cleanup();
          resolve(results);
          return;
        }

        console.log('INBOX opened, messages:', box.messages?.total);

        // Search for emails with "PMI" in subject
        imap.search([['SUBJECT', 'PMI']], (err1, pmiUids) => {
          // Also search for "Write-up" in subject
          imap.search([['SUBJECT', 'Write-up']], (err2, writeupUids) => {
            // Also search for "Writeup" (no hyphen)
            imap.search([['SUBJECT', 'Writeup']], (err3, writeupUids2) => {
              // Also search for "Informe" (Spanish)
              imap.search([['SUBJECT', 'Informe']], (err4, informeUids) => {
                // Combine all results
                const allUids = [...new Set([
                  ...(pmiUids || []), 
                  ...(writeupUids || []),
                  ...(writeupUids2 || []),
                  ...(informeUids || [])
                ])];
                
                console.log('Found', allUids.length, 'emails with PMI/Write-up/Informe in subject');

                if (allUids.length === 0) {
                  console.log('No PMI write-up emails found at all');
                  cleanup();
                  resolve(results);
                  return;
                }

                // Fetch these emails and check if WO number is in subject
                const fetch = imap.fetch(allUids, {
                  bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
                  struct: false
                });

                fetch.on('message', (msg) => {
                  msg.on('body', (stream) => {
                    let buffer = '';
                    stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
                    stream.on('end', () => {
                      const subjectMatch = buffer.match(/Subject:\s*(.+?)(?:\r\n|\n)/i);
                      const subject = subjectMatch ? subjectMatch[1].trim() : '';
                      
                      // Check if WO number is in subject
                      if (subject.toUpperCase().includes(woNumber.toUpperCase())) {
                        const fromMatch = buffer.match(/From:\s*(.+?)(?:\r\n|\n)/i);
                        const dateMatch = buffer.match(/Date:\s*(.+?)(?:\r\n|\n)/i);
                        
                        console.log('✓ MATCH:', subject);
                        results.emails.push({
                          subject: subject,
                          from: fromMatch ? fromMatch[1].trim() : '',
                          date: dateMatch ? dateMatch[1].trim() : ''
                        });
                        results.found = true;
                      }
                    });
                  });
                });

                fetch.once('error', (fetchErr) => {
                  console.error('Fetch error:', fetchErr.message);
                  results.error = fetchErr.message;
                });

                fetch.once('end', () => {
                  console.log('Search complete. Matches:', results.emails.length);
                  cleanup();
                  resolve(results);
                });
              });
            });
          });
        });
      });
    });

    imap.once('error', (err) => {
      console.error('IMAP error:', err.message);
      results.error = err.message;
      cleanup();
      resolve(results);
    });

    try {
      imap.connect();
    } catch (e) {
      results.error = e.message;
      cleanup();
      resolve(results);
    }
  });
}

// GET: Check if PMI write-ups exist for a PM work order
export async function GET(request, { params }) {
  try {
    const { woNumber } = await params;

    if (!woNumber) {
      return Response.json({ success: false, error: 'WO number required' }, { status: 400 });
    }

    // Verify this is a PM work order (starts with P followed by numbers)
    const isPMWorkOrder = /^P\d+$/i.test(woNumber);
    if (!isPMWorkOrder) {
      return Response.json({
        success: true,
        writeups_received: true, // Non-PM work orders don't need write-ups
        not_required: true,
        message: 'Write-ups not required for non-PM work orders'
      });
    }

    console.log('=== PMI Write-up check for:', woNumber, '===');

    // Check database first
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, writeups_received, writeups_verified_at, writeups_email_subject')
      .eq('wo_number', woNumber)
      .single();

    if (woError || !workOrder) {
      return Response.json({ success: false, error: 'Work order not found' }, { status: 404 });
    }

    // If already marked as received, return cached result
    if (workOrder.writeups_received) {
      return Response.json({
        success: true,
        writeups_received: true,
        cached: true,
        verified_at: workOrder.writeups_verified_at,
        email_subject: workOrder.writeups_email_subject
      });
    }

    // Check credentials
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return Response.json({ 
        success: false, 
        error: 'Email not configured',
        writeups_received: false
      }, { status: 500 });
    }

    // Search email
    const searchResult = await searchForWriteups(woNumber);

    if (searchResult.error && !searchResult.found) {
      return Response.json({
        success: true,
        writeups_received: false,
        search_error: searchResult.error,
        message: 'Could not search email'
      });
    }

    // Update database
    if (searchResult.found && searchResult.emails.length > 0) {
      const latestEmail = searchResult.emails[searchResult.emails.length - 1];
      
      await supabase
        .from('work_orders')
        .update({
          writeups_received: true,
          writeups_verified_at: new Date().toISOString(),
          writeups_email_subject: latestEmail?.subject || null
        })
        .eq('wo_id', workOrder.wo_id);

      return Response.json({
        success: true,
        writeups_received: true,
        verified_at: new Date().toISOString(),
        email_count: searchResult.emails.length,
        latest_email: latestEmail
      });
    } else {
      await supabase
        .from('work_orders')
        .update({ writeups_verified_at: new Date().toISOString() })
        .eq('wo_id', workOrder.wo_id);

      return Response.json({
        success: true,
        writeups_received: false,
        verified_at: new Date().toISOString(),
        message: 'No PMI write-up emails found for this work order'
      });
    }

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Manual override
export async function POST(request, { params }) {
  try {
    const { woNumber } = await params;
    const body = await request.json();
    const { received, override_reason } = body;

    if (!woNumber) {
      return Response.json({ success: false, error: 'WO number required' }, { status: 400 });
    }

    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, comments')
      .eq('wo_number', woNumber)
      .single();

    if (woError || !workOrder) {
      return Response.json({ success: false, error: 'Work order not found' }, { status: 404 });
    }

    const updates = {
      writeups_received: received !== false,
      writeups_verified_at: new Date().toISOString()
    };

    if (override_reason) {
      const timestamp = new Date().toLocaleString();
      const newComment = `[WRITEUPS OVERRIDE] ${timestamp}\nManually marked as ${received ? 'received' : 'not received'}: ${override_reason}`;
      updates.comments = workOrder.comments 
        ? `${workOrder.comments}\n\n${newComment}`
        : newComment;
    }

    await supabase
      .from('work_orders')
      .update(updates)
      .eq('wo_id', workOrder.wo_id);

    return Response.json({
      success: true,
      writeups_received: received !== false,
      message: `Write-ups manually marked as ${received ? 'received' : 'not received'}`
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
