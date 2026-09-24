// lib/completionAcknowledge.js
// -----------------------------------------------------------------------------
// "Acknowledge Completion & Lock" — the same single step the button in the work
// order modal performs, applied automatically once the completion has reached
// CBRE.
//
// Reporting the completion to CBRE IS the event that makes a work order ready
// to invoice: CBRE closes the order on their side (posting status CPW, "Order
// closed, waiting paperwork") and waits for our invoice. Until now the office
// had to walk back into each work order afterwards and press the button by
// hand, which is pure repetition — the decision was already made when the
// completion was submitted.
//
// Two paths report a completion, and both mean the same thing, so both end
// here:
//   • ApprovalsView → "Mark submitted"          (a person confirms they sent it)
//   • api/cbre/sync-vendor-confirmations        (CBRE's own confirmation mail)
//
// The guards mirror the button exactly — it only appears for
// `status === 'completed' && !acknowledged && !is_locked` — so nothing is
// acknowledged here that a human could not have acknowledged there. In
// particular `is_locked` is left alone: it means "locked, invoiced" and is set
// when the invoice is generated. Setting it here would take the work order OUT
// of the Ready-to-Invoice list, which queries acknowledged && !is_locked.
//
// The manual button stays for everything that does not travel this road: UPS
// work, rework, one-offs.
// -----------------------------------------------------------------------------

/** The columns "Acknowledge Completion & Lock" writes. */
export function acknowledgePatch(nowIso, userId = null) {
  return {
    acknowledged: true,
    acknowledged_at: nowIso,
    acknowledged_by: userId ?? null,
  };
}

/**
 * Acknowledge the work orders whose completion just reached CBRE.
 * Idempotent and safe to call with ids that are already acknowledged, locked or
 * not completed — those rows simply do not match.
 *
 * @returns {Promise<{count: number, error: Error|null}>} how many rows moved.
 */
export async function acknowledgeSubmittedCompletions(supabase, woIds, nowIso, userId = null) {
  const ids = [...new Set((woIds || []).filter(Boolean))];
  if (!ids.length) return { count: 0, error: null };

  const { data, error } = await supabase
    .from('work_orders')
    .update(acknowledgePatch(nowIso, userId))
    .in('wo_id', ids)
    .eq('status', 'completed')
    .eq('acknowledged', false)
    .eq('is_locked', false)
    .select('wo_id');

  return { count: data?.length ?? 0, error: error || null };
}

/**
 * Comment line for the unattended path. The office sees why a work order moved
 * to Ready-to-Invoice without anyone touching it. Not needed on the
 * "Mark submitted" path — the person is standing right there.
 */
export function autoAcknowledgeNote(nowIso) {
  const when = nowIso.slice(0, 16).replace('T', ' ');
  return `[ACKNOWLEDGED AUTOMATICALLY] ${when}\nCBRE confirmed the completion — work order acknowledged and locked, ready to invoice.`;
}
