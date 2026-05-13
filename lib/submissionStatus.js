// lib/submissionStatus.js
// ─────────────────────────────────────────────────────────────────────────────
// Helpers for the "submission status" of a work order — i.e. has the tech
// emailed in photos / receipts / PMI write-ups yet?
//
// Photos and write-ups have IMAP-verified status columns on work_orders
// (populated by /api/verify-photos and /api/verify-writeups). Receipts use
// the same pattern with the new /api/verify-receipts route.
//
// This file is the single source of truth for which icon / colour / tooltip
// shows for each submission type so the WO list and detail modal stay in sync.
// ─────────────────────────────────────────────────────────────────────────────

// Is this a PM (preventive maintenance) work order? Only PM WOs need write-ups.
// PM WO numbers start with "P" followed by digits (matches EmailPhotosSection).
export const isPMWorkOrder = (woNumber) => !!woNumber && /^P\d+$/i.test(woNumber);

// Does this work order need material receipts? Only if there are material costs.
// We check `work_orders.material_cost` (entered by tech for EMF-procured material)
// AND any pre-existing receipts state (so once a tech does email receipts in for
// e.g. a labour-only WO, the status doesn't suddenly become 'not_required').
export function needsReceipts(wo) {
  if (!wo) return false;
  if (parseFloat(wo.material_cost) > 0) return true;
  if (wo.receipts_received) return true;       // once received → always show
  if (wo.receipts_verified_at) return true;     // explicit override / earlier check
  return false;
}

// What's the status for one submission type?
// Returns one of:
//   'received'      — verified, item was sent
//   'missing'       — last check failed, item not found
//   'not_checked'   — never checked or no verified_at yet
//   'not_required'  — this WO doesn't need this submission type (e.g. write-ups
//                     on a non-PM WO, or receipts on a labour-only WO)
function statusFor(received, verifiedAt, required) {
  if (!required) return 'not_required';
  if (received)   return 'received';
  if (verifiedAt) return 'missing';
  return 'not_checked';
}

// Build the full submission status object for a single WO.
export function getSubmissionStatus(wo) {
  if (!wo) return { photos: 'not_checked', receipts: 'not_required', writeups: 'not_required' };
  return {
    photos:   statusFor(wo.photos_received,   wo.photos_verified_at,   true),
    receipts: statusFor(wo.receipts_received, wo.receipts_verified_at, needsReceipts(wo)),
    writeups: statusFor(wo.writeups_received, wo.writeups_verified_at, isPMWorkOrder(wo.wo_number)),
  };
}

// Visual config per submission type — icon + label + tooltip strings.
// Keep these short — the table view has very little horizontal room.
export const SUBMISSION_META = {
  photos:   { icon: '📷', label: 'Photos',     verb: 'Photos'        },
  receipts: { icon: '🧾', label: 'Receipts',   verb: 'Material receipts' },
  writeups: { icon: '📝', label: 'PMI Write-ups', verb: 'PMI write-ups' },
};

// Map status → Tailwind colour classes for the table badges.
// `bg-…/20  text-…  border-…/30` is the same shape as other badges in the app.
export const STATUS_BADGE_CLASS = {
  received:     'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  missing:      'bg-red-500/20    text-red-400    border-red-500/30',
  not_checked:  'bg-slate-700/30  text-slate-500  border-slate-600/30',
  not_required: '',  // hidden in the table
};

// Plain-text tooltip for a given submission type + status.
export function tooltipFor(type, status, wo) {
  const meta = SUBMISSION_META[type];
  if (!meta) return '';
  if (status === 'received') {
    const subj = wo?.[`${type}_email_subject`];
    return `${meta.verb} received${subj ? ` — "${subj}"` : ''}`;
  }
  if (status === 'missing')      return `${meta.verb} not found in inbox`;
  if (status === 'not_required') return `${meta.verb} not required for this WO`;
  return `${meta.verb} not checked yet`;
}
