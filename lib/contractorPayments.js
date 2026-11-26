// lib/contractorPayments.js  (server only)
// -----------------------------------------------------------------------------
// Payments the subcontractor received on one of his invoices — part payments
// too (contractor_invoice_payments). amount_paid on the invoice is the sum;
// once it reaches the total the invoice is 'paid' (paid_at = last payment day),
// below it a paid invoice goes back to 'sent'. "Mark as paid" writes one
// automatic payment for the remainder; "Undo paid" removes the automatic ones.
// This is the sub's own record — EMF's payment stays in emf_paid_at.
// -----------------------------------------------------------------------------
const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const METHODS = ['check', 'zelle', 'ach', 'cash', 'card', 'other'];
const clip = (v, n) => { const t = String(v ?? '').trim(); return t ? t.slice(0, n) : null; };
const etDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);

export async function paymentsFor(supabase, invoiceIds) {
  if (!invoiceIds.length) return {};
  const { data, error } = await supabase.from('contractor_invoice_payments')
    .select('payment_id, invoice_id, amount, paid_on, method, reference, note, auto, created_at')
    .in('invoice_id', invoiceIds).order('paid_on', { ascending: true });
  if (error) return {};                     // table not there yet → no payments shown
  const by = {};
  for (const p of data || []) (by[p.invoice_id] ||= []).push(p);
  return by;
}

/** Re-sum the payments and set amount_paid / status / paid_at. → updated invoice */
async function settle(supabase, invoice) {
  const { data: pays, error } = await supabase.from('contractor_invoice_payments')
    .select('amount, paid_on').eq('invoice_id', invoice.invoice_id).order('paid_on', { ascending: true });
  if (error) throw new Error(error.message);
  const paid = round2((pays || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const total = round2(invoice.grand_total);
  const update = { amount_paid: paid, updated_at: new Date().toISOString() };
  if (total > 0 && paid >= total) {
    update.status = 'paid';
    update.paid_at = new Date(`${pays[pays.length - 1].paid_on}T12:00:00-05:00`).toISOString();
  } else if (invoice.status === 'paid') {
    update.status = invoice.sent_at ? 'sent' : 'draft';
    update.paid_at = null;
  }
  const { data, error: upErr } = await supabase.from('subcontractor_invoices').update(update)
    .eq('invoice_id', invoice.invoice_id).select().single();
  if (upErr) throw new Error(upErr.message);
  return data;
}

/** body: { amount, paid_on, method?, reference?, note? } → { invoice } | { error, status } */
export async function addPayment(supabase, invoice, body) {
  const amount = round2(body.amount);
  const open = round2((Number(invoice.grand_total) || 0) - (Number(invoice.amount_paid) || 0));
  if (!(amount > 0)) return { error: 'Amount must be more than $0', status: 400 };
  if (amount > open + 0.005) return { error: `Only $${open.toFixed(2)} is still open on this invoice`, status: 400 };
  const paidOn = DAY.test(body.paid_on || '') ? body.paid_on : etDay();
  if (paidOn > etDay()) return { error: 'Payment date is in the future', status: 400 };
  const method = METHODS.includes(body.method) ? body.method : null;
  const { error } = await supabase.from('contractor_invoice_payments').insert({
    invoice_id: invoice.invoice_id, user_id: invoice.user_id, amount, paid_on: paidOn, method,
    reference: clip(body.reference, 100), note: clip(body.note, 300), auto: false,
  });
  if (error) return { error: error.message, status: 500 };
  return { invoice: await settle(supabase, invoice) };
}

export async function deletePayment(supabase, invoice, paymentId) {
  const { error } = await supabase.from('contractor_invoice_payments').delete()
    .eq('payment_id', paymentId).eq('invoice_id', invoice.invoice_id);
  if (error) return { error: error.message, status: 500 };
  return { invoice: await settle(supabase, invoice) };
}

/** "Mark as paid": the remainder as one automatic payment (today). */
export async function markFullyPaid(supabase, invoice, paidOn) {
  const open = round2((Number(invoice.grand_total) || 0) - (Number(invoice.amount_paid) || 0));
  if (open > 0) {
    const { error } = await supabase.from('contractor_invoice_payments').insert({
      invoice_id: invoice.invoice_id, user_id: invoice.user_id, amount: open,
      paid_on: DAY.test(paidOn || '') ? paidOn : etDay(), auto: true,
    });
    if (error) return { error: error.message, status: 500 };
  }
  return { invoice: await settle(supabase, { ...invoice }) };
}

/** "Undo paid": drop the automatic remainder payment(s), keep real part payments. */
export async function undoPaid(supabase, invoice) {
  const { error } = await supabase.from('contractor_invoice_payments').delete()
    .eq('invoice_id', invoice.invoice_id).eq('auto', true);
  if (error) return { error: error.message, status: 500 };
  return { invoice: await settle(supabase, invoice) };
}
