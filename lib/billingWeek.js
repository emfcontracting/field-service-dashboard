// lib/billingWeek.js
// -----------------------------------------------------------------------------
// EMF billing week: Friday through Thursday. An invoice written today covers
// the LAST COMPLETED week, which becomes due on Friday.
//   Mon 2026-11-23 → Fri 2026-11-13 – Thu 2026-11-19
//   Thu 2026-11-26 → Fri 2026-11-13 – Thu 2026-11-19 (current week not done)
//   Fri 2026-11-27 → Fri 2026-11-20 – Thu 2026-11-26
// Input/output are YYYY-MM-DD strings (Eastern date); pure date math in UTC.
// -----------------------------------------------------------------------------
function toUTC(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function fmt(dt) {
  return dt.toISOString().slice(0, 10);
}

export function lastBillingWeek(todayYmd) {
  const today = toUTC(todayYmd);
  const dow = today.getUTCDay();             // 0 Sun … 4 Thu … 5 Fri
  const back = ((dow - 4 + 7) % 7) || 7;     // days back to the last Thursday BEFORE today
  const end = new Date(today); end.setUTCDate(end.getUTCDate() - back);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 6);
  return { start: fmt(start), end: fmt(end) };
}
