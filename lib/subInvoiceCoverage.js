// lib/subInvoiceCoverage.js
// -----------------------------------------------------------------------------
// For EMF's invoicing (EMF → CBRE): per work order, which subcontractors
// logged hours on it and which of them already put it on an invoice to EMF.
// Only a warning in the UI — the idea from 12/2025: see before paying the sub
// or billing CBRE whose paperwork is missing.
//
// "Invoiced" = a line for this WO on one of the sub's invoices that is not a
// draft and that EMF has not rejected. Only users with an enabled
// subcontractor_profiles row count as subs.
//
// Works with any Supabase client that may read these tables (staff session
// in the browser, or the service client on the server).
// -----------------------------------------------------------------------------
const CHUNK = 200;
const chunks = (arr) => { const out = []; for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK)); return out; };

/**
 * @returns {Promise<Record<string, { subs: number, invoiced: number, missing: string[] }>>}
 */
export async function subInvoiceCoverage(supabase, woIds) {
  const ids = [...new Set((woIds || []).filter(Boolean))];
  if (!ids.length) return {};

  const { data: profiles, error: pErr } = await supabase
    .from('subcontractor_profiles')
    .select('user_id, is_enabled');
  if (pErr) throw pErr;
  const subIds = new Set((profiles || []).filter((p) => p.is_enabled !== false).map((p) => p.user_id));
  if (!subIds.size) return {};

  const logs = [];
  const lines = [];
  for (const part of chunks(ids)) {
    const [l, it] = await Promise.all([
      supabase.from('daily_hours_log')
        .select('wo_id, user_id, hours_regular, hours_overtime')
        .in('wo_id', part),
      supabase.from('subcontractor_invoice_items')
        .select('wo_id, invoice:subcontractor_invoices(user_id, status, emf_review_status)')
        .in('wo_id', part),
    ]);
    if (l.error) throw l.error;
    if (it.error) throw it.error;
    logs.push(...(l.data || []));
    lines.push(...(it.data || []));
  }

  const worked = {};   // wo_id -> Set(user_id)
  for (const r of logs) {
    if (!subIds.has(r.user_id)) continue;
    if ((parseFloat(r.hours_regular) || 0) + (parseFloat(r.hours_overtime) || 0) <= 0) continue;
    (worked[r.wo_id] ||= new Set()).add(r.user_id);
  }
  const userIds = [...new Set(Object.values(worked).flatMap((s) => [...s]))];
  const names = {};
  if (userIds.length) {
    const { data: users, error: uErr } = await supabase.from('users').select('user_id, first_name, last_name').in('user_id', userIds);
    if (uErr) throw uErr;
    for (const u of users || []) names[u.user_id] = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unknown';
  }
  const billed = {};   // wo_id -> Set(user_id)
  for (const r of lines) {
    const inv = r.invoice;
    if (!inv || inv.status === 'draft' || inv.emf_review_status === 'rejected') continue;
    (billed[r.wo_id] ||= new Set()).add(inv.user_id);
  }

  const out = {};
  for (const [woId, subs] of Object.entries(worked)) {
    const done = billed[woId] || new Set();
    const missing = [...subs].filter((uid) => !done.has(uid)).map((uid) => names[uid] || 'Unknown');
    out[woId] = { subs: subs.size, invoiced: subs.size - missing.length, missing };
  }
  return out;
}
