// PATCH  /api/contractor/customers/[id]  { any customer field, archived? } → { customer }
// DELETE /api/contractor/customers/[id]  → removed; archived instead when
//        invoices, estimates or time entries point to it  → { ok, archived? }
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient, ownsUser, denyNotOwner } from '@/lib/serverAuth';
import { cleanCustomer } from '@/lib/contractorCustomers';

export const dynamic = 'force-dynamic';

async function load(auth, id) {
  const { data } = await serviceClient().from('contractor_customers').select('*').eq('customer_id', id).maybeSingle();
  if (!data) return { res: NextResponse.json({ error: 'Customer not found' }, { status: 404 }) };
  if (!ownsUser(auth, data.user_id)) return { res: denyNotOwner().response };
  return { customer: data };
}

export async function PATCH(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { customer, res } = await load(auth, id);
  if (res) return res;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const { row, error } = cleanCustomer(body, true);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const { data, error: upErr } = await serviceClient().from('contractor_customers')
    .update({ ...row, updated_at: new Date().toISOString() }).eq('customer_id', customer.customer_id).select().single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ customer: data });
}

export async function DELETE(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { customer, res } = await load(auth, id);
  if (res) return res;
  const sb = serviceClient();
  const counts = await Promise.all([
    sb.from('subcontractor_invoices').select('invoice_id', { count: 'exact', head: true }).eq('customer_id', id),
    sb.from('contractor_estimates').select('estimate_id', { count: 'exact', head: true }).eq('customer_id', id),
    sb.from('contractor_time_entries').select('entry_id', { count: 'exact', head: true }).eq('customer_id', id),
  ]);
  if (counts.some((c) => (c.count || 0) > 0)) {
    const { error } = await sb.from('contractor_customers').update({ archived: true, updated_at: new Date().toISOString() }).eq('customer_id', customer.customer_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, archived: true });
  }
  const { error } = await sb.from('contractor_customers').delete().eq('customer_id', customer.customer_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
