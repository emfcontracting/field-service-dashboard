// app/api/auth/change-pin/route.js
// POST /api/auth/change-pin  { newPin }   (Authorization: Bearer <app token>)
// Changes the caller's OWN PIN. Admins may pass { userId } to set another
// user's PIN (e.g. onboarding).
import { NextResponse } from 'next/server';
import { requireUser, serviceClient } from '@/lib/serverAuth';

export async function POST(request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  let body = {};
  try { body = await request.json(); } catch { /* empty */ }
  const newPin = String(body.newPin || '').trim();
  if (!/^\d{4,8}$/.test(newPin)) return NextResponse.json({ error: 'PIN must be 4-8 digits' }, { status: 400 });

  const me = auth.principal.user;
  let targetId = me.user_id;
  if (body.userId && body.userId !== me.user_id) {
    if (me.role !== 'admin') return NextResponse.json({ error: 'Admin access required to set another user\'s PIN' }, { status: 403 });
    targetId = body.userId;
  }

  const supabase = serviceClient();
  const { error } = await supabase
    .from('user_pins')
    .upsert({ user_id: targetId, pin: newPin, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) {
    // Migration not run yet → keep legacy column working.
    const { error: legacyErr } = await supabase.from('users').update({ pin: newPin }).eq('user_id', targetId);
    if (legacyErr) return NextResponse.json({ error: legacyErr.message }, { status: 500 });
  } else {
    // Keep the legacy column empty once user_pins is the source of truth.
    await supabase.from('users').update({ pin: null }).eq('user_id', targetId);
  }
  return NextResponse.json({ success: true });
}
