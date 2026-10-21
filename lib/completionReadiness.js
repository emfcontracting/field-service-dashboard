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
import { CBRE_WO_PATTERN } from './cbreEmailParser';
import { isDisputeActive } from './disputeStatus';
export { CBRE_WO_PATTERN };

export const CBRE_STATUS_READY = [null, undefined, '', 'quote_approved'];
export const QUOTE_PENDING_STATES = ['pending', 'submitted'];

// The work_orders select every consumer uses (keeps the readiness inputs in
// one place; add a column here and all three callers get it).
export const COMPLETION_SELECT = `
  wo_id, wo_number, building, work_order_description, comments, nte, status,
  acknowledged, is_locked, cbre_status, cbre_posting_status, dispute_status, dispute_sub_wo,
  client_type, include_admin_hours,
  hours_regular, hours_overtime, miles,
  material_cost, emf_equipment_cost, rental_cost, trailer_cost,
  time_in, time_out, date_completed, acknowledged_at, customer_signature, customer_name,
  completion_transferred, completion_transferred_at, completion_transferred_by,
  cbre_completion_submitted_at, updated_at,
  lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name),
  work_order_assignments(hours_regular, hours_overtime, miles),
  daily_hours_log(work_date, hours_regular, hours_overtime, miles, tech_material_cost),
  work_order_quotes(quote_id, nte_status, new_nte_amount)
`;

export const READINESS_LABEL = {
  cbre_status:   'CBRE has an open request on this WO',
  pending_quote: 'NTE quote pending on our side',
  over_nte:      'Cost exceeds the NTE',
  no_times:      'No check-in / check-out on the work order',
  not_cbre:      'Not a CBRE work order number',
  escalated:     'Open escalation — being worked in the Escalations tab',
};

/**
 * Start/End window for the Complete action, or nulls.
 *
 * The check-in / check-out pair is the best answer and stays first. When it is
 * missing we fall back to the technician's own day entries: they carry no
 * clock time, only the day worked, and that is enough — the form's DATE fields
 * are what we prefill, and the time dropdowns are picked by hand on CBRE's page
 * either way. Without this fallback eleven finished work orders sat outside the
 * Approvals queue for want of a timestamp nobody ever recorded, some of them
 * since 2025.
 */
export function completionWindow(wo) {
  const days = (wo?.daily_hours_log || [])
    .map((l) => l?.work_date)
    .filter(Boolean)
    .map(String)
    .sort();

  const fromLog = () => (days.length
    ? { startAt: parseTs(days[0]), endAt: parseTs(days[days.length - 1]),
        source: 'daily hours log', timesKnown: false }
    : { startAt: null, endAt: null, source: null, timesKnown: false });

  const startAt = parseTs(wo?.time_in);
  const endAt   = parseTs(wo?.time_out) || parseTs(wo?.date_completed);

  // Both ends come from ONE source or the window is not used. Mixing them is
  // how a 3.5-hour job on 2026-01-30 came out as a window running to
  // 2026-03-24: the start from the day entries, the end from date_completed.
  // The same mismatch can even run backwards — C3297245 is stamped complete on
  // 2025-10-10 while its hours were logged on 2025-12-29.
  if (!startAt || !endAt) return fromLog();
  if (endAt < startAt)    return fromLog();

  return {
    startAt,
    endAt,
    source: wo?.time_out ? 'check-in/out' : 'check-in + completion date',
    timesKnown: true,
  };
}

/** Accrued T&M cost from the nested rows (same math as the invoice). */
export function completionActualTotal(wo) {
  return calcTotal(wo, { assignments: wo?.work_order_assignments || [], dailyLogs: wo?.daily_hours_log || [] });
}

export function completionReadinessCheck(wo) {
  if (!CBRE_WO_PATTERN.test(String(wo.wo_number || '').trim())) {
    return { ready: false, reason: 'not_cbre', detail: wo.wo_number };
  }
  if (isDisputeActive(wo)) {
    return { ready: false, reason: 'escalated', detail: wo.dispute_status };
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
  const { startAt, endAt, source, timesKnown } = completionWindow(wo);
  const built = buildCbrePayload({
    kind: 'cbre_complete',
    woNumber: wo.wo_number,
    buildingRaw: wo.ups_building_code || wo.building,
    requestorEmail,
    vendor,
    startAt,
    endAt,
    timesKnown,
    comment,
  });
  if (built.problems.length) return { row: null, problems: built.problems };
  const row = {
    kind: 'cbre_complete',
    wo_id: wo.wo_id,
    wo_number: wo.wo_number,
    title: `Complete ${wo.wo_number} at CBRE`,
    // The source belongs in the summary: whoever picks the time dropdowns on
    // CBRE's form has to know whether the window comes from a real check-in or
    // from the day entries, where only the date is recorded.
    summary: `${wo.ups_building_code || wo.building || 'unknown site'} · ${built.readable.Start || '?'} → ${built.readable.End || '?'}`
      + (source === 'check-in/out' ? '' : ` · times from ${source}`),
    payload: {
      ...built.payload,
      _readable: {
        ...built.readable,
        leadTech: wo.lead_tech ? `${wo.lead_tech.first_name || ''} ${wo.lead_tech.last_name || ''}`.trim() : null,
        dateCompleted: wo.date_completed,
        timeSource: source,
        nte: wo.nte,
      },
    },
    status: 'pending',
  };
  if (createdBy) row.created_by = createdBy;
  return { row, problems: [] };
}

/** Still in the office's hands (mirrors the dashboard's work-order filter). */
// An open escalation takes the work order out of CBRE Data Entry too: while
// the problem is unsettled the completion must not be reported to CBRE.
export const isActiveWo = (wo) => !!wo && !wo.acknowledged && !wo.is_locked && !isDisputeActive(wo);

/** Already reported — by the Approvals tab, by CBRE's confirmation, or by hand. */
export const isCompletionDone = (wo) => !!(wo?.completion_transferred || wo?.cbre_completion_submitted_at);
