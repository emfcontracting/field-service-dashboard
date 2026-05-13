// app/api/verify-receipts/[woNumber]/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Verifies that material receipts have been sent to emfcbre@gmail.com for a WO.
// IMAP search Gmail for emails with "Receipts" / "Recibos" + WO number in subject.
// Mirrors verify-photos and verify-writeups exactly.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import Imap from 'imap';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function searchForReceipts(woNumber) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.log('IMAP search timed out');
      resolve({ found: false, emails: [], error: 'Search timed out' });
    }, 12000);

    const imap = new Imap({
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      authTimeout: 8000,
      connTimeout: 8000,
    });

    const results = { found: false, emails: [], error: null };
    const cleanup = () => { clearTimeout(timeoutId); try { imap.end(); } catch {} };

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err) => {
        if (err) { results.error = err.message; cleanup(); resolve(results); return; }

        // Search for "Receipts" (EN) + "Recibos" (ES) in subject.
        imap.search([['SUBJECT', 'Receipts']], (e1, receiptUids) => {
          imap.search([['SUBJECT', 'Recibos']], (e2, recibosUids) => {
            const allUids = [...new Set([
              ...(receiptUids || []),
              ...(recibosUids || []),
            ])];

            if (allUids.length === 0) { cleanup(); resolve(results); return; }

            const fetch = imap.fetch(allUids, {
              bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)',
              struct: false,
            });

            fetch.on('message', (msg) => {
              msg.on('body', (stream) => {
                let buffer = '';
                stream.on('data', (chunk) => buffer += chunk.toString('utf8'));
                stream.on('end', () => {
                  const subjectMatch = buffer.match(/Subject:\s*(.+?)(?:\r\n|\n)/i);
                  const subject = subjectMatch ? subjectMatch[1].trim() : '';
                  if (subject.toUpperCase().includes(woNumber.toUpperCase())) {
                    const fromMatch = buffer.match(/From:\s*(.+?)(?:\r\n|\n)/i);
                    const dateMatch = buffer.match(/Date:\s*(.+?)(?:\r\n|\n)/i);
                    results.emails.push({
                      subject,
                      from: fromMatch ? fromMatch[1].trim() : '',
                      date: dateMatch ? dateMatch[1].trim() : '',
                    });
                    results.found = true;
                  }
                });
              });
            });

            fetch.once('error', (fetchErr) => { results.error = fetchErr.message; });
            fetch.once('end', () => { cleanup(); resolve(results); });
          });
        });
      });
    });

    imap.once('error', (err) => { results.error = err.message; cleanup(); resolve(results); });

    try { imap.connect(); } catch (e) { results.error = e.message; cleanup(); resolve(results); }
  });
}

// ── GET: Check if receipts exist ────────────────────────────────────────────
export async function GET(_request, { params }) {
  try {
    const { woNumber } = await params;
    if (!woNumber) return Response.json({ success: false, error: 'WO number required' }, { status: 400 });

    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, receipts_received, receipts_verified_at, receipts_email_subject')
      .eq('wo_number', woNumber)
      .single();

    if (woError || !workOrder) {
      return Response.json({ success: false, error: 'Work order not found' }, { status: 404 });
    }

    // Cached hit — no IMAP roundtrip needed
    if (workOrder.receipts_received) {
      return Response.json({
        success: true,
        receipts_received: true,
        cached: true,
        verified_at: workOrder.receipts_verified_at,
        email_subject: workOrder.receipts_email_subject,
      });
    }

    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return Response.json({
        success: false, error: 'Email not configured', receipts_received: false,
      }, { status: 500 });
    }

    const searchResult = await searchForReceipts(woNumber);

    if (searchResult.error && !searchResult.found) {
      return Response.json({
        success: true,
        receipts_received: false,
        search_error: searchResult.error,
        message: 'Could not search email',
      });
    }

    if (searchResult.found && searchResult.emails.length > 0) {
      const latestEmail = searchResult.emails[searchResult.emails.length - 1];
      await supabase
        .from('work_orders')
        .update({
          receipts_received: true,
          receipts_verified_at: new Date().toISOString(),
          receipts_email_subject: latestEmail?.subject || null,
        })
        .eq('wo_id', workOrder.wo_id);

      return Response.json({
        success: true,
        receipts_received: true,
        verified_at: new Date().toISOString(),
        email_count: searchResult.emails.length,
        latest_email: latestEmail,
      });
    }

    // No matches — touch verified_at so we can show "last checked" in the UI
    await supabase
      .from('work_orders')
      .update({ receipts_verified_at: new Date().toISOString() })
      .eq('wo_id', workOrder.wo_id);

    return Response.json({
      success: true,
      receipts_received: false,
      verified_at: new Date().toISOString(),
      message: 'No receipt emails found for this work order',
    });
  } catch (error) {
    console.error('verify-receipts error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// ── POST: Manual override ─────────────────────────────────────────────────
export async function POST(request, { params }) {
  try {
    const { woNumber } = await params;
    const body = await request.json();
    const { received, override_reason } = body;

    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, comments')
      .eq('wo_number', woNumber)
      .single();

    if (woError || !workOrder) {
      return Response.json({ success: false, error: 'Work order not found' }, { status: 404 });
    }

    const updates = {
      receipts_received: received !== false,
      receipts_verified_at: new Date().toISOString(),
    };

    if (override_reason) {
      const timestamp = new Date().toLocaleString();
      const newComment = `[RECEIPTS OVERRIDE] ${timestamp}\nManually marked as ${received ? 'received' : 'not received'}: ${override_reason}`;
      updates.comments = workOrder.comments ? `${workOrder.comments}\n\n${newComment}` : newComment;
    }

    await supabase.from('work_orders').update(updates).eq('wo_id', workOrder.wo_id);

    return Response.json({
      success: true,
      receipts_received: received !== false,
      message: `Receipts manually marked as ${received ? 'received' : 'not received'}`,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
