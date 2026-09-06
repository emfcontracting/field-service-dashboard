// app/api/flags/[id]/route.js
// ─────────────────────────────────────────────────────────────────────────────
// PATCH  /api/flags/[id]   → resolve a flag (only flagger or superadmin)
// DELETE /api/flags/[id]   → delete a flag (only flagger or superadmin)
//
// Caller identity comes from the verified session token (lib/serverAuth).
// Superuser can act on any flag; admins/office_staff only on their OWN flags.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireStaff, SUPERUSER_EMAIL } from '@/lib/serverAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);


// Authorise the signed-in caller (identity comes from the verified token,
// never from the request body). Returns { actor, isSuperadmin } or { error, status }.
function authorise(user) {
  if (!user) return { error: 'Sign in required', status: 401 };
  if (!['admin', 'office_staff', 'office'].includes(user.role)) {
    return { error: 'Only admins and office staff can modify flags', status: 403 };
  }
  return { actor: user, isSuperadmin: (user.email || '').toLowerCase() === SUPERUSER_EMAIL };
}

// Verify the actor can touch THIS flag. Returns { flag } or { error, status }.
async function loadFlagAndCheckOwnership(flagId, actor, isSuperadmin) {
  const { data: flag, error } = await supabase
    .from('work_order_flags')
    .select('*')
    .eq('flag_id', flagId)
    .single();
  if (error || !flag) return { error: 'Flag not found', status: 404 };
  // Superadmin can do anything; otherwise only the flagger.
  if (!isSuperadmin && flag.flagged_by !== actor.user_id) {
    return { error: 'You can only modify your own flags', status: 403 };
  }
  return { flag };
}

// ── PATCH /api/flags/[id] — Resolve a flag ─────────────────────────────────
export async function PATCH(request, { params }) {
  const session = await requireStaff(request);
  if (!session.ok) return session.response;
  try {
    const { id } = await params;
    const body = await request.json();
    const { resolution_note } = body;

    const auth = authorise(session.principal.user);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const check = await loadFlagAndCheckOwnership(id, auth.actor, auth.isSuperadmin);
    if (check.error) return NextResponse.json({ error: check.error }, { status: check.status });

    if (check.flag.status === 'resolved') {
      return NextResponse.json({ error: 'Flag is already resolved' }, { status: 400 });
    }

    const { data: updated, error: updErr } = await supabase
      .from('work_order_flags')
      .update({
        status: 'resolved',
        resolved_by: auth.actor.user_id,
        resolved_at: new Date().toISOString(),
        resolution_note: resolution_note?.trim() || null,
      })
      .eq('flag_id', id)
      .select(`
        *,
        flagger:users!work_order_flags_flagged_by_fkey(user_id, first_name, last_name, role),
        resolver:users!work_order_flags_resolved_by_fkey(user_id, first_name, last_name)
      `)
      .single();

    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ success: true, flag: updated });
  } catch (e) {
    console.error('[flags PATCH] error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── DELETE /api/flags/[id] — Hard delete (flagger or superadmin) ───────────
// Useful for "I flagged this by accident" scenarios. Resolved flags can also
// be deleted to keep history tidy.
export async function DELETE(request, { params }) {
  const session = await requireStaff(request);
  if (!session.ok) return session.response;
  try {
    const { id } = await params;
    const auth = authorise(session.principal.user);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const check = await loadFlagAndCheckOwnership(id, auth.actor, auth.isSuperadmin);
    if (check.error) return NextResponse.json({ error: check.error }, { status: check.status });

    const { error: delErr } = await supabase
      .from('work_order_flags')
      .delete()
      .eq('flag_id', id);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
