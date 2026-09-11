// lib/agingRisk.js
// ─────────────────────────────────────────────────────────────────────────────
// How close a work order is to being closed out by CBRE for age — after which,
// in CBRE's words, it "cannot be reopened for billing". This is the mechanism
// that cost us the fifteen sub work orders.
//
// THE NUMBERS, FROM CBRE'S OWN WARNING E-MAIL
// The Supplier Training Guide (July 2025) says the monthly sweep takes work
// orders more than 90 days past target. CBRE's cancellation notices said "aging
// past 60 days". Both are real, and the automated warning e-mail settles it:
//
//   Subject: "P1-Emergency Request # C3067674 Will Be Closed in 7 Days"
//   Body:    "flagged for being open 53 days after the target completion date.
//             If no action is taken in the next 7 days, this WO will be closed."
//   Order Status: DRC - No Activity, Review to Close
//
// 53 + 7 = 60. That is where the 60 comes from, it is measured from the TARGET
// COMPLETION DATE, and it is a per-work-order timer, not a monthly sweep. The
// guide's 90 predates it — a CBRE notice of 09.02.2026, "Update to Aging Work
// Order Closure Guidelines Effective March 1", is when it appears to have
// changed. We plan against 53/60 because that is what the machine actually does.
//
// THE BASIS PROBLEM
// CBRE measures from target_completion_at. That field is set on 122 of 937 work
// orders here — 13%, and only 40% of recent ones. A model keyed on it alone
// would go quiet on the majority. So the basis falls back to the dispatch date
// plus that priority's own completion window, which is what CBRE's target would
// have been, and the result says which basis it used so nobody mistakes our
// reconstruction for CBRE's own date.
//
// Checked against the sixteen work orders CBRE really did cancel on 08.04.2026:
// fourteen were already past 60 days on the sweep date by this reckoning, and
// the two that were not sat at 50 — three days off CBRE's own count of 53. The
// estimated basis is close enough to act on.
//
// WHEN CBRE HAS TOLD US DIRECTLY
// If the warning e-mail has been read for this work order,
// cbre_closeout_deadline holds the date CBRE itself named. That always wins
// over any reckoning of ours.
// ─────────────────────────────────────────────────────────────────────────────

import { parseDate } from './dates';
import { extractPriorityCode, completionHoursFor } from './priorityCodes';

// Days past the target completion date at which CBRE flags the work order and
// sends the warning e-mail.
export const AGING_FLAG_DAYS = 53;
// …and closes it, seven days after that.
export const AGING_CLOSE_DAYS = 60;
// Days CBRE's own grace period runs once the warning is sent.
export const AGING_GRACE_DAYS = 7;
// What the July 2025 Supplier Training Guide still documents.
export const AGING_DOCUMENTED_DAYS = 90;
// Our own early warning, far enough out that a quote or an invoice can still be
// moved before CBRE's timer starts.
export const AGING_WARN_DAYS = 40;
// Guide: a work order may not sit in a complete status this long without an
// invoice.
export const COMPLETE_WITHOUT_INVOICE_DAYS = 90;

// The order status CBRE puts a flagged work order into.
export const CLOSEOUT_ORDER_STATUS = 'DRC';
export const CLOSEOUT_ORDER_STATUS_LABEL = 'No Activity, Review to Close';

// Where CBRE publishes no completion target (P6, P7, P11), a basis is still
// needed or the work order drops out of the model entirely. Thirty days is the
// PM interval — the longest thing CBRE does put a number on — and it is
// deliberately generous: better to warn late on a job with no published target
// than to cry wolf on every one of them.
const NO_TARGET_FALLBACK_HOURS = 720;

const MS_D = 86400000;
const toDate = (v) => parseDate(v);

/**
 * The date CBRE's clock counts from, and how confident we are in it.
 *   'cbre'      — the target CBRE itself set. Their measurement exactly.
 *   'estimated' — dispatch plus that priority's window. Our reconstruction.
 *   'dispatch'  — dispatch alone, when there is no priority to reason from.
 */
export function agingBasis(wo) {
  const target = toDate(wo?.target_completion_at);
  if (target) return { date: target, source: 'cbre' };

  const entered = toDate(wo?.date_entered) || toDate(wo?.created_at);
  if (!entered) return { date: null, source: null };

  // CBRE's own completion target in hours, from its SLA table — 72 for a P3,
  // 168 for a P4, 336 for a P5. Until 10.09.2026 this used hand-made calendar
  // windows that treated CBRE's plain hours as business days and so ran three
  // to six days long on every routine job.
  const code = extractPriorityCode(wo?.priority);
  if (!code) return { date: entered, source: 'dispatch' };
  const hours = completionHoursFor(wo?.priority) ?? NO_TARGET_FALLBACK_HOURS;
  return { date: new Date(entered.getTime() + hours * 3600000), source: 'estimated' };
}

