// POST /api/push/wo-notify-hook
//
// Fired by Supabase Database Webhooks (UPDATE) to push a native notification to
// the work order's LEAD TECH when something meaningful changes. Wire it as TWO
// webhooks (both pointing at this same URL):
//   1) table `work_order_quotes`, event UPDATE   → quote submitted/approved/rejected
//   2) table `work_orders`,        event UPDATE   → flagged / returned from invoice
//
// Supabase sends: { type, table, schema, record, old_record }.

import { NextResponse } from 'next/server';
import { notifyTech } from '@/lib/expoPush';
import { getSupabase } from '@/lib/supabase';

const QUOTE_MSG = {
  submitted: { title: '📤 Quote submitted to CBRE', body: (wo) => `${wo.wo_number} — waiting on CBRE approval` },
  approved:  { title: '✅ Quote approved',           body: (wo, r) => `${wo.wo_number} — NTE now $${Number(r.new_nte_amount || 0).toFixed(2)}` },
  rejected:  { title: '❌ Quote rejected',           body: (wo) => `${wo.wo_number} — needs revision` },
};

async function leadFor(supabase, woId) {
  const { data } = await supabase
    .from('work_orders')
    .select('wo_id, wo_number, building, lead_tech_id')
    .eq('wo_id', woId)
    .single();
  return data || null;
}

async function push(leadId, title, body, data, results) {
  if (!leadId) { results.push({ skipped: 'no lead tech' }); return; }
  try {
    results.push(await notifyTech(leadId, title, body, data));
  } catch (e) {
    results.push({ error: e.message });
  }
}

function len(v) {
  if (Array.isArray(v)) return v.length;
  if (typeof v === 'string') return v.trim() ? 1 : 0;
  return v ? 1 : 0;
}

export async function POST(request) {
  try {
    const payload = await request.json();
    const table = payload.table;
    const rec = payload.record || {};
    const old = payload.old_record || {};
    const supabase = getSupabase();
    const results = [];

    if (table === 'work_order_quotes') {
      const s = rec.nte_status;
      if (s && s !== old.nte_status && QUOTE_MSG[s]) {
        const wo = await leadFor(supabase, rec.wo_id);
        if (wo) {
          const m = QUOTE_MSG[s];
          await push(wo.lead_tech_id, m.title, m.body(wo, rec), { type: 'quote_status', status: s, woId: wo.wo_id }, results);
        }
      }
    } else if (table === 'work_orders') {
      const label = rec.wo_number || 'Work order';
      const lead = rec.lead_tech_id;

      // Newly flagged — missing data
      if (len(rec.missing_data_items) > 0 && len(old.missing_data_items) === 0) {
        await push(lead, '🚩 Missing Data', `${label} — info needed before you can continue`, { type: 'flag', flag: 'missing_data', woId: rec.wo_id }, results);
      }
      // Newly flagged — update required
      if (rec.update_required_flagged_at && !old.update_required_flagged_at) {
        await push(lead, '🔵 Update Required', `${label} — an update is required`, { type: 'flag', flag: 'update_required', woId: rec.wo_id }, results);
      }
      // Returned from invoice — status flips back to tech_review
      if (rec.status === 'tech_review' && old.status !== 'tech_review') {
        await push(lead, '↩️ Back for review', `${label} — returned from invoice, needs your review`, { type: 'tech_review', woId: rec.wo_id }, results);
      }
    }

    return NextResponse.json({ ok: true, table, results });
  } catch (err) {
    console.error('wo-notify-hook error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
