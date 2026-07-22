// lib/priorityCodes.js
// ─────────────────────────────────────────────────────────────────────────────
// CANONICAL CBRE priority codes — single source of truth for the whole system:
// email parsing, dashboard, web mobile, and the Android app (mirrored in
// pcs-mobile/src/lib/priorityCodes.ts).
//
// Only these codes are valid (NOT a continuous P1..P23):
//   P1, P2, P3, P4, P5, P6, P10, P11, P23
// ─────────────────────────────────────────────────────────────────────────────

export const PRIORITY_CODES = {
  P1:  { description: 'Emergency',                              response: '2 Hours',        completion: '8 Hours',        icon: '🚨', color: '#ef4444' },
  P2:  { description: 'Urgent',                                 response: '8 Hours',        completion: '24 Hours',       icon: '⚡', color: '#f97316' },
  P3:  { description: 'Urgent - Non Emergency',                 response: '1 Business Day', completion: '3 Business Days',icon: '🔥', color: '#f59e0b' },
  P4:  { description: 'Non-Urgent, Non-Emergency',              response: '3 Business Days',completion: '7 Business Days',icon: '📢', color: '#eab308' },
  P5:  { description: 'Non-Equipment-Based (handyman work)',    response: '5 Business Days',completion: '14 Business Days',icon: '🛠️', color: '#22c55e' },
  P6:  { description: 'Tech/Vendor Entered Corrective/Reactive',response: '-',              completion: 'Per Tech/Vendor',icon: '🔧', color: '#9ca3af' },
  P10: { description: 'PM',                                     response: '-',              completion: 'As Issued: 7 Days Weekly / 14 Days Bi-Weekly / 30 Days Monthly', icon: '🗓️', color: '#60a5fa' },
  P11: { description: 'PM - Compliance',                        response: '-',              completion: 'Per PM Requirement', icon: '✅', color: '#38bdf8' },
  P23: { description: 'Complaints',                             response: '20 Hours',       completion: '50 Hours',       icon: '📣', color: '#a78bfa' },
};

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
