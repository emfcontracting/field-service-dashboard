// lib/cbreExtensionPolicy.js
// ─────────────────────────────────────────────────────────────────────────────
// CBRE's rules for target-completion-date extensions, as they wrote them.
//
// Source: "Important Guidance and Update: Changing Work Order Completion Dates",
// CBRE-UPS Vendor Management to U.S.-based suppliers, 2026-11-03. Requests now
// go to a review team and come back approved or declined within 24-48 hours,
// and the mail lists what will be declined. Three of its rules decide almost
// everything we submit:
//
//   1. "We do not provide date extensions for work orders managed by UPS,
//      which includes any problem code that says UPS and not CBRE. Those
//      problem codes include conveyors, capital projects, environmental, and
//      fuel islands. UPS manages work orders in those categories directly, and
//      they do NOT count in your scorecard."
//
//   2. "Pending quote approval. When a work order is awaiting CBRE quote
//      approval, your vendor score is not impacted. Do not request an
//      extension while approval is pending. If the quote is approved after the
//      Target Completion Date has passed, include the approval date and
//      proposed completion date in your request."
//
//   3. "Waiting for paperwork or invoice. Once work is complete, the work
//      order should be moved to CPW (Completed Pending Paperwork) status.
//      Target Completion Dates will not be extended for paperwork or
//      invoicing purposes."
//
// Measured against the 55 work orders we had queued behind a hold reason on
// 2026-11-03: 39 carry a UPS problem code, 51 carry "pending quote approval",
// and exactly five survive these rules. The producer used to send all 55.
//
// NOTE THE LIMIT OF WHAT CBRE PROMISED. Rules 1 and 2 say the SCORECARD is not
// affected. They do not say the 60-day close-out sweep will spare the work
// order, and the close-out is what makes one unbillable — fifteen sub work
// orders and $29,794.89 came out of exactly that. So this file withdraws a
// tool; it does not establish that the risk is gone.
// ─────────────────────────────────────────────────────────────────────────────

import { fmtDate } from './cbreVendorForm';

/** Work orders CBRE has already posted — an extension is meaningless there. */
export const POSTED_STATES = ['CPW', 'CIS', 'CA1', 'CA2', 'CIR', 'CMP'];

/**
 * Who manages this work order, read from the problem code that opens the
 * description: "144017 - UPS - Conveyor/Sorting Equipment …" or
 * "141303 - CBRE - Electrical - Emergency …". Returns 'UPS', 'CBRE' or null
 * when the description does not carry a code we recognise.
 */
export function problemCodeOwner(wo) {
  const m = /^\s*(\d{6})\s*-\s*(UPS|CBRE)\b/i.exec(String(wo?.work_order_description || ''));
  return m ? m[2].toUpperCase() : null;
}

/** The six-digit problem code itself, or null. */
export function problemCode(wo) {
  const m = /^\s*(\d{6})\s*-/.exec(String(wo?.work_order_description || ''));
  return m ? m[1] : null;
}

const asDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

export const EXTENSION_BLOCKED = {
  ups_managed:      'UPS problem code — CBRE grants no extension and it does not count in the scorecard',
  posted:           'already posted at CBRE',
  completed_use_cpw:'work is complete — CBRE wants CPW, not an extension',
  quote_pending:    'quote still with CBRE — their guidance says do not ask, and the score is not affected',
  quote_decided_early: 'quote was decided before the target date — the hold reason no longer holds',
  no_target_date:   'no target completion date on file, so "approved after target" cannot be shown',
  unknown_owner:    'problem code does not say UPS or CBRE — cannot tell whether an extension is allowed',
  no_reason:        'no hold reason recorded',
};

/**
 * May we submit a target-date extension for this work order, and on what
 * grounds? Returns { allowed, reason, kind } — `kind` picks the comment.
 *
 * Deliberately conservative where CBRE is unclear: an unrecognised problem
 * code is treated as not allowed rather than guessed at, because a declined
 * request now costs a review-team look and goes on our record.
 */
export function extensionEligibility(wo) {
  if (!wo?.waiting_reason) return { allowed: false, reason: EXTENSION_BLOCKED.no_reason };

  const owner = problemCodeOwner(wo);
  if (owner === 'UPS')  return { allowed: false, reason: EXTENSION_BLOCKED.ups_managed };
  if (owner === null)   return { allowed: false, reason: EXTENSION_BLOCKED.unknown_owner };

  if (POSTED_STATES.includes(wo.cbre_posting_status) || POSTED_STATES.includes(wo.cbre_status)) {
    return { allowed: false, reason: EXTENSION_BLOCKED.posted };
  }
  if (wo.status === 'completed') return { allowed: false, reason: EXTENSION_BLOCKED.completed_use_cpw };

  if (wo.waiting_reason === 'cbre_approval') {
    if (wo.cbre_status !== 'quote_approved') {
      return { allowed: false, reason: EXTENSION_BLOCKED.quote_pending };
    }
    const approved = asDate(wo.cbre_status_updated_at);
    const target   = asDate(wo.target_completion_at);
    if (!approved || !target) return { allowed: false, reason: EXTENSION_BLOCKED.no_target_date };
    if (approved <= target)   return { allowed: false, reason: EXTENSION_BLOCKED.quote_decided_early };
    // The one case CBRE spells out as acceptable.
    return { allowed: true, kind: 'quote_approved_late', approvedAt: approved, targetAt: target };
  }

  if (wo.waiting_reason === 'parts_ordered' || wo.waiting_reason === 'equipment_backorder') {
    return { allowed: true, kind: 'parts', needsOfficeDetail: true };
  }

  // site_access, return_trip_wait, other: CBRE lists "Availability" and
  // "Coordinating with our branch" among the refusals, and offers no wording
  // that would pass for these. Left out rather than sent to be declined.
  return { allowed: false, reason: `no accepted wording for hold reason "${wo.waiting_reason}"` };
}

/** Placeholder the office must replace before submitting a parts request. */
export const FILL_IN = '<FILL IN>';

/**
 * The comment CBRE will read. Both shapes follow the examples in their own
 * mail — they printed the form of a request they would accept, so we use it.
 */
export function extensionComment(kind, { approvedAt, targetAt, waitingSince, proposedTarget } = {}) {
  if (kind === 'quote_approved_late') {
    return `Quote approved on ${fmtDate(approvedAt)}, after the target completion date of ${fmtDate(targetAt)} had passed. `
         + `Work is scheduled for completion by ${proposedTarget}.`;
  }
  if (kind === 'parts') {
    return `Parts ordered on ${waitingSince ? fmtDate(waitingSince) : FILL_IN}. `
         + `Original expected delivery ${FILL_IN}. Delayed because ${FILL_IN}. Revised delivery ${FILL_IN}. `
         + `Anticipated completion date ${proposedTarget}.`;
  }
  return null;
}
