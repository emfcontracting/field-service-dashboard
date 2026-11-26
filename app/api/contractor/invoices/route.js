// app/api/contractor/invoices/route.js
// -----------------------------------------------------------------------------
// GET  /api/contractor/invoices[?status=paid&year=2026&limit=5&items=1&user_id=]
//      → { invoices, items? }   (contractor: own rows only; staff: user_id)
// POST /api/contractor/invoices
//      { period_start, period_end, line_items: [{ description, quantity, rate }] }
//      → { invoice }
//
// POST builds the invoice on the server: hours, OT, mileage and tech material
// are read from daily_hours_log for the period, rates come from the stored
// subcontractor profile (never from the browser), totals are computed here.
// If the line items cannot be written, the invoice row is removed again so no
// invoice with a total but no lines is left behind.
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient } from '@/lib/serverAuth';
import { targetUserId, profileRates } from '@/lib/contractorProfile';

export const dynamic = 'force-dynamic';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EMF_EMAIL = 'emfcontractingsc2@gmail.com';
const num = (v) => parseFloat(v || 0) || 0;
const round2 = (v) => Math.round(v * 100) / 100;

export async function GET(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const userId = targetUserId(auth, searchParams.get('user_id'));
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });

  const supabase = serviceClient();
  let q = supabase.from('subcontractor_invoices').select('*').eq('user_id', userId);
  const status = searchParams.get('status');
  if (status) q = q.eq('status', status);
  const year = searchParams.get('year');
  if (year && /^\d{4}$/.test(year)) {
    q = q.gte('period_start', `${year}-01-01`).lte('period_end', `${year}-12-31`).order('period_start', { ascending: true });
  } else {
    q = q.order('created_at', { ascending: false });
  }
  const limit = parseInt(searchParams.get('limit') || '', 10);
  if (limit > 0) q = q.limit(Math.min(limit, 500));

  const { data: invoices, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (searchParams.get('items') !== '1') return NextResponse.json({ invoices: invoices || [] });

  let items = [];
  if (invoices?.length) {
    const { data, error: itemsError } = await supabase
      .from('subcontractor_invoice_items')
      .select('*')
      .in('invoice_id', invoices.map((i) => i.invoice_id))
      .order('work_date', { ascending: true });
    if (itemsError) return NextResponse.json({ error: itemsError.message }, { status: 500 });
    items = data || [];
  }
  return NextResponse.json({ invoices: invoices || [], items });
}

export async function POST(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  if (!p.contractor) return NextResponse.json({ error: 'Only the subcontractor can create their invoice' }, { status: 403 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const periodStart = body.period_start;
  const periodEnd = body.period_end;
  if (!DAY.test(periodStart || '') || !DAY.test(periodEnd || '') || periodStart > periodEnd) {
    return NextResponse.json({ error: 'Valid period_start and period_end required' }, { status: 400 });
  }

  const user = p.user;
  const rates = profileRates(p.contractor);
  const supabase = serviceClient();

  const { data: hours, error: hoursError } = await supabase
    .from('daily_hours_log')
    .select('*, work_order:work_orders(wo_number, building)')
    .eq('user_id', user.user_id)
    .gte('work_date', periodStart)
    .lte('work_date', periodEnd)
    .order('work_date', { ascending: true });
  if (hoursError) return NextResponse.json({ error: hoursError.message }, { status: 500 });

  const custom = (Array.isArray(body.line_items) ? body.line_items : [])
    .map((li) => {
      const quantity = num(li.quantity) || 1;
      const rate = num(li.rate);
      return { description: String(li.description || '').trim().slice(0, 300), quantity, rate, amount: round2(quantity * rate) };
    })
    .filter((li) => li.description && li.amount > 0);

  if (!(hours || []).length && !custom.length) {
    return NextResponse.json({ error: 'No hours or line items for this period' }, { status: 400 });
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
  const initials = ((user.first_name?.[0] || '') + (user.last_name?.[0] || '')).toUpperCase();

  // ── invoice row (number from DB function; retry on unique race) ──
  let invoice = null;
  for (let attempt = 0; attempt < 3 && !invoice; attempt++) {
    const { data: invoiceNumber, error: numError } = await supabase.rpc('next_subcontractor_invoice_number', { p_user_id: user.user_id, p_initials: initials });
    if (numError) return NextResponse.json({ error: numError.message }, { status: 500 });
    const { data, error } = await supabase.from('subcontractor_invoices').insert({
      user_id: user.user_id,
      invoice_number: invoiceNumber,
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
    }).select().single();
    if (!error) { invoice = data; break; }
    if (error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!invoice) return NextResponse.json({ error: 'Could not assign an invoice number, try again' }, { status: 409 });

  if (items.length) {
    const { error: itemsError } = await supabase
      .from('subcontractor_invoice_items')
      .insert(items.map((it) => ({ ...it, invoice_id: invoice.invoice_id })));
    if (itemsError) {
      await supabase.from('subcontractor_invoices').delete().eq('invoice_id', invoice.invoice_id);
      return NextResponse.json({ error: `Line items failed, invoice not created: ${itemsError.message}` }, { status: 500 });
    }
  }
  return NextResponse.json({ invoice });
}
