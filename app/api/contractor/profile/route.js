// PATCH /api/contractor/profile → business name, address, tax id.
// Rates are NOT accepted here — they are set by EMF (Settings → Subcontractors).
// A masked tax id (***-**-1234) coming back from the form is ignored.
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient } from '@/lib/serverAuth';
import { publicProfile, isMaskedTaxId } from '@/lib/contractorProfile';

export const dynamic = 'force-dynamic';

export async function PATCH(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  if (!p.contractor) return NextResponse.json({ error: 'Not a subcontractor account' }, { status: 403 });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }

  const update = { updated_at: new Date().toISOString() };
  if (body.business_name !== undefined) update.business_name = String(body.business_name || '').slice(0, 200);
  if (body.business_address !== undefined) update.business_address = String(body.business_address || '').slice(0, 500);
  if (body.tax_id !== undefined && !isMaskedTaxId(body.tax_id)) update.tax_id = String(body.tax_id || '').trim().slice(0, 20) || null;

  const { data, error } = await serviceClient()
    .from('subcontractor_profiles')
    .update(update)
    .eq('user_id', p.user.user_id)
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: publicProfile(data) });
}
