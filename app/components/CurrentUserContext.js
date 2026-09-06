// app/components/CurrentUserContext.js
// -----------------------------------------------------------------------------
// THE signed-in dashboard user. AppShell resolves it once (auth.getUser() →
// users row by auth_id, active, role-gated) and provides it here; pages and
// components read it with useCurrentUser() instead of repeating the
// auth.getUser + users lookup (dashboard, settings, users, modals … each had
// their own copy, some without the is_active / role checks the shell makes).
//
//   const { user, isAdmin, isSuperuser, refresh } = useCurrentUser();
//
// `user` is the users row (user_id, email, role, first_name …) or null while
// loading / outside AppShell. `refresh()` re-reads the row (after the user
// edits their own profile). Components rendered outside AppShell (login, the
// technicians' mobile app) get nulls — they have their own auth.
// -----------------------------------------------------------------------------
'use client';

import { createContext, useContext, useMemo } from 'react';

export const SUPERUSER_EMAIL = 'jones.emfcontracting@gmail.com';
export const OFFICE_ROLES = ['admin', 'office_staff'];

const CurrentUserContext = createContext({ user: null, loading: true, refresh: async () => null });

export function CurrentUserProvider({ user, loading = false, refresh, children }) {
  const value = useMemo(() => ({ user: user || null, loading, refresh: refresh || (async () => user || null) }), [user, loading, refresh]);
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const { user, loading, refresh } = useContext(CurrentUserContext);
  return {
    user,
    loading,
    refresh,
    isAdmin: user?.role === 'admin',
    isOffice: OFFICE_ROLES.includes(user?.role),
    isSuperuser: !!user?.email && user.email.toLowerCase() === SUPERUSER_EMAIL,
  };
}
