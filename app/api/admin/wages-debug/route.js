// app/api/admin/wages-debug/route.js
// Temporary debug endpoint — DELETE after fixing
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const results = {};

  // 1. Check env vars exist
  results.hasUrl  = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  results.hasAnon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  results.url     = process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 30) + '...';

  // 2. Check auth header
  const authHeader = request.headers.get('authorization');
  results.hasAuthHeader = !!authHeader;
  if (!authHeader) return NextResponse.json({ step: 'no_auth_header', ...results });

  const token = authHeader.replace('Bearer ', '');
  results.tokenLength = token.length;

  // 3. Try creating client with token
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
    );

    // 4. Check auth.getUser()
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    results.authError = authErr?.message || null;
    results.userId    = user?.id || null;
    if (!user) return NextResponse.json({ step: 'auth_failed', ...results });

    // 5. Check users table
    const { data: userData, error: userErr } = await supabase
      .from('users').select('role, is_active').eq('auth_id', user.id).single();
    results.userError  = userErr?.message || null;
    results.userRole   = userData?.role || null;
    results.userActive = userData?.is_active || null;
    if (!userData) return NextResponse.json({ step: 'user_not_found', ...results });

    // 6. Try querying user_wages
    const { data: wages, error: wagesErr } = await supabase
      .from('user_wages').select('*').limit(1);
    results.wagesError = wagesErr?.message || null;
    results.wagesCode  = wagesErr?.code || null;
    results.wagesCount = wages?.length ?? null;

    return NextResponse.json({ step: 'complete', ...results });
  } catch (err) {
    return NextResponse.json({ step: 'exception', message: err.message, ...results });
  }
}
