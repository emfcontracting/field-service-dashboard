// app/api/users/reset-password/route.js
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/serverAuth';

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const { userId, newPassword } = body;
    const requestorEmail = auth.principal.user.email;

    if (!userId || !newPassword)
      return NextResponse.json({ error: 'userId and newPassword required' }, { status: 400 });

    if (newPassword.length < 6)
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    // Requestor already verified as an active admin by requireAdmin() above.
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // ── Get target user's auth_id ────────────────────────────────────────────
    const { data: targetUser, error: targetErr } = await supabaseAnon
      .from('users')
      .select('auth_id, email, first_name, last_name')
      .eq('user_id', userId)
      .single();

    if (targetErr || !targetUser)
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });

    if (!targetUser.auth_id)
      return NextResponse.json({
        error: `${targetUser.first_name} does not have an auth account (PIN-only user). Create one in Supabase Auth first.`
      }, { status: 400 });

    // ── Require service role key for admin.updateUserById ───────────────────
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        error: 'SUPABASE_SERVICE_ROLE_KEY is not set in Vercel environment variables. Add it to use password reset.'
      }, { status: 500 });
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.auth_id,
      { password: newPassword }
    );

    if (resetErr) {
      console.error('Password reset error:', resetErr);
      return NextResponse.json({ error: 'Reset failed: ' + resetErr.message }, { status: 500 });
    }

    console.log(`[reset-password] ${requestorEmail} reset password for ${targetUser.email}`);

    return NextResponse.json({
      success: true,
      message: `Password reset for ${targetUser.first_name} ${targetUser.last_name}`
    });

  } catch (err) {
    console.error('reset-password exception:', err);
    return NextResponse.json({ error: 'Internal error: ' + err.message }, { status: 500 });
  }
}
