// lib/cbreGridReport.js
// ─────────────────────────────────────────────────────────────────────────────
// The CBRE "grid" export: every work order CBRE still has OPEN on their side.
//
// This is the only list that says what CBRE believes is still running. Two
// things fall out of comparing it with FSM, and both have cost real money:
//
//   • a work order in the grid that FSM has never seen — the dispatch e-mail
//     was missed. 13 of those turned up in the 2026-08-27 reconciliation, done
//     by hand.
//   • a work order FSM still has open that has quietly LEFT the grid. That is
//     how "cancelled due to aging past 60 days" happens without anyone
//     noticing, and it is what the sub work orders are now cleaning up.
//
// One caveat the reconciliation has to respect: a work order sitting in a
// quote status is in NEITHER the open nor the closed CBRE list. Its absence
// from this export means nothing, so those are counted separately instead of
// being reported as gone.
//
// Grid status codes are the dispatch lifecycle (D, DAK, DAR, DEA, EBO, QUA,
// OVD…) — a different family from the posting codes in cbreStatusMapping
// (CIS/CA1/CA2/CIR/CMP). They are kept in cbre_grid_status and, with exactly
// one exception, never mapped onto cbre_status.
//
// The exception is QUA. "Quote Approved" is not a dispatch state, it is the
// same fact our own cbre_status carries as 'quote_approved' — CBRE decided our
// NTE request. Nine work orders on the first real file sat at 'quote_submitted'
// here while CBRE had already approved them, six of them the new B-prefix sub
// work orders, $8,244.86 that was billable and looked like it was still
// waiting. That is worth taking over automatically, because it only ever moves
// forward from the same source.
//
// It moves forward or not at all: a work order already past the quote stage
// (posted, or invoice rejected) keeps what it has, and 'cancelled' against an
// open grid row is a contradiction that a person has to look at.
// ─────────────────────────────────────────────────────────────────────────────

export const GRID_COLUMNS = {
  'wo number':             'wo_number',
  'status':                'grid_status',
  'building description':  'building',
  'date entered':          'date_entered',
  'priority':              'priority',
  'problem description':   'description',
  'caller name':           'caller_name',
  'caller phone':          'caller_phone',
  'past target (days)':    'past_target_days',
  'target response':       'target_response',
  'target completion':     'target_completion',
  'completion date':       'completion_date',
  'address of location':   'address',
  'city':                  'city',
  'state':                 'state',
  'zip':                   'zip',
  'project number':        'project_number',
  'fm':                    'fm',
  'contact name':          'contact_name',
  'contact phone':         'contact_phone',
  'location in room':      'location_in_room',
};

export const REQUIRED_GRID_COLUMNS = ['wo number', 'status'];

// A work order in one of these is invisible in BOTH CBRE lists, so it being
// absent from the open export says nothing at all.
export const QUOTE_LIMBO = ['quote_submitted', 'quote_approved'];

const asText = (v) => (v == null ? '' : String(v).trim());

