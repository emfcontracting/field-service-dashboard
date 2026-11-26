// app/api/contractor/estimates/[id]/route.js
// GET    → { estimate, items }
// PATCH  { action: 'edit', customer_id?|client?, title?, notes?, valid_until?, line_items? }  (not invoiced)
//        { action: 'send' }       mail the PDF to the customer → sent
//        { action: 'sent' }       mark sent (sent some other way)
//        { action: 'accepted' | 'declined' | 'reopen' }
//        { action: 'invoice' }    → draft invoice with the same lines { estimate, invoice }
// DELETE → removed (not when already invoiced)
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient, ownsUser, denyNotOwner } from '@/lib/serverAuth';
import {
  loadEstimate, estimateLines, estimateClient, estimateFields, replaceEstimateLines, mailEstimate, estimateToInvoice,
} from '@/lib/contractorEstimates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function guard(request, params) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return { res: auth.response };
  const { id } = await params;
  const data = await loadEstimate(serviceClient(), id);
  if (!data) return { res: NextResponse.json({ error: 'Estimate not found' }, { status: 404 }) };
  if (!ownsUser(auth, data.estimate.user_id)) return { res: denyNotOwner().response };
  return { auth, id, data };
}

export async function GET(request, { params }) {
  const { res, data } = await guard(request, params);
  if (res) return res;
  return NextResponse.json({ estimate: data.estimate, items: data.items });
}

export async function PATCH(request, { params }) {
  const { res, auth, id, data } = await guard(request, params);
  if (res) return res;
  if (!auth.principal.contractor) return NextResponse.json({ error: 'Only the subcontractor changes his estimate' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const sb = serviceClient();
  const est = data.estimate;
  const now = new Date().toISOString();
  let update = null;

  if (body.action === 'edit') {
    if (est.status === 'invoiced') return NextResponse.json({ error: 'Already invoiced' }, { status: 409 });
    update = { ...estimateFields(body), updated_at: now };
    if (body.customer_id !== undefined || body.client) {
      const c = await estimateClient(sb, est.user_id, body);
      if (c.error) return NextResponse.json({ error: c.error }, { status: 400 });
      Object.assign(update, c.row);
    }
    if (body.line_items) {
      const lines = estimateLines(body.line_items);
      if (!lines.length) return NextResponse.json({ error: 'Add at least one line' }, { status: 400 });
      const r = await replaceEstimateLines(sb, id, lines);
      if (r.error) return NextResponse.json({ error: r.error }, { status: 500 });
      update.total = r.total;
    }
  } else if (body.action === 'send') {
    if (est.status === 'invoiced') return NextResponse.json({ error: 'Already invoiced' }, { status: 409 });
    let mailed;
    try { mailed = await mailEstimate(data); } catch (e) { return NextResponse.json({ error: `E-mail not sent: ${e.message}` }, { status: 502 }); }
    update = { status: est.status === 'accepted' ? 'accepted' : 'sent', sent_at: now, sent_to_email: mailed.to, updated_at: now };
  } else if (body.action === 'sent') {
    update = { status: 'sent', sent_at: now, updated_at: now };
  } else if (body.action === 'accepted' || body.action === 'declined') {
    if (est.status === 'invoiced') return NextResponse.json({ error: 'Already invoiced' }, { status: 409 });
    update = { status: body.action, decided_at: now, updated_at: now };
  } else if (body.action === 'reopen') {
    if (est.status === 'invoiced') return NextResponse.json({ error: 'Already invoiced — delete the invoice first' }, { status: 409 });
    update = { status: est.sent_at ? 'sent' : 'draft', decided_at: null, updated_at: now };
  } else if (body.action === 'invoice') {
    const r = await estimateToInvoice(sb, auth.principal.user, data);
    if (r.error) return NextResponse.json({ error: r.error }, { status: r.status || 500 });
    const fresh = await loadEstimate(sb, id);
    return NextResponse.json({ estimate: fresh.estimate, items: fresh.items, invoice: r.invoice });
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const { error } = await sb.from('contractor_estimates').update(update).eq('estimate_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const fresh = await loadEstimate(sb, id);
  return NextResponse.json({ estimate: fresh.estimate, items: fresh.items });
}

export async function DELETE(request, { params }) {
  const { res, id, data } = await guard(request, params);
  if (res) return res;
  if (data.estimate.invoice_id) return NextResponse.json({ error: 'Already invoiced — delete the invoice first' }, { status: 409 });
  const { error } = await serviceClient().from('contractor_estimates').delete().eq('estimate_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
