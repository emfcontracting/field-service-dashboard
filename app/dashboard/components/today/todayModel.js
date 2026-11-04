// app/dashboard/components/today/todayModel.js
// ─────────────────────────────────────────────────────────────────────────────
// The one model behind the Today theme's three views (Today, Pipeline,
// Sites & Crew). Pure functions over data the hook (useTodayData.js) loads:
//
//   workOrders  the open list the dashboard already has (dataFetchers.js):
//               not acknowledged, not locked, no active dispute, not archived,
//               with total_hours_* / nte_quotes / open_flags / lead_tech
//   invoices    invoices with their work order (draft → paid)
//   approvals   approval_requests still in the office's hands (pending/approved)
//   disputes    work orders waiting on a sub work order (out of the open list)
//   timeLog     today's check-in / check-out events, per technician
//
// Everything a view shows is derived here, once, so the money strip on Today,
// the column counts on Pipeline and the site matrix on Sites & Crew can never
// disagree with each other. The rules reuse the libraries the classic views
// and the crons already trust — agingRisk for the cancellation window,
// invoiceReadiness for what may go out, completionReadiness for what may be
// reported — rather than re-deriving them.
// ─────────────────────────────────────────────────────────────────────────────

import { agingRisk, isAgingExposed } from '@/lib/agingRisk';
import { invoiceBlocker, hasQbNumber } from '@/lib/invoiceReadiness';
import { CBRE_STATUS_READY, QUOTE_PENDING_STATES, READINESS_LABEL, CBRE_WO_PATTERN } from '@/lib/completionReadiness';
import { pauseLabel } from '@/lib/clockPause';
import { extractPriorityCode } from '@/lib/priorityCodes';
import { parseDate, daysBetweenET, dateKeyET } from '@/lib/dates';
import { calculateTotalCost } from '../../utils/calculations';

// ── Stages ─────────────────────────────────────────────────────────────────
// The seven columns of the pipeline — a work order's whole life, dispatch to
// paid, in one line. The first five come from the open list, the last two from
// the invoices table (an invoiced work order is acknowledged and so no longer
// in the open list).
export const STAGES = [
  { id: 'new',      label: 'New',          hint: 'dispatched, nobody assigned' },
  { id: 'assigned', label: 'Assigned',     hint: 'has a technician, not started' },
  { id: 'in_field', label: 'In the field', hint: 'started, return trip, tech review' },
  { id: 'done',     label: 'Done',         hint: 'finished, completion not yet reported' },
  { id: 'at_cbre',  label: 'At CBRE',      hint: 'NTE request or completion waiting there' },
  { id: 'invoice',  label: 'Invoice',      hint: 'draft — ready, on hold or rejected' },
  { id: 'invoiced', label: 'Invoiced',     hint: 'out, not paid' },
];
export const STAGE_IDS = STAGES.map((s) => s.id);

const IN_FIELD = ['in_progress', 'return_trip', 'needs_return', 'tech_review'];
const INVOICED_STATUSES = ['approved', 'accepted', 'synced'];
const D = 86400000;

export const money = (n, digits = 0) =>
  `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

export const ageDays = (v, now = new Date()) => {
  const d = parseDate(v);
  return d ? Math.max(0, Math.floor((now.getTime() - d.getTime()) / D)) : null;
};
export const fmtAge = (days) => days == null ? '' : days === 0 ? 'today' : days === 1 ? '1 d' : `${days} d`;

export const techName = (wo) => wo?.lead_tech
  ? `${wo.lead_tech.first_name || ''} ${wo.lead_tech.last_name || ''}`.trim() || 'technician'
  : null;
export const userName = (u) => u ? `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'someone' : 'someone';
// Site code from the building string: "SCSMV - SUMMERVILLE CENTER", "SCLON-UPS
// NORTH MYRTLE" and a bare "SCSMV" are the same site. Anything that does not
// start with a code is used as written.
export const siteOf = (wo) => {
  const raw = String(wo?.building || '').trim();
  if (!raw) return 'No site';
  const m = raw.match(/^([A-Z]{5})(\s*[-–]|\s|$)/);
  return m ? m[1] : raw;
};
export const siteNameOf = (wo) => {
  const raw = String(wo?.building || '').trim();
  const m = raw.match(/^[A-Z]{5}\s*[-–]\s*(.+)$/);
  return m ? m[1].trim() : '';
};

