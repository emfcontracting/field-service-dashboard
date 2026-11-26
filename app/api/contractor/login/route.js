// app/api/contractor/login/route.js
// -----------------------------------------------------------------------------
// Subcontractor portal sign-in: e-mail + portal PIN → app token.
//
// Until now the portal checked the PIN in the browser (users + profile read
// with the anon key, btoa(pin) compared client-side) and never obtained a
// token, so every /api/contractor/* call has answered 401 "Sign in required"
// since the routes were guarded. This route does the same checks server-side
// (service role, no profile columns reach the client) and returns the app
// token lib/serverAuth understands; the routes accept it through
// requireContractorOrStaff.
//
// PINs are stored hashed (lib/contractorPin: scrypt). Rows still holding the
// old btoa(pin) value are accepted once and re-hashed on that sign-in. First
// sign-in without a PIN is allowed and flagged needsPinSetup — the settings
// page forces one. The profile sent back never contains pin_hash or the full
// tax_id (lib/contractorProfile.publicProfile).
// Rate-limited per IP like /api/auth/login.
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { serviceClient, signAppToken, publicUser } from '@/lib/serverAuth';
import { verifyPin, hashPin } from '@/lib/contractorPin';
import { publicProfile } from '@/lib/contractorProfile';

export const dynamic = 'force-dynamic';

const ATTEMPTS = new Map(); // ip -> { count, until }
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 10 * 60 * 1000;
function limited(ip) {
  const rec = ATTEMPTS.get(ip);
  return !!rec && rec.until >= Date.now() && rec.count >= MAX_ATTEMPTS;
}
function bump(ip) {
  const now = Date.now();
  const rec = ATTEMPTS.get(ip);
  if (!rec || rec.until < now) ATTEMPTS.set(ip, { count: 1, until: now + WINDOW_MS });
  else rec.count += 1;
}

export async function POST(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (limited(ip)) return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const email = String(body.email || '').trim().toLowerCase();
  const pin = String(body.pin || '').trim();
  const step = body.step === 'email' ? 'email' : 'pin';   // 'email' = existence check only
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const supabase = serviceClient();
  const { data: user } = await supabase
    .from('users')
    .select('user_id, auth_id, email, first_name, last_name, role, is_active')
    .eq('email', email)
    .eq('is_active', true)
    .maybeSingle();
  if (!user) { bump(ip); return NextResponse.json({ error: 'Email not found or account inactive' }, { status: 404 }); }

  const { data: profile } = await supabase
    .from('subcontractor_profiles')
    .select('*')
    .eq('user_id', user.user_id)
    .maybeSingle();
  if (!profile) return NextResponse.json({ error: 'Subcontractor access not enabled. Contact admin.' }, { status: 403 });
  if (profile.is_enabled === false) return NextResponse.json({ error: 'Your subcontractor access is disabled. Contact admin.' }, { status: 403 });
  if (profile.subscription_status === 'expired') return NextResponse.json({ error: 'Your subscription has expired. Contact admin.' }, { status: 403 });

  // Step 1 of the portal's two-step form: confirm the e-mail, ask for the PIN.
  if (step === 'email') {
    return NextResponse.json({ ok: true, hasPin: !!profile.pin_hash, first_name: user.first_name, last_name: user.last_name });
  }

  if (profile.pin_hash) {
    if (!pin) return NextResponse.json({ error: 'PIN required' }, { status: 400 });
    const check = verifyPin(pin, profile.pin_hash);
    if (!check.ok) {
      bump(ip);
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
    }
    if (check.needsRehash) {
      await supabase
        .from('subcontractor_profiles')
        .update({ pin_hash: hashPin(pin) })
        .eq('user_id', user.user_id);
    }
  }


  return NextResponse.json({
    user: publicUser(user),
    profile: publicProfile(profile),
    needsPinSetup: !profile.pin_hash,
    token: signAppToken(user),
  });
}
