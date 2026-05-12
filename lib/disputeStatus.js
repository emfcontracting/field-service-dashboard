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
    { to: 'escalated',   label: '📞 Escalate to UPS', variant: 'orange' },
    { to: 'resolved',    label: '🟢 Mark Resolved',   variant: 'success' },
    { to: 'written_off', label: '⚫ Write Off',        variant: 'default' },
  ],
  escalated: [
    { to: 'resolved',    label: '🟢 Mark Resolved',   variant: 'success' },
    { to: 'written_off', label: '⚫ Write Off',        variant: 'default' },
    { to: 'open',        label: '↩️ Reopen',          variant: 'ghost' },
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
