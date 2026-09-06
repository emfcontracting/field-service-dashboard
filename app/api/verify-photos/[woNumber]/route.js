// app/api/verify-photos/[woNumber]/route.js
// Verifies that before/after photos have been sent to emfcbre@gmail.com for a work order
// Uses IMAP to search Gmail - just needs "photos" + WO number in subject
import { createClient } from '@supabase/supabase-js';
import { findMailsBySubject } from '@/lib/imap';
import { requireUser } from '@/lib/serverAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Search Gmail via IMAP for photo emails
// Gmail search lives in lib/imap.js (findMailsBySubject): subject must contain
// one of the terms AND the WO number; 12 s budget, never throws.
const searchForPhotos = (woNumber) => findMailsBySubject({ account: 'photos', terms: ['Photos', 'Fotos'], contains: woNumber });

export async function GET(request, { params }) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const { woNumber } = await params;

    if (!woNumber) {
      return Response.json({ success: false, error: 'WO number required' }, { status: 400 });
    }

    console.log('=== Photo check for:', woNumber, '===');

    // Check database first
    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, photos_received, photos_verified_at, photos_email_subject')
      .eq('wo_number', woNumber)
      .single();

    if (woError || !workOrder) {
      return Response.json({ success: false, error: 'Work order not found' }, { status: 404 });
    }

    // If already marked as received, return cached result
    if (workOrder.photos_received) {
      return Response.json({
        success: true,
        photos_received: true,
        cached: true,
        verified_at: workOrder.photos_verified_at,
        email_subject: workOrder.photos_email_subject
      });
    }

    // Check credentials
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      return Response.json({ 
        success: false, 
        error: 'Email not configured',
        photos_received: false
      }, { status: 500 });
    }

    // Search email
    const searchResult = await searchForPhotos(woNumber);

    if (searchResult.error && !searchResult.found) {
      return Response.json({
        success: true,
        photos_received: false,
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
      await supabase
        .from('work_orders')
        .update({ photos_verified_at: new Date().toISOString() })
        .eq('wo_id', workOrder.wo_id);

      return Response.json({
        success: true,
        photos_received: false,
        verified_at: new Date().toISOString(),
        message: 'No photo emails found for this work order'
      });
    }

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: Manual override
export async function POST(request, { params }) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
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
      photos_received: received !== false,
      photos_verified_at: new Date().toISOString()
    };

    if (override_reason) {
      const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
      const newComment = `[PHOTOS OVERRIDE] ${timestamp}\nManually marked as ${received ? 'received' : 'not received'}: ${override_reason}`;
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
      photos_received: received !== false,
      message: `Photos manually marked as ${received ? 'received' : 'not received'}`
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
