// DELETE /api/contractor/trips/[id] → removes one of the sub's own trips
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient, ownsUser, denyNotOwner } from '@/lib/serverAuth';

export const dynamic = 'force-dynamic';

export async function DELETE(request, { params }) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const supabase = serviceClient();
  const { data: trip } = await supabase.from('contractor_trips').select('user_id').eq('trip_id', id).maybeSingle();
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  if (!ownsUser(auth, trip.user_id)) return denyNotOwner().response;
  const { error } = await supabase.from('contractor_trips').delete().eq('trip_id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
