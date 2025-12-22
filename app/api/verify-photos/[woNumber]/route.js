// app/api/verify-photos/[woNumber]/route.js
// Verifies that before/after photos have been sent to emfcbre@gmail.com for a work order
// Uses IMAP to search Gmail
import { createClient } from '@supabase/supabase-js';
import Imap from 'imap';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Search Gmail via IMAP for photo emails with timeout handling
function searchForPhotos(woNumber) {
  return new Promise((resolve) => {
    // Set overall timeout for serverless environment (8 seconds)
    const timeoutId = setTimeout(() => {
      console.log('IMAP search timed out');
      resolve({ found: false, emails: [], error: 'Search timed out' });
    }, 8000);

    const imapConfig = {
      user: process.env.SMTP_USER || 'emfcbre@gmail.com',
      password: process.env.SMTP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { 
        rejectUnauthorized: false,
        servername: 'imap.gmail.com'
      },
      authTimeout: 5000,
      connTimeout: 5000
    };

    console.log('Connecting to IMAP with user:', imapConfig.user);

    const imap = new Imap(imapConfig);

    let results = {
      found: false,
      emails: [],
      error: null
    };

    function cleanup() {
      clearTimeout(timeoutId);
      try {
        imap.end();
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    imap.once('ready', () => {
      console.log('IMAP connected, opening mailbox...');
      
      // Try to open INBOX (simpler than All Mail)
      imap.openBox('INBOX', true, (err, box) => {
        if (err) {
          console.error('Error opening mailbox:', err.message);
          results.error = 'Could not open mailbox';
          cleanup();
          resolve(results);
          return;
        }

        console.log('Mailbox opened, searching for:', woNumber);

        // Search for emails with "Photos" and WO number in subject
        // Subject format: "Photos - C2900347 - SCMYR - MYRTLE BEACH CENTER"
        const searchCriteria = [
          ['OR',
            ['SUBJECT', `Photos - ${woNumber}`],
            ['SUBJECT', `Fotos - ${woNumber}`]
          ]
        ];

        imap.search(searchCriteria, (searchErr, uids) => {
          if (searchErr) {
            console.error('Search error:', searchErr.message);
            // Try simpler search
            imap.search([['SUBJECT', woNumber]], (searchErr2, uids2) => {
              if (searchErr2 || !uids2 || uids2.length === 0) {
                console.log('No emails found for WO:', woNumber);
                cleanup();
                resolve(results);
                return;
              }
              processResults(uids2);
            });
            return;
          }

          if (!uids || uids.length === 0) {
            console.log('No emails found matching criteria');
            // Try broader search - just WO number
            imap.search([['SUBJECT', woNumber]], (searchErr2, uids2) => {
              if (searchErr2 || !uids2 || uids2.length === 0) {
                cleanup();
                resolve(results);
                return;
              }
              // Filter to only those with "Photos" or "Fotos"
              processResults(uids2);
            });
            return;
          }

          processResults(uids);
        });

        function processResults(uids) {
          if (!uids || uids.length === 0) {
            cleanup();
            resolve(results);
            return;
          }

          console.log(`Found ${uids.length} potential emails`);

          const fetch = imap.fetch(uids.slice(-5), {
            bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
            struct: false
          });

          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              let buffer = '';
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
              stream.on('end', () => {
                const subjectMatch = buffer.match(/Subject:\s*(.+?)(?:\r\n|\n)/i);
                const subject = subjectMatch ? subjectMatch[1].trim() : '';
                
                // Check if this is actually a photo email
                if (subject.toLowerCase().includes('photo') || subject.toLowerCase().includes('foto')) {
                  const fromMatch = buffer.match(/From:\s*(.+?)(?:\r\n|\n)/i);
                  const dateMatch = buffer.match(/Date:\s*(.+?)(?:\r\n|\n)/i);
                  
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
            console.log('Fetch complete, found:', results.emails.length, 'photo emails');
            cleanup();
            resolve(results);
          });
        }
      });
    });

    imap.once('error', (err) => {
      console.error('IMAP connection error:', err.message);
      results.error = err.message;
      cleanup();
      resolve(results);
    });

    imap.once('end', () => {
      console.log('IMAP connection ended');
    });

    try {
      imap.connect();
    } catch (connectErr) {
      console.error('IMAP connect error:', connectErr.message);
      results.error = connectErr.message;
      cleanup();
      resolve(results);
    }
  });
}

// GET: Check if photos exist for a work order
export async function GET(request, { params }) {
  try {
    const { woNumber } = await params;

    if (!woNumber) {
      return Response.json({ success: false, error: 'WO number required' }, { status: 400 });
    }

    console.log('Checking photos for WO:', woNumber);

    // First check if already verified in database
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, photos_received, photos_verified_at, photos_email_subject')
      .eq('wo_number', woNumber)
      .single();

    if (woError || !workOrder) {
      return Response.json({ 
        success: false, 
        error: 'Work order not found' 
      }, { status: 404 });
    }

    // If already marked as received, return immediately
    if (workOrder.photos_received) {
      return Response.json({
        success: true,
        photos_received: true,
        cached: true,
        verified_at: workOrder.photos_verified_at,
        email_subject: workOrder.photos_email_subject
      });
    }

    // Check SMTP/IMAP credentials
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error('Missing SMTP credentials');
      return Response.json({ 
        success: false, 
        error: 'Email not configured',
        photos_received: workOrder.photos_received || false
      }, { status: 500 });
    }

    // Search for photos in email via IMAP
    console.log('Starting IMAP search...');
    const searchResult = await searchForPhotos(woNumber);
    console.log('IMAP search result:', searchResult);

    if (searchResult.error && !searchResult.found) {
      console.error('IMAP search error:', searchResult.error);
      // Return current database status if search fails
      return Response.json({
        success: true,
        photos_received: workOrder.photos_received || false,
        search_error: searchResult.error,
        message: 'Could not search email, showing last known status'
      });
    }

    // Update database with result
    if (searchResult.found && searchResult.emails.length > 0) {
      const latestEmail = searchResult.emails[searchResult.emails.length - 1];
      
      await supabase
        .from('work_orders')
        .update({
          photos_received: true,
          photos_verified_at: new Date().toISOString(),
          photos_email_subject: latestEmail?.subject || null
        })
        .eq('wo_id', workOrder.wo_id);

      return Response.json({
        success: true,
        photos_received: true,
        verified_at: new Date().toISOString(),
        email_count: searchResult.emails.length,
        latest_email: latestEmail
      });
    } else {
      // No photos found
      await supabase
        .from('work_orders')
        .update({
          photos_verified_at: new Date().toISOString()
        })
        .eq('wo_id', workOrder.wo_id);

      return Response.json({
        success: true,
        photos_received: false,
        verified_at: new Date().toISOString(),
        message: 'No photo emails found for this work order'
      });
    }

  } catch (error) {
    console.error('Verify photos error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// POST: Manually mark photos as received (for office override)
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

    // Update photos status
    const updates = {
      photos_received: received !== false,
      photos_verified_at: new Date().toISOString()
    };

    // Add note to comments about manual override
    if (override_reason) {
      const timestamp = new Date().toLocaleString();
      const newComment = `[PHOTOS OVERRIDE] ${timestamp}\nManually marked as ${received ? 'received' : 'not received'}: ${override_reason}`;
      updates.comments = workOrder.comments 
        ? `${workOrder.comments}\n\n${newComment}`
        : newComment;
    }

    const { error: updateError } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('wo_id', workOrder.wo_id);

    if (updateError) {
      return Response.json({ success: false, error: updateError.message }, { status: 500 });
    }

    return Response.json({
      success: true,
      photos_received: received !== false,
      message: `Photos manually marked as ${received ? 'received' : 'not received'}`
    });

  } catch (error) {
    console.error('Manual photo override error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
