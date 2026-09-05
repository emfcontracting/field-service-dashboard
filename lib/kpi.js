// lib/kpi.js
// ─────────────────────────────────────────────────────────────────────────────
// KPI math shared by the dashboard Performance view and the mobile
// "My Performance" screen. Two views of every time metric:
//
//   RAW      — how CBRE sees it: measured against the LATEST target
//              (work_orders.target_completion_at, kept current by the email
//              import re-dispatch handling and the target history).
//   ADJUSTED — pauses subtracted: windows in work_order_clock_pauses
//              (quote awaiting CBRE approver, equipment on backorder, …)
//              push the effective target out. This is the fair view — the
//              pause rows double as the compliance defense trail.
//
// All functions are pure; callers load rows and pass them in.
// ─────────────────────────────────────────────────────────────────────────────

const MS_H = 3600000;
const MS_D = 86400000;

export const toDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
};

// Manually excluded tickets (kpi_excluded) never enter any KPI computation.
export const isKpiExcluded = (wo) => wo?.kpi_excluded === true;
export const kpiEligible = (wos) => (wos || []).filter((w) => !isKpiExcluded(w));

// Sum of pause time (ms) overlapping [from, to]. Open pauses run until `to`.
export function pauseMsInWindow(pauses, from, to) {
  if (!pauses?.length || !from || !to || to <= from) return 0;
  let ms = 0;
  for (const p of pauses) {
    const s = toDate(p.started_at);
    if (!s) continue;
    const e = toDate(p.ended_at) || to;
    const lo = Math.max(s.getTime(), from.getTime());
    const hi = Math.min(e.getTime(), to.getTime());
    if (hi > lo) ms += hi - lo;
  }
  return ms;
}

// Group pause rows by wo_id once.
export function pausesByWo(pauseRows) {
  const map = new Map();
  for (const p of pauseRows || []) {
    if (!map.has(p.wo_id)) map.set(p.wo_id, []);
    map.get(p.wo_id).push(p);
  }
  return map;
}

// Effective (adjusted) target completion: latest target + pause time between
// dispatch and completion (or now, for open WOs).
export function adjustedTargetCompletion(wo, pauses, now = new Date()) {
  const target = toDate(wo.target_completion_at);
  if (!target) return null;
  const from = toDate(wo.date_entered) || target;
  const to = toDate(wo.date_completed) || now;
  return new Date(target.getTime() + pauseMsInWindow(pauses, from, to));
}

// On-time verdict for a COMPLETED wo. Returns true/false, or null when it
// can't be judged (no target or no completion date).
export function onTimeCompletion(wo, pauses, { adjusted = true, now = new Date() } = {}) {
  const done = toDate(wo.date_completed);
  const target = adjusted ? adjustedTargetCompletion(wo, pauses, now) : toDate(wo.target_completion_at);
  if (!done || !target) return null;
  return done <= target;
}

// Hours from dispatch to the tech's first check-in (work_orders.time_in is set
// once, at the first-ever check-in). Null when either side is missing.
export function responseHours(wo) {
  const entered = toDate(wo.date_entered);
  const firstIn = toDate(wo.time_in);
  if (!entered || !firstIn || firstIn < entered) return null;
  return (firstIn - entered) / MS_H;
}

// Countdown for an OPEN wo: ms until the (adjusted) target, plus whether the
// clock is currently paused and why.
export function timeToTarget(wo, pauses, now = new Date()) {
  const target = adjustedTargetCompletion(wo, pauses, now);
  if (!target) return null;
  const open = (pauses || []).find((p) => !p.ended_at);
  return {
    target,
    msLeft: target.getTime() - now.getTime(),
    daysLeft: (target.getTime() - now.getTime()) / MS_D,
    paused: !!open,
    pauseReason: open?.reason || null,
  };
}

export function median(values) {
  const v = values.filter((x) => x !== null && x !== undefined && !isNaN(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// On-time rate over a set of completed WOs. Skips unjudgeable ones.
export function onTimeRate(wos, pauseMap, { adjusted = true, now = new Date() } = {}) {
  let ok = 0, n = 0;
  for (const wo of wos) {
    if (isKpiExcluded(wo)) continue;
    const r = onTimeCompletion(wo, pauseMap.get(wo.wo_id) || [], { adjusted, now });
    if (r === null) continue;
    n++;
    if (r) ok++;
  }
  return { n, ok, rate: n ? ok / n : null };
}

// Rate grouped by an arbitrary key (priority, facility, tech, …).
export function onTimeRateBy(wos, pauseMap, keyFn, opts) {
  const groups = new Map();
  for (const wo of wos) {
    const key = keyFn(wo) || '—';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(wo);
  }
  const out = [];
  for (const [key, list] of groups) {
    out.push({ key, ...onTimeRate(list, pauseMap, opts) });
  }
  return out.sort((a, b) => b.n - a.n);
}

// ISO-week key (Monday) for grouping.
export function weekKey(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

// Weekly on-time series for the last `weeks` weeks (by completion date).
export function weeklyOnTime(wos, pauseMap, { weeks = 12, adjusted = true, now = new Date() } = {}) {
  const start = new Date(now.getTime() - weeks * 7 * MS_D);
  const byWeek = new Map();
  for (const wo of wos) {
    if (isKpiExcluded(wo)) continue;
    const done = toDate(wo.date_completed);
    if (!done || done < start) continue;
    const key = weekKey(done);
    if (!byWeek.has(key)) byWeek.set(key, []);
    byWeek.get(key).push(wo);
  }
  return [...byWeek.entries()]
    .map(([key, list]) => ({ week: key, ...onTimeRate(list, pauseMap, { adjusted, now }) }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

// Facility code from the building string ("SCSMV - SUMMERVILLE CENTER" → SCSMV).
export function facilityOf(wo) {
  const b = (wo.building || '').trim();
  const m = b.match(/^([A-Z]{4,6})\b/);
  return m ? m[1] : (b.split(/\s|-/)[0] || '—');
}

export const PAUSE_REASON_LABELS = {
  cbre_approval: '⏸ Awaiting CBRE approver',
  equipment_backorder: '⏸ Equipment on backorder',
  parts_ordered: '⏸ Waiting for parts',
  site_access: '⏸ No site access',
  return_trip_wait: '⏸ Awaiting return-trip release',
  other: '⏸ Paused',
};
