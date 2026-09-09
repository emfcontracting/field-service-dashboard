// app/api/work-orders/link-sub/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Link a billing sub work order to the original it replaces — and MOVE the work
// across, which is the part that makes the link mean something.
//
// CBRE issues a sub work order when the original can no longer be billed
// (cancelled by aging, closed for inactivity, or posted with the NTE frozen).
// From that moment only the sub counts: it carries the hours, the costs, the
// check-in/out and the completion, and it runs the normal flow —
// acknowledge → report completion to CBRE → lock → invoice. The original goes
// inactive, keeps the link, and stays in the system for the history.
//
// Until now this was a one-off SQL script (2026-09-08_cbre_sub_work_orders.sql)
// and the UI only wrote the number into a text field, which linked the two
// without moving anything. This route does what the script did, for one pair,
// on demand.
//
// POST { original_wo_id | original_wo_number, sub_wo_number, dry_run? }
// Returns what was (or would be) moved.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { requireStaff } from '@/lib/serverAuth';
import { CBRE_WO_PATTERN } from '@/lib/cbreEmailParser';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const WO_SELECT = `wo_id, wo_number, building, status, nte, client_type, lead_tech_id,
  hours_regular, hours_overtime, miles, material_cost, emf_equipment_cost, rental_cost, trailer_cost,
  time_in, time_out, date_completed, comments, tech_comments,
  acknowledged, is_locked, dispute_status, dispute_sub_wo, dispute_amount, dispute_notes,
  customer_signature, customer_name`;

const COST_FIELDS = ['hours_regular', 'hours_overtime', 'miles', 'material_cost',
                     'emf_equipment_cost', 'rental_cost', 'trailer_cost'];

