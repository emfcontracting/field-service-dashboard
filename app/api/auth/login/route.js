// app/api/auth/login/route.js
// -----------------------------------------------------------------------------
// POST /api/auth/login  { email, pin }
//
// Technician app sign-in (native + browser). The PIN is verified HERE with the
// service-role key — the apps no longer read the users table (incl. every
// other tech's PIN) with the anon key. Returns the user's own row without
// secrets plus a signed app-session token for the API routes.
//
// PIN storage: user_pins(user_id, pin) — service-role only. During the
// migration window users.pin is still honoured as a fallback.
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { serviceClient, signAppToken, publicUser } from '@/lib/serverAuth';

const ATTEMPTS = new Map(); // ip -> { count, until }  (per-instance rate limit)
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;

function limited(ip) {
  const now = Date.now();
  const rec = ATTEMPTS.get(ip);
  if (!rec || rec.until < now) return false;
  return rec.count >= MAX_ATTEMPTS;
}
function bump(ip) {
  const now = Date.now();
  const rec = ATTEMPTS.get(ip);
  if (!rec || rec.until < now) ATTEMPTS.set(ip, { count: 1, until: now + WINDOW_MS });
  else rec.count += 1;
}

async function lookupPin(supabase, userId) {
  const { data: row } = await supabase.from('user_pins').select('pin').eq('user_id', userId).maybeSingle();
  if (row?.pin) return row.pin;
  const { data: legacy } = await supabase.from('users').select('pin').eq('user_id', userId).maybeSingle();
  return legacy?.pin || null;
}

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (limited(ip)) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });

  let body = {};
  try { body = await request.json(); } catch { /* empty */ }
  const email = String(body.email || '').trim().toLowerCase();
  const pin = String(body.pin || '').trim();
  if (!email || !pin) return NextResponse.json({ error: 'Email and PIN required' }, { status: 400 });

  const supabase = serviceClient();
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .ilike('email', email)
    .maybeSingle();

  if (error || !user) { bump(ip); return NextResponse.json({ error: 'Invalid email - user not found' }, { status: 401 }); }
  if (user.is_active === false) { bump(ip); return NextResponse.json({ error: 'Account is inactive. Contact admin.' }, { status: 403 }); }

  const stored = await lookupPin(supabase, user.user_id);
  if (!stored) return NextResponse.json({ error: 'No PIN set for this user. Contact admin to set up your PIN.' }, { status: 403 });
  if (stored !== pin) { bump(ip); return NextResponse.json({ error: 'Invalid PIN - PIN does not match' }, { status: 401 }); }

  return NextResponse.json({ user: publicUser(user), token: signAppToken(user) });
}
