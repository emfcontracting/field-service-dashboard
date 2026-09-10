// lib/clockPause.js
// ─────────────────────────────────────────────────────────────────────────────
// The stop-the-clock pause a technician sets from the app — one place that
// says what each reason means and how it should look.
//
// WHY THIS EXISTS: the tech presses "Waiting for parts" in the field app. That
// writes an open row to work_order_clock_pauses AND sets
// work_orders.waiting_reason / waiting_since (see pcs-mobile
// src/services/pauseService.ts). Until now the office saw NONE of it — the
// pause fed the KPI maths silently and nothing else. A job could stand still
// for a month with the reason sitting in the database and the dispatcher none
// the wiser.
//
// The badge reads waiting_reason straight off the work order, so the table
// needs no extra query. The note and who set it live on the pause row, which
// the detail modal loads when it is opened.
//
// These are also the reasons queue-holds reports to CBRE as a target-date
// extension, so a pause here is what keeps a job from ageing out there.
// ─────────────────────────────────────────────────────────────────────────────

export const PAUSE_REASONS = {
  cbre_approval:       { short: 'CBRE approval', label: 'Awaiting CBRE approver',      emoji: '⏸', tech: false },
  equipment_backorder: { short: 'Backorder',     label: 'Equipment on backorder',      emoji: '📦', tech: true  },
  parts_ordered:       { short: 'Parts',         label: 'Waiting for parts',           emoji: '🔩', tech: true  },
  site_access:         { short: 'No access',     label: 'No site access',              emoji: '🚪', tech: true  },
  return_trip_wait:    { short: 'Return trip',   label: 'Awaiting return-trip release',emoji: '↩', tech: false },
  other:               { short: 'On hold',       label: 'Paused',                      emoji: '⏸', tech: true  },
};

// One amber family for all of them: a pause is a pause, and colour-coding the
// reason would compete with the status and priority badges already in the row.
export const PAUSE_BADGE = 'bg-amber-500/15 text-amber-400 border-amber-500/30';

export const pauseLabel = (reason) => PAUSE_REASONS[reason]?.label || 'Paused';
export const pauseShort = (reason) => PAUSE_REASONS[reason]?.short || 'On hold';
export const pauseEmoji = (reason) => PAUSE_REASONS[reason]?.emoji || '⏸';

// Backwards-compatible map for callers that want "⏸ Waiting for parts" in one
// string (lib/kpi.js re-exports this so PerformanceView keeps working).
export const PAUSE_REASON_LABELS = Object.fromEntries(
  Object.entries(PAUSE_REASONS).map(([k, v]) => [k, `${v.emoji} ${v.label}`])
);

/**
 * The open pause on a work order, as far as the work_orders row can tell.
 * Returns null when nothing is paused.
 *
 * { reason, label, short, emoji, since, days }
 */
export function openPauseOf(wo, now = new Date()) {
  const reason = wo?.waiting_reason;
  if (!reason) return null;
  const since = wo.waiting_since ? new Date(wo.waiting_since) : null;
  const valid = since && !Number.isNaN(since.getTime());
  return {
    reason,
    label: pauseLabel(reason),
    short: pauseShort(reason),
    emoji: pauseEmoji(reason),
    since: valid ? since : null,
    days: valid ? Math.floor((now.getTime() - since.getTime()) / 86400000) : null,
  };
}
