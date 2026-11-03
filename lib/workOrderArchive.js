// lib/workOrderArchive.js
// ─────────────────────────────────────────────────────────────────────────────
// Archiving a work order instead of deleting it.
//
// Until 2026-11-03 the only way to get a work order out of the dashboard was
// the superuser "Delete Selected" button, which removed the row along with its
// assignments and daily hours. Seven hand-created work orders went that way on
// 2026-10-28 and the triage sheet needed a note explaining where they had gone.
// Daniel's decision: keep every work order, move the dead ones out of the way.
//
// Why its own column and not a status:
//   • cbre_status = 'cancelled' is written automatically now — by a decline we
//     submit and by CBRE's cancellation mail. Hanging the archive on it would
//     have swept 26 PM work orders out of the list by itself on the afternoon
//     it shipped. Archiving is a decision somebody makes, so it gets its own
//     field and records who made it.
//   • status is the crew's work status: it drives the technician app, the KPIs
//     and invoice readiness. Nothing here touches it.
//
// Reversible by design: restore nulls the three columns and the work order is
// back in the list exactly as it was.
// ─────────────────────────────────────────────────────────────────────────────

export const ARCHIVE_REASONS = [
  { value: 'cbre_cancelled', label: 'Cancelled by CBRE' },
  { value: 'declined',       label: 'Declined by us' },
  { value: 'duplicate',      label: 'Duplicate work order' },
  { value: 'data_entry',     label: 'Created in error / data entry' },
  { value: 'reassigned',     label: 'Reassigned to another vendor' },
  { value: 'other',          label: 'Other' },
];

export const archiveReasonLabel = (value) =>
  ARCHIVE_REASONS.find((r) => r.value === value)?.label || value || '—';

// CBRE posting states that mean the invoice is already in their workflow.
const POSTED = ['CIS', 'CA1', 'CA2', 'CIR', 'CMP'];
// Quote states that are still waiting on an answer or already carry a promise.
const LIVE_QUOTE = ['submitted', 'approved', 'verbal_approved'];

const money = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const loggedHours = (wo) => {
  if (typeof wo?.total_hours_regular === 'number' || typeof wo?.total_hours_overtime === 'number') {
    return (wo.total_hours_regular || 0) + (wo.total_hours_overtime || 0);
  }
  return (parseFloat(wo?.hours_regular) || 0) + (parseFloat(wo?.hours_overtime) || 0) || (parseFloat(wo?.hours) || 0);
};

// What would be taken out of sight along with this work order. Daniel's call
// of 2026-11-03: warn and let him decide, never block — but never archive
// money silently either. C3225805 sat unnoticed for four months precisely
// because nobody could see it any more.
export function archiveWarnings(wo) {
  const out = [];
  if (!wo) return out;

  if (wo.qb_invoice_number) out.push(`invoice ${wo.qb_invoice_number} is attached`);
  if (POSTED.includes(wo.cbre_posting_status)) {
    out.push(`CBRE has it at ${wo.cbre_posting_status}${wo.cmp_date ? '' : ' — not paid yet'}`);
  }

  const hrs = loggedHours(wo);
  if (hrs > 0 && !wo.qb_invoice_number) out.push(`${hrs} h logged, nothing invoiced`);

  const live = (wo.nte_quotes || []).filter((q) => LIVE_QUOTE.includes(q?.nte_status));
  for (const q of live) {
    const amount = q.new_nte_amount ? ` over ${money(q.new_nte_amount)}` : '';
    out.push(`NTE quote${amount} is ${q.nte_status}`);
  }

  if (wo.dispute_status && wo.dispute_status !== 'resolved') out.push(`dispute is ${wo.dispute_status}`);

  return out;
}

export const hasArchiveWarning = (wo) => archiveWarnings(wo).length > 0;

// One statement for the whole selection. Returns { error }.
export async function archiveWorkOrders(supabase, woIds, { reason, note = null, userId = null } = {}) {
  if (!woIds?.length) return { error: null, count: 0 };
  const { error } = await supabase
    .from('work_orders')
    .update({
      archived_at: new Date().toISOString(),
      archived_by: userId,
      archive_reason: note ? `${reason}: ${note}` : reason,
    })
    .in('wo_id', woIds)
    .is('archived_at', null);          // never re-stamp an already archived row
  return { error: error || null, count: woIds.length };
}

export async function restoreWorkOrders(supabase, woIds) {
  if (!woIds?.length) return { error: null, count: 0 };
  const { error } = await supabase
    .from('work_orders')
    .update({ archived_at: null, archived_by: null, archive_reason: null })
    .in('wo_id', woIds);
  return { error: error || null, count: woIds.length };
}
