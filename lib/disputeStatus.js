// lib/disputeStatus.js
// ─────────────────────────────────────────────────────────────────────────────
// Constants and helpers for the CBRE Dispute / UPS Escalation workflow
// ─────────────────────────────────────────────────────────────────────────────

export const DISPUTE_STATUS = {
  open: {
    label: 'Open Dispute',
    short: 'Open',
    emoji: '🔴',
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/30',
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
  },
  escalated: {
    label: 'Escalated to UPS',
    short: 'Escalated',
    emoji: '📞',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10 border-orange-500/30',
    badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
  // The WO is dead at CBRE (cancelled / closed without invoice); a sub work
  // order has been requested and the money comes back through that sub-WO.
  sub_wo_requested: {
    label: 'Sub-WO requested from CBRE',
    short: 'Sub-WO req.',
    emoji: '📨',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/30',
    badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  },
  resolved: {
    label: 'Resolved (Recovered)',
    short: 'Resolved',
    emoji: '🟢',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  },
  written_off: {
    label: 'Written Off',
    short: 'Written Off',
    emoji: '⚫',
    color: 'text-slate-500',
    bg: 'bg-slate-700/30 border-slate-600/30',
    badge: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  },
};

export const DISPUTE_REASONS = {
  cbre_cancelled: {
    label: 'CBRE Cancelled',
    description: 'CBRE cancelled the work order',
  },
  closed_inactivity: {
    label: 'Closed Due to Inactivity',
    description: 'WO closed automatically due to lack of activity',
  },
  nte_rejected: {
    label: 'NTE Increase Rejected',
    description: 'CBRE/UPS rejected the NTE increase — bill the original NTE or escalate',
  },
  nte_pending: {
    label: 'NTE Pending at CBRE/UPS',
    description: 'NTE increase request submitted but never approved or rejected',
  },
  // CBRE freezes the NTE once it posts a work order (CPW and everything after).
  // The portal takes no further increase, so the money above the posted NTE can
  // only come back on a sub work order.
  nte_locked_posted: {
    label: 'NTE Locked — Posted at CBRE',
    description: 'WO posted at CBRE (CPW …) before the NTE was raised — no increase possible, needs a sub work order',
  },
  other: {
    label: 'Other',
    description: 'Custom reason (specify in notes)',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Status transition rules — defines what actions are available per status
// ─────────────────────────────────────────────────────────────────────────────
export const STATUS_TRANSITIONS = {
  open: [
    { to: 'escalated',        label: '📞 Escalate to UPS',   variant: 'orange' },
    { to: 'sub_wo_requested', label: '📨 Sub-WO requested', variant: 'sky' },
    { to: 'resolved',         label: '🟢 Mark Resolved',     variant: 'success' },
    { to: 'written_off',      label: '⚫ Write Off',          variant: 'default' },
  ],
  escalated: [
    { to: 'sub_wo_requested', label: '📨 Sub-WO requested', variant: 'sky' },
    { to: 'resolved',         label: '🟢 Mark Resolved',     variant: 'success' },
    { to: 'written_off',      label: '⚫ Write Off',          variant: 'default' },
    { to: 'open',             label: '↩️ Reopen',            variant: 'ghost' },
  ],
  sub_wo_requested: [
    { to: 'resolved',         label: '🟢 Mark Resolved',     variant: 'success' },
    { to: 'escalated',        label: '📞 Escalate to UPS',   variant: 'orange' },
    { to: 'written_off',      label: '⚫ Write Off',          variant: 'default' },
    { to: 'open',             label: '↩️ Reopen',            variant: 'ghost' },
  ],
  resolved: [
    { to: 'escalated', label: '↩️ Reopen (Escalated)', variant: 'ghost' },
    { to: 'open',      label: '↩️ Reopen (Open)',      variant: 'ghost' },
  ],
  written_off: [
    { to: 'escalated', label: '↩️ Reopen (Escalated)', variant: 'ghost' },
    { to: 'open',      label: '↩️ Reopen (Open)',      variant: 'ghost' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Compute what timestamps to update when transitioning
// ─────────────────────────────────────────────────────────────────────────────
export function buildTransitionUpdate(toStatus) {
  const now = new Date().toISOString();
  const update = { dispute_status: toStatus };

  if (toStatus === 'escalated') {
    update.dispute_escalated_at = now;
  } else if (toStatus === 'sub_wo_requested') {
    update.dispute_requested_at = now;
    update.dispute_resolved_at = null;
  } else if (toStatus === 'resolved' || toStatus === 'written_off') {
    update.dispute_resolved_at = now;
  } else if (toStatus === 'open') {
    // Reopening — clear later timestamps
    update.dispute_resolved_at = null;
  }
  return update;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick badge component data
// ─────────────────────────────────────────────────────────────────────────────
export function disputeBadgeClasses(status) {
  return DISPUTE_STATUS[status]?.badge || 'bg-slate-500/15 text-slate-400 border-slate-500/30';
}