function asDate(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

const asInt = (v) => {
  const n = parseInt(String(v ?? '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
};

/** "DAK - Dispatched, Acknowledged" → "DAK" */
export const gridStatusCode = (s) => (asText(s).split(/[\s-]/)[0] || '').toUpperCase();

/** rows: array-of-arrays with the header first. */
export function parseGridExport(rows) {
  if (!rows?.length) return { orders: [], problems: ['The file is empty'] };

  const header = (rows[0] || []).map((h) => asText(h).toLowerCase());
  const idx = {};
  header.forEach((h, i) => { if (GRID_COLUMNS[h] !== undefined) idx[GRID_COLUMNS[h]] = i; });

  const missing = REQUIRED_GRID_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    return { orders: [], problems: [`This does not look like a CBRE open-orders export — missing column(s): ${missing.join(', ')}`] };
  }

  const orders = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const wo_number = asText(row[idx.wo_number]).toUpperCase();
    if (!wo_number) continue;
    orders.push({
      row: r + 1,
      wo_number,
      grid_status: asText(row[idx.grid_status]),
      grid_code: gridStatusCode(row[idx.grid_status]),
      building: asText(row[idx.building]),
      priority: asText(row[idx.priority]),
      description: asText(row[idx.description]),
      caller_name: asText(row[idx.caller_name]),
      caller_phone: asText(row[idx.caller_phone]),
      contact_name: asText(row[idx.contact_name]),
      contact_phone: asText(row[idx.contact_phone]),
      address: asText(row[idx.address]),
      city: asText(row[idx.city]),
      state: asText(row[idx.state]),
      zip: asText(row[idx.zip]),
      project_number: asText(row[idx.project_number]),
      fm: asText(row[idx.fm]),
      location_in_room: asText(row[idx.location_in_room]),
      date_entered: asDate(row[idx.date_entered]),
      target_response: asDate(row[idx.target_response]),
      target_completion: asDate(row[idx.target_completion]),
      completion_date: asDate(row[idx.completion_date]),
      past_target_days: asInt(row[idx.past_target_days]),
    });
  }
  return { orders, problems: [] };
}

// cbre_status values that are already further along than "the quote was
// approved" — the grid must never pull them back.
export const BEYOND_QUOTE = ['CPW', 'CIS', 'CA1', 'CA2', 'CIR', 'CMP', 'invoice_rejected'];
// …and the ones QUA may legitimately move forward from.
export const BEFORE_APPROVAL = [null, undefined, '', 'pending_quote', 'quote_submitted', 'reassigned'];

export const GRID_OUTCOME = {
  nte_approved: { label: 'NTE approved at CBRE', tone: 'emerald', hint: 'CBRE says the quote is approved and FSM still shows it waiting — this one is billable' },
  status_conflict: { label: 'Status disagrees',  tone: 'amber',  hint: 'CBRE and FSM say different things and neither is obviously right — nothing is written' },
  open_both:    { label: 'Open on both sides', tone: 'slate',   hint: 'CBRE and FSM agree — the grid detail is refreshed' },
  missing_fsm:  { label: 'Not in FSM',         tone: 'red',     hint: 'CBRE dispatched it and we never received it' },
  billed_ours:  { label: 'We already billed',  tone: 'amber',   hint: 'invoiced here, still open at CBRE' },
  closed_ours:  { label: 'Closed here',        tone: 'amber',   hint: 'acknowledged or escalated here, still open at CBRE' },
  gone_cbre:    { label: 'Gone from the grid', tone: 'red',     hint: 'open in FSM, CBRE no longer lists it — the aging pattern' },
  quote_limbo:  { label: 'In quote at CBRE',   tone: 'slate',   hint: 'invisible in both CBRE lists — absence means nothing' },
};

/**
 * woByNumber: { [wo_number]: workOrder } for every number in the grid, plus
 * fsmOpen: the work orders FSM currently has open, so the reverse direction
 * can be reported.
 */
// Does this grid row say the NTE was approved, and is that news to FSM?
// Deliberately independent of whether we have already invoiced or acknowledged
// the work order: "CBRE approved the quote" is a fact about the quote
// conversation and stays true either way. An earlier version asked this only
// after the billed/acknowledged checks, so a work order that happened to carry
// an invoice had its approval silently dropped — seven of the first nine.
function quoteApproval(gridCode, wo) {
  if (gridCode !== 'QUA') return { applies: false };
  const cs = wo.cbre_status;
  if (cs === 'quote_approved') return { applies: false, note: 'quote approved on both sides' };
  if (BEYOND_QUOTE.includes(cs) || BEYOND_QUOTE.includes(wo.cbre_posting_status)) {
    return { applies: false, note: `FSM is further along (${cs || wo.cbre_posting_status}) — left alone` };
  }
  if (BEFORE_APPROVAL.includes(cs)) {
    return { applies: true, note: `${cs ? String(cs).replace(/_/g, ' ') : 'nothing recorded'} → quote approved` };
  }
  return { applies: false, conflict: true,
           note: `FSM says ${String(cs).replace(/_/g, ' ')}, CBRE says quote approved and still open` };
}

export function reconcileGrid(orders, woByNumber, fsmOpen = []) {
  const gridNumbers = new Set(orders.map((o) => o.wo_number));
  const rows = orders.map((o) => {
    const wo = woByNumber[o.wo_number];
    if (!wo) return { ...o, outcome: 'missing_fsm', detail: 'no work order in FSM' };

    // Asked first, so it survives whatever bucket the work order lands in.
    const approval = quoteApproval(o.grid_code, wo);
    const base = { ...o, wo, approves_nte: approval.applies };

    const hasInvoice = (wo.invoices || []).length > 0;
    if (wo.is_locked || hasInvoice) {
      const inv = (wo.invoices || [])[0]?.invoice_number || 'locked here';
      return { ...base, outcome: 'billed_ours',
               detail: approval.applies ? `${inv} — and CBRE approved the quote` : inv };
    }
    if (wo.acknowledged || ['open', 'escalated', 'sub_wo_requested', 'superseded'].includes(wo.dispute_status)) {
      const where = wo.dispute_status ? `escalated (${wo.dispute_status})` : 'acknowledged here';
      return { ...base, outcome: 'closed_ours',
               detail: approval.applies ? `${where} — and CBRE approved the quote` : where };
    }

    if (approval.applies)  return { ...base, outcome: 'nte_approved',    detail: approval.note };
    if (approval.conflict) return { ...base, outcome: 'status_conflict', detail: approval.note };
    if (approval.note)     return { ...base, outcome: 'open_both',       detail: approval.note };

    return { ...base, outcome: 'open_both', detail: wo.status };
  });

  // The other direction: open here, absent there.
  for (const wo of fsmOpen) {
    if (gridNumbers.has(String(wo.wo_number || '').toUpperCase())) continue;
    const limbo = QUOTE_LIMBO.includes(wo.cbre_status);
    rows.push({
      row: null,
      wo_number: wo.wo_number,
      wo,
      grid_status: '',
      grid_code: '',
      building: wo.building || '',
      date_entered: wo.date_entered || null,
      past_target_days: null,
      outcome: limbo ? 'quote_limbo' : 'gone_cbre',
      detail: limbo
        ? `${String(wo.cbre_status).replace(/_/g, ' ')} — not listed in either CBRE view`
        : `open here since ${String(wo.date_entered || '').slice(0, 10)}, not in this export`,
    });
  }
  return rows;
}

export function gridSummary(rows) {
  const by = {};
  for (const r of rows) (by[r.outcome] = by[r.outcome] || { count: 0 }).count += 1;
  return by;
}

// Only two things are written, and both are additive: the grid detail on work
// orders we already have, and new work orders for what CBRE dispatched and we
// never received. Everything else is reported for a human to decide.
export const GRID_REFRESHABLE = ['open_both', 'billed_ours', 'closed_ours', 'nte_approved', 'status_conflict'];
export const GRID_CREATABLE   = ['missing_fsm'];
// Rows that also move cbre_status forward. Only ever quote_approved, only ever
// from a state before it.
export const GRID_APPROVES = ['nte_approved'];
/** Every row that moves cbre_status to quote_approved, whatever bucket it sits in. */
export const approvingRows = (rows) => (rows || []).filter((r) => r.approves_nte);

/** The patch that records where CBRE last had this work order. */
export function gridStampPatch(row, seenAt) {
  const patch = {
    cbre_grid_status:      row.grid_status || null,
    cbre_grid_seen_at:     seenAt,
    cbre_past_target_days: row.past_target_days,
  };
  // approves_nte, not the outcome bucket: a work order can be billed or
  // acknowledged here and still have just been approved at CBRE.
  if (row.approves_nte) {
    patch.cbre_status = 'quote_approved';
    patch.cbre_status_label = row.grid_status || 'QUA - Quote Approved';
    patch.cbre_status_updated_at = seenAt;
  }
  return patch;
}

/** A new work order built from a grid row — same shape the 2026-08-27 backfill used. */
export function gridNewWorkOrder(row, fileName) {
  const stamp = new Date().toLocaleDateString('en-US');
  const comments = [
    row.address ? `Address: ${row.address}${row.city ? `, ${row.city}` : ''}${row.state ? `, ${row.state}` : ''}${row.zip ? ` ${row.zip}` : ''}` : '',
    row.location_in_room ? `Location: ${row.location_in_room}` : '',
    row.grid_status ? `CBRE grid status: ${row.grid_status}` : '',
    row.project_number ? `Project Number: ${row.project_number}` : '',
    row.fm ? `FM: ${row.fm}` : '',
    row.contact_name ? `Contact: ${row.contact_name}${row.contact_phone ? ` (${row.contact_phone})` : ''}` : '',
    row.target_response ? `Target Response: ${row.target_response}` : '',
    row.target_completion ? `Target Completion: ${row.target_completion}` : '',
    `[Imported from CBRE open-orders export (${fileName}) on ${stamp} — missing-in-FSM backfill. No NTE: the grid export does not carry one; take it from the dispatch e-mail or VAWS.]`,
  ].filter(Boolean).join('\n');

  return {
    wo_number: row.wo_number,
    building: row.building || null,
    date_entered: row.date_entered,
    work_order_description: row.description || null,
    requestor: row.caller_name || null,
    requestor_phone: row.caller_phone || null,
    priority: row.priority || null,
    status: 'pending',
    comments,
    cbre_grid_status: row.grid_status || null,
    cbre_past_target_days: row.past_target_days,
  };
}
