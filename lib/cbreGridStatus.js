// lib/cbreGridStatus.js
// ─────────────────────────────────────────────────────────────────────────────
// How a CBRE dispatch-lifecycle code is shown. These come from the CBRE
// open-orders export and live in work_orders.cbre_grid_status.
//
// They are NOT the same thing as cbre_status (our record of the CBRE
// relationship: quote_submitted, quote_approved, invoice_rejected …) and NOT
// the same as cbre_posting_status (CPW → CMP, after the completion is
// reported). Three different questions:
//
//   status              — where OUR crew is with the job
//   cbre_status         — where the quote/invoice conversation with CBRE stands
//   cbre_posting_status — how far CBRE is through paying it
//   cbre_grid_status    — what CBRE's open list said the last time we looked
//
// Only QUA carries a fact that belongs in cbre_status, and the grid import
// moves that one across. Everything here is display only.
// ─────────────────────────────────────────────────────────────────────────────

export const CBRE_GRID_STATUS = {
  D:   { label: 'Dispatched',            short: 'D',   emoji: '📨', badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  DAK: { label: 'Dispatched, Acknowledged', short: 'DAK', emoji: '✔️', badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  DEA: { label: 'Dispatched, ETA Set',   short: 'DEA', emoji: '🕒', badge: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  DAR: { label: 'Tech arrived on site',  short: 'DAR', emoji: '📍', badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  QUA: { label: 'Quote Approved',        short: 'QUA', emoji: '✅', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  // The two that mean someone has to do something.
  EBO: { label: 'Equipment on back order', short: 'EBO', emoji: '📦', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  OVD: { label: 'Open, Vendor Declined', short: 'OVD', emoji: '⚠️', badge: 'bg-red-500/15 text-red-300 border-red-500/30' },
};

/** "DAK - Dispatched, Acknowledged" → "DAK" */
export const gridCode = (raw) => (String(raw || '').split(/[\s-]/)[0] || '').toUpperCase();

export function gridBadgeConfig(raw) {
  const code = gridCode(raw);
  if (!code) return null;
  return CBRE_GRID_STATUS[code] || { label: String(raw), short: code, emoji: '📋', badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
}

/** Days since CBRE last listed the work order as open, or null. */
export function daysSinceGridSeen(seenAt) {
  if (!seenAt) return null;
  const t = Date.parse(seenAt);
  return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : null;
}
