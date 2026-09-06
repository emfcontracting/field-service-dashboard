// lib/completionReadiness.js
// -----------------------------------------------------------------------------
// "Is this completed work order ready to be reported to CBRE?" — ONE answer for
// the queue-completions producer, the CBRE Data Entry view and the sidebar
// badge, so all three agree on what is ready, what is waiting and why.
//
// A completed WO is reported to CBRE with the Vendor App action
// "Complete A Work Order", which needs a Start and an End (date + time). We
// take them from the technician's check-in / check-out:
//   start = work_orders.time_in   (set once, at the FIRST check-in)
//   end   = work_orders.time_out  (overwritten at every check-out → the LAST)
// with date_completed as the fallback for a missing end.
//
// Not ready when:
//   1. cbre_status has a pending state at CBRE (quote submitted, pending
//      quote, escalation…) — only null / quote_approved are clean;
//   2. we hold a pending / submitted NTE quote of our own;
//   3. the accrued cost exceeds the NTE (CBRE pays up to the NTE — an NTE
//      increase has to go first);
//   4. there is no usable start/end (no check-in and no completion date) —
//      the office sends those by hand from the Send-to-CBRE dialog.
// Pure: pass the row in (with the nested relations listed in
// COMPLETION_SELECT), get an answer out. No I/O.
// -----------------------------------------------------------------------------
import { calcTotal } from './billing';
import { parseTs, buildCbrePayload } from './cbreVendorForm';

export const CBRE_STATUS_READY = [null, undefined, '', 'quote_approved'];
// Only CBRE-numbered work orders go to the Vendor App form.
export const CBRE_WO_PATTERN = /^(C|P|PJ|ST|COU)\d+$/i;
export const QUOTE_PENDING_STATES = ['pending', 'submitted'];

// The work_orders select every consumer uses (keeps the readiness inputs in
// one place; add a column here and all three callers get it).
export const COMPLETION_SELECT = `
  wo_id, wo_number, building, work_order_description, comments, nte, status,
  acknowledged, is_locked, cbre_status, client_type, include_admin_hours,
  hours_regular, hours_overtime, miles,
  material_cost, emf_equipment_cost, rental_cost, trailer_cost,
  time_in, time_out, date_completed, acknowledged_at, customer_signature, customer_name,
  completion_transferred, completion_transferred_at, completion_transferred_by,
  cbre_completion_submitted_at, updated_at,
  lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name),
  work_order_assignments(hours_regular, hours_overtime, miles),
  daily_hours_log(hours_regular, hours_overtime, miles, tech_material_cost),
  work_order_quotes(quote_id, nte_status, new_nte_amount)
`;

export const READINESS_LABEL = {
  cbre_status:   'CBRE has an open request on this WO',
  pending_quote: 'NTE quote pending on our side',
  over_nte:      'Cost exceeds the NTE',
  no_times:      'No check-in / check-out on the work order',
  not_cbre:      'Not a CBRE work order number',
};

/** Start/End window for the Complete action, or nulls. */
export function completionWindow(wo) {
  const startAt = parseTs(wo?.time_in);
  const endAt = parseTs(wo?.time_out) || parseTs(wo?.date_completed);
  let source = 'check-in/out';
  if (!wo?.time_out && endAt) source = 'check-in + completion date';
  return { startAt, endAt, source };
}

/** Accrued T&M cost from the nested rows (same math as the invoice). */
export function completionActualTotal(wo) {
  return calcTotal(wo, { assignments: wo?.work_order_assignments || [], dailyLogs: wo?.daily_hours_log || [] });
}

export function completionReadinessCheck(wo) {
  if (!CBRE_WO_PATTERN.test(String(wo.wo_number || '').trim())) {
    return { ready: false, reason: 'not_cbre', detail: wo.wo_number };
  }
  if (!CBRE_STATUS_READY.includes(wo.cbre_status)) {
    return { ready: false, reason: 'cbre_status', detail: wo.cbre_status };
  }
  const pendingQuote = (wo.work_order_quotes || []).find((q) => QUOTE_PENDING_STATES.includes(q.nte_status));
  if (pendingQuote) {
    return { ready: false, reason: 'pending_quote', detail: pendingQuote.nte_status };
  }
  const actual = completionActualTotal(wo);
  const nte = parseFloat(wo.nte) || 0;
  if (actual > nte) {
    return { ready: false, reason: 'over_nte', detail: { actual, nte } };
  }
  const { startAt, endAt } = completionWindow(wo);
  if (!startAt || !endAt) {
    return { ready: false, reason: 'no_times', detail: { hasStart: !!startAt, hasEnd: !!endAt } };
  }
  return { ready: true };
}

// Same defaults as the other producers. NEXT_PUBLIC_* so the browser (Data
// Entry "Queue now") and the server (producer) build identical rows.
export const CBRE_REQUESTOR_EMAIL =
  process.env.CBRE_REQUESTOR_EMAIL || process.env.NEXT_PUBLIC_CBRE_REQUESTOR_EMAIL || 'emfcontractingsc@gmail.com';
export const CBRE_VENDOR_NAME =
  process.env.CBRE_VENDOR_NAME || process.env.NEXT_PUBLIC_CBRE_VENDOR_NAME || 'EMF Contracting LLC(Gaston)';
export const CBRE_COMPLETE_COMMENT =
  process.env.CBRE_COMPLETE_COMMENT || 'Work completed by EMF Contracting LLC.';

/**
 * The approval_requests row for reporting this completion — used by the
 * producer and by "Queue now" in CBRE Data Entry, so both queue the same thing.
 * Returns { row, problems }; row is null when the form cannot be built.
 */
export function buildCompletionApprovalRow(wo, { requestorEmail = CBRE_REQUESTOR_EMAIL, vendor = CBRE_VENDOR_NAME, comment = CBRE_COMPLETE_COMMENT, createdBy = null } = {}) {
  const { startAt, endAt } = completionWindow(wo);
  const built = buildCbrePayload({
    kind: 'cbre_complete',
    woNumber: wo.wo_number,
    buildingRaw: wo.ups_building_code || wo.building,
    requestorEmail,
    vendor,
    startAt,
    endAt,
    comment,
  });
  if (built.problems.length) return { row: null, problems: built.problems };
  const row = {
    kind: 'cbre_complete',
    wo_id: wo.wo_id,
    wo_number: wo.wo_number,
    title: `Complete ${wo.wo_number} at CBRE`,
    summary: `${wo.ups_building_code || wo.building || 'unknown site'} · ${built.readable.Start || '?'} → ${built.readable.End || '?'}`,
    payload: {
      ...built.payload,
      _readable: {
        ...built.readable,
        leadTech: wo.lead_tech ? `${wo.lead_tech.first_name || ''} ${wo.lead_tech.last_name || ''}`.trim() : null,
        dateCompleted: wo.date_completed,
        nte: wo.nte,
      },
    },
    status: 'pending',
  };
  if (createdBy) row.created_by = createdBy;
  return { row, problems: [] };
}

/** Still in the office's hands (mirrors the dashboard's work-order filter). */
export const isActiveWo = (wo) => !!wo && !wo.acknowledged && !wo.is_locked;

/** Already reported — by the Approvals tab, by CBRE's confirmation, or by hand. */
export const isCompletionDone = (wo) => !!(wo?.completion_transferred || wo?.cbre_completion_submitted_at);
