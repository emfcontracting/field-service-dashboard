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

const WO_SELECT = `wo_id, wo_number, building, status, nte, client, client_type, lead_tech_id,
  hours, hours_regular, hours_overtime, miles, labor_cost, mileage_rate,
  material_cost, emf_equipment_cost, rental_cost, trailer_cost,
  time_in, time_out, date_completed, comments, tech_comments,
  comments_spanish, comments_original_language, include_admin_hours,
  photos_received, photos_verified_at, photos_email_subject, photos_email_reference,
  writeups_received, writeups_verified_at, writeups_email_subject,
  receipts_received, receipts_verified_at, receipts_email_subject,
  missing_data_items, missing_data_comment, missing_data_flagged_by, missing_data_flagged_at,
  update_required_items, update_required_comment, update_required_flagged_by, update_required_flagged_at,
  acknowledged, is_locked, dispute_status, dispute_sub_wo, dispute_amount, dispute_notes,
  customer_signature, customer_name`;

// Money and hours: moved to the sub, zeroed on the original.
const COST_FIELDS = ['hours', 'hours_regular', 'hours_overtime', 'miles', 'labor_cost', 'material_cost',
                     'emf_equipment_cost', 'rental_cost', 'trailer_cost'];

// Proof the work was documented. These are not files — technicians e-mail the
// photos to the office and verify-photos sets the flag — so what moves is the
// status plus the subject line that points at the mail. Without this the sub
// shows "photos missing" and the office chases a technician for pictures that
// were sent months ago: true on five of the fifteen pairs linked before
// 2026-11-04.
const DOC_FIELDS = [
  'photos_received', 'photos_verified_at', 'photos_email_subject', 'photos_email_reference',
  'writeups_received', 'writeups_verified_at', 'writeups_email_subject',
  'receipts_received', 'receipts_verified_at', 'receipts_email_subject',
];

// Carried over only where the sub has nothing of its own.
const CARRY_FIELDS = ['client', 'client_type', 'mileage_rate', 'include_admin_hours',
                      'comments_spanish', 'comments_original_language'];

// An open "missing data" / "update required" flag belongs to the work, so it
// follows it. Only if the sub carries none of its own.
const FLAG_FIELDS = [
  ['missing_data_items', 'missing_data_comment', 'missing_data_flagged_by', 'missing_data_flagged_at'],
  ['update_required_items', 'update_required_comment', 'update_required_flagged_by', 'update_required_flagged_at'],
];

// Every table hanging off a work order. The first two were already moved; the
// rest were not, which is how check-in/out rows, clock pauses, flags, target
// history and written quotes stayed behind on a work order nobody looks at.
const CHILD_TABLES = [
  'work_order_assignments',
  'daily_hours_log',
  'work_order_time_log',
  'work_order_clock_pauses',
  'work_order_flags',
  'work_order_target_history',
  'work_order_quotes',
];

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
    const childCounts = {};
    for (const table of CHILD_TABLES) {
      const { count, error } = await supabase
        .from(table).select('wo_id', { count: 'exact', head: true }).eq('wo_id', original.wo_id);
      if (error) throw new Error(`counting ${table} failed: ${error.message}`);
      childCounts[table] = count || 0;
    }
    const { data: invoices } = await supabase
      .from('invoices').select('invoice_id, invoice_number, status, qb_invoice_number').eq('wo_id', original.wo_id);

    const docs = Object.fromEntries(
      DOC_FIELDS.map((f) => [f, original[f]]).filter(([, v]) => v !== null && v !== undefined && v !== false)
    );

    const moved = {
      rows: childCounts,
      costs: Object.fromEntries(COST_FIELDS.map((f) => [f, original[f]]).filter(([, v]) => Number(v) > 0)),
      times: { time_in: original.time_in, time_out: original.time_out, date_completed: original.date_completed },
      documentation: docs,
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
      lead_tech_id: sub.lead_tech_id || original.lead_tech_id,
      comments: [
        sub.comments || '',
        `[SUB WORK ORDER — ${now.slice(0, 10)}] Billing sub work order for ${original.wo_number}. Hours, costs, check-in/out, clock pauses, flags, written quotes and the photo/write-up/receipt status were all moved here. The photos themselves are in the office mailbox under ${original.wo_number}. ${original.wo_number} is no longer active — look it up there for the full history.`,
        original.tech_comments ? `--- Technician comments from ${original.wo_number} ---\n${original.tech_comments}` : '',
      ].filter(Boolean).join('\n\n'),
      tech_comments: sub.tech_comments || original.tech_comments,
    };
    for (const f of COST_FIELDS) subUpdate[f] = Number(sub[f]) || Number(original[f]) || 0;
    for (const f of CARRY_FIELDS) subUpdate[f] = sub[f] ?? original[f] ?? null;
    // Documentation status: never downgrade something the sub already has.
    for (const f of DOC_FIELDS) {
      const own = sub[f];
      subUpdate[f] = (own === null || own === undefined || own === false) ? (original[f] ?? own ?? null) : own;
    }
    // A flag moves as a set or not at all — half a flag is worse than none.
    for (const group of FLAG_FIELDS) {
      const subHasOwn = group.some((f) => sub[f] !== null && sub[f] !== undefined);
      if (!subHasOwn) for (const f of group) subUpdate[f] = original[f] ?? null;
    }

    const { error: subErr } = await supabase.from('work_orders').update(subUpdate).eq('wo_id', sub.wo_id);
    if (subErr) throw new Error(`updating ${subNumber} failed: ${subErr.message}`);

    // Everything that hangs off the work order follows the money: hours, team,
    // check-in/out, clock pauses, flags, target history and the written quotes.
    for (const table of CHILD_TABLES) {
      if (!childCounts[table]) continue;
      const { error } = await supabase.from(table).update({ wo_id: sub.wo_id }).eq('wo_id', original.wo_id);
      if (error) throw new Error(`moving ${table} failed: ${error.message}`);
    }

    // The original goes inactive: no costs, no invoicing flags, linked, closed.
    const origUpdate = {
      dispute_status: 'superseded',
      dispute_sub_wo: subNumber,
      dispute_notes: [
        original.dispute_notes || '',
        `${stamp} — Closed — replaced by sub work order ${subNumber}. Hours, costs, check-in/out, clock pauses, flags and written quotes were moved there; this work order stays for the history only.`,
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
