// lib/contractorEstimates.js  (server only)
// -----------------------------------------------------------------------------
// Estimates (quotes) a subcontractor sends to his own customers:
//   draft → sent → accepted | declined → invoiced (turned into a draft invoice)
// The PDF is the invoice layout headed ESTIMATE (lib/subInvoicePdf, doc opts);
// the mail goes out like an invoice (EMF Gmail, sub as Reply-To + CC).
// Number: EST-<year>-<initials>-<NNN>, per sub.
// -----------------------------------------------------------------------------
import nodemailer from 'nodemailer';
import { buildSubInvoicePdf } from './subInvoicePdf';
import { EMAIL_RE } from './contractorCustomers';
import { createOtherClientInvoice } from './subInvoiceCreate';

const num = (v) => parseFloat(v || 0) || 0;
const round2 = (v) => Math.round(v * 100) / 100;
const clip = (v, n) => { const t = String(v ?? '').trim(); return t ? t.slice(0, n) : null; };
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtDay = (d) => {
  if (!d) return '';
  const [y, m, dd] = d.split('-').map(Number);
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${dd}, ${y}`;
};

export function estimateLines(items) {
  return (Array.isArray(items) ? items : []).map((li, i) => {
    const quantity = num(li.quantity) || 1;
    const rate = num(li.rate);
    return { position: i, description: String(li.description || '').trim().slice(0, 300), quantity, rate, amount: round2(quantity * rate) };
  }).filter((li) => li.description && li.amount > 0);
}

/** body.client / customer → estimate client columns, or { error } */
export async function estimateClient(supabase, userId, body) {
  if (body.customer_id) {
    const { data: c } = await supabase.from('contractor_customers').select('*').eq('customer_id', body.customer_id).maybeSingle();
    if (!c || c.user_id !== userId) return { error: 'Customer not found' };
    const o = body.client || {};
    return { row: {
      customer_id: c.customer_id,
      client_name: clip(o.name, 200) || c.name, client_address: clip(o.address ?? c.address, 300), client_city: clip(o.city ?? c.city, 100),
      client_state: clip(o.state ?? c.state, 20), client_zip: clip(o.zip ?? c.zip, 20), client_email: clip(o.email ?? c.email, 200),
    } };
  }
  const o = body.client || {};
  const row = {
    customer_id: null, client_name: clip(o.name, 200), client_address: clip(o.address, 300), client_city: clip(o.city, 100),
    client_state: clip(o.state, 20), client_zip: clip(o.zip, 20), client_email: clip(o.email, 200),
  };
  if (!row.client_name) return { error: 'Customer name required' };
  if (row.client_email && !EMAIL_RE.test(row.client_email)) return { error: 'E-mail looks invalid' };
  return { row };
}

export function estimateFields(body) {
  const out = {};
  if (body.title !== undefined) out.title = clip(body.title, 200);
  if (body.notes !== undefined) out.notes = clip(body.notes, 2000);
  if (body.valid_until !== undefined) out.valid_until = DAY.test(body.valid_until || '') ? body.valid_until : null;
  return out;
}

export async function nextEstimateNumber(supabase, user) {
  const year = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }).format(new Date());
  const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase() || 'XX';
  const prefix = `EST-${year}-${initials}-`;
  const { data } = await supabase.from('contractor_estimates').select('estimate_number')
    .eq('user_id', user.user_id).like('estimate_number', `${prefix}%`);
  const max = Math.max(0, ...(data || []).map((r) => parseInt(r.estimate_number.slice(prefix.length), 10) || 0));
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

/** Insert estimate + items (number retried on a unique race). → { estimate } | { error } */
export async function insertEstimate(supabase, user, row, lines) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const estimate_number = await nextEstimateNumber(supabase, user);
    const { data, error } = await supabase.from('contractor_estimates')
      .insert({ ...row, user_id: user.user_id, estimate_number, total: round2(lines.reduce((s, l) => s + l.amount, 0)) })
      .select().single();
    if (error?.code === '23505') continue;
    if (error) return { error: error.message };
    if (lines.length) {
      const { error: itErr } = await supabase.from('contractor_estimate_items').insert(lines.map((l) => ({ ...l, estimate_id: data.estimate_id })));
      if (itErr) { await supabase.from('contractor_estimates').delete().eq('estimate_id', data.estimate_id); return { error: itErr.message }; }
    }
    return { estimate: data };
  }
  return { error: 'Could not assign an estimate number, try again' };
}

/** Replace the lines of an estimate and re-total it. */
export async function replaceEstimateLines(supabase, estimateId, lines) {
  const { data: old } = await supabase.from('contractor_estimate_items').select('item_id').eq('estimate_id', estimateId);
  if (lines.length) {
    const { error } = await supabase.from('contractor_estimate_items').insert(lines.map((l) => ({ ...l, estimate_id: estimateId })));
    if (error) return { error: error.message };
  }
  if (old?.length) await supabase.from('contractor_estimate_items').delete().in('item_id', old.map((o) => o.item_id));
  return { total: round2(lines.reduce((s, l) => s + l.amount, 0)) };
}

export async function loadEstimate(supabase, id) {
  const { data: estimate } = await supabase.from('contractor_estimates').select('*').eq('estimate_id', id).maybeSingle();
  if (!estimate) return null;
  const [{ data: items }, { data: userData }, { data: profile }] = await Promise.all([
    supabase.from('contractor_estimate_items').select('*').eq('estimate_id', id).order('position'),
    supabase.from('users').select('user_id, first_name, last_name, email').eq('user_id', estimate.user_id).maybeSingle(),
    supabase.from('subcontractor_profiles').select('business_name, business_address').eq('user_id', estimate.user_id).maybeSingle(),
  ]);
  return { estimate, items: items || [], userData, profile };
}

export async function buildEstimatePdf({ estimate, items, userData, profile }) {
  const asInvoice = {
    invoice_number: estimate.estimate_number, client_type: 'other',
    client_name: estimate.client_name, client_address: estimate.client_address, client_city: estimate.client_city,
    client_state: estimate.client_state, client_zip: estimate.client_zip, client_email: estimate.client_email,
    grand_total: estimate.total, total_line_items_amount: estimate.total,
  };
  return buildSubInvoicePdf({
    invoice: asInvoice, userData, profile,
    lineItems: items.map((i) => ({ ...i, item_type: 'custom' })),
    doc: {
      heading: 'ESTIMATE', periodLabel: 'Valid until', periodText: estimate.valid_until ? fmtDay(estimate.valid_until) : '30 days',
      itemsTitle: estimate.title || 'Services & Materials', totalLabel: 'ESTIMATE TOTAL', notes: estimate.notes || '',
    },
  });
}

export async function mailEstimate(data) {
  const user = process.env.EMAIL_USER, pass = process.env.EMAIL_PASS;
  if (!user || !pass) throw new Error('Email service not configured');
  const { estimate, userData, profile } = data;
  if (!estimate.client_email) throw new Error('This estimate has no customer e-mail');
  const from = profile?.business_name || `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() || 'Subcontractor';
  const pdf = await buildEstimatePdf(data);
  const info = await nodemailer.createTransport({ service: 'gmail', auth: { user, pass } }).sendMail({
    from: `"${from.replace(/"/g, '')}" <${user}>`,
    to: estimate.client_email,
    cc: userData?.email || undefined,
    replyTo: userData?.email || undefined,
    subject: `Estimate ${estimate.estimate_number}${estimate.title ? ` — ${estimate.title}` : ''} — $${num(estimate.total).toFixed(2)}`,
    html: `<p>Hello ${esc(estimate.client_name)},</p>
<p>please find attached estimate <strong>${esc(estimate.estimate_number)}</strong>${estimate.title ? ` for ${esc(estimate.title)}` : ''}: <strong>$${num(estimate.total).toFixed(2)}</strong>${estimate.valid_until ? `, valid until ${esc(fmtDay(estimate.valid_until))}` : ''}.</p>
<p>Just reply to this e-mail to accept it or if you have questions.</p>
<p>Thank you,<br>${esc(from)}${userData?.email ? `<br>${esc(userData.email)}` : ''}</p>`,
    attachments: [{ filename: `${estimate.estimate_number}.pdf`, content: Buffer.from(pdf), contentType: 'application/pdf' }],
  });
  return { to: estimate.client_email, messageId: info.messageId };
}

/** Accepted estimate → draft invoice to the same customer with the same lines. */
export async function estimateToInvoice(supabase, user, data) {
  const { estimate, items } = data;
  if (estimate.invoice_id) return { error: 'Already turned into an invoice', status: 409 };
  if (!['accepted', 'sent', 'draft'].includes(estimate.status)) return { error: `A ${estimate.status} estimate can't be invoiced`, status: 409 };
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const result = await createOtherClientInvoice(supabase, user, {
    client: { name: estimate.client_name, address: estimate.client_address, city: estimate.client_city, state: estimate.client_state, zip: estimate.client_zip, email: estimate.client_email },
    customer_id: estimate.customer_id || undefined,
    estimate_id: estimate.estimate_id,
    line_items: items.map((i) => ({ description: i.description, quantity: i.quantity, rate: i.rate })),
  }, today, today);
  if (result.error) return result;
  await supabase.from('contractor_estimates').update({
    status: 'invoiced', invoice_id: result.invoice.invoice_id, decided_at: estimate.decided_at || new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq('estimate_id', estimate.estimate_id);
  return { invoice: result.invoice };
}