export const totalHours = (wo) => {
  if (typeof wo.total_hours_regular === 'number' || typeof wo.total_hours_overtime === 'number') {
    return (wo.total_hours_regular || 0) + (wo.total_hours_overtime || 0);
  }
  return (parseFloat(wo.hours_regular) || 0) + (parseFloat(wo.hours_overtime) || 0);
};

// The NTE request currently at CBRE on this work order, if any.
export function submittedQuote(wo) {
  const quotes = (wo.nte_quotes || wo.work_order_quotes || []).filter((q) => QUOTE_PENDING_STATES.includes(q.nte_status));
  if (!quotes.length) return null;
  return quotes.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
}
export const quoteWaitingSince = (wo, q) => wo.cbre_quote_submitted_at || wo.cbre_nte_submitted_at || wo.cbre_status_updated_at || q?.created_at || null;

// ── Why is this work order not moving? ─────────────────────────────────────
// One line under every card. Says the reason, never just the status.
export function completionBlocker(wo) {
  if (!CBRE_WO_PATTERN.test(String(wo.wo_number || '').trim())) return { ready: false, text: 'not a CBRE work order — nothing to report' };
  if (!CBRE_STATUS_READY.includes(wo.cbre_status)) return { ready: false, text: `${READINESS_LABEL.cbre_status} (${wo.cbre_status})` };
  const q = submittedQuote(wo);
  if (q) return { ready: false, text: q.nte_status === 'submitted' ? `NTE ${money(q.new_nte_amount)} waiting at CBRE` : READINESS_LABEL.pending_quote };
  const hours = totalHours(wo);
  if (hours <= 0) return { ready: false, text: `no hours logged${techName(wo) ? ` — ${techName(wo)}` : ''}`, missingHours: true };
  const nte = parseFloat(wo.nte) || 0;
  const cost = calculateTotalCost(wo);
  if (nte > 0 && cost > nte) return { ready: false, text: `${money(cost)} against an NTE of ${money(nte)} — request an increase` };
  const hasStart = !!parseDate(wo.time_in);
  const hasEnd = !!(parseDate(wo.time_out) || parseDate(wo.date_completed));
  if (!hasStart || !hasEnd) return { ready: false, text: READINESS_LABEL.no_times };
  return { ready: true, text: 'ready for the completion form' };
}

export function stageOf(wo, ctx = {}) {
  const status = String(wo.status || '').toLowerCase();
  if (['cancelled', 'rejected'].includes(status)) return null;          // belongs in the archive, not on the board
  if (status === 'completed') {
    if (wo.cbre_completion_submitted_at || wo.completion_transferred) return 'at_cbre';
    return 'done';
  }
  const q = submittedQuote(wo);
  if (q && q.nte_status === 'submitted' && !IN_FIELD.includes(status)) return 'at_cbre';   // cannot start until approved
  if (IN_FIELD.includes(status)) return 'in_field';
  if (status === 'assigned' || wo.lead_tech_id) return 'assigned';
  return 'new';
}

