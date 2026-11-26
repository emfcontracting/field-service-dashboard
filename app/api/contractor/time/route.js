// app/api/contractor/time/route.js
// -----------------------------------------------------------------------------
// The sub's own time tracking for customers other than EMF (EMF hours come
// from daily_hours_log). One running timer per sub.
// GET  ?customer_id=&unbilled=1&days=60  → { entries, running }
// POST { action: 'start', customer_id, description? }        → { entry }
//      { action: 'stop', description? }                        → { entry }
//      { action: 'manual', customer_id, date, minutes, description?, rate? } → { entry }
// Rate: the entry's own, else the customer's hourly rate, else the sub's rate.
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient } from '@/lib/serverAuth';
import { targetUserId } from '@/lib/contractorProfile';

export const dynamic = 'force-dynamic';
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const clip = (v, n) => { const t = String(v ?? '').trim(); return t ? t.slice(0, n) : null; };
const SELECT = '*, customer:contractor_customers(name, hourly_rate)';

async function ownCustomer(sb, userId, customerId) {
  if (!customerId) return null;
  const { data } = await sb.from('contractor_customers').select('customer_id, user_id, hourly_rate').eq('customer_id', customerId).maybeSingle();
  return data && data.user_id === userId ? data : null;
}

export async function GET(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const userId = targetUserId(auth, searchParams.get('user_id'));
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  const sb = serviceClient();
  let q = sb.from('contractor_time_entries').select(SELECT).eq('user_id', userId).order('started_at', { ascending: false });
  if (searchParams.get('customer_id')) q = q.eq('customer_id', searchParams.get('customer_id'));
  if (searchParams.get('unbilled') === '1') q = q.is('invoice_id', null).not('ended_at', 'is', null);
  else {
    const days = Math.min(366, Math.max(1, parseInt(searchParams.get('days') || '60', 10)));
    q = q.gte('started_at', new Date(Date.now() - days * 86400000).toISOString());
  }
  const [{ data, error }, run] = await Promise.all([
    q.limit(500),
    sb.from('contractor_time_entries').select(SELECT).eq('user_id', userId).is('ended_at', null).maybeSingle(),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: (data || []).filter((e) => e.ended_at), running: run.data || null });
}

export async function POST(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  if (!p.contractor) return NextResponse.json({ error: 'Only subcontractors track time' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const sb = serviceClient();
  const userId = p.user.user_id;
  const now = new Date();

  if (body.action === 'start') {
    const c = await ownCustomer(sb, userId, body.customer_id);
    if (!c) return NextResponse.json({ error: 'Pick a customer' }, { status: 400 });
    const { data: running } = await sb.from('contractor_time_entries').select('entry_id').eq('user_id', userId).is('ended_at', null).maybeSingle();
    if (running) return NextResponse.json({ error: 'A timer is already running — stop it first' }, { status: 409 });
    const { data, error } = await sb.from('contractor_time_entries').insert({
      user_id: userId, customer_id: c.customer_id, started_at: now.toISOString(),
      description: clip(body.description, 300), rate: c.hourly_rate ?? p.contractor.hourly_rate ?? null,
    }).select(SELECT).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entry: data });
  }

  if (body.action === 'stop') {
    const { data: run } = await sb.from('contractor_time_entries').select('*').eq('user_id', userId).is('ended_at', null).maybeSingle();
    if (!run) return NextResponse.json({ error: 'No timer running' }, { status: 409 });
    // A timer left running for days is capped at 24 h — the sub edits it after.
    const minutes = Math.min(1440, Math.max(0, Math.round((now - new Date(run.started_at)) / 60000)));
    const ended = new Date(new Date(run.started_at).getTime() + minutes * 60000);
    const update = { ended_at: (minutes === 1440 ? ended : now).toISOString(), minutes, updated_at: now.toISOString() };
    if (body.description !== undefined) update.description = clip(body.description, 300);
    const { data, error } = await sb.from('contractor_time_entries').update(update).eq('entry_id', run.entry_id).select(SELECT).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entry: data, capped: minutes === 1440 });
  }

  if (body.action === 'manual') {
    const c = await ownCustomer(sb, userId, body.customer_id);
    if (!c) return NextResponse.json({ error: 'Pick a customer' }, { status: 400 });
    if (!DAY.test(body.date || '')) return NextResponse.json({ error: 'Date required' }, { status: 400 });
    const minutes = Math.round(parseFloat(body.minutes));
    if (!(minutes > 0 && minutes <= 1440)) return NextResponse.json({ error: 'Time must be between 1 minute and 24 hours' }, { status: 400 });
    const rate = body.rate === '' || body.rate == null ? (c.hourly_rate ?? p.contractor.hourly_rate ?? null) : parseFloat(body.rate);
    if (rate != null && !(rate >= 0 && rate <= 1000)) return NextResponse.json({ error: 'Rate must be between 0 and 1000' }, { status: 400 });
    const start = new Date(`${body.date}T08:00:00-05:00`);
    const { data, error } = await sb.from('contractor_time_entries').insert({
      user_id: userId, customer_id: c.customer_id, started_at: start.toISOString(),
      ended_at: new Date(start.getTime() + minutes * 60000).toISOString(), minutes,
      description: clip(body.description, 300), rate,
    }).select(SELECT).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entry: data });
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
