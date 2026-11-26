// PATCH  /api/contractor/time/[id] { description?, minutes?, rate?, customer_id? } → { entry }
// DELETE /api/contractor/time/[id]  → { ok }
// Only entries not yet on an invoice.
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient, ownsUser, denyNotOwner } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';
const clip = (v, n) => { const t = String(v ?? '').trim(); return t ? t.slice(0, n) : null; };
const SELECT = '*, customer:contractor_customers(name, hourly_rate)';

async function load(auth, id) {
  const { data } = await serviceClient().from('contractor_time_entries').select('*').eq('entry_id', id).maybeSingle();
  if (!data) return { res: NextResponse.json({ error: 'Entry not found' }, { status: 404 }) };
  if (!ownsUser(auth, data.user_id)) return { res: denyNotOwner().response };
  if (data.invoice_id) return { res: NextResponse.json({ error: 'This time is already on an invoice' }, { status: 409 }) };
  return { entry: data };
}

export async function PATCH(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { entry, res } = await load(auth, id);
  if (res) return res;
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const sb = serviceClient();
  const update = { updated_at: new Date().toISOString() };
  if (body.description !== undefined) update.description = clip(body.description, 300);
  if (body.minutes !== undefined) {
    if (!entry.ended_at) return NextResponse.json({ error: 'Stop the timer first' }, { status: 409 });
    const m = Math.round(parseFloat(body.minutes));
    if (!(m > 0 && m <= 1440)) return NextResponse.json({ error: 'Time must be between 1 minute and 24 hours' }, { status: 400 });
    update.minutes = m;
    update.ended_at = new Date(new Date(entry.started_at).getTime() + m * 60000).toISOString();
  }
  if (body.rate !== undefined) {
    const r = body.rate === '' || body.rate == null ? null : parseFloat(body.rate);
    if (r != null && !(r >= 0 && r <= 1000)) return NextResponse.json({ error: 'Rate must be between 0 and 1000' }, { status: 400 });
    update.rate = r;
  }
  if (body.customer_id !== undefined) {
    const { data: c } = await sb.from('contractor_customers').select('customer_id, user_id').eq('customer_id', body.customer_id).maybeSingle();
    if (!c || c.user_id !== entry.user_id) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    update.customer_id = c.customer_id;
  }
  const { data, error } = await sb.from('contractor_time_entries').update(update).eq('entry_id', id).select(SELECT).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entry: data });
}

export async function DELETE(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { res } = await load(auth, id);
  if (res) return res;
  const { error } = await serviceClient().from('contractor_time_entries').delete().eq('entry_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
