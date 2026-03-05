// app/api/users/create-auth-account/route.js
// Creates a Supabase Auth account for a PIN-only user and links auth_id
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request) {
  try {
    const { userId, email, newPassword, requestorEmail } = await request.json();

    if (!userId || !email || !newPassword)
      return NextResponse.json({ error: 'userId, email and newPassword required' }, { status: 400 });

    if (newPassword.length < 6)
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY)
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in Vercel environment variables' }, { status: 500 });

    // ── Verify requestor is admin ─────────────────────────────────────────
    const supabaseAnon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: requestor } = await supabaseAnon
      .from('users')
      .select('role, is_active')
      .eq('email', requestorEmail)
      .single();

    if (!requestor?.is_active || requestor.role !== 'admin')
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    // ── Create Supabase Auth account ──────────────────────────────────────
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Check if auth account already exists for this email (unlinked)
    const { data: existingList } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingList?.users?.find(u => u.email === email);

    let authId;

    if (existing) {
      // Auth account exists but auth_id was never linked — just link + set password
      authId = existing.id;
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(authId, { password: newPassword });
      if (pwErr) return NextResponse.json({ error: 'Failed to set password: ' + pwErr.message }, { status: 500 });
    } else {
      // Create brand new auth account
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: newPassword,
        email_confirm: true, // skip confirmation email requirement
      });
      if (createErr) return NextResponse.json({ error: 'Failed to create auth account: ' + createErr.message }, { status: 500 });
      authId = created.user.id;
    }

    // ── Link auth_id back to users table ──────────────────────────────────
    const { error: linkErr } = await supabaseAdmin
      .from('users')
      .update({ auth_id: authId })
      .eq('user_id', userId);

    if (linkErr)
      return NextResponse.json({ error: 'Auth account created but failed to link: ' + linkErr.message }, { status: 500 });

    console.log(`[create-auth-account] ${requestorEmail} created auth for ${email} (auth_id: ${authId})`);

    return NextResponse.json({ success: true, message: `Auth account created and linked for ${email}` });

  } catch (err) {
    console.error('create-auth-account exception:', err);
    return NextResponse.json({ error: 'Internal error: ' + err.message }, { status: 500 });
  }
}
