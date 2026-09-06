// lib/dates.js
// -----------------------------------------------------------------------------
// THE date/time parsing and formatting for FSM. Everything the business does
// happens in Eastern time; the database and the servers (Vercel) run in UTC.
// Two traps kept producing dates that were a day early or times 4–5 h late:
//
//   1. DATE columns (date_entered, date_completed, invoice_date, due_date,
//      cmp_date, work_date, …) come back as 'YYYY-MM-DD'. `new Date('2026-09-05')`
//      is UTC midnight = 8 PM the evening BEFORE in Eastern time, so
//      `.toLocaleDateString()` printed 9/4 for a 9/5 record.
//   2. Some timestamp columns were `timestamp` WITHOUT time zone holding UTC
//      (work_orders.time_in / time_out / assigned_to_field_at / created_at /
//      updated_at, users.*, work_order_assignments.created_at). PostgREST
//      returns them without "Z", and `new Date()` parsed them as local time.
//      Migration 2026-09-06_timestamptz_naive_columns.sql converts them; the
//      parser here treats a tz-less timestamp as UTC either way.
//
// Rules: parse with parseDate(); format with fmtDate*/fmtDateTime* (always in
// ET); compare/sort with the Date objects. Never `new Date(row.some_date)`.
// Pure, no I/O, safe on server and client.
// -----------------------------------------------------------------------------

export const CBRE_TZ = 'America/New_York';
export const ET = CBRE_TZ;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const NAIVE_TS = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;

/** { y, m (1-12), d, h (0-23), min, s } of an instant as an Eastern clock shows it. */
export function tzParts(d, tz = ET) {
  if (d == null || d === '') return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const o = {};
  for (const p of f.formatToParts(dt)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, min: +o.minute, s: +o.second };
}

/** The instant at which an Eastern clock shows y-m-d h:min (DST-aware). */
export function tzDate(y, m, d, h = 0, min = 0, tz = ET) {
  const guess = Date.UTC(y, m - 1, d, h, min, 0, 0);
  const p = tzParts(new Date(guess), tz);
  const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, 0, 0);
  return new Date(guess - (shown - guess));
}

/**
 * Any DB value → Date (or null).
 *   'YYYY-MM-DD'            → midnight Eastern of that day
 *   'YYYY-MM-DDTHH:MM:SS'   → UTC (tz-less timestamps hold UTC)
 *   ISO with offset / Date / epoch number → as is
 */
export function parseDate(v, tz = ET) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (typeof v === 'number') { const d = new Date(v); return isNaN(d.getTime()) ? null : d; }
  const s = String(v).trim();
  if (DATE_ONLY.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return tzDate(y, m, d, 0, 0, tz);
  }
  const dt = new Date(NAIVE_TS.test(s) ? s.replace(' ', 'T') + 'Z' : s);
  return isNaN(dt.getTime()) ? null : dt;
}
export const parseTs = parseDate;
export const parseLocalDate = parseDate;   // legacy name used by a few views

/** 'YYYY-MM-DD' of an instant in Eastern time (what a DATE column should hold). */
export function dateKeyET(d = new Date(), tz = ET) {
  const p = tzParts(d, tz);
  return p ? `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}` : null;
}
export const todayET = () => dateKeyET(new Date());

/** Midnight Eastern of the day containing `d` (for day arithmetic). */
export function startOfDayET(d = new Date(), tz = ET) {
  const p = tzParts(d, tz);
  return p ? tzDate(p.y, p.m, p.d, 0, 0, tz) : null;
}

/** Whole Eastern calendar days from `from` to `to` (default now). */
export function daysBetweenET(from, to = new Date()) {
  const a = startOfDayET(parseDate(from)), b = startOfDayET(parseDate(to));
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

// ── formatting (always Eastern) ────────────────────────────────────────────
const fmt = (v, opts, fallback) => {
  const d = parseDate(v);
  return d ? new Intl.DateTimeFormat('en-US', { timeZone: ET, ...opts }).format(d) : fallback;
};

/** 9/5/2026 (the `toLocaleDateString()` look, but the right day). */
export const fmtDate = (v, fallback = '—') => fmt(v, { year: 'numeric', month: 'numeric', day: 'numeric' }, fallback);
/** 09/05/2026 */
export const fmtDateNum = (v, fallback = '—') => fmt(v, { year: 'numeric', month: '2-digit', day: '2-digit' }, fallback);
/** Sep 5, 2026 */
export const fmtDateMed = (v, fallback = '—') => fmt(v, { year: 'numeric', month: 'short', day: 'numeric' }, fallback);
/** Sep 5 */
export const fmtDateShort = (v, fallback = '—') => fmt(v, { month: 'short', day: 'numeric' }, fallback);
/** 09/05 */
export const fmtMonthDay = (v, fallback = '—') => fmt(v, { month: '2-digit', day: '2-digit' }, fallback);
/** 9/5/2026, 10:11 AM */
export const fmtDateTime = (v, fallback = '—') => fmt(v, { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }, fallback);
/** Sep 5, 10:11 AM */
export const fmtDateTimeShort = (v, fallback = '—') => fmt(v, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }, fallback);
/** 10:11 AM */
export const fmtTime = (v, fallback = '—') => fmt(v, { hour: 'numeric', minute: '2-digit' }, fallback);
/** MM/DD/YYYY — what CBRE's Smartsheet form date inputs accept. */
export const fmtDateMDY = (v) => fmtDateNum(v, null);

/** Custom Intl options, still pinned to Eastern time. */
export const fmtET = (v, opts = {}, fallback = '—') => fmt(v, opts, fallback);
