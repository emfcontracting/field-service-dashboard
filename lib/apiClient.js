// lib/apiClient.js
// -----------------------------------------------------------------------------
// fetch() wrapper that attaches the caller's credentials as
// "Authorization: Bearer <token>" so API routes can verify who is calling
// (see lib/serverAuth.js).
//
//   Office/admin dashboard → Supabase Auth session access_token
//   Technician browser app → app-session token from /api/auth/login
//                            (stored in localStorage under APP_TOKEN_KEY)
//
//   import { apiFetch } from '@/lib/apiClient';
//   const res = await apiFetch('/api/users/delete', { method: 'POST', body: ... });
//
// Drop-in replacement for fetch — same arguments, same Response.
// -----------------------------------------------------------------------------
import { getSupabase } from './supabase';

export const APP_TOKEN_KEY = 'appToken';

export function getAppToken() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(APP_TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

export function setAppToken(token) {
  try {
    if (token) localStorage.setItem(APP_TOKEN_KEY, token);
    else localStorage.removeItem(APP_TOKEN_KEY);
  } catch { /* storage unavailable */ }
}

export async function getAccessToken() {
  try {
    const { data: { session } } = await getSupabase().auth.getSession();
    if (session?.access_token) return session.access_token;
  } catch { /* no supabase session */ }
  return getAppToken();
}

export async function apiFetch(input, init = {}) {
  const token = await getAccessToken();
  const headers = new Headers(init.headers || {});
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}

export default apiFetch;
