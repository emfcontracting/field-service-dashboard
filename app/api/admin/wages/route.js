// app/api/admin/wages/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Admin-only API: GET and POST/PUT user wages
// Triple security: Supabase RLS + server-side role check + anon key isolation
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Use service role for server-side ops — never exposed to client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function verifyAdmin(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('role, is_active')
    .eq('auth_id', user.id)
    .single();
  if (!userData || !userData.is_active || userData.role !== 'admin') return null;
  return user;
}

// GET /api/admin/wages — fetch all wages (or ?user_id=X for one)
export async function GET(request) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  let query = supabaseAdmin
    .from('user_wages')
    .select(`*, user:users(user_id, first_name, last_name, role, email)`);

  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/admin/wages — upsert wage for a user
export async function POST(request) {
  const admin = await verifyAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json();
  const { user_id, hourly_rate_regular, hourly_rate_overtime, notes } = body;

  if (!user_id || hourly_rate_regular == null || hourly_rate_overtime == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('user_wages')
    .upsert({
      user_id,
      hourly_rate_regular: parseFloat(hourly_rate_regular),
      hourly_rate_overtime: parseFloat(hourly_rate_overtime),
      notes: notes || null,
      effective_date: new Date().toISOString().split('T')[0],
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
