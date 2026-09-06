// app/api/verify-admin-pin/route.js
// POST /api/verify-admin-pin  { pin }   (Authorization: Bearer <app or dashboard token>)
// Used by the technician app for admin overrides (e.g. finishing a WO without
// photos). Returns { valid, admin: { user_id, first_name } } — never the PIN.
import { NextResponse } from 'next/server';
import { requireUser, serviceClient } from '@/lib/serverAuth';

export async function POST(request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  let body = {};
  try { body = await request.json(); } catch { /* empty */ }
  const pin = String(body.pin || '').trim();
  if (!pin) return NextResponse.json({ valid: false, error: 'PIN required' }, { status: 400 });

  const supabase = serviceClient();
  const { data: admins } = await supabase
    .from('users')
    .select('user_id, first_name, last_name, pin')
    .eq('role', 'admin')
    .eq('is_active', true);

  const ids = (admins || []).map(a => a.user_id);
  const { data: pins } = ids.length
    ? await supabase.from('user_pins').select('user_id, pin').in('user_id', ids)
    : { data: [] };
  const pinById = new Map((pins || []).map(p => [p.user_id, p.pin]));

  const match = (admins || []).find(a => (pinById.get(a.user_id) || a.pin) === pin);
  if (!match) return NextResponse.json({ valid: false, error: 'Invalid admin PIN' });
  return NextResponse.json({ valid: true, admin: { user_id: match.user_id, first_name: match.first_name, last_name: match.last_name } });
}
