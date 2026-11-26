// app/api/admin/subcontractor-invoices/[id]/route.js
// -----------------------------------------------------------------------------
// EMF's side of a subcontractor invoice. Never touches `status`, which is the
// subcontractor's own bookkeeping (draft / sent / paid).
//
// GET   → { overlaps }  entries of this invoice that are on another invoice too
// PATCH { action, note? }
//         accept      → emf_review_status='accepted'
//         reject      → emf_review_status='rejected', note required
//         clear       → review removed
//         emf_paid    → emf_paid_at = now
//         emf_unpaid  → emf_paid_at removed
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { requireStaff, serviceClient } from '@/lib/serverAuth';
import { findAlreadyInvoiced } from '@/lib/subInvoiceOverlap';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const supabase = serviceClient();
  const { data: invoice } = await supabase.from('subcontractor_invoices').select('invoice_id, user_id').eq('invoice_id', id).maybeSingle();
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  const { data: items, error } = await supabase
    .from('subcontractor_invoice_items')
    .select('wo_id, work_date, item_type')
    .eq('invoice_id', id)
    .in('item_type', ['hours', 'mileage', 'material']);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  try {
    const overlaps = await findAlreadyInvoiced(supabase, invoice.user_id, items || [], id);
    return NextResponse.json({ overlaps });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const me = auth.principal.user.user_id;
  const now = new Date().toISOString();
  const note = String(body.note || '').trim().slice(0, 1000);
  let update;
  switch (body.action) {
    case 'accept':
      update = { emf_review_status: 'accepted', emf_review_note: note || null, emf_reviewed_at: now, emf_reviewed_by: me };
      break;
    case 'reject':
      if (!note) return NextResponse.json({ error: 'A reason is required to reject' }, { status: 400 });
      update = { emf_review_status: 'rejected', emf_review_note: note, emf_reviewed_at: now, emf_reviewed_by: me };
      break;
    case 'clear':
      update = { emf_review_status: null, emf_review_note: null, emf_reviewed_at: null, emf_reviewed_by: null };
      break;
    case 'emf_paid':
      update = { emf_paid_at: now, emf_paid_by: me };
      break;
    case 'emf_unpaid':
      update = { emf_paid_at: null, emf_paid_by: null };
      break;
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  update.updated_at = now;

  const { data, error } = await serviceClient().from('subcontractor_invoices').update(update).eq('invoice_id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}
