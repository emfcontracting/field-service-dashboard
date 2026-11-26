// lib/taxRecordSync.js  (server only)
// -----------------------------------------------------------------------------
// Fills a sub's Expenses (contractor_tax_records) for a tax year from what the
// system already knows, so he doesn't type it twice:
//   material — every daily_hours_log entry with tech_material_cost
//              (category Material, linked to the work order)
//   mileage  — per month: EMF work-order miles + his own trips, valued at the
//              IRS business rate of each date (category Mileage)
//   hotel    — hotel/lodging lines on his sent/paid invoices (category Hotels;
//              lines passed on from his own expenses, [R-…], are skipped)
// Rules: an entry the sub edited (edited) or deleted (dismissed) is never
// touched again; entries whose origin disappeared are removed (unless edited);
// manual entries are never touched, and an entry the sub already typed in
// (same date, category, amount) is not generated again. Idempotent — safe on
// every page load.
// -----------------------------------------------------------------------------
import { irsRateOn } from './irsMileage';

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

async function desiredRecords(supabase, userId, year) {
  const from = `${year}-01-01`, to = `${year}-12-31`;
  const [logs, trips, invoices] = await Promise.all([
    supabase.from('daily_hours_log').select('*, work_order:work_orders(wo_number, building)')
      .eq('user_id', userId).gte('work_date', from).lte('work_date', to),
    supabase.from('contractor_trips').select('trip_date, miles')
      .eq('user_id', userId).gte('trip_date', from).lte('trip_date', to),
    supabase.from('subcontractor_invoices').select('invoice_id, invoice_number, status, period_end')
      .eq('user_id', userId).neq('status', 'draft'),
  ]);
  if (logs.error) throw logs.error;
  // trips table may not exist yet on an older database — mileage then uses EMF miles only
  const tripRows = trips.error ? [] : (trips.data || []);

  const out = [];
  // material
  for (const l of logs.data || []) {
    const amt = round2(l.tech_material_cost);
    if (amt <= 0) continue;
    const id = l.log_id ?? l.id;
    const wo = l.work_order?.wo_number;
    out.push({
      source: 'material', source_ref: `hours:${id}`, entry_date: l.work_date, category_name: 'Material',
      amount: amt, wo_id: l.wo_id ?? null,
      notes: `Material on ${wo || 'work order'}${l.work_order?.building ? ' – ' + l.work_order.building : ''} (from EMF hours log)`,
    });
  }
  // mileage per month
  const months = {};
  const addMiles = (day, miles, kind) => {
    const m = parseFloat(miles) || 0;
    if (m <= 0) return;
    const key = String(day).slice(0, 7);
    const b = (months[key] ||= { emf: 0, own: 0, value: 0, last: day });
    b[kind] += m;
    b.value += m * (irsRateOn(day) || 0);
    if (day > b.last) b.last = day;
  };
  for (const l of logs.data || []) addMiles(l.work_date, l.miles, 'emf');
  for (const t of tripRows) addMiles(t.trip_date, t.miles, 'own');
  for (const [ym, b] of Object.entries(months)) {
    if (b.value <= 0) continue;
    const [, mm] = ym.split('-');
    const lastDay = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(mm), 0)).toISOString().slice(0, 10);
    out.push({
      source: 'mileage', source_ref: `mileage:${ym}`, entry_date: lastDay, category_name: 'Mileage',
      amount: round2(b.value), wo_id: null,
      notes: `${MONTHS[Number(mm) - 1]} ${ym.slice(0, 4)}: ${b.emf.toFixed(1)} mi EMF work orders${b.own ? ` + ${b.own.toFixed(1)} mi own trips` : ''} at IRS rate`,
    });
  }
  // hotels from invoice lines
  const invs = invoices.error ? [] : (invoices.data || []);
  if (invs.length) {
    const byId = Object.fromEntries(invs.map((i) => [i.invoice_id, i]));
    const { data: lines, error } = await supabase.from('subcontractor_invoice_items')
      .select('item_id, invoice_id, description, amount, work_date')
      .in('invoice_id', invs.map((i) => i.invoice_id)).eq('item_type', 'custom');
    if (error) throw error;
    for (const li of lines || []) {
      const d = String(li.description || '');
      if (!/hotel|lodging|motel/i.test(d) || /\[R-[0-9a-f]{8}\]/i.test(d)) continue;
      const inv = byId[li.invoice_id];
      const day = li.work_date || inv?.period_end;
      if (!day || !String(day).startsWith(String(year))) continue;
      const amt = round2(li.amount);
      if (amt <= 0) continue;
      out.push({
        source: 'hotel', source_ref: `item:${li.item_id}`, entry_date: day, category_name: 'Hotels',
        amount: amt, wo_id: null, invoice_ref: inv?.invoice_number || null,
        notes: `${d} (from invoice ${inv?.invoice_number || ''})`.trim(),
      });
    }
  }
  return out;
}

export async function syncTaxRecords(supabase, userId, year) {
  const want = await desiredRecords(supabase, userId, year);
  const { data: existing, error } = await supabase.from('contractor_tax_records')
    .select('record_id, tax_year, source, source_ref, entry_date, category_name, amount, notes, wo_id, invoice_ref, edited, dismissed')
    .eq('user_id', userId).not('source_ref', 'is', null);   // all years: an origin may have moved years
  if (error) throw error;
  const have = Object.fromEntries((existing || []).map((r) => [r.source_ref, r]));
  const wanted = new Set(want.map((w) => w.source_ref));

  // Entries the sub already typed in himself (same date, category, amount)
  // are not generated a second time.
  const { data: manual } = await supabase.from('contractor_tax_records')
    .select('entry_date, category_name, amount')
    .eq('user_id', userId).eq('tax_year', Number(year)).is('source_ref', null);
  const manualKey = new Set((manual || []).map((m) => `${m.entry_date}|${m.category_name}|${round2(m.amount)}`));

  const inserts = [];
  let updated = 0, removed = 0, skippedManual = 0;
  for (const w of want) {
    const row = { tax_year: Number(year), user_id: userId, invoice_ref: null, ...w };
    const h = have[w.source_ref];
    if (!h) {
      if (manualKey.has(`${w.entry_date}|${w.category_name}|${w.amount}`)) { skippedManual++; continue; }
      inserts.push(row);
      continue;
    }
    if (h.edited || h.dismissed) continue;
    const changed = round2(h.amount) !== w.amount || h.entry_date !== w.entry_date || (h.notes || '') !== (w.notes || '')
      || h.category_name !== w.category_name || Number(h.tax_year) !== Number(year);
    if (changed) {
      const { error: uErr } = await supabase.from('contractor_tax_records')
        .update({ tax_year: Number(year), amount: w.amount, entry_date: w.entry_date, notes: w.notes, category_name: w.category_name, wo_id: w.wo_id ?? null, invoice_ref: w.invoice_ref ?? null })
        .eq('record_id', h.record_id);
      if (!uErr) updated++;
    }
  }
  if (inserts.length) {
    const { error: iErr } = await supabase.from('contractor_tax_records').insert(inserts);
    if (iErr) throw iErr;
  }
  const gone = (existing || []).filter((r) => Number(r.tax_year) === Number(year)
    && !wanted.has(r.source_ref) && !r.edited && !r.dismissed && r.source !== 'manual');
  if (gone.length) {
    const { error: dErr } = await supabase.from('contractor_tax_records').delete().in('record_id', gone.map((r) => r.record_id));
    if (!dErr) removed = gone.length;
  }
  return { added: inserts.length, updated, removed, skippedManual };
}
