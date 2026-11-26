// lib/subInvoiceCreate.js  (server only)
// -----------------------------------------------------------------------------
// Creating subcontractor invoices — shared by POST /api/contractor/invoices
// and the Friday draft job (/api/cron/sub-invoice-drafts).
//   createEmfInvoice:         hours / OT / mileage / tech material from
//                             daily_hours_log for the period, rates from the
//                             stored profile, totals computed here.
//   createOtherClientInvoice: the sub's own lines and prices, addressee stored.
// Both return { invoice } or { error, status }. body.use_recurring adds the
// sub's recurring lines (subcontractor_profiles.recurring_lines). If the lines cannot be written
// the invoice row is removed again.
// -----------------------------------------------------------------------------
import { profileRates, recurringLinesOf } from './contractorProfile';

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

  // Saved customer: picked from the list, or "save as customer" for a new one
  let customerId = null;
  if (body.customer_id) {
    const { data: c } = await supabase.from('contractor_customers').select('customer_id, user_id').eq('customer_id', body.customer_id).maybeSingle();
    if (!c || c.user_id !== user.user_id) return { error: 'Customer not found', status: 404 };
    customerId = c.customer_id;
  } else if (body.save_customer) {
    const { data: dup } = await supabase.from('contractor_customers').select('customer_id')
      .eq('user_id', user.user_id).ilike('name', client.client_name.replace(/[%_\\]/g, (m) => '\\' + m)).limit(1);
    if (dup?.length) customerId = dup[0].customer_id;
    else {
      const { data: nc } = await supabase.from('contractor_customers').insert({
        user_id: user.user_id, name: client.client_name, address: client.client_address, city: client.client_city,
        state: client.client_state, zip: client.client_zip, email: client.client_email,
      }).select('customer_id').single();
      customerId = nc?.customer_id || null;
    }
  }

  const { invoice, error } = await nextNumberInsert(supabase, user, {
    user_id: user.user_id,
    client_type: 'other',
    ...client,
    customer_id: customerId,
    ...(body.estimate_id ? { estimate_id: body.estimate_id } : {}),
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
  // Timer entries put on this invoice (lines were built from them in the
  // browser and may have been edited): mark them billed.
  const entryIds = (Array.isArray(body.time_entry_ids) ? body.time_entry_ids : []).filter((x) => typeof x === 'string').slice(0, 500);
  if (entryIds.length) {
    await supabase.from('contractor_time_entries').update({ invoice_id: invoice.invoice_id, updated_at: new Date().toISOString() })
      .in('entry_id', entryIds).eq('user_id', user.user_id).is('invoice_id', null).not('ended_at', 'is', null);
  }
  return { invoice };
}


// EMF lines from the hours log for a period, with the stored rates.
// → { items, totals } or { error, status }
async function buildEmfLines(supabase, userId, profile, periodStart, periodEnd) {
  const rates = profileRates(profile);
  const { data: hours, error: hoursError } = await supabase
    .from('daily_hours_log')
    .select('*, work_order:work_orders(wo_number, building)')
    .eq('user_id', userId)
    .gte('work_date', periodStart)
    .lte('work_date', periodEnd)
    .order('work_date', { ascending: true });
  if (hoursError) return { error: hoursError.message, status: 500 };

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
  return {
    items,
    totals: {
      total_regular_hours: regH,
      total_ot_hours: otH,
      total_hours_amount: round2(regH * rates.hourly + otH * rates.ot),
      total_miles: miles,
      total_mileage_amount: round2(miles * rates.mileage),
      total_tech_material: round2(material),
      hourly_rate_used: rates.hourly,
      ot_rate_used: rates.ot,
      mileage_rate_used: rates.mileage,
    },
  };
}

// Expenses the sub marked "bill to EMF" (contractor_tax_records.bill_to_emf)
// that are not on an invoice yet, up to the end of the period. Each becomes a
// custom line carrying a marker [R-xxxxxxxx] (first 8 chars of record_id), so
// a draft edit that removes the line frees the expense again.
const reimbMarker = (recordId) => `[R-${String(recordId).slice(0, 8)}]`;

async function unbilledReimbursements(supabase, userId, upTo) {
  const { data, error } = await supabase
    .from('contractor_tax_records')
    .select('record_id, entry_date, category_name, vendor, amount, notes')
    .eq('user_id', userId)
    .eq('bill_to_emf', true)
    .is('billed_invoice_id', null)
    .lte('entry_date', upTo)
    .order('entry_date', { ascending: true });
  if (error) throw error;
  return (data || []).filter((r) => num(r.amount) > 0).map((r) => ({
    record_id: r.record_id,
    line: {
      description: `Reimbursement: ${r.category_name}${r.vendor ? ' – ' + r.vendor : ''} (${r.entry_date}) ${reimbMarker(r.record_id)}`.slice(0, 300),
      quantity: 1,
      rate: round2(num(r.amount)),
      amount: round2(num(r.amount)),
    },
  }));
}

// After a draft edit: expenses linked to this invoice whose marker is no
// longer on any line are freed for the next invoice.
async function releaseRemovedReimbursements(supabase, invoiceId, lines) {
  const { data } = await supabase.from('contractor_tax_records').select('record_id').eq('billed_invoice_id', invoiceId);
  const text = lines.map((l) => l.description).join('\n');
  const freed = (data || []).filter((r) => !text.includes(reimbMarker(r.record_id))).map((r) => r.record_id);
  if (freed.length) await supabase.from('contractor_tax_records').update({ billed_invoice_id: null }).in('record_id', freed);
  return freed.length;
}

const emfGrand = (t, linesAmount) =>
  round2((t.total_hours_amount || 0) + (t.total_mileage_amount || 0) + (t.total_tech_material || 0) + linesAmount);

export async function createEmfInvoice(supabase, user, profile, body, periodStart, periodEnd) {
  const built = await buildEmfLines(supabase, user.user_id, profile, periodStart, periodEnd);
  if (built.error) return built;
  // use_recurring: put the sub's recurring lines (e.g. admin hours) on top —
  // one-click invoice and the Friday draft. New Invoice pre-fills them itself.
  const custom = customLines(body.use_recurring
    ? { line_items: [...recurringLinesOf(profile), ...(Array.isArray(body.line_items) ? body.line_items : [])] }
    : body);
  // Expenses to pass on to EMF (receipts marked "bill to EMF")
  let reimb = [];
  try { reimb = await unbilledReimbursements(supabase, user.user_id, periodEnd); }
  catch (e) { return { error: e.message, status: 500 }; }
  custom.push(...reimb.map((r) => r.line));
  if (!built.items.length && !custom.length) {
    return { error: 'No hours or line items for this period', status: 400 };
  }
  const items = [...built.items, ...custom.map((li) => ({ item_type: 'custom', ...li }))];
  const lineItemsAmount = round2(custom.reduce((s, li) => s + li.amount, 0));

  // ── invoice row (number from DB function; retry on unique race) ──
  const { invoice, error: insertError } = await nextNumberInsert(supabase, user, {
    user_id: user.user_id,
    client_type: 'emf',
    period_start: periodStart,
    period_end: periodEnd,
    ...built.totals,
    total_line_items_amount: lineItemsAmount,
    grand_total: emfGrand(built.totals, lineItemsAmount),
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
  if (reimb.length) {
    await supabase.from('contractor_tax_records')
      .update({ billed_invoice_id: invoice.invoice_id })
      .in('record_id', reimb.map((r) => r.record_id))
      .is('billed_invoice_id', null);
  }
  return { invoice };
}

/**
 * Edit a DRAFT: replace the sub's own lines (custom) and, with refreshHours,
 * rebuild the EMF lines from the hours log and current rates. Totals are
 * recomputed here. Other-client drafts: lines (+ optional client fields).
 * → { invoice } or { error, status }
 */
export async function updateDraftInvoice(supabase, invoice, profile, body) {
  if (invoice.status !== 'draft') return { error: 'Only drafts can be edited', status: 409 };
  const id = invoice.invoice_id;
  const custom = customLines(body);
  const lineItemsAmount = round2(custom.reduce((s, li) => s + li.amount, 0));
  const isOther = invoice.client_type === 'other';

  const { data: current, error: curErr } = await supabase
    .from('subcontractor_invoice_items').select('*').eq('invoice_id', id);
  if (curErr) return { error: curErr.message, status: 500 };

  let emfItems = (current || []).filter((it) => it.item_type !== 'custom');
  let totals = {
    total_regular_hours: invoice.total_regular_hours, total_ot_hours: invoice.total_ot_hours,
    total_hours_amount: num(invoice.total_hours_amount), total_miles: invoice.total_miles,
    total_mileage_amount: num(invoice.total_mileage_amount), total_tech_material: num(invoice.total_tech_material),
  };
  if (!isOther && body.refresh_hours) {
    const built = await buildEmfLines(supabase, invoice.user_id, profile, invoice.period_start, invoice.period_end);
    if (built.error) return built;
    emfItems = built.items;
    totals = built.totals;
  }
  if (!emfItems.length && !custom.length) return { error: 'The invoice would be empty — delete it instead', status: 400 };

  const update = {
    ...(isOther ? {} : totals),
    total_line_items_amount: lineItemsAmount,
    grand_total: isOther ? lineItemsAmount : emfGrand(totals, lineItemsAmount),
    updated_at: new Date().toISOString(),
  };
  if (isOther && body.client) {
    const c = body.client;
    if (c.name !== undefined) {
      const n = clip(c.name, 200);
      if (!n) return { error: 'Client name required', status: 400 };
      update.client_name = n;
    }
    if (c.address !== undefined) update.client_address = clip(c.address, 300);
    if (c.city !== undefined) update.client_city = clip(c.city, 100);
    if (c.state !== undefined) update.client_state = clip(c.state, 20);
    if (c.zip !== undefined) update.client_zip = clip(c.zip, 20);
    if (c.email !== undefined) update.client_email = clip(c.email, 200);
    if (update.client_email !== undefined) update.sent_to_email = update.client_email;
  }

  // Replace lines: write the new set first, then remove the old rows, so a
  // failure never leaves the draft without lines.
  const newRows = [
    ...(body.refresh_hours && !isOther ? emfItems.map((it) => ({ ...it, invoice_id: id })) : []),
    ...custom.map((li) => ({ ...li, item_type: 'custom', invoice_id: id })),
  ];
  const oldIds = (current || [])
    .filter((it) => it.item_type === 'custom' || (body.refresh_hours && !isOther))
    .map((it) => it.item_id);
  if (newRows.length) {
    const { error: insErr } = await supabase.from('subcontractor_invoice_items').insert(newRows);
    if (insErr) return { error: insErr.message, status: 500 };
  }
  if (oldIds.length) {
    const { error: delErr } = await supabase.from('subcontractor_invoice_items').delete().in('item_id', oldIds);
    if (delErr) return { error: delErr.message, status: 500 };
  }

  const { data, error } = await supabase.from('subcontractor_invoices').update(update).eq('invoice_id', id).select().single();
  if (error) return { error: error.message, status: 500 };
  if (!isOther) await releaseRemovedReimbursements(supabase, id, custom).catch(() => 0);
  return { invoice: data };
}

/** Lines the sub added himself on recent invoices — for quick-add buttons. */
export async function recentCustomLines(supabase, userId, limit = 8) {
  const { data: invs } = await supabase
    .from('subcontractor_invoices').select('invoice_id').eq('user_id', userId)
    .order('created_at', { ascending: false }).limit(25);
  const ids = (invs || []).map((i) => i.invoice_id);
  if (!ids.length) return [];
  const { data: lines } = await supabase
    .from('subcontractor_invoice_items').select('invoice_id, description, quantity, rate')
    .in('invoice_id', ids).eq('item_type', 'custom');
  const order = Object.fromEntries(ids.map((id, i) => [id, i]));
  const seen = new Map();
  for (const l of (lines || []).sort((a, b) => order[a.invoice_id] - order[b.invoice_id])) {
    const k = String(l.description || '').trim().toLowerCase();
    if (!k || seen.has(k) || /\[r-[0-9a-f]{8}\]/.test(k)) continue; // skip passed-on expenses
    seen.set(k, { description: String(l.description).trim(), quantity: num(l.quantity) || 1, rate: num(l.rate) });
    if (seen.size >= limit) break;
  }
  return [...seen.values()];
}

/**
 * EMF rejected an invoice → copy it as a new DRAFT (new number, same period,
 * same lines) that the sub corrects and sends again. The rejected one stays
 * for the record; expenses billed on it move to the copy.
 * → { invoice } or { error, status }
 */
export async function copyAsCorrection(supabase, user, invoice) {
  if (invoice.emf_review_status !== 'rejected') return { error: 'Only an invoice EMF rejected can be corrected', status: 409 };
  const { data: existing } = await supabase.from('subcontractor_invoices')
    .select('invoice_id, invoice_number').eq('replaces_invoice_id', invoice.invoice_id).maybeSingle();
  if (existing) return { error: `Already corrected as ${existing.invoice_number}`, status: 409, invoice: existing };

  const { data: items, error: itErr } = await supabase.from('subcontractor_invoice_items').select('*').eq('invoice_id', invoice.invoice_id);
  if (itErr) return { error: itErr.message, status: 500 };
  const SKIP = new Set(['invoice_id', 'invoice_number', 'created_at', 'updated_at', 'status', 'sent_at', 'sent_to_email', 'paid_at',
    'emf_review_status', 'emf_review_note', 'emf_reviewed_at', 'emf_reviewed_by', 'emf_paid_at', 'emf_paid_by', 'emf_paid_note',
    'replaces_invoice_id', 'amount_paid', 'last_reminder_at', 'reminder_count']);
  const row = Object.fromEntries(Object.entries(invoice).filter(([k]) => !SKIP.has(k)));
  const { invoice: copy, error } = await nextNumberInsert(supabase, user, {
    ...row, status: 'draft', replaces_invoice_id: invoice.invoice_id,
    sent_to_email: invoice.client_type === 'other' ? invoice.client_email || null : EMF_EMAIL,
  });
  if (error) return { error: error.message, status: 500 };
  if (items?.length) {
    const rows = items.map(({ item_id, invoice_id, created_at, ...rest }) => ({ ...rest, invoice_id: copy.invoice_id }));
    const { error: insErr } = await supabase.from('subcontractor_invoice_items').insert(rows);
    if (insErr) {
      await supabase.from('subcontractor_invoices').delete().eq('invoice_id', copy.invoice_id);
      return { error: `Lines failed, nothing created: ${insErr.message}`, status: 500 };
    }
  }
  await supabase.from('contractor_tax_records').update({ billed_invoice_id: copy.invoice_id }).eq('billed_invoice_id', invoice.invoice_id);
  return { invoice: copy };
}
