// app/api/verify-receipts/[woNumber]/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Verifies that material receipts have been sent to emfcbre@gmail.com for a WO.
// IMAP search Gmail for emails with "Receipts" / "Recibos" + WO number in subject.
// Mirrors verify-photos and verify-writeups exactly.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import { findMailsBySubject } from '@/lib/imap';
import { requireUser } from '@/lib/serverAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Gmail search lives in lib/imap.js (findMailsBySubject): subject must contain
// one of the terms AND the WO number; 12 s budget, never throws.
const searchForReceipts = (woNumber) => findMailsBySubject({ account: 'photos', terms: ['Receipts', 'Recibos'], contains: woNumber });

export async function GET(request, { params }) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
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
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
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
      const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
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
