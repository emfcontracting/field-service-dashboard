// lib/priorityCodes.js
// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL CBRE priority codes — single source of truth for the whole system:
// email parsing, dashboard, web mobile, and the Android app (mirrored in
// pcs-mobile/src/lib/priorityCodes.ts).
//
// Only these codes are valid (NOT a continuous P1..P23):
//   P1, P2, P3, P4, P5, P6, P7, P10, P11, P23
//
// P7 was missing until 09.09.2026. It is not a severity like the others — it is
// CBRE's SLA-extension marker, described in the Supplier Training Guide beside
// the completion targets: "P7 is used to extend SLA where quote approval and/or
// material lead time is pushing completion past SLA". Without it here,
// extractPriorityCode() returned null for a P7 work order and it lost its code,
// its badge and its targets in one go — the work order looked like it had no
// priority at all, on exactly the jobs CBRE had agreed to give us more time on.
// ─────────────────────────────────────────────────────────────────────────────

// SLA targets, straight off CBRE's own table (Supplier Training Guide 18.06.2025,
// "Service Level Agreements (SLA) — Completion Expectations"):
//
//   Priority  Description                        Dispatch   Response      Completion
//   P1        Emergency                          10 min     2 hrs         8 hrs
//   P3        Urgent - non emergency             60 min     24 (1 day)    72 (3 days)
//   P4        Non Urgent, Non-Emergency          60 min     72 (3 days)   168 (7 days)
//   P5        Non Equipment based (handyman)     1 day      120 (5 days)  336 (14 days)
//   P6        Tech/Vendor Entered Corrective     —          —             Per Tech/Vendor
//   P10       PM                                 —          —             30 days
//   P11       PM - Compliance                    —          —             Per PM Requirement
//
// TWO CORRECTIONS THAT TABLE FORCED (10.09.2026):
//   • These are CALENDAR hours, not business days. We had P3 as "1 Business
//     Day / 3 Business Days", P4 as "3 / 7 Business Days", P5 as "5 / 14
//     Business Days". CBRE's own numbers are 24/72, 72/168 and 120/336 hours —
//     plain division by 24. Counting weekends out of a deadline CBRE counts
//     them into made every routine job look younger than CBRE sees it.
//   • P2 and P23 are NOT in CBRE's published table at all. Their targets here
//     come from us, not from CBRE, and are marked accordingly.
//
// `responseHours` / `completionHours` are the numbers to compute with; the
// strings stay for display. null means CBRE publishes no target.
export const PRIORITY_CODES = {
  P1:  { description: 'Emergency',                              response: '2 Hours',   completion: '8 Hours',    responseHours: 2,   completionHours: 8,   dispatchMinutes: 10, icon: '🚨', color: '#ef4444' },
  // Not in CBRE's SLA table — our own numbers, kept because the dispatch mails
  // do use P2 and something has to be measured against.
  P2:  { description: 'Urgent',                                 response: '8 Hours',   completion: '24 Hours',   responseHours: 8,   completionHours: 24,  dispatchMinutes: null, ours: true, icon: '⚡', color: '#f97316' },
  P3:  { description: 'Urgent - Non Emergency',                 response: '24 Hours (1 day)',  completion: '72 Hours (3 days)',  responseHours: 24,  completionHours: 72,  dispatchMinutes: 60, icon: '🔥', color: '#f59e0b' },
  P4:  { description: 'Non-Urgent, Non-Emergency',              response: '72 Hours (3 days)', completion: '168 Hours (7 days)', responseHours: 72,  completionHours: 168, dispatchMinutes: 60, icon: '📢', color: '#eab308' },
  P5:  { description: 'Non-Equipment-Based (handyman work)',    response: '120 Hours (5 days)',completion: '336 Hours (14 days)',responseHours: 120, completionHours: 336, dispatchMinutes: 1440, icon: '🛠️', color: '#22c55e' },
  P6:  { description: 'Tech/Vendor Entered Corrective/Reactive',response: '-',         completion: 'Per Tech/Vendor', responseHours: null, completionHours: null, dispatchMinutes: null, icon: '🔧', color: '#9ca3af' },
  // Not a severity: CBRE moves a work order to P7 to extend its SLA while a
  // quote is with the approver or material is on lead time. There is no target
  // to miss, so `slaExtended` takes it out of the on-time completion rate
  // rather than scoring it against a deadline CBRE itself lifted.
  P7:  { description: 'SLA Extended (quote approval / material lead time)', response: '-', completion: 'Extended by CBRE', responseHours: null, completionHours: null, dispatchMinutes: null, slaExtended: true, icon: '⏸', color: '#38bdf8' },
  P10: { description: 'PM',                                     response: '-',         completion: '30 Days',    responseHours: null, completionHours: 720, dispatchMinutes: null, icon: '🗓️', color: '#60a5fa' },
  P11: { description: 'PM - Compliance',                        response: '-',         completion: 'Per PM Requirement', responseHours: null, completionHours: null, dispatchMinutes: null, icon: '✅', color: '#38bdf8' },
  // Also not in CBRE's table — our own numbers.
  P23: { description: 'Complaints',                             response: '20 Hours',  completion: '50 Hours',   responseHours: 20,  completionHours: 50,  dispatchMinutes: null, ours: true, icon: '📣', color: '#a78bfa' },
};

