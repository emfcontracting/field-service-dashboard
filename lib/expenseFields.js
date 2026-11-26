// lib/expenseFields.js  (server only)
// Extra expense fields on contractor_tax_records, cleaned from request bodies:
// vendor, wo_id, bill_to_emf, receipt_url (a storage PATH in the private
// bucket — <user_id>/<file>; full URLs are no longer accepted).
export function expenseExtras(body, userId) {
  const out = {};
  if (body.vendor !== undefined) out.vendor = String(body.vendor || '').trim().slice(0, 200) || null;
  if (body.wo_id !== undefined) out.wo_id = body.wo_id === null || body.wo_id === '' ? null : body.wo_id;
  if (body.bill_to_emf !== undefined) out.bill_to_emf = !!body.bill_to_emf;
  if (body.receipt_url !== undefined) {
    const v = String(body.receipt_url || '').trim();
    if (!v) out.receipt_url = null;
    else if (/^https?:/i.test(v) || v.includes('..') || !v.startsWith(`${userId}/`)) out.__badReceipt = true;
    else out.receipt_url = v;
  }
  return out;
}

/** wo_number from the form → wo_id (null when empty). → { wo_id } | { error } */
export async function resolveWoNumber(supabase, body) {
  if (body.wo_number === undefined) return {};
  const n = String(body.wo_number || '').trim().toUpperCase();
  if (!n) return { wo_id: null };
  const { data } = await supabase.from('work_orders').select('wo_id').eq('wo_number', n).maybeSingle();
  if (!data) return { error: `Work order ${n} not found` };
  return { wo_id: data.wo_id };
}

/** Rows from the DB → add wo_number for the form. */
export function withWoNumber(rows) {
  return (rows || []).map(({ work_order, ...r }) => ({ ...r, wo_number: work_order?.wo_number || null }));
}
