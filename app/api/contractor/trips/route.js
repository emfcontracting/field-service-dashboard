// GET  /api/contractor/trips?year=2026  → { trips, emf: [{ work_date, miles, wo_number }] }
// POST /api/contractor/trips { trip_date, miles, purpose, from_place?, to_place? } → { trip }
// The sub's own trips plus the miles EMF logged on his work orders that year.
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient } from '@/lib/serverAuth';
import { targetUserId } from '@/lib/contractorProfile';

export const dynamic = 'force-dynamic';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const clip = (v, n) => { const t = String(v ?? '').trim(); return t ? t.slice(0, n) : null; };

export async function GET(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const userId = targetUserId(auth, searchParams.get('user_id'));
  const year = /^\d{4}$/.test(searchParams.get('year') || '') ? searchParams.get('year') : String(new Date().getFullYear());
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  const supabase = serviceClient();
  const [trips, logs] = await Promise.all([
    supabase.from('contractor_trips').select('*').eq('user_id', userId)
      .gte('trip_date', `${year}-01-01`).lte('trip_date', `${year}-12-31`).order('trip_date', { ascending: false }),
    supabase.from('daily_hours_log').select('work_date, miles, work_order:work_orders(wo_number)').eq('user_id', userId)
      .gte('work_date', `${year}-01-01`).lte('work_date', `${year}-12-31`).gt('miles', 0).order('work_date', { ascending: false }),
  ]);
  if (trips.error) return NextResponse.json({ error: trips.error.message }, { status: 500 });
  if (logs.error) return NextResponse.json({ error: logs.error.message }, { status: 500 });
  return NextResponse.json({
    trips: trips.data || [],
    emf: (logs.data || []).map((l) => ({ work_date: l.work_date, miles: parseFloat(l.miles) || 0, wo_number: l.work_order?.wo_number || null })),
  });
}

export async function POST(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  if (!p.contractor) return NextResponse.json({ error: 'Only subcontractors log trips' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const miles = parseFloat(body.miles);
  if (!DAY.test(body.trip_date || '')) return NextResponse.json({ error: 'Date required' }, { status: 400 });
  if (!(miles > 0 && miles < 5000)) return NextResponse.json({ error: 'Miles must be between 0 and 5000' }, { status: 400 });
  const purpose = clip(body.purpose, 300);
  if (!purpose) return NextResponse.json({ error: 'Purpose required (e.g. supply run for job at …)' }, { status: 400 });
  const { data, error } = await serviceClient().from('contractor_trips').insert({
    user_id: p.user.user_id, trip_date: body.trip_date, miles: Math.round(miles * 10) / 10, purpose,
    from_place: clip(body.from_place, 200), to_place: clip(body.to_place, 200),
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ trip: data });
}
