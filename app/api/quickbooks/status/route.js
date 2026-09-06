// app/api/quickbooks/status/route.js
// GET /api/quickbooks/status  (office/admin session)
// Connection status WITHOUT tokens — the quickbooks_settings table itself is
// no longer readable from the browser.
import { NextResponse } from 'next/server';
import { requireStaff, serviceClient } from '@/lib/serverAuth';

export async function GET(request) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  const { data, error } = await serviceClient()
    .from('quickbooks_settings')
    .select('realm_id, connected_at, last_sync_at, token_expires_at, is_active, needs_reconnect, last_error, last_error_at')
    .eq('is_active', true)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ connected: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ connected: false, settings: null });
  return NextResponse.json({ connected: true, needs_reconnect: !!data.needs_reconnect, settings: data });
}
