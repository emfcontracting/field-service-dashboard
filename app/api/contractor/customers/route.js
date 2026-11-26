// GET  /api/contractor/customers[?all=1]  → { customers }  (archived only with all=1)
// POST /api/contractor/customers { name, address?, city?, state?, zip?, email?, phone?, hourly_rate?, notes? }
//      → { customer }
// The sub's own saved customers (other clients). Contractor only sees his own.
import { NextResponse } from 'next/server';
import { requireContractorOrStaff, serviceClient } from '@/lib/serverAuth';
import { targetUserId } from '@/lib/contractorProfile';
import { cleanCustomer } from '@/lib/contractorCustomers';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const userId = targetUserId(auth, searchParams.get('user_id'));
  if (!userId) return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  let q = serviceClient().from('contractor_customers').select('*').eq('user_id', userId).order('name');
  if (searchParams.get('all') !== '1') q = q.eq('archived', false);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ customers: data || [] });
}

export async function POST(request) {
  const auth = await requireContractorOrStaff(request);
  if (!auth.ok) return auth.response;
  if (!auth.principal.contractor) return NextResponse.json({ error: 'Only subcontractors keep customers' }, { status: 403 });
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request' }, { status: 400 }); }
  const { row, error } = cleanCustomer(body);
  if (error) return NextResponse.json({ error }, { status: 400 });
  const supabase = serviceClient();
  // Same name already saved → return that one (no duplicates from "save as customer")
  const { data: dup } = await supabase.from('contractor_customers').select('*')
    .eq('user_id', auth.principal.user.user_id).ilike('name', row.name.replace(/[%_\\]/g, (m) => '\\' + m)).limit(1);
  if (dup?.length) return NextResponse.json({ customer: dup[0], existing: true });
  const { data, error: insErr } = await supabase.from('contractor_customers')
    .insert({ ...row, user_id: auth.principal.user.user_id }).select().single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ customer: data });
}
