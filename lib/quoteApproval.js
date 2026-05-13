// lib/quoteApproval.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralised quote-approval logic. When a quote is approved (either via Gmail
// label sync or via manual CBRE-status change in the dashboard), we need to:
//   1. Update work_orders.nte to the new NTE amount
//   2. Mark the matching work_order_quotes row as approved
//
// Source of truth for the new NTE amount, in priority order:
//   a) `overrideNTE` passed by caller (e.g. value parsed out of the Gmail email)
//   b) `new_nte_amount` from the latest pending/submitted quote on this WO
//
// If neither is available the function is a no-op and returns applied=false so
// the caller can decide whether to fall back to a warning/notification.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} supabase  — Supabase client (server or browser)
 * @param {string} woId      — work_orders.wo_id (UUID)
 * @param {object} [opts]
 * @param {number} [opts.overrideNTE]  — explicit NTE value (takes precedence)
 * @returns {Promise<{
 *   applied: boolean,
 *   reason?: string,
 *   quoteId?: string,
 *   oldNTE?: number,
 *   newNTE?: number,
 *   source?: 'override' | 'quote',
 * }>}
 */
export async function applyQuoteApproval(supabase, woId, opts = {}) {
  if (!woId) return { applied: false, reason: 'no wo_id' };

  // 1. Find newest pending/submitted quote (used both for sourcing the NTE and
  //    for flipping the quote to approved at the end).
  const { data: quotes, error: qErr } = await supabase
    .from('work_order_quotes')
    .select('quote_id, new_nte_amount, nte_status, created_at')
    .eq('wo_id', woId)
    .in('nte_status', ['pending', 'submitted'])
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
    return { applied: false, reason: 'no NTE amount available (no override and no pending quote with new_nte_amount)' };
  }

  // 3. Read current NTE for reporting
  const { data: wo, error: woReadErr } = await supabase
    .from('work_orders')
    .select('nte')
    .eq('wo_id', woId)
    .single();
  if (woReadErr) throw woReadErr;
  const oldNTE = parseFloat(wo?.nte) || 0;

  // 4. Update work_orders.nte
  const { error: woUpdErr } = await supabase
    .from('work_orders')
    .update({ nte: newNTE })
    .eq('wo_id', woId);
  if (woUpdErr) throw woUpdErr;

  // 5. Mark the quote approved (if one exists)
  if (quote) {
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
    oldNTE,
    newNTE,
    source,
  };
}
