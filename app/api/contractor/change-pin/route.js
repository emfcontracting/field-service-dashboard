// POST /api/contractor/change-pin { currentPin?, newPin } → sets a hashed PIN.
// currentPin is required whenever a PIN already exists.
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient } from '@/lib/serverAuth';
import { hashPin, verifyPin, validPinFormat } from '@/lib/contractorPin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  if (!p.contractor) return NextResponse.json({ error: 'Not a subcontractor account' }, { status: 403 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const newPin = String(body.newPin || '').trim();
  if (!validPinFormat(newPin)) return NextResponse.json({ error: 'PIN must be 4–8 digits' }, { status: 400 });

  if (p.contractor.pin_hash) {
    const check = verifyPin(String(body.currentPin || '').trim(), p.contractor.pin_hash);
    if (!check.ok) return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 401 });
  }

  const { error } = await serviceClient()
    .from('subcontractor_profiles')
    .update({ pin_hash: hashPin(newPin), updated_at: new Date().toISOString() })
    .eq('user_id', p.user.user_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