export async function POST(request) {
  const auth = await requireStaff(request);
  if (!auth.ok) return auth.response;

  let body;
  try { body = await request.json(); } catch { body = {}; }
  const { original_wo_id, original_wo_number, sub_wo_number, dry_run = false } = body;
  const subNumber = String(sub_wo_number || '').trim().toUpperCase();

  if (!subNumber) return Response.json({ error: 'sub_wo_number is required' }, { status: 400 });
  if (!CBRE_WO_PATTERN.test(subNumber)) {
    return Response.json({ error: `${subNumber} is not a CBRE work order number` }, { status: 400 });
  }
  if (!original_wo_id && !original_wo_number) {
    return Response.json({ error: 'original_wo_id or original_wo_number is required' }, { status: 400 });
  }

  try {
    // ── Both ends have to exist ───────────────────────────────────────────────
    const origQuery = supabase.from('work_orders').select(WO_SELECT);
    const { data: original, error: oErr } = original_wo_id
      ? await origQuery.eq('wo_id', original_wo_id).maybeSingle()
      : await origQuery.eq('wo_number', String(original_wo_number).trim().toUpperCase()).maybeSingle();
    if (oErr) throw new Error(`original lookup failed: ${oErr.message}`);
    if (!original) return Response.json({ error: 'Original work order not found' }, { status: 404 });

    const { data: sub, error: sErr } = await supabase
      .from('work_orders').select(WO_SELECT).eq('wo_number', subNumber).maybeSingle();
    if (sErr) throw new Error(`sub lookup failed: ${sErr.message}`);
    if (!sub) {
      return Response.json(
        { error: `${subNumber} is not in FSM yet. Import the CBRE dispatch e-mail first, then link it.` },
        { status: 404 }
      );
    }
    if (sub.wo_id === original.wo_id) {
      return Response.json({ error: 'A work order cannot replace itself' }, { status: 400 });
    }

    // Already linked somewhere else? Say so rather than quietly re-pointing.
    const { data: otherParent } = await supabase
      .from('work_orders').select('wo_number').eq('dispute_sub_wo', subNumber).neq('wo_id', original.wo_id).maybeSingle();
    if (otherParent) {
      return Response.json(
        { error: `${subNumber} is already the sub work order for ${otherParent.wo_number}` },
        { status: 409 }
      );
    }
    if (sub.is_locked) {
      return Response.json({ error: `${subNumber} is locked — it has already been invoiced` }, { status: 409 });
    }

    // ── What moves ────────────────────────────────────────────────────────────
    const [{ data: assignments }, { data: dailyLogs }, { data: invoices }] = await Promise.all([
      supabase.from('work_order_assignments').select('assignment_id').eq('wo_id', original.wo_id),
      supabase.from('daily_hours_log').select('log_id').eq('wo_id', original.wo_id),
      supabase.from('invoices').select('invoice_id, invoice_number, status, qb_invoice_number').eq('wo_id', original.wo_id),
    ]);

    const moved = {
      assignments: assignments?.length || 0,
      daily_logs: dailyLogs?.length || 0,
      costs: Object.fromEntries(COST_FIELDS.map((f) => [f, original[f]]).filter(([, v]) => Number(v) > 0)),
      times: { time_in: original.time_in, time_out: original.time_out, date_completed: original.date_completed },
      lead_tech: !sub.lead_tech_id && original.lead_tech_id ? original.lead_tech_id : null,
      invoices: (invoices || []).map((i) => i.invoice_number),
    };

    // A draft invoice on the original is not carried over — an invoice may only
    // exist after the work order has been acknowledged, and the sub has not been.
    const billedInvoice = (invoices || []).find((i) => i.qb_invoice_number || i.status === 'paid');
    if (billedInvoice) {
      return Response.json(
        { error: `${original.wo_number} already has invoice ${billedInvoice.invoice_number} in QuickBooks — do not move its work to a sub work order` },
        { status: 409 }
      );
    }

    if (dry_run) return Response.json({ dry_run: true, original: original.wo_number, sub: subNumber, moved });

    // ── Move it ───────────────────────────────────────────────────────────────
    const now = new Date().toISOString();
    const stamp = new Date().toLocaleDateString('en-US');

    const subUpdate = {
      status: 'completed',
      time_in: sub.time_in || original.time_in,
      time_out: sub.time_out || original.time_out,
      date_completed: sub.date_completed || original.date_completed,
      customer_signature: sub.customer_signature || original.customer_signature,
      customer_name: sub.customer_name || original.customer_name,
      client_type: sub.client_type || original.client_type,
      lead_tech_id: sub.lead_tech_id || original.lead_tech_id,
      comments: [
        sub.comments || '',
        `[SUB WORK ORDER — ${now.slice(0, 10)}] Billing sub work order for ${original.wo_number}. Hours, costs, check-in/out and the work performed were moved here. ${original.wo_number} is no longer active — look it up there for the full history.`,
        original.tech_comments ? `--- Technician comments from ${original.wo_number} ---\n${original.tech_comments}` : '',
      ].filter(Boolean).join('\n\n'),
      tech_comments: sub.tech_comments || original.tech_comments,
    };
    for (const f of COST_FIELDS) subUpdate[f] = Number(sub[f]) || Number(original[f]) || 0;

    const { error: subErr } = await supabase.from('work_orders').update(subUpdate).eq('wo_id', sub.wo_id);
    if (subErr) throw new Error(`updating ${subNumber} failed: ${subErr.message}`);

    // Hours and logs follow the money.
    if (moved.assignments) {
      const { error } = await supabase.from('work_order_assignments').update({ wo_id: sub.wo_id }).eq('wo_id', original.wo_id);
      if (error) throw new Error(`moving assignments failed: ${error.message}`);
    }
    if (moved.daily_logs) {
      const { error } = await supabase.from('daily_hours_log').update({ wo_id: sub.wo_id }).eq('wo_id', original.wo_id);
      if (error) throw new Error(`moving daily hours failed: ${error.message}`);
    }

    // The original goes inactive: no costs, no invoicing flags, linked, closed.
    const origUpdate = {
      dispute_status: 'superseded',
      dispute_sub_wo: subNumber,
      dispute_notes: [
        original.dispute_notes || '',
        `${stamp} — Closed — replaced by sub work order ${subNumber}. Hours, costs and the work performed were moved there; this work order stays for the history only.`,
      ].filter(Boolean).join('\n'),
      acknowledged: false, acknowledged_at: null,
      is_locked: false, locked_at: null, locked_by: null,
      completion_transferred: false, completion_transferred_at: null, completion_transferred_by: null,
    };
    for (const f of COST_FIELDS) origUpdate[f] = 0;

    const { error: origErr } = await supabase.from('work_orders').update(origUpdate).eq('wo_id', original.wo_id);
    if (origErr) throw new Error(`updating ${original.wo_number} failed: ${origErr.message}`);

    return Response.json({
      success: true,
      original: original.wo_number,
      sub: subNumber,
      moved,
      message: `${original.wo_number} is now closed and replaced by ${subNumber}. ${subNumber} is in the dashboard — run acknowledge → report completion → lock → invoice on it.`,
    });
  } catch (e) {
    console.error('link-sub error:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
