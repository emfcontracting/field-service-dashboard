// app/components/useRequireRole.js
// ─────────────────────────────────────────────────────────────────────────────
// The login/role gate for pages that live OUTSIDE AppShell.
//
// Everything under /dashboard gets its gate from app/dashboard/layout.js, which
// wraps it in AppShell: auth.getUser() → users row by auth_id → is_active →
// role check → otherwise back to /login. The two pages under /admin had no
// layout and no gate of their own. Their links in Settings sit in a
// superuser-only block, so nobody else ever saw the button — but the pages
// themselves answered to anyone who typed the URL, logged in or not, because
// they read Supabase with the anon key and those tables have no RLS.
// Found on 2026-11-03 while adding the self-review filter.
//
// This is an application gate, not a security boundary: the anon key is in the
// client bundle and the tables are still open to it. It closes "knowing the
// URL is enough", which is what was actually wrong. Real protection is RLS on
// the tables, and that is its own piece of work.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { SUPERUSER_EMAIL } from './CurrentUserContext';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

/**
 * Blocks until the signed-in user is known and allowed.
 *   const { ready, user } = useRequireRole(['admin'], { superuserOnly: true });
 *   if (!ready) return <GateScreen />;
 * `user` is the full users row, so a page that needs "who am I" gets it here
 * instead of repeating the lookup.
 */
export function useRequireRole(allowedRoles = ['admin'], { superuserOnly = false } = {}) {
  const router = useRouter();
  const [state, setState] = useState({ ready: false, user: null });
  const rolesKey = allowedRoles.join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();
        if (error || !authUser) { router.replace('/login'); return; }

        const { data: row } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', authUser.id)
          .eq('is_active', true)
          .maybeSingle();
        if (!row) { router.replace('/login'); return; }

        const allowed = superuserOnly
          ? String(row.email || '').toLowerCase() === SUPERUSER_EMAIL
          : rolesKey.split(',').includes(row.role);
        // Signed in but not entitled: back to their own dashboard, not to the
        // login screen — they are not the problem, the URL is.
        if (!allowed) { router.replace('/dashboard'); return; }

        if (!cancelled) setState({ ready: true, user: row });
      } catch {
        router.replace('/login');
      }
    })();
    return () => { cancelled = true; };
  }, [router, rolesKey, superuserOnly]);

  return state;
}

/** The placeholder shown while the gate is still deciding. */
export function GateScreen({ label = 'Checking access…' }) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-slate-400 text-sm">{label}</div>
    </div>
  );
}
