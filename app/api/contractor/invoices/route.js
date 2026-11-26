// app/api/contractor/invoices/route.js
// -----------------------------------------------------------------------------
// GET  /api/contractor/invoices[?status=paid&year=2026&limit=5&items=1&user_id=]
//      → { invoices, items? }   (contractor: own rows only; staff: user_id)
// POST /api/contractor/invoices
//      EMF:   { period_start, period_end, line_items: [{ description, quantity, rate }] }
//      Other: { client_type: 'other', client: { name, address, city, state, zip, email },
//               period_start, period_end, line_items }   (only the sub's own lines/prices)
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
import { targetUserId } from '@/lib/contractorProfile';
import { createEmfInvoice, createOtherClientInvoice } from '@/lib/subInvoiceCreate';
import { paymentsFor } from '@/lib/contractorPayments';

export const dynamic = 'force-dynamic';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
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

  // Payments received (part payments) on each invoice
  const payBy = await paymentsFor(supabase, (invoices || []).map((i) => i.invoice_id));
  for (const i of invoices || []) i.payments = payBy[i.invoice_id] || [];

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

  const supabase = serviceClient();
  const result = body.client_type === 'other'
    ? await createOtherClientInvoice(supabase, p.user, body, periodStart, periodEnd)
    : await createEmfInvoice(supabase, p.user, p.contractor, body, periodStart, periodEnd);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 500 });
  return NextResponse.json({ invoice: result.invoice });
}
