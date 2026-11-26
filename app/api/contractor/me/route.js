// GET /api/contractor/me → { user, profile } for the signed-in contractor.
// profile is publicProfile(): no pin_hash, tax_id only masked.
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, publicUser } from '@/lib/serverAuth';
import { publicProfile } from '@/lib/contractorProfile';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  if (!p.contractor) return NextResponse.json({ error: 'Not a subcontractor account' }, { status: 403 });
  return NextResponse.json({ user: publicUser(p.user), profile: publicProfile(p.contractor) });
}
