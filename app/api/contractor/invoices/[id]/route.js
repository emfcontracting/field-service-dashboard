// app/api/contractor/invoices/[id]/route.js
// -----------------------------------------------------------------------------
// GET    → { invoice, items }            (owner or staff)
// PATCH  { action: 'submit' | 'sent' | 'paid' | 'unpaid' }   (owner; staff: any)
//        { action: 'edit', line_items, refresh_hours?, client? }  draft only, owner only
//        { action: 'correct' }  EMF rejected it → new draft copy { invoice } (owner)
//        { action: 'payment', amount, paid_on, method?, reference?, note? }  part/full payment received
//        { action: 'delete_payment', payment_id }
//        { action: 'remind' }  other client, sent, open amount: payment reminder mail + PDF
//          paid = remainder as one payment · unpaid = drop that automatic payment
// GET    also returns suggestions: the sub's own lines from recent invoices
//          submit = mail the PDF to the addressee (EMF or other client), then sent
//          sent   = mark sent without mailing (sent some other way)
// DELETE → removes an invoice and its lines
//          (contractor: only draft, or one EMF rejected; staff: any)
// status (draft/sent/paid) is the subcontractor's own; EMF's review and
// payment live in emf_* columns (PATCH /api/admin/subcontractor-invoices/[id]).
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient, ownsUser, denyNotOwner } from '@/lib/serverAuth';
import { loadSubInvoiceForPdf } from '@/lib/subInvoicePdf';
import { mailSubInvoice } from '@/lib/subInvoiceMail';
import { invoiceRecipient } from '@/lib/invoiceRecipient';
import { updateDraftInvoice, recentCustomLines, copyAsCorrection } from '@/lib/subInvoiceCreate';
import { paymentsFor, addPayment, deletePayment, markFullyPaid, undoPaid } from '@/lib/contractorPayments';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  const suggestions = invoice.status === 'draft' ? await recentCustomLines(serviceClient(), invoice.user_id).catch(() => []) : [];
  const payments = (await paymentsFor(serviceClient(), [id]))[id] || [];
  return NextResponse.json({ invoice: { ...invoice, payments }, items: items || [], suggestions });
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
  if (body.action === 'edit') {
    if (!auth.principal.contractor) return NextResponse.json({ error: 'Only the subcontractor edits his draft' }, { status: 403 });
    const result = await updateDraftInvoice(serviceClient(), invoice, auth.principal.contractor, body);
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    return NextResponse.json({ invoice: result.invoice });
  }

  if (body.action === 'correct') {
    if (!auth.principal.contractor) return NextResponse.json({ error: 'Only the subcontractor corrects his invoice' }, { status: 403 });
    const result = await copyAsCorrection(serviceClient(), auth.principal.user, invoice);
    if (result.error) return NextResponse.json({ error: result.error, invoice: result.invoice || null }, { status: result.status || 500 });
    return NextResponse.json({ invoice: result.invoice });
  }

  if (body.action === 'remind') {
    if (!auth.principal.contractor) return NextResponse.json({ error: 'Only the subcontractor sends reminders' }, { status: 403 });
    if (invoice.client_type !== 'other' || invoice.status !== 'sent') return NextResponse.json({ error: 'Reminders are for sent invoices to your own customers' }, { status: 409 });
    if (!invoice.client_email) return NextResponse.json({ error: 'This customer has no e-mail' }, { status: 400 });
    if (invoice.last_reminder_at && Date.now() - new Date(invoice.last_reminder_at).getTime() < 2 * 86400000) {
      return NextResponse.json({ error: 'A reminder went out less than 2 days ago' }, { status: 429 });
    }
    let mailed;
    try { mailed = await mailSubInvoice(await loadSubInvoiceForPdf(serviceClient(), id), { reminder: true }); }
    catch (e) { return NextResponse.json({ error: `E-mail not sent: ${e.message}` }, { status: 502 }); }
    const { data, error } = await serviceClient().from('subcontractor_invoices').update({
      last_reminder_at: new Date().toISOString(), reminder_count: (invoice.reminder_count || 0) + 1, updated_at: new Date().toISOString(),
    }).eq('invoice_id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const payments = (await paymentsFor(serviceClient(), [id]))[id] || [];
    return NextResponse.json({ invoice: { ...data, payments }, mailed });
  }

  // Payments (the sub's own record; works on sent and paid invoices)
  if (['payment', 'delete_payment', 'paid', 'unpaid'].includes(body.action)) {
    const sb = serviceClient();
    let result;
    try {
      if (body.action === 'payment') {
        if (invoice.status === 'draft') return NextResponse.json({ error: 'Send the invoice first' }, { status: 409 });
        result = await addPayment(sb, invoice, body);
      } else if (body.action === 'delete_payment') result = await deletePayment(sb, invoice, body.payment_id);
      else if (body.action === 'paid') result = await markFullyPaid(sb, invoice, body.paid_on);
      else result = await undoPaid(sb, invoice);
    } catch (e) { result = { error: e.message, status: 500 }; }
    if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 });
    const payments = (await paymentsFor(sb, [id]))[id] || [];
    return NextResponse.json({ invoice: { ...result.invoice, payments } });
  }

  const now = new Date().toISOString();
  let update;
  let mailed = null;
  if (body.action === 'submit') {
    try {
      const data = await loadSubInvoiceForPdf(serviceClient(), id);
      mailed = await mailSubInvoice(data);
    } catch (e) {
      console.error('submit mail failed:', e);
      return NextResponse.json({ error: `E-mail not sent: ${e.message}` }, { status: 502 });
    }
    update = { status: invoice.status === 'paid' ? 'paid' : 'sent', sent_to_email: mailed.to, sent_at: now };
  } else if (body.action === 'sent') {
    update = { status: 'sent', sent_to_email: invoiceRecipient(invoice).email || null, sent_at: now };
  } else {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }
  update.updated_at = now;

  const { data, error } = await serviceClient().from('subcontractor_invoices').update(update).eq('invoice_id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invoice: data, mailed });
}

export async function DELETE(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const invoice = await load(id);
  if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (!ownsUser(auth, invoice.user_id)) return denyNotOwner().response;
  if (auth.principal.contractor && invoice.status !== 'draft' && invoice.emf_review_status !== 'rejected') {
    return NextResponse.json({ error: `A ${invoice.status} invoice can't be deleted. Contact EMF.` }, { status: 409 });
  }

  const supabase = serviceClient();
  // An estimate turned into this invoice becomes "accepted" again; timer
  // entries are released by the FK (ON DELETE SET NULL).
  await supabase.from('contractor_estimates').update({ status: 'accepted', invoice_id: null, updated_at: new Date().toISOString() })
    .eq('invoice_id', id).then(() => {}, () => {});
  const { error: itemsError } = await supabase.from('subcontractor_invoice_items').delete().eq('invoice_id', id);
  if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
  const { error } = await supabase.from('subcontractor_invoices').delete().eq('invoice_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
