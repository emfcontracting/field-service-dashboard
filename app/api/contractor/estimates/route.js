// GET  /api/contractor/estimates → { estimates }
// POST /api/contractor/estimates { customer_id? | client{}, title?, notes?, valid_until?, line_items } → { estimate }
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient } from '@/lib/serverAuth';
import { targetUserId } from '@/lib/contractorProfile';
import { estimateLines, estimateClient, estimateFields, insertEstimate } from '@/lib/contractorEstimates';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const userId = targetUserId(auth, searchParams.get('user_id'));
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  const { data, error } = await serviceClient().from('contractor_estimates').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ estimates: data || [] });
}

export async function POST(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const p = auth.principal;
  if (!p.contractor) return NextResponse.json({ error: 'Only subcontractors write estimates' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const sb = serviceClient();
  const client = await estimateClient(sb, p.user.user_id, body);
  if (client.error) return NextResponse.json({ error: client.error }, { status: 400 });
  const lines = estimateLines(body.line_items);
  if (!lines.length) return NextResponse.json({ error: 'Add at least one line' }, { status: 400 });
  const result = await insertEstimate(sb, p.user, { ...client.row, ...estimateFields(body), status: 'draft' }, lines);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ estimate: result.estimate });
}