/** CBRE's completion target for this priority, in hours. null when none is published. */
export function completionHoursFor(raw) {
  const code = extractPriorityCode(raw);
  return code ? (PRIORITY_CODES[code].completionHours ?? null) : null;
}

/** CBRE's response target for this priority, in hours. null when none is published. */
export function responseHoursFor(raw) {
  const code = extractPriorityCode(raw);
  return code ? (PRIORITY_CODES[code].responseHours ?? null) : null;
}


// Legacy bucket values from the old email parser (emergency/high/medium/low).
const LEGACY = {
  emergency: { label: 'Emergency', icon: '🚨', color: '#ef4444' },
  urgent:    { label: 'Urgent',    icon: '⚡', color: '#f97316' },
  high:      { label: 'High',      icon: '⚡', color: '#f97316' },
  medium:    { label: 'Medium',    icon: '📢', color: '#eab308' },
  low:       { label: 'Low',       icon: '🟢', color: '#22c55e' },
  normal:    { label: 'Normal',    icon: '⚪', color: '#9ca3af' },
};

// Extract the canonical code (P1..P23) from any stored/free-text value.
export function extractPriorityCode(raw) {
  if (!raw) return null;
  const m = String(raw).trim().match(/\bP(\d{1,2})\b/i);
  if (!m) return null;
  const code = `P${parseInt(m[1], 10)}`;
  return PRIORITY_CODES[code] ? code : null;
}

// Display info used by dashboard + web mobile (and mirrored in the app).
export function getPriorityInfo(raw) {
  const code = extractPriorityCode(raw);
  if (code) {
    const d = PRIORITY_CODES[code];
    const label = `${code} · ${d.description}`;
    return { code, description: d.description, label, badge: `${d.icon} ${label}`, color: d.color, response: d.response, completion: d.completion };
  }
  const raw2 = (raw && String(raw).trim()) || '';
  const legacy = LEGACY[raw2.toLowerCase()];
  if (legacy) {
    return { code: null, description: legacy.label, label: legacy.label, badge: `${legacy.icon} ${legacy.label}`, color: legacy.color, response: '', completion: '' };
  }
  return { code: null, description: raw2 || 'Normal', label: raw2 || 'Normal', badge: raw2 ? `⚪ ${raw2}` : '⚪ Normal', color: '#9ca3af', response: '', completion: '' };
}

// True when CBRE has lifted the deadline on this work order (P7 today). Such a
// work order has no target to be late against, so KPI code must not score it.
export function isSlaExtended(raw) {
  const code = extractPriorityCode(raw);
  return !!(code && PRIORITY_CODES[code]?.slaExtended);
}

export function getPriorityLabel(raw) {
  return getPriorityInfo(raw).label;
}

// ── PARSER SIDE ──────────────────────────────────────────────────────────────
// Extract the real priority CODE from a dispatch email so it can be STORED
// verbatim (e.g. "P1"), preserving the exact code instead of collapsing it into
// emergency/high/medium/low buckets. Returns "P1".."P23" or null if not found.
export function parsePriorityCode(bodyText, subject) {
  const sources = [String(bodyText || ''), String(subject || '')];
  for (const s of sources) {
    // "Priority: P1 - Emergency", "Priority_P10", "Priority P23", etc.
    // Capture only the digits so parseInt works (the "P" is outside the group).
    const m = s.match(/Priority[:\s_\-]*?P(\d{1,2})\b/i) ||
              s.match(/\bP(\d{1,2})\b\s*[-–]\s*(?:Emergency|Urgent|Non|PM|Complaint|Handyman|Tech)/i);
    if (m) {
      const code = `P${parseInt(m[1], 10)}`;
      if (PRIORITY_CODES[code]) return code;
    }
  }
  return null;
}