export function blockerLine(wo, stage, ctx = {}) {
  const now = ctx.now || new Date();
  const age = ageDays(wo.date_entered || wo.created_at, now);
  const tech = techName(wo);
  const code = extractPriorityCode(wo.priority);
  const q = submittedQuote(wo);
  const pause = wo.waiting_reason ? pauseLabel(wo.waiting_reason) : null;
  switch (stage) {
    case 'new':
      return `${code ? `${code} · ` : ''}no technician yet · ${fmtAge(age)}`;
    case 'assigned':
      if (pause) return `${tech || 'assigned'} · ${pause}`;
      return `${tech || 'assigned'} · not started · ${fmtAge(age)}`;
    case 'in_field': {
      if (pause) return `${tech || ''} · ${pause}`.replace(/^ · /, '');
      if (wo.status === 'tech_review') return `${tech || ''} · tech review`.replace(/^ · /, '');
      if (wo.status === 'return_trip' || wo.status === 'needs_return') return `${tech || ''} · return trip needed`.replace(/^ · /, '');
      if (q && q.nte_status === 'submitted') return `${tech || ''} · NTE ${money(q.new_nte_amount)} at CBRE`.replace(/^ · /, '');
      const h = totalHours(wo);
      return `${tech || 'in progress'} · ${h > 0 ? `${h.toFixed(1)} h logged` : 'no hours yet'}`;
    }
    case 'done': {
      const ap = ctx.approvalByWo?.get(wo.wo_id);
      if (ap) return ap.status === 'approved' ? 'approved — waiting to be submitted to CBRE' : `in Approvals since ${fmtAge(ageDays(ap.created_at, now))}`;
      return completionBlocker(wo).text;
    }
    case 'at_cbre': {
      if (wo.status === 'completed') return `completion posted ${fmtAge(ageDays(wo.cbre_completion_submitted_at || wo.completion_transferred_at, now))} ago`;
      if (q) return `NTE ${money(q.new_nte_amount)} waiting ${fmtAge(ageDays(quoteWaitingSince(wo, q), now))}`;
      return 'waiting at CBRE';
    }
    default:
      return '';
  }
}

// ── Invoices ───────────────────────────────────────────────────────────────
export function invoiceStage(inv) {
  if (!inv) return null;
  if (inv.status === 'paid' || inv.paid_at) return null;
  if (inv.status === 'draft' || inv.status === 'rejected') return 'invoice';
  if (INVOICED_STATUSES.includes(inv.status)) return 'invoiced';
  return null;
}

export function invoiceLine(inv, now = new Date()) {
  const age = ageDays(inv.invoice_date || inv.created_at, now);
  if (inv.status === 'rejected') return `rejected by CBRE · ${money(inv.total)} · ${fmtAge(age)}`;
  if (inv.status === 'draft') {
    const b = invoiceBlocker(inv, inv.work_order);
    return b.blocked ? `${b.label} · ${money(inv.total)}` : `ready to send · ${money(inv.total)} · ${fmtAge(age)}`;
  }
  return `${hasQbNumber(inv) ? 'in QuickBooks' : 'sent'} ${fmtAge(age)} ago · ${money(inv.total)}`;
}

