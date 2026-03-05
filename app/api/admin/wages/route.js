// app/api/admin/wages/route.js
// -----------------------------------------------------------------------------
// Admin-only API: GET and POST/PUT user wages
// Uses the user's own JWT so RLS handles auth (no service role key needed)
// -----------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

function getSupabaseForUser(token) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth:   { persistSession: false },
    }
  );
}

async function verifyAdmin(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return { user: null, supabase: null, error: 'No auth header' };

    const token = authHeader.replace('Bearer ', '');
    const supabase = getSupabaseForUser(token);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return { user: null, supabase: null, error: authError?.message || 'No user' };

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role, is_active')
      .eq('auth_id', user.id)
      .single();

    if (userError || !userData) return { user: null, supabase: null, error: userError?.message || 'User not found' };
    if (!userData.is_active)    return { user: null, supabase: null, error: 'User inactive' };
    if (userData.role !== 'admin') return { user: null, supabase: null, error: 'Not admin' };

    return { user, supabase, error: null };
  } catch (err) {
    return { user: null, supabase: null, error: err.message };
  }
}

// GET /api/admin/wages
export async function GET(request) {
  const { user, supabase, error } = await verifyAdmin(request);
  if (!user) {
    console.error('[wages GET] Auth failed:', error);
    return NextResponse.json({ error: `Forbidden: ${error}` }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('user_id');

  let query = supabase
    .from('user_wages')
    .select('*, user:users(user_id, first_name, last_name, role, email)');

  if (userId) query = query.eq('user_id', userId);

  const { data, error: dbError } = await query.order('created_at', { ascending: false });

  if (dbError) {
    console.error('[wages GET] DB error:', dbError);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ data: data || [] });
}

// POST /api/admin/wages — upsert wage for a user
export async function POST(request) {
  const { user, supabase, error } = await verifyAdmin(request);
  if (!user) {
    console.error('[wages POST] Auth failed:', error);
    return NextResponse.json({ error: `Forbidden: ${error}` }, { status: 403 });
  }

  const body = await request.json();
  const { user_id, hourly_rate_regular, hourly_rate_overtime, mileage_rate, notes } = body;

  if (!user_id || hourly_rate_regular == null || hourly_rate_overtime == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error: dbError } = await supabase
    .from('user_wages')
    .upsert({
      user_id,
      hourly_rate_regular:  parseFloat(hourly_rate_regular),
      hourly_rate_overtime: parseFloat(hourly_rate_overtime),
      mileage_rate:         parseFloat(mileage_rate ?? 0.55),
      notes:                notes || null,
      effective_date:       new Date().toISOString().split('T')[0],
    }, { onConflict: 'user_id' })
    .select()
    .single();

  if (dbError) {
    console.error('[wages POST] DB error:', dbError);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
