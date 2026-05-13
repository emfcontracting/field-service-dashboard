// lib/quoteApproval.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralised quote-approval logic. When a quote is approved (either via Gmail
// label sync or via manual CBRE-status change in the dashboard), we need to:
//   1. Update work_orders.nte to the new NTE amount
//   2. Mark the matching work_order_quotes row as approved
//
// Quote search strategy: take the NEWEST quote for this WO across ALL active
// states (pending / submitted / approved / verbal_approved). We need 'approved'
// in the list so historic records still work — e.g. a quote that the old
// email-sync already flipped to 'approved' WITHOUT updating work_orders.nte
// can still be reconciled. The quote status update is idempotent — re-applying
// 'approved' to an already-approved quote is a no-op.
//
// Source of truth for the NEW NTE amount, in priority order:
//   a) `overrideNTE` passed by caller (e.g. value parsed out of the Gmail email)
//   b) `new_nte_amount` from the selected quote
//
// If neither is available the function is a no-op and returns applied=false so
// the caller can decide whether to fall back to a warning/notification.
//
// If the work order's NTE already equals the target value, returns
// applied=false with reason='NTE already in sync' — no DB writes.
// ─────────────────────────────────────────────────────────────────────────────

const ACTIVE_QUOTE_STATUSES = ['pending', 'submitted', 'approved', 'verbal_approved'];

/**
 * @param {object} supabase  — Supabase client (server or browser)
 * @param {string} woId      — work_orders.wo_id (UUID)
 * @param {object} [opts]
 * @param {number} [opts.overrideNTE]  — explicit NTE value (takes precedence)
 * @returns {Promise<{
 *   applied: boolean,
 *   reason?: string,
 *   quoteId?: string,
 *   quoteWasApproved?: boolean,   // true if the quote was already approved before we touched it
 *   oldNTE?: number,
 *   newNTE?: number,
 *   source?: 'override' | 'quote',
 * }>}
 */
export async function applyQuoteApproval(supabase, woId, opts = {}) {
  if (!woId) return { applied: false, reason: 'no wo_id' };

  // 1. Find newest active quote (any state). We allow already-approved quotes
  //    so historic mismatches between work_orders.nte and the approved quote
  //    can still be repaired.
  const { data: quotes, error: qErr } = await supabase
    .from('work_order_quotes')
    .select('quote_id, new_nte_amount, nte_status, created_at')
    .eq('wo_id', woId)
    .in('nte_status', ACTIVE_QUOTE_STATUSES)
    .order('created_at', { ascending: false })
    .limit(1);

  if (qErr) throw qErr;
  const quote = quotes && quotes[0];

  // 2. Pick the NTE value to apply
  const overrideNTE = opts.overrideNTE != null ? parseFloat(opts.overrideNTE) : null;
  const quoteNTE    = quote?.new_nte_amount != null ? parseFloat(quote.new_nte_amount) : null;

  let newNTE  = null;
  let source  = null;
  if (overrideNTE && overrideNTE > 0)      { newNTE = overrideNTE; source = 'override'; }
  else if (quoteNTE && quoteNTE > 0)       { newNTE = quoteNTE;    source = 'quote';    }

  if (!newNTE) {
    return {
      applied: false,
      reason: quote
        ? 'newest quote has no new_nte_amount and no override was provided'
        : 'no active quote found on this work order',
    };
  }

  // 3. Read current NTE for reporting + idempotency check
  const { data: wo, error: woReadErr } = await supabase
    .from('work_orders')
    .select('nte')
    .eq('wo_id', woId)
    .single();
  if (woReadErr) throw woReadErr;
  const oldNTE = parseFloat(wo?.nte) || 0;

  const quoteWasApproved = quote && (quote.nte_status === 'approved' || quote.nte_status === 'verbal_approved');

  // 4. If everything is already in sync, no DB writes needed
  if (oldNTE === newNTE && quoteWasApproved) {
    return {
      applied: false,
      reason: 'NTE and quote status already in sync',
      quoteId: quote?.quote_id,
      quoteWasApproved,
      oldNTE,
      newNTE,
      source,
    };
  }

  // 5. Update work_orders.nte (only if different)
  if (oldNTE !== newNTE) {
    const { error: woUpdErr } = await supabase
      .from('work_orders')
      .update({ nte: newNTE })
      .eq('wo_id', woId);
    if (woUpdErr) throw woUpdErr;
  }

  // 6. Mark the quote approved (idempotent — re-applying to an already-approved
  //    quote is fine; we only set approved_at if it wasn't already)
  if (quote && !quoteWasApproved) {
    const { error: qUpdErr } = await supabase
      .from('work_order_quotes')
      .update({
        nte_status:  'approved',
        approved_at: new Date().toISOString(),
      })
      .eq('quote_id', quote.quote_id);
    if (qUpdErr) throw qUpdErr;
  }

  return {
    applied: true,
    quoteId: quote?.quote_id,
    quoteWasApproved,
    oldNTE,
    newNTE,
    source,
  };
}