// ── The model ──────────────────────────────────────────────────────────────
export function buildTodayModel({ workOrders = [], invoices = [], approvals = [], disputes = [], timeLog = [], doneToday = {}, users = [], now = new Date() }) {
  const approvalByWo = new Map();
  for (const a of approvals) if (!approvalByWo.has(a.wo_id)) approvalByWo.set(a.wo_id, a);
  const ctx = { now, approvalByWo };
  const usersById = new Map(users.map((u) => [u.user_id, u]));

  // Cards per stage -------------------------------------------------------
  const columns = Object.fromEntries(STAGE_IDS.map((id) => [id, []]));
  const woCards = [];
  for (const wo of workOrders) {
    const stage = stageOf(wo, ctx);
    if (!stage) continue;
    const card = { key: `wo-${wo.wo_id}`, kind: 'wo', wo, stage, line: blockerLine(wo, stage, ctx), age: ageDays(wo.date_entered || wo.created_at, now), site: siteOf(wo), value: parseFloat(wo.nte) || 0 };
    columns[stage].push(card);
    woCards.push(card);
  }
  const openWoIds = new Set(workOrders.map((w) => w.wo_id));
  for (const inv of invoices) {
    const stage = invoiceStage(inv);
    if (!stage) continue;
    const wo = inv.work_order || {};
    columns[stage].push({ key: `inv-${inv.invoice_id}`, kind: 'invoice', inv, wo, stage, line: invoiceLine(inv, now), age: ageDays(inv.invoice_date || inv.created_at, now), site: siteOf(wo), value: parseFloat(inv.total) || 0, inOpenList: openWoIds.has(wo.wo_id) });
  }
  for (const id of STAGE_IDS) columns[id].sort((a, b) => (b.age || 0) - (a.age || 0));

  // Money -------------------------------------------------------------------
  const nteWaiting = workOrders.map((wo) => ({ wo, q: submittedQuote(wo) })).filter(({ wo, q }) => q?.nte_status === 'submitted' || wo.cbre_status === 'quote_submitted');
  const nteWaitingOld = nteWaiting.filter(({ wo, q }) => (ageDays(quoteWaitingSince(wo, q), now) ?? 0) > 14);
  const sumQuotes = (rows) => rows.reduce((s, { q }) => s + (parseFloat(q?.new_nte_amount) || 0), 0);

  const drafts = invoices.filter((i) => i.status === 'draft').map((inv) => ({ inv, blocker: invoiceBlocker(inv, inv.work_order) }));
  const draftsReady = drafts.filter((d) => !d.blocker.blocked);
  const draftsOnHold = drafts.filter((d) => d.blocker.blocked);
  const rejectedInvoices = invoices.filter((i) => i.status === 'rejected');
  const unpaid = invoices.filter((i) => INVOICED_STATUSES.includes(i.status) && !i.paid_at);
  const sumInv = (rows) => rows.reduce((s, r) => s + (parseFloat((r.inv || r).total) || 0), 0);

  // Soonest to close first; the ones already past CBRE's cut-off after that,
  // most recently expired first — a work order 460 days gone is history, not a
  // deadline.
  const agingAll = workOrders.filter(isAgingExposed).map((wo) => ({ wo, risk: agingRisk(wo, now) })).filter((r) => r.risk && r.risk.level !== 'ok');
  const ahead = agingAll.filter((r) => r.risk.daysToClose > 0).sort((a, b) => a.risk.daysToClose - b.risk.daysToClose);
  const gone = agingAll.filter((r) => r.risk.daysToClose <= 0).sort((a, b) => b.risk.daysToClose - a.risk.daysToClose);
  const aging = ahead.concat(gone);
  const closing = aging.filter((r) => ['at_risk', 'past_due'].includes(r.risk.level));

  const completionsInHand = approvals.length;   // pending or approved — the form has not been sent yet

  const money_ = {
    waitingAtCbre:  { value: sumQuotes(nteWaiting), count: nteWaiting.length, old: nteWaitingOld.length, oldValue: sumQuotes(nteWaitingOld) },
    doneNotInvoiced:{ value: sumInv(draftsReady), count: draftsReady.length, completions: completionsInHand, doneCount: columns.done.length },
    invoicedUnpaid: { value: sumInv(unpaid), count: unpaid.length },
    closing:        { count: closing.length, watch: aging.length - closing.length, pastDue: closing.filter((r) => r.risk.level === 'past_due').length },
  };

  // Action list ---------------------------------------------------------------
  // Each item: who must act, what it is, one number, one button. Empty groups
  // vanish — empty is the goal.
  const items = [];
  const push = (it) => { if ((it.count ?? 1) > 0) items.push(it); };
  const woNums = (rows, n = 4) => rows.slice(0, n).map((r) => (r.wo || r).wo_number).filter(Boolean).join(', ') + (rows.length > n ? ` and ${rows.length - n} more` : '');

  // You
  push({ id: 'closing', group: 'you', tone: 'red', count: closing.length,
    title: `${closing.length} work order${closing.length === 1 ? '' : 's'} in CBRE's cancellation window`,
    sub: `${money_.closing.pastDue ? `${money_.closing.pastDue} past the cut-off · ` : ''}move the target date, complete, or invoice · ${woNums(closing)}`,
    value: `${closing.length}`, action: { label: 'Show', kind: 'expand' },
    wos: closing.map((r) => ({ wo: r.wo, note: r.risk.fromCbre ? `CBRE closes ${dateKeyET(r.risk.closeDate)}` : `${r.risk.days} d past target · closes about ${dateKeyET(r.risk.closeDate)}` })) });
  push({ id: 'drafts', group: 'you', tone: 'green', count: draftsReady.length,
    title: `${draftsReady.length} invoice draft${draftsReady.length === 1 ? ' is' : 's are'} ready to send`,
    sub: `${money(sumInv(draftsReady))}${draftsReady.length ? ` · oldest ${fmtAge(Math.max(...draftsReady.map((d) => ageDays(d.inv.created_at, now) || 0)))}` : ''} · ${woNums(draftsReady.map((d) => d.inv.work_order || {}))}`,
    value: money(sumInv(draftsReady)), action: { label: 'Invoicing', href: '/invoices' },
    wos: draftsReady.map((d) => ({ wo: d.inv.work_order, note: `${d.inv.invoice_number || 'draft'} · ${money(d.inv.total)}` })) });
  push({ id: 'approvals', group: 'you', tone: 'blue', count: approvals.length,
    title: `${approvals.length} CBRE form${approvals.length === 1 ? '' : 's'} waiting for your click`,
    sub: `${approvals.filter((a) => a.status === 'pending').length} to approve · ${approvals.filter((a) => a.status === 'approved').length} approved, not yet submitted · oldest ${fmtAge(Math.max(0, ...approvals.map((a) => ageDays(a.created_at, now) || 0)))}`,
    value: `${approvals.length}`, action: { label: 'Approvals', view: 'approvals' } });
  const unassigned = columns.new.map((c) => c.wo);
  const urgent = unassigned.filter((wo) => ['P1', 'P2'].includes(extractPriorityCode(wo.priority)));
  push({ id: 'unassigned', group: 'you', tone: urgent.length ? 'red' : 'blue', count: unassigned.length,
    title: `${unassigned.length} new work order${unassigned.length === 1 ? '' : 's'} need${unassigned.length === 1 ? 's' : ''} a technician`,
    sub: `${urgent.length ? `${urgent.length} urgent (${urgent.map((w) => `${w.wo_number} ${extractPriorityCode(w.priority)}`).join(', ')}) · ` : ''}${woNums(unassigned)}`,
    value: urgent.length ? `${urgent.length} urgent` : `${unassigned.length}`, action: { label: 'Assign', view: 'pipeline', params: { col: 'new' } },
    wos: unassigned.map((wo) => ({ wo, note: `${extractPriorityCode(wo.priority) || ''} ${siteOf(wo)} · ${fmtAge(ageDays(wo.date_entered, now))}`.trim() })) });
  const flagged = workOrders.filter((wo) => (wo.open_flags || []).length);
  push({ id: 'flags', group: 'you', tone: 'amber', count: flagged.length,
    title: `${flagged.length} work order${flagged.length === 1 ? '' : 's'} flagged for review`,
    sub: `${flagged.reduce((s, wo) => s + wo.open_flags.length, 0)} open flag${flagged.length === 1 ? '' : 's'} · ${woNums(flagged)}`,
    value: `${flagged.length}`, action: { label: 'Review queue', view: 'review-queue' },
    wos: flagged.map((wo) => ({ wo, note: wo.open_flags[0]?.comment || 'flagged' })) });
  const doneStuck = columns.done.filter((c) => !approvalByWo.has(c.wo.wo_id)).map((c) => ({ wo: c.wo, b: completionBlocker(c.wo) })).filter((r) => !r.b.ready && !r.b.missingHours);
  push({ id: 'done-stuck', group: 'you', tone: 'amber', count: doneStuck.length,
    title: `${doneStuck.length} finished work order${doneStuck.length === 1 ? '' : 's'} cannot be reported yet`,
    sub: `${woNums(doneStuck)} · ${doneStuck[0]?.b.text || ''}`,
    value: `${doneStuck.length}`, action: { label: 'Show', kind: 'expand' },
    wos: doneStuck.map((r) => ({ wo: r.wo, note: r.b.text })) });

  // CBRE
  push({ id: 'nte-old', group: 'cbre', tone: 'amber', count: nteWaitingOld.length,
    title: `${nteWaitingOld.length} NTE request${nteWaitingOld.length === 1 ? '' : 's'} unanswered for more than 14 days`,
    sub: `${money(sumQuotes(nteWaitingOld))} · oldest ${fmtAge(Math.max(0, ...nteWaitingOld.map(({ wo, q }) => ageDays(quoteWaitingSince(wo, q), now) || 0)))} · ${nteWaiting.length} waiting in all`,
    value: money(sumQuotes(nteWaitingOld)), action: { label: 'Chase list', view: 'ups-escalation' },
    wos: nteWaitingOld.map(({ wo, q }) => ({ wo, note: `${money(q?.new_nte_amount)} · ${fmtAge(ageDays(quoteWaitingSince(wo, q), now))}` })) });
  const quoteRejected = workOrders.filter((wo) => wo.cbre_status === 'quote_rejected');
  push({ id: 'quote-rejected', group: 'cbre', tone: 'amber', count: quoteRejected.length,
    title: `${quoteRejected.length} quote${quoteRejected.length === 1 ? '' : 's'} rejected by CBRE`,
    sub: `decide: resubmit, do the work within the NTE, or decline · ${woNums(quoteRejected)}`,
    value: `${quoteRejected.length}`, action: { label: 'Show', kind: 'expand' },
    wos: quoteRejected.map((wo) => ({ wo, note: `NTE ${money(wo.nte)} · ${siteOf(wo)}` })) });
  push({ id: 'drafts-hold', group: 'cbre', tone: 'grey', count: draftsOnHold.length,
    title: `${draftsOnHold.length} invoice${draftsOnHold.length === 1 ? '' : 's'} on hold — CBRE is not ready`,
    sub: `${money(sumInv(draftsOnHold))} parked · ${draftsOnHold.slice(0, 3).map((d) => `${d.inv.work_order?.wo_number} (${d.blocker.reason})`).join(', ')}`,
    value: money(sumInv(draftsOnHold)), action: { label: 'Invoicing', href: '/invoices' },
    wos: draftsOnHold.map((d) => ({ wo: d.inv.work_order, note: d.blocker.label })) });
  push({ id: 'inv-rejected', group: 'cbre', tone: 'red', count: rejectedInvoices.length,
    title: `${rejectedInvoices.length} invoice${rejectedInvoices.length === 1 ? '' : 's'} rejected by CBRE`,
    sub: `${money(sumInv(rejectedInvoices))} · ${woNums(rejectedInvoices.map((i) => i.work_order || {}))}`,
    value: money(sumInv(rejectedInvoices)), action: { label: 'Invoicing', href: '/invoices' },
    wos: rejectedInvoices.map((i) => ({ wo: i.work_order, note: `${i.invoice_number || ''} · ${money(i.total)}` })) });
  const subWoOld = disputes.filter((wo) => (ageDays(wo.dispute_requested_at, now) ?? 0) > 21);
  push({ id: 'sub-wo', group: 'cbre', tone: 'grey', count: disputes.length,
    title: `${disputes.length} sub work order request${disputes.length === 1 ? '' : 's'} open at CBRE`,
    sub: `${subWoOld.length} older than 21 days · ${woNums(disputes)}`,
    value: `${disputes.length}`, action: { label: 'Escalations', view: 'ups-escalation' },
    wos: disputes.map((wo) => ({ wo, note: `requested ${fmtAge(ageDays(wo.dispute_requested_at, now))} ago` })) });
  const posted = columns.at_cbre.filter((c) => c.wo.status === 'completed');
  push({ id: 'posted', group: 'cbre', tone: 'grey', count: posted.length,
    title: `${posted.length} completion${posted.length === 1 ? '' : 's'} posted, waiting for CBRE to close`,
    sub: woNums(posted),
    value: `${posted.length}`, action: { label: 'Pipeline', view: 'pipeline', params: { col: 'at_cbre' } } });

  // Technicians
  const noHours = workOrders.filter((wo) => wo.status === 'completed' && wo.lead_tech_id && totalHours(wo) <= 0);
  const byTech = new Map();
  for (const wo of noHours) { const n = techName(wo) || 'unknown'; byTech.set(n, (byTech.get(n) || 0) + 1); }
  push({ id: 'no-hours', group: 'tech', tone: 'red', count: noHours.length,
    title: `${noHours.length} finished work order${noHours.length === 1 ? '' : 's'} without hours`,
    sub: `${[...byTech.entries()].map(([n, c]) => `${n.split(' ')[0]} ${c}`).join(' · ')} · one message per technician`,
    value: `${noHours.length}`, action: { label: 'Remind', view: 'missing-hours' },
    wos: noHours.map((wo) => ({ wo, note: `${techName(wo)} · completed ${fmtAge(ageDays(wo.date_completed || wo.updated_at, now))} ago` })) });
  const notStarted = columns.assigned.map((c) => c.wo).filter((wo) => !wo.waiting_reason && (ageDays(wo.date_entered, now) ?? 0) >= 3);
  push({ id: 'not-started', group: 'tech', tone: 'amber', count: notStarted.length,
    title: `${notStarted.length} assigned job${notStarted.length === 1 ? '' : 's'} not started for 3+ days`,
    sub: woNums(notStarted),
    value: `${notStarted.length}`, action: { label: 'Pipeline', view: 'pipeline', params: { col: 'assigned' } },
    wos: notStarted.map((wo) => ({ wo, note: `${techName(wo)} · ${fmtAge(ageDays(wo.date_entered, now))}` })) });
  // A pause set from the field. "Awaiting CBRE approver" is CBRE's wait, the
  // rest (parts, backorder, no access) are the technician's.
  const pausedAll = workOrders.filter((wo) => wo.waiting_reason && !['completed', 'cancelled'].includes(wo.status));
  const pausedCbre = pausedAll.filter((wo) => wo.waiting_reason === 'cbre_approval');
  const paused = pausedAll.filter((wo) => wo.waiting_reason !== 'cbre_approval');
  const pauseNote = (wo) => `${pauseLabel(wo.waiting_reason)}${wo.waiting_since ? ` since ${fmtAge(ageDays(wo.waiting_since, now))}` : ''}`;
  push({ id: 'paused-cbre', group: 'cbre', tone: 'grey', count: pausedCbre.length,
    title: `${pausedCbre.length} job${pausedCbre.length === 1 ? '' : 's'} on hold for a CBRE approver`,
    sub: `paused from the field · ${woNums(pausedCbre)}`,
    value: `${pausedCbre.length}`, action: { label: 'Pipeline', view: 'pipeline', params: { col: 'in_field' } },
    wos: pausedCbre.map((wo) => ({ wo, note: pauseNote(wo) })) });
  push({ id: 'paused', group: 'tech', tone: 'grey', count: paused.length,
    title: `${paused.length} job${paused.length === 1 ? '' : 's'} paused in the field`,
    sub: paused.slice(0, 4).map((wo) => `${wo.wo_number} ${pauseLabel(wo.waiting_reason).toLowerCase()}`).join(' · '),
    value: `${paused.length}`, action: { label: 'Pipeline', view: 'pipeline', params: { col: 'in_field' } },
    wos: paused.map((wo) => ({ wo, note: pauseNote(wo) })) });

  const TONE_RANK = { red: 0, amber: 1, green: 2, blue: 3, grey: 4 };
  items.sort((a, b) => (TONE_RANK[a.tone] - TONE_RANK[b.tone]) || (b.count - a.count));
  const groups = ['you', 'cbre', 'tech'].map((g) => ({ id: g, items: items.filter((i) => i.group === g) }));

  // Crew: who is clocked in where, right now -----------------------------------
  const lastByUser = new Map();
  for (const ev of timeLog.slice().sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) lastByUser.set(ev.user_id, ev);
  const woByIdText = new Map(workOrders.map((wo) => [String(wo.wo_id), wo]));
  const crew = [];
  for (const [userId, ev] of lastByUser) {
    if (ev.event_type !== 'check_in') continue;
    const wo = woByIdText.get(String(ev.wo_id)) || null;
    crew.push({ userId, user: usersById.get(userId) || null, name: userName(usersById.get(userId)), wo, since: ev.created_at, site: wo ? siteOf(wo) : null });
  }
  crew.sort((a, b) => a.name.localeCompare(b.name));
  const clockedInIds = new Set(crew.map((c) => c.userId));
  // Technicians with live work today who have not clocked in
  const activeTechIds = new Set(workOrders.filter((wo) => ['assigned', 'in_progress', 'return_trip'].includes(wo.status) && wo.lead_tech_id).map((wo) => wo.lead_tech_id));
  const notClockedIn = [...activeTechIds].filter((id) => !clockedInIds.has(id)).map((id) => usersById.get(id)).filter(Boolean)
    .map((u) => ({ user: u, name: userName(u), open: workOrders.filter((wo) => wo.lead_tech_id === u.user_id && ['assigned', 'in_progress', 'return_trip'].includes(wo.status)).length }))
    .sort((a, b) => b.open - a.open);

  // Sites -------------------------------------------------------------------
  const sites = new Map();
  const siteRow = (code, wo) => {
    if (!sites.has(code)) sites.set(code, { site: code, name: '', counts: Object.fromEntries(STAGE_IDS.map((s) => [s, 0])), total: 0, oldest: 0, oldestWo: null, techs: new Set(), closing: 0 });
    const r = sites.get(code);
    if (!r.name && wo) r.name = siteNameOf(wo);
    return r;
  };
  for (const card of woCards) {
    const r = siteRow(card.site, card.wo);
    r.counts[card.stage]++; r.total++;
    if ((card.age || 0) > r.oldest) { r.oldest = card.age || 0; r.oldestWo = card.wo.wo_number; }
  }
  for (const card of columns.invoice.concat(columns.invoiced)) { const r = siteRow(card.site, card.wo); r.counts[card.stage]++; r.total++; }
  for (const c of crew) if (c.site) siteRow(c.site, c.wo).techs.add(c.name.split(' ')[0]);
  for (const r of closing) siteRow(siteOf(r.wo), r.wo).closing++;
  const siteRows = [...sites.values()].map((r) => ({ ...r, techs: [...r.techs] })).sort((a, b) => (b.closing - a.closing) || (b.total - a.total));

  // Expiring: the next eight, in the order set above (ahead of the cut-off
  // first).
  const expiring = aging.slice(0, 8).map((r) => ({ wo: r.wo, risk: r.risk, site: siteOf(r.wo) }));

  // Where it sticks (pipeline strip) --------------------------------------------
  const strip = STAGES.map((s) => {
    const cards = columns[s.id];
    const oldest = cards.length ? Math.max(...cards.map((c) => c.age || 0)) : 0;
    return { ...s, count: cards.length, oldest, value: cards.reduce((sum, c) => sum + (c.value || 0), 0) };
  });
  const stuck = strip.filter((s) => s.count).sort((a, b) => b.oldest - a.oldest)[0]?.id || null;

  return { columns, strip, stuck, money: money_, groups, itemCount: items.length, crew, notClockedIn, sites: siteRows, expiring, doneToday, now };
}