export const AGING_LEVELS = {
  ok:       { label: 'Not aging',          emoji: '',   badge: '' },
  watch:    { label: 'Aging',              emoji: '🕒', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  at_risk:  { label: 'Flagged for closure',emoji: '⏳', badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  past_due: { label: 'Past CBRE cut-off',  emoji: '🛑', badge: 'bg-red-500/15 text-red-400 border-red-500/30' },
};

// Posting codes that mean CBRE has already taken the work order into its own
// billing chain. The close-out timer is behind it at that point.
const IN_CBRE_CHAIN = ['CPW', 'CIS', 'CA1', 'CA2', 'CIR', 'CMP', 'CIA'];

/**
 * Is this work order actually exposed to the close-out timer?
 *
 * Without this the badge would fire on all 937 rows, 667 of them long closed,
 * and be ignored within a day. Exposed means: still open in FSM, not already
 * being handled in the Escalations tab, not in CBRE's posting chain, and not
 * invoiced. On the live data that is 91 work orders.
 */
export function isAgingExposed(wo) {
  if (!wo) return false;
  if (wo.acknowledged || wo.is_locked) return false;
  if (wo.dispute_status && !['resolved', 'closed'].includes(wo.dispute_status)) return false;
  if (IN_CBRE_CHAIN.includes(String(wo.cbre_posting_status || '').toUpperCase().trim())) return false;
  if (wo.qb_invoice_number || wo.vwas_invoice_submitted) return false;
  return true;
}

/**
 * Where a work order stands against CBRE's close-out timer.
 * Returns null when there is nothing to measure.
 *
 * { days, level, basis, source, closeDate, daysToClose, fromCbre, note }
 *   days      — days past the basis date (negative = still ahead of it)
 *   level     — ok | watch | at_risk | past_due
 *   closeDate — when CBRE closes it; theirs if they told us, else basis + 60
 *   fromCbre  — true when the deadline came out of CBRE's warning e-mail
 */
export function agingRisk(wo, now = new Date()) {
  const { date, source } = agingBasis(wo);
  const stated = toDate(wo?.cbre_closeout_deadline);
  if (!date && !stated) return null;

  const days = date ? Math.floor((now.getTime() - date.getTime()) / MS_D) : null;

  const closeDate = stated || new Date(date.getTime() + AGING_CLOSE_DAYS * MS_D);
  const daysToClose = Math.ceil((closeDate.getTime() - now.getTime()) / MS_D);

  let level;
  if (stated) {
    // CBRE has named the date. Everything before it is the grace period.
    level = daysToClose <= 0 ? 'past_due' : 'at_risk';
  } else if (days >= AGING_CLOSE_DAYS) level = 'past_due';
  else if (days >= AGING_FLAG_DAYS) level = 'at_risk';
  else if (days >= AGING_WARN_DAYS) level = 'watch';
  else level = 'ok';

  const basisWord = source === 'cbre'
    ? "CBRE's target date"
    : source === 'estimated'
      ? 'estimated target (dispatch + priority window)'
      : 'dispatch date';

  let note;
  if (stated) {
    note = daysToClose > 0
      ? `CBRE has flagged this one: it closes on ${closeDate.toISOString().slice(0, 10)}, in ${daysToClose} day${daysToClose === 1 ? '' : 's'}. Move the target date, update the status, or complete and invoice it.`
      : `CBRE's stated close-out date (${closeDate.toISOString().slice(0, 10)}) has passed. It can no longer be reopened for billing — a sub work order is the only route left.`;
  } else if (level === 'past_due') {
    note = `${days} days past ${basisWord} — beyond the ${AGING_CLOSE_DAYS} days at which CBRE closes. Check whether it is already gone.`;
  } else if (level === 'at_risk') {
    note = `${days} days past ${basisWord}. CBRE flags at ${AGING_FLAG_DAYS} days and closes ${AGING_GRACE_DAYS} days later — about ${daysToClose} left.`;
  } else if (level === 'watch') {
    note = `${days} days past ${basisWord}. CBRE starts its ${AGING_GRACE_DAYS}-day countdown at ${AGING_FLAG_DAYS} days.`;
  } else {
    note = `${days} days past ${basisWord}.`;
  }

  return { days, level, basis: date, source, closeDate, daysToClose, fromCbre: !!stated, note };
}

/**
 * Completed, but no invoice — the second clock in the guide: a work order may
 * not sit complete for more than 90 days without one. Returns null when it does
 * not apply.
 */
export function completeWithoutInvoiceRisk(wo, now = new Date()) {
  const done = toDate(wo?.date_completed);
  if (!done) return null;
  if (wo?.qb_invoice_number || wo?.vwas_invoice_submitted) return null;
  const days = Math.floor((now.getTime() - done.getTime()) / MS_D);
  if (days < AGING_WARN_DAYS) return null;
  return {
    days,
    level: days >= COMPLETE_WITHOUT_INVOICE_DAYS ? 'past_due' : 'at_risk',
    note: `Complete for ${days} days with no invoice submitted. CBRE's limit is ${COMPLETE_WITHOUT_INVOICE_DAYS} days.`,
  };
}
