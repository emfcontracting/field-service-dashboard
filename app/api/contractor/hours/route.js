// GET /api/contractor/hours?start=YYYY-MM-DD&end=YYYY-MM-DD[&user_id=]
// → { hours: [...daily_hours_log rows with work_order], already_invoiced: [...] }
// for the contractor's own user_id (staff may pass user_id). already_invoiced
// lists entries that are on another invoice already (lib/subInvoiceOverlap).
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient } from '@/lib/serverAuth';
import { targetUserId } from '@/lib/contractorProfile';
import { findAlreadyInvoiced } from '@/lib/subInvoiceOverlap';

export const dynamic = 'force-dynamic';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const userId = targetUserId(auth, searchParams.get('user_id'));
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  if (!DAY.test(start || '')) return NextResponse.json({ error: 'start (YYYY-MM-DD) required' }, { status: 400 });
  if (end && !DAY.test(end)) return NextResponse.json({ error: 'end must be YYYY-MM-DD' }, { status: 400 });

  let q = serviceClient()
    .from('daily_hours_log')
    .select('*, work_order:work_orders(wo_number, building, work_order_description)')
    .eq('user_id', userId)
    .gte('work_date', start)
    .order('work_date', { ascending: true });
  if (end) q = q.lte('work_date', end);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let alreadyInvoiced = [];
  if (searchParams.get('check') === '1') {
    try { alreadyInvoiced = await findAlreadyInvoiced(serviceClient(), userId, data || []); }
    catch (e) { console.error('overlap check failed:', e.message); }
  }
  return NextResponse.json({ hours: data || [], already_invoiced: alreadyInvoiced });
}
