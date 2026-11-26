// app/api/contractor/invoices/[id]/route.js
// -----------------------------------------------------------------------------
// GET    → { invoice, items }            (owner or staff)
// PATCH  { action: 'sent' | 'paid' }     (owner: own invoice; staff: any)
// DELETE → removes a draft/rejected invoice and its lines
//          (contractor: only draft or rejected; staff: any)
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient, ownsUser, denyNotOwner } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';
const EMF_EMAIL = 'emfcontractingsc2@gmail.com';

async function load(id) {
  const { data } = await serviceClient().from('subcontractor_invoices').select('*').eq('invoice_id', id).maybeSingle();
  return data;
}

export async function GET(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const invoice = await load(id);
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (!ownsUser(auth, invoice.user_id)) return denyNotOwner().response;

  const { data: items, error } = await serviceClient()
    .from('subcontractor_invoice_items')
    .select('*, work_order:work_orders(wo_number, building)')
    .eq('invoice_id', id)
    .order('work_date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice, items: items || [] });
}

export async function PATCH(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const invoice = await load(id);
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (!ownsUser(auth, invoice.user_id)) return denyNotOwner().response;

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const now = new Date().toISOString();
  let update;
  if (body.action === 'sent') update = { status: 'sent', sent_to_email: EMF_EMAIL, sent_at: now };
  else if (body.action === 'paid') update = { status: 'paid', paid_at: now };
  else return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  update.updated_at = now;

  const { data, error } = await serviceClient().from('subcontractor_invoices').update(update).eq('invoice_id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data });
}

export async function DELETE(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const invoice = await load(id);
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (!ownsUser(auth, invoice.user_id)) return denyNotOwner().response;
  if (auth.principal.contractor && !['draft', 'rejected'].includes(invoice.status)) {
    return NextResponse.json({ error: `A ${invoice.status} invoice can't be deleted. Contact EMF.` }, { status: 409 });
  }

  const supabase = serviceClient();
  const { error: itemsError } = await supabase.from('subcontractor_invoice_items').delete().eq('invoice_id', id);
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
  const { error } = await supabase.from('subcontractor_invoices').delete().eq('invoice_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
