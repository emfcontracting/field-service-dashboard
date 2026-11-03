// lib/cbreSubmissionStatus.js
// ─────────────────────────────────────────────────────────────────────────────
// What a Vendor App submission writes back onto the work order's cbre_status.
//
// Until 2026-11-03 nothing did. Submitting an NTE request stamped
// cbre_nte_submitted_at and flipped the quote to 'submitted', but cbre_status
// stayed empty on purpose: the codebase treated 'quote_submitted' as something
// only CBRE's own confirmation mail (email-sync, label "quote-submitted") may
// set. The cost showed on 2026-11-03: eleven NTE requests worth $39,484 were
// submitted and appeared in none of the three places that key on cbre_status —
// the StatsCards tile, the "Waiting on CBRE" tab, the health digest.
// A decline wrote nothing at all; there was no branch for it anywhere, so a
// declined work order looked exactly like one nobody had touched.
//
// Daniel's decision (2026-11-03): record both at the moment WE submit, and let
// CBRE's mail confirm the same value later — email-sync is idempotent and its
// sticky ranking still lets a later quote_approved through.
//
// The guards below are the whole point of this file: a submission must never
// drag a work order BACKWARDS. The ranking mirrors STATUS_RANK in
// app/api/email-sync/route.js.
// ─────────────────────────────────────────────────────────────────────────────

// cbre_status values a fresh 'quote_submitted' may overwrite. Anything beyond
// these (quote_approved, invoice_rejected, cancelled) outranks it and stays.
const QUOTE_SUBMITTED_OVERWRITES = ['pending_quote', 'reassigned', 'quote_rejected', 'quote_submitted'];

export const SUBMISSION_STATUS = {
  cbre_nte: {
    status: 'quote_submitted',
    billing_status: 'quoted',
    // null OR one of the lower-ranked statuses
    guard: `cbre_status.is.null,cbre_status.in.(${QUOTE_SUBMITTED_OVERWRITES.join(',')})`,
  },
  cbre_decline: {
    status: 'cancelled',
    billing_status: null,
    // 'cancelled' is the top of the ranking; only skip a repeat.
    guard: 'cbre_status.is.null,cbre_status.neq.cancelled',
  },
};

// Applies the status for one kind to a set of work orders. Returns { error }.
// Never throws: the caller has already recorded the submission itself, and a
// failed status write must not undo that.
export async function applySubmissionStatus(supabase, kind, woIds, nowIso) {
  const spec = SUBMISSION_STATUS[kind];
  if (!spec || !woIds?.length) return { error: null };

  const patch = {
    cbre_status: spec.status,
    cbre_status_updated_at: nowIso,
    cbre_status_acknowledged_at: null,   // same as email-sync: show the marker
  };
  if (spec.billing_status) patch.billing_status = spec.billing_status;

  const { error } = await supabase
    .from('work_orders')
    .update(patch)
    .in('wo_id', woIds)
    .or(spec.guard);

  return { error: error || null };
}
