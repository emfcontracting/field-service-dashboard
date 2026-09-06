// lib/serverAuth.js
// -----------------------------------------------------------------------------
// Central request authentication for API routes (server only).
//
// Principals:
//   dashboard  – Supabase Auth JWT (office/admin web app). Header:
//                Authorization: Bearer <access_token>
//   app        – Signed app-session token issued by /api/auth/login for the
//                technician apps (native + browser). Same header.
//   cron       – Vercel Cron / internal trigger. Header:
//                Authorization: Bearer <CRON_SECRET>
//   hook       – Supabase Database Webhook. Header: x-hook-secret
//
// Every guard returns { ok: true, principal } or { ok: false, response } —
// usage in a route:
//
//   const auth = await requireStaff(request);
//   if (!auth.ok) return auth.response;
//
// Nothing here trusts the request body (no more requestorEmail) and nothing
// here reads secrets from query strings.
// -----------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const STAFF_ROLES = ['admin', 'office_staff', 'office'];
export const SUPERUSER_EMAIL = (process.env.SUPERUSER_EMAIL || 'jones.emfcontracting@gmail.com').toLowerCase();

const USER_COLS = 'user_id, auth_id, email, first_name, last_name, role, is_active';
const APP_TOKEN_PREFIX = 'pcs1.';
const APP_TOKEN_TTL_DAYS = 90;

// ---------------------------------------------------------------- clients ----
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------- helpers ----
export function bearerToken(request) {
  const h = request.headers.get('authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

function deny(status, message) {
  return { ok: false, response: NextResponse.json({ error: message }, { status }) };
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ab = Buffer.from(a), bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** Strip anything a client must never see from a users row. */
export function publicUser(row) {
  if (!row) return null;
  // eslint-disable-next-line no-unused-vars
  const { pin, password, password_hash, ...rest } = row;
  return rest;
}

// ------------------------------------------------------------- app tokens ----
function appSecret() {
  const s = process.env.APP_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error('APP_SESSION_SECRET not configured');
  return crypto.createHash('sha256').update('pcs-app-session:' + s).digest();
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s) {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Issue a signed app-session token for a technician (used by /api/auth/login). */
export function signAppToken(user) {
  const payload = {
    uid: user.user_id,
    role: user.role || null,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + APP_TOKEN_TTL_DAYS * 86400,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', appSecret()).update(body).digest());
  return `${APP_TOKEN_PREFIX}${body}.${sig}`;
}

export function verifyAppToken(token) {
  if (!token || !token.startsWith(APP_TOKEN_PREFIX)) return null;
  const [body, sig] = token.slice(APP_TOKEN_PREFIX.length).split('.');
  if (!body || !sig) return null;
  const expected = b64url(crypto.createHmac('sha256', appSecret()).update(body).digest());
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString('utf8'));
    if (!payload.uid || !payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// ------------------------------------------------------- principal lookup ----
/** Cron / internal trigger (Vercel sends Authorization: Bearer CRON_SECRET). */
export function isCronRequest(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed – no secret, no cron access
  return safeEqual(bearerToken(request) || '', secret);
}

/**
 * Resolve the caller. Returns null when unauthenticated.
 *   { kind: 'cron' }
 *   { kind: 'dashboard', user: {...users row} }
 *   { kind: 'app',       user: {...users row} }
 */
export async function getPrincipal(request) {
  const token = bearerToken(request);
  if (!token) return null;

  if (isCronRequest(request)) return { kind: 'cron', user: null };

  // Technician app token
  if (token.startsWith(APP_TOKEN_PREFIX)) {
    const payload = verifyAppToken(token);
    if (!payload) return null;
    const { data } = await serviceClient().from('users').select(USER_COLS).eq('user_id', payload.uid).maybeSingle();
    if (!data || data.is_active === false) return null;
    return { kind: 'app', user: data };
  }

  // Supabase Auth JWT (dashboard)
  try {
    const { data: { user }, error } = await anonClient().auth.getUser(token);
    if (error || !user) return null;
    const { data } = await serviceClient().from('users').select(USER_COLS).eq('auth_id', user.id).maybeSingle();
    if (!data || data.is_active === false) return null;
    return { kind: 'dashboard', user: { ...data, email: data.email || user.email }, authUser: user };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ guards ----
/** Any signed-in person (dashboard user of any role, or technician app). */
export async function requireUser(request) {
  const p = await getPrincipal(request);
  if (!p || p.kind === 'cron') return deny(401, 'Sign in required');
  return { ok: true, principal: p };
}

/** Any signed-in person, or an internal server-side call carrying CRON_SECRET. */
export async function requireUserOrCron(request) {
  if (isCronRequest(request)) return { ok: true, principal: { kind: 'cron', user: null } };
  return requireUser(request);
}

/** Office staff or admin (dashboard). */
export async function requireStaff(request) {
  const p = await getPrincipal(request);
  if (!p || !p.user) return deny(401, 'Sign in required');
  if (!STAFF_ROLES.includes(p.user.role)) return deny(403, 'Office/admin access required');
  return { ok: true, principal: p };
}

/** Admin only. Pass { superuser: true } to restrict to the configured superuser. */
export async function requireAdmin(request, { superuser = false } = {}) {
  const p = await getPrincipal(request);
  if (!p || !p.user) return deny(401, 'Sign in required');
  if (p.user.role !== 'admin') return deny(403, 'Admin access required');
  if (superuser && (p.user.email || '').toLowerCase() !== SUPERUSER_EMAIL) return deny(403, 'Superuser access required');
  return { ok: true, principal: p };
}

/** Scheduled job only (Vercel Cron / backend trigger with CRON_SECRET). */
export async function requireCron(request) {
  if (!isCronRequest(request)) return deny(401, 'Unauthorized');
  return { ok: true, principal: { kind: 'cron', user: null } };
}

/** Scheduled job, or a signed-in office/admin user pressing the button manually. */
export async function requireCronOrStaff(request) {
  if (isCronRequest(request)) return { ok: true, principal: { kind: 'cron', user: null } };
  return requireStaff(request);
}

/** Scheduled job or admin. */
export async function requireCronOrAdmin(request) {
  if (isCronRequest(request)) return { ok: true, principal: { kind: 'cron', user: null } };
  return requireAdmin(request);
}

/** Supabase Database Webhook (x-hook-secret must match NOTIFY_HOOK_SECRET). */
export function requireHook(request) {
  const secret = process.env.NOTIFY_HOOK_SECRET;
  if (!secret) return deny(503, 'NOTIFY_HOOK_SECRET not configured');
  if (!safeEqual(request.headers.get('x-hook-secret') || '', secret)) return deny(401, 'Unauthorized');
  return { ok: true, principal: { kind: 'hook', user: null } };
}

/** Absolute origin of this deployment (for server-side calls to our own routes). */
export function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://field-service-dashboard.vercel.app'
  );
}

/** Headers to forward when a route calls another internal route as the cron. */
export function cronHeaders(extra = {}) {
  return { ...extra, Authorization: `Bearer ${process.env.CRON_SECRET || ''}` };
}
