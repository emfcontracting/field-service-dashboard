// lib/subInvoiceOverlap.js  (server only)
// -----------------------------------------------------------------------------
// Which daily_hours_log entries of a subcontractor already appear on another
// of his invoices. Match = same work order + same work date, on an hours /
// mileage / material line. Invoices EMF rejected don't count (they get
// recreated). This only WARNS — nothing is blocked.
// -----------------------------------------------------------------------------
const BILLED_TYPES = ['hours', 'mileage', 'material'];
const key = (woId, day) => `${woId || ''}|${day || ''}`;

/**
 * @param supabase  service client
 * @param userId    subcontractor
 * @param entries   [{ wo_id, work_date }]
 * @param excludeInvoiceId  the invoice being looked at (admin), optional
 * @returns [{ wo_id, work_date, invoice_id, invoice_number, status }]
 */
export async function findAlreadyInvoiced(supabase, userId, entries, excludeInvoiceId = null) {
  const days = [...new Set((entries || []).map((e) => e.work_date).filter(Boolean))].sort();
  if (!days.length) return [];

  let q = supabase
    .from('subcontractor_invoices')
    .select('invoice_id, invoice_number, status, emf_review_status')
    .eq('user_id', userId)
    .lte('period_start', days[days.length - 1])
    .gte('period_end', days[0]);
  if (excludeInvoiceId) q = q.neq('invoice_id', excludeInvoiceId);
  const { data: invoices, error } = await q;
  if (error) throw error;
  const live = (invoices || []).filter((i) => i.emf_review_status !== 'rejected');
  if (!live.length) return [];
  const byId = Object.fromEntries(live.map((i) => [i.invoice_id, i]));

  const { data: items, error: itemsError } = await supabase
    .from('subcontractor_invoice_items')
    .select('invoice_id, wo_id, work_date, item_type')
    .in('invoice_id', live.map((i) => i.invoice_id))
    .in('item_type', BILLED_TYPES)
    .in('work_date', days);
  if (itemsError) throw itemsError;

  const wanted = new Set((entries || []).map((e) => key(e.wo_id, e.work_date)));
  const seen = new Set();
  const out = [];
  for (const it of items || []) {
    const k = key(it.wo_id, it.work_date);
    if (!wanted.has(k)) continue;
    const dedupe = `${k}|${it.invoice_id}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const inv = byId[it.invoice_id];
    out.push({ wo_id: it.wo_id, work_date: it.work_date, invoice_id: it.invoice_id, invoice_number: inv.invoice_number, status: inv.status });
  }
  return out.sort((a, b) => (a.work_date < b.work_date ? -1 : 1));
}
