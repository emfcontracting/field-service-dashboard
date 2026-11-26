// lib/subInvoiceCreate.js  (server only)
// -----------------------------------------------------------------------------
// Creating subcontractor invoices — shared by POST /api/contractor/invoices
// and the Friday draft job (/api/cron/sub-invoice-drafts).
//   createEmfInvoice:         hours / OT / mileage / tech material from
//                             daily_hours_log for the period, rates from the
//                             stored profile, totals computed here.
//   createOtherClientInvoice: the sub's own lines and prices, addressee stored.
// Both return { invoice } or { error, status }. If the lines cannot be written
// the invoice row is removed again.
// -----------------------------------------------------------------------------
import { profileRates } from './contractorProfile';

const EMF_EMAIL = 'emfcontractingsc2@gmail.com';
const num = (v) => parseFloat(v || 0) || 0;
const round2 = (v) => Math.round(v * 100) / 100;
const clip = (v, n) => { const t = String(v ?? '').trim(); return t ? t.slice(0, n) : null; };

function customLines(body) {
  return (Array.isArray(body.line_items) ? body.line_items : [])
    .map((li) => {
      const quantity = num(li.quantity) || 1;
      const rate = num(li.rate);
      return { description: String(li.description || '').trim().slice(0, 300), quantity, rate, amount: round2(quantity * rate) };
    })
    .filter((li) => li.description && li.amount > 0);
}

async function nextNumberInsert(supabase, user, row) {
  const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase();
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: invoiceNumber, error: numError } = await supabase.rpc('next_subcontractor_invoice_number', { p_user_id: user.user_id, p_initials: initials });
    if (numError) return { error: numError };
    const { data, error } = await supabase.from('subcontractor_invoices').insert({ ...row, invoice_number: invoiceNumber }).select().single();
    if (!error) return { invoice: data };
    if (error.code !== '23505') return { error };
  }
  return { error: { message: 'Could not assign an invoice number, try again' } };
}

// An invoice to someone other than EMF: the sub's own lines and prices, no
// hours pulled from EMF's log, addressee stored on the invoice.
export async function createOtherClientInvoice(supabase, user, body, periodStart, periodEnd) {
  const c = body.client || {};
  const client = {
    client_name: clip(c.name, 200),
    client_address: clip(c.address, 300),
    client_city: clip(c.city, 100),
    client_state: clip(c.state, 20),
    client_zip: clip(c.zip, 20),
    client_email: clip(c.email, 200),
  };
  if (!client.client_name) return { error: 'Client name required', status: 400 };
  if (client.client_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(client.client_email)) {
    return { error: 'Client e-mail looks invalid', status: 400 };
  }
  const lines = customLines(body);
  if (!lines.length) return { error: 'Add at least one line item', status: 400 };
  const total = round2(lines.reduce((s, li) => s + li.amount, 0));

  const { invoice, error } = await nextNumberInsert(supabase, user, {
    user_id: user.user_id,
    client_type: 'other',
    ...client,
    period_start: periodStart,
    period_end: periodEnd,
    total_regular_hours: 0, total_ot_hours: 0, total_hours_amount: 0,
    total_miles: 0, total_mileage_amount: 0, total_tech_material: 0,
    total_line_items_amount: total,
    grand_total: total,
    status: 'draft',
    sent_to_email: client.client_email,
  });
  if (error) return { error: error.message, status: 500 };

  const { error: itemsError } = await supabase
    .from('subcontractor_invoice_items')
    .insert(lines.map((li) => ({ ...li, item_type: 'custom', invoice_id: invoice.invoice_id })));
  if (itemsError) {
    await supabase.from('subcontractor_invoices').delete().eq('invoice_id', invoice.invoice_id);
    return { error: `Line items failed, invoice not created: ${itemsError.message}`, status: 500 };
  }
  return { invoice };
}


export async function createEmfInvoice(supabase, user, profile, body, periodStart, periodEnd) {
  const rates = profileRates(profile);

  const { data: hours, error: hoursError } = await supabase
    .from('daily_hours_log')
    .select('*, work_order:work_orders(wo_number, building)')
    .eq('user_id', user.user_id)
    .gte('work_date', periodStart)
    .lte('work_date', periodEnd)
    .order('work_date', { ascending: true });
  if (hoursError) return { error: hoursError.message, status: 500 };

  const custom = customLines(body);

  if (!(hours || []).length && !custom.length) {
    return { error: 'No hours or line items for this period', status: 400 };
  }

  // ── line items + totals ──
  const items = [];
  let regH = 0, otH = 0, miles = 0, material = 0;
  for (const e of hours || []) {
    const woNum = e.work_order?.wo_number || 'N/A';
    const building = e.work_order?.building || '';
    const r = num(e.hours_regular), o = num(e.hours_overtime), m = num(e.miles), mat = num(e.tech_material_cost);
    regH += r; otH += o; miles += m; material += mat;
    if (r > 0) items.push({ wo_id: e.wo_id, item_type: 'hours', description: `Regular Hours - ${woNum} - ${building}`, quantity: r, rate: rates.hourly, amount: round2(r * rates.hourly), work_date: e.work_date });
    if (o > 0) items.push({ wo_id: e.wo_id, item_type: 'hours', description: `OT Hours - ${woNum} - ${building}`, quantity: o, rate: rates.ot, amount: round2(o * rates.ot), work_date: e.work_date });
    if (m > 0) items.push({ wo_id: e.wo_id, item_type: 'mileage', description: `Mileage - ${woNum}`, quantity: m, rate: rates.mileage, amount: round2(m * rates.mileage), work_date: e.work_date });
    if (mat > 0) items.push({ wo_id: e.wo_id, item_type: 'material', description: `Material Reimbursement - ${woNum} - ${building}`, quantity: 1, rate: mat, amount: round2(mat), work_date: e.work_date });
  }
  for (const li of custom) items.push({ item_type: 'custom', ...li });

  const hoursAmount = round2(regH * rates.hourly + otH * rates.ot);
  const mileageAmount = round2(miles * rates.mileage);
  const lineItemsAmount = round2(custom.reduce((s, li) => s + li.amount, 0));
  const grandTotal = round2(hoursAmount + mileageAmount + material + lineItemsAmount);
  // ── invoice row (number from DB function; retry on unique race) ──
  const { invoice, error: insertError } = await nextNumberInsert(supabase, user, {
    user_id: user.user_id,
    client_type: 'emf',
    period_start: periodStart,
    period_end: periodEnd,
    total_regular_hours: regH,
    total_ot_hours: otH,
    total_hours_amount: hoursAmount,
    total_miles: miles,
    total_mileage_amount: mileageAmount,
    total_tech_material: round2(material),
    total_line_items_amount: lineItemsAmount,
    grand_total: grandTotal,
    hourly_rate_used: rates.hourly,
    ot_rate_used: rates.ot,
    mileage_rate_used: rates.mileage,
    status: 'draft',
    sent_to_email: EMF_EMAIL,
  });
  if (insertError) return { error: insertError.message, status: 500 };

  if (items.length) {
    const { error: itemsError } = await supabase
      .from('subcontractor_invoice_items')
      .insert(items.map((it) => ({ ...it, invoice_id: invoice.invoice_id })));
    if (itemsError) {
      await supabase.from('subcontractor_invoices').delete().eq('invoice_id', invoice.invoice_id);
      return { error: `Line items failed, invoice not created: ${itemsError.message}`, status: 500 };
    }
  }
  return { invoice };
}
