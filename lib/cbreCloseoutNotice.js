// lib/cbreCloseoutNotice.js
// ─────────────────────────────────────────────────────────────────────────────
// CBRE's automated close-out warning — the free early warning we have been
// throwing away.
//
// Seven days before a work order is closed for age, si-noreply@cbre.com sends
// one of these. It is the single most actionable e-mail CBRE sends us: it names
// the work order, says exactly how many days past target it is, and gives a
// dated deadline. Nothing in FSM has ever read one.
//
// A real one, 12.05.2026 (C3067674):
//
//   Subject: P1-Emergency Request # C3067674 Will Be Closed in 7 Days
//   From:    si-noreply@cbre.com
//
//   P1-Emergency Request # C3067674 will be closed in 7 Days without vendor action.
//   The referenced WO has been flagged for being open 53 days after the target
//   completion date. If no action is taken in the next 7 days, this WO will be closed.
//   ...
//   Things needing to be updated:
//   1) Update Target Completion Date
//   2) Update Status
//   3) If service has actually been completed:
//        a. Complete WO with actual Date & Time work was performed.
//        b. Submit invoice.
//   ...
//   Date Entered: Mar 19 2026 7:23AM UTC-05
//   Priority: P1 - Emergency
//   Target Completion: Mar 19 2026 3:22PM UTC-05
//   Order Status: DRC - No Activity, Review to Close
//
// The parser is deliberately tolerant: the day counts are read from the text
// rather than assumed, because 53 and 7 are CBRE's current settings and not
// laws of nature. What it will not do is guess — a notice it cannot read
// returns `ok: false` with a reason, and the importer reports that rather than
// stamping a date nobody can defend.
// ─────────────────────────────────────────────────────────────────────────────

import { parseDate } from './dates';

export const CLOSEOUT_SENDER = 'si-noreply@cbre.com';
// IMAP SUBJECT term. Matches "Will Be Closed in 7 Days" and any other number.
export const CLOSEOUT_SUBJECT_TERM = 'Will Be Closed in';

const MS_D = 86400000;

/** Cheap subject test, for triage before the body is parsed. */
export function isCloseoutNotice(subject) {
  return /will\s+be\s+closed\s+in\s+\d+\s+days?/i.test(String(subject || ''));
}

// "Mar 19 2026 3:22PM UTC-05" / "Mar 19 2026 7:23AM EST" → Date.
// The zone suffix is dropped and the stamp read as Eastern, which is what every
// other CBRE date in this system does (lib/dates).
function cbreStamp(raw) {
  if (!raw) return null;
  const cleaned = String(raw)
    .replace(/\s*UTC[+-]\d{1,2}\s*$/i, '')
    .replace(/\s*(EST|EDT|CST|CDT|MST|MDT|PST|PDT)\s*$/i, '')
    .trim();
  const m = cleaned.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return parseDate(cleaned);
  const months = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };
  const mon = months[m[1].toLowerCase()];
  if (mon == null) return null;
  let h = parseInt(m[4], 10) % 12;
  if (/pm/i.test(m[6])) h += 12;
  // Eastern is UTC-4 or UTC-5; the hour matters far less than the day here, so
  // noon-safe construction beats pretending to know the offset.
  return new Date(Date.UTC(parseInt(m[3], 10), mon, parseInt(m[2], 10), h + 4, parseInt(m[5], 10)));
}

const field = (body, label) => {
  const re = new RegExp(`${label}\\s*:\\s*(.+)`, 'i');
  const m = String(body || '').match(re);
  return m ? m[1].replace(/\*+/g, '').trim() : null;
};

/**
 * Parse one close-out warning.
 *
 * @param {string} subject
 * @param {string} body       plain-text body
 * @param {Date}   receivedAt when the e-mail arrived — the countdown starts here
 * @returns {{
 *   ok: boolean, reason?: string,
 *   woNumber: string|null, priority: string|null,
 *   daysPastTarget: number|null, graceDays: number|null,
 *   flaggedAt: Date|null, deadline: Date|null,
 *   targetCompletion: Date|null, dateEntered: Date|null,
 *   orderStatus: string|null, building: string|null, note: string
 * }}
 */
export function parseCloseoutNotice(subject, body, receivedAt = new Date()) {
  const text = String(body || '');
  const subj = String(subject || '');

  const fail = (reason) => ({
    ok: false, reason,
    woNumber: null, priority: null, daysPastTarget: null, graceDays: null,
    flaggedAt: null, deadline: null, targetCompletion: null, dateEntered: null,
    orderStatus: null, building: null, note: reason,
  });

  if (!isCloseoutNotice(subj)) return fail('subject is not a close-out warning');

  // "Request # C3067674" in the subject, or the same phrasing in the body.
  const woMatch =
    subj.match(/Request\s*#\s*([A-Z]{1,3}\d{6,8})/i) ||
    text.match(/Request\s*#\s*([A-Z]{1,3}\d{6,8})/i);
  if (!woMatch) return fail('no work order number in the notice');
  const woNumber = woMatch[1].toUpperCase();

  // "will be closed in 7 Days"
  const graceMatch = subj.match(/closed\s+in\s+(\d+)\s+days?/i) || text.match(/closed\s+in\s+(\d+)\s+days?/i);
  const graceDays = graceMatch ? parseInt(graceMatch[1], 10) : null;

  // "flagged for being open 53 days after the target completion date"
  const pastMatch = text.match(/open\s+(\d+)\s+days?\s+after\s+the\s+target\s+completion/i);
  const daysPastTarget = pastMatch ? parseInt(pastMatch[1], 10) : null;

  if (graceDays == null) return fail('could not read the number of days left');

  const flaggedAt = parseDate(receivedAt) || new Date();
  const deadline = new Date(flaggedAt.getTime() + graceDays * MS_D);

  // "P1-Emergency Request # ..." in the subject; "Priority: P1 - Emergency" in body.
  const prioSubject = subj.match(/^\s*(P\d{1,2})\s*-/i);
  const priority = prioSubject ? prioSubject[1].toUpperCase() : (field(text, 'Priority') || null);

  const orderStatusRaw = field(text, 'Order Status');
  const orderStatus = orderStatusRaw ? orderStatusRaw.split(/\s*-\s*/)[0].trim().toUpperCase() : null;

  return {
    ok: true,
    woNumber,
    priority,
    daysPastTarget,
    graceDays,
    flaggedAt,
    deadline,
    targetCompletion: cbreStamp(field(text, 'Target Completion')),
    dateEntered: cbreStamp(field(text, 'Date Entered')),
    orderStatus,
    orderStatusLabel: orderStatusRaw,
    building: field(text, 'Building'),
    note:
      `CBRE will close ${woNumber} in ${graceDays} day${graceDays === 1 ? '' : 's'}` +
      (daysPastTarget != null ? ` — flagged at ${daysPastTarget} days past target completion` : '') +
      '. Move the target date, update the status, or complete it and invoice.',
  };
}
