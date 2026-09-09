// lib/invoiceBulkActions.js
// ─────────────────────────────────────────────────────────────────────────────
// What a bulk action in Invoicing may do, and — more importantly — what it must
// leave alone.
//
// The first version of "Mark as Paid" ran
//   .update({ status: 'paid', paid_at: now }).in('invoice_id', ids)
// over the whole selection. Select all, click once, and every invoice already
// paid has its real payment date replaced with today: the cheque dates just
// imported from the Corpay report (May, June, July, August) would all have
// become 9 September, and six drafts that never left the building would read as
// paid.
//
// So every action here declares who it APPLIES to. The bar counts the selection
// against that, tells the office "344 of 695 — 351 are already paid and 6 are
// drafts, both skipped", and writes only to the rows that qualify. Nothing is
// ever changed silently, and no action can undo a fact it did not establish.
// ─────────────────────────────────────────────────────────────────────────────

export const PAID_STATUSES = ['paid'];
export const SENT_STATUSES = ['accepted', 'approved', 'synced'];

const has = (inv, field) => !!inv?.[field];
const isPaid = (inv) => inv?.status === 'paid' || has(inv, 'paid_at');

export const BULK_ACTIONS = {
  mark_paid: {
    label: 'Mark as paid',
    emoji: '💰',
    variant: 'success',
    // A draft was never sent, so it cannot have been paid. An invoice that is
    // already paid keeps the date it has — that is the whole point.
    applies: (inv) => !isPaid(inv) && inv?.status !== 'draft',
    skipReason: (inv) => isPaid(inv) ? 'already paid' : 'still a draft — it was never sent',
    needs: ['paid_on'],                    // date, plus optional cheque number
    describe: (n, { paid_on, reference }) =>
      `Mark ${n} invoice${n === 1 ? '' : 's'} as paid on ${paid_on}` +
      (reference ? ` (cheque ${reference})` : '') + '?',
    patch: ({ paid_on, reference }) => ({
      status: 'paid',
      paid_at: paid_on,
      ...(reference ? { payment_reference: reference, payment_source: 'bulk_entry' } : {}),
    }),
  },

  unmark_paid: {
    label: 'Undo payment',
    emoji: '↩️',
    variant: 'ghost',
    danger: true,
    applies: (inv) => isPaid(inv),
    skipReason: () => 'not marked paid',
    describe: (n) => `Put ${n} invoice${n === 1 ? '' : 's'} back to accepted and clear the payment?\n\nThe payment date, amount and cheque number are removed.`,
    patch: () => ({
      status: 'accepted', paid_at: null, paid_amount: null,
      payment_reference: null, payment_source: null,
    }),
  },

  mark_accepted: {
    label: 'Accepted — submitted to AP',
    emoji: '📤',
    variant: 'primary',
    // Only forwards, and never over a payment.
    applies: (inv) => ['draft', 'approved'].includes(inv?.status),
    skipReason: (inv) => isPaid(inv) ? 'already paid' : `already ${inv?.status}`,
    describe: (n) => `Mark ${n} invoice${n === 1 ? '' : 's'} as accepted and submitted to CBRE's AP?`,
    patch: () => ({ status: 'accepted' }),
  },

  approved_to_pay: {
    label: 'Stamp "approved to pay"',
    emoji: '💳',
    variant: 'primary',
    applies: (inv) => !has(inv, 'approved_to_pay_at') && !isPaid(inv),
    skipReason: (inv) => isPaid(inv) ? 'already paid' : 'already stamped',
    needs: ['approved_on'],
    describe: (n, { approved_on }) =>
      `Record that CBRE approved ${n} invoice${n === 1 ? '' : 's'} for payment on ${approved_on}?`,
    patch: ({ approved_on }) => ({ approved_to_pay_at: approved_on }),
  },

  mark_rejected: {
    label: 'Rejected by CBRE',
    emoji: '❌',
    variant: 'danger',
    danger: true,
    applies: (inv) => inv?.status !== 'rejected' && !isPaid(inv),
    skipReason: (inv) => isPaid(inv) ? 'already paid' : 'already rejected',
    needs: ['reason'],
    describe: (n, { reason }) =>
      `Mark ${n} invoice${n === 1 ? '' : 's'} as rejected by CBRE?\n\nReason recorded on each: ${reason}`,
    patch: ({ reason }) => ({
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
    }),
  },

  add_note: {
    label: 'Add a note',
    emoji: '📝',
    variant: 'ghost',
    applies: () => true,
    needs: ['note'],
    describe: (n, { note }) => `Add this note to ${n} invoice${n === 1 ? '' : 's'}?\n\n${note}`,
    // Appends rather than replaces — an existing note is somebody's work.
    patchPerRow: (inv, { note }) => ({
      admin_notes: [inv.admin_notes, `${new Date().toLocaleDateString('en-US')} — ${note}`]
        .filter(Boolean).join('\n'),
    }),
  },
};

/**
 * Split a selection into the rows an action will touch and the ones it will
 * not, with a reason for each skip. This is what the confirmation is built
 * from, so the office never has to guess what a click will reach.
 */
export function planBulkAction(actionKey, invoices) {
  const action = BULK_ACTIONS[actionKey];
  if (!action) return null;
  const apply = [], skip = [];
  for (const inv of invoices || []) {
    if (action.applies(inv)) apply.push(inv);
    else skip.push({ invoice: inv, reason: action.skipReason?.(inv) || 'does not apply' });
  }
  const bySkipReason = {};
  for (const s of skip) bySkipReason[s.reason] = (bySkipReason[s.reason] || 0) + 1;
  return {
    action,
    apply,
    skip,
    bySkipReason,
    total: (invoices || []).length,
    applyTotal: apply.reduce((s, i) => s + (parseFloat(i.total) || 0), 0),
  };
}

/** "344 of 695 · 351 already paid, 6 still drafts — both skipped" */
export function planSummary(plan) {
  if (!plan) return '';
  const head = `${plan.apply.length} of ${plan.total}`;
  const skips = Object.entries(plan.bySkipReason).map(([reason, n]) => `${n} ${reason}`);
  return skips.length ? `${head} · ${skips.join(', ')} — skipped` : head;
}
