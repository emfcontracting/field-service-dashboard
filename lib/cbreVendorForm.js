// lib/cbreVendorForm.js
// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for CBRE's "Vendor App Submission (Production)" form.
//
// The form's URL, every field's internal key, the exact Action option strings,
// and which fields each Action needs. Captured directly from the live rendered
// form on 2026-08-25.
//
// WHY ONE MODULE: the form is prefilled by query string keyed on the field
// LABEL (case-sensitive). A wrong or missing label silently fails to prefill,
// with no error. Keeping the map in one place, verified against the rendered
// form, is the only safe way to add Actions.
//
// VERIFIED FORM QUIRKS (tested by loading prefilled URLs against production):
//   • Date  fields (text)      prefill fine as MM/DD/YYYY.
//   • AM/PM fields (picklist)  prefill fine as "AM" / "PM".
//   • TIME  fields (time picker) DO NOT accept query-string prefill at all.
//     For any Action with a time we prefill the date + AM/PM and write the
//     intended time into the Comment as a hint for the person to pick by hand.
//   • File Upload cannot be prefilled (browser security) — the person attaches.
// ─────────────────────────────────────────────────────────────────────────────

export const CBRE_FORM_URL =
  'https://app.smartsheet.com/b/form/019aa33a6ffd70a7983bbf4af282307a';

// internal key (data-field-name) → form field LABEL. Labels are what actually
// prefill; the raw keys are sent too as a harmless fallback (unknown query
// params are ignored by Smartsheet).
export const FIELD_LABEL = {
  PbOqlOgpG: 'Action',
  WaG1J2w0J: 'Requestor Email',
  GY7jE7PwJ: 'Work Order #',
  aKvjgv3dl: 'Vendor',
  '6wAdpAQzv': 'UPS Building Code',
  yZpQ0pqkp: 'Comment/Reason/File Description',
  '5wAdLAyzm': 'NTE Request Amount',
  '7wALv2OvR': 'Target Completion Date',
  Ky8adPgdN: 'Target Completion Time',
  yZp9g6egl: 'Target Completion Time AM/PM',
  mX7P97yGR: 'Completion Start Date',
  Ya3XR3Nqg: 'Completion Start Time',
  '2waXpankl': 'Completion Start Time AM/PM',
  J9QDGQdn0: 'Completion End Date',
  LQjNyjKog: 'Completion End Time',
  '0w6dA6pkL': 'Completion End Time AM/PM',
  QDNWbNylX: 'Vendor Confirmation before Completion',
  NjX8Owv3o: 'Asset Barcode ID',
  '9yKnpKlXG': 'Arrival Date',
  pQvGpvjke: 'Arrival Time',
  vOpL9pe5q: 'Arrival Time AM/PM',
};

// readable name → internal key, for building payloads without magic strings.
export const K = {
  action: 'PbOqlOgpG',
  requestorEmail: 'WaG1J2w0J',
  workOrder: 'GY7jE7PwJ',
  vendor: 'aKvjgv3dl',
  buildingCode: '6wAdpAQzv',
  comment: 'yZpQ0pqkp',
  nteAmount: '5wAdLAyzm',
  targetDate: '7wALv2OvR',
  targetTime: 'Ky8adPgdN',
  targetAmpm: 'yZp9g6egl',
  startDate: 'mX7P97yGR',
  startTime: 'Ya3XR3Nqg',
  startAmpm: '2waXpankl',
  endDate: 'J9QDGQdn0',
  endTime: 'LQjNyjKog',
  endAmpm: '0w6dA6pkL',
  vendorConfirm: 'QDNWbNylX',
  assetBarcode: 'NjX8Owv3o',
  arrivalDate: '9yKnpKlXG',
  arrivalTime: 'pQvGpvjke',
  arrivalAmpm: 'vOpL9pe5q',
};

// The Action options, keyed by our internal `kind`. `value` is the EXACT
// case-sensitive string the Action dropdown expects. `label` is our own UI text.
// `needs` lists the extra inputs beyond the always-present WO#/email/vendor/
// building/comment. `file:true` means CBRE shows a required upload the person
// must attach by hand (cannot be prefilled).
export const ACTIONS = {
  cbre_acknowledge:   { value: 'Acknowledge Work',                 label: 'Acknowledge Work',   needs: [] },
  cbre_comment:       { value: 'Add Comment',                      label: 'Add Comment',        needs: [] },
  cbre_decline:       { value: 'Decline A Work Order',             label: 'Decline Work Order', needs: [] },
  cbre_complete:      { value: 'Complete A Work Order',            label: 'Complete Work Order',needs: ['start', 'end'] },
  cbre_nte:           { value: 'Submit NTE Request',               label: 'Submit NTE Request', needs: ['nteAmount'], file: true },
  cbre_target_date:   { value: 'Change Completion Target Date',    label: 'Change Target Date', needs: ['target'] },
  cbre_eta:           { value: 'Update Next Arrival Time',         label: 'Update Arrival Time',needs: ['arrival'] },
  cbre_tag_equipment: { value: 'Tag Equipment To Work Order',      label: 'Tag Equipment',      needs: ['assetBarcode'] },
};

// ── formatting helpers ───────────────────────────────────────────────────────

// "GAAUG - AUGUSTA" | "SCFLO" → "GAAUG". CBRE's dropdown expects its own 5-letter
// code. We keep this bare code; callers validate /^[A-Z]{5}$/ and fail loudly.
export function buildingCode(raw) {
  if (!raw) return null;
  return String(raw).split('-')[0].trim().toUpperCase();
}

// ── time zone ────────────────────────────────────────────────────────────────
// Everything CBRE sees is Eastern time (all sites are in the Southeast). Two
// traps make this explicit:
//   • work_orders.time_in / time_out (and the other check-in/out stamps) are
//     `timestamp` WITHOUT time zone, written with toISOString() — i.e. they hold
//     the UTC wall clock but come back from PostgREST with no "Z". `new Date()`
//     on such a string parses it as LOCAL time and shifts it by 4–5 h.
//   • The automatic producers run on Vercel, where local time is UTC, so local
//     getters (getHours…) would put "10:11 AM" into the form as "2:11 PM".
// parseTs() and tzParts() fix both; fmtDate()/to12h() render in CBRE_TZ on
// every runtime.
export const CBRE_TZ = 'America/New_York';

const NAIVE_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// { y, m (1-12), d, h (0-23), min } of an instant, as a clock in `tz` shows it.
export function tzParts(d, tz = CBRE_TZ) {
  if (d == null || d === '') return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
  const o = {};
  for (const p of f.formatToParts(dt)) o[p.type] = p.value;
  return { y: +o.year, m: +o.month, d: +o.day, h: (+o.hour) % 24, min: +o.minute };
}

// The instant at which a clock in `tz` shows y-m-d h:min (DST-aware).
export function tzDate(y, m, d, h = 0, min = 0, tz = CBRE_TZ) {
  const guess = Date.UTC(y, m - 1, d, h, min, 0, 0);
  const p = tzParts(new Date(guess), tz);
  const shown = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, 0, 0);
  return new Date(guess - (shown - guess));
}

// DB value → Date. Naive timestamps are UTC; a date-only string is that
// calendar day in CBRE_TZ (noon, so DST edges cannot move the date).
export function parseTs(v, tz = CBRE_TZ) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  const s = String(v).trim();
  if (DATE_ONLY.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    return tzDate(y, m, d, 12, 0, tz);
  }
  const dt = new Date(NAIVE_TS.test(s) ? s + 'Z' : s);
  return isNaN(dt.getTime()) ? null : dt;
}

// any date/timestamp → "MM/DD/YYYY" in CBRE_TZ (the format the form's date
// inputs accept).
export function fmtDate(d, tz = CBRE_TZ) {
  const p = tzParts(d, tz);
  if (!p) return null;
  return `${String(p.m).padStart(2, '0')}/${String(p.d).padStart(2, '0')}/${p.y}`;
}

// any timestamp → { time:"9:15", ampm:"AM" } in CBRE_TZ, rounded to the nearest
// 15 minutes (the form's time dropdown only offers :00/:15/:30/:45). Rounding
// the whole instant handles the :52 → next hour rollover cleanly.
export function to12h(d, tz = CBRE_TZ) {
  const dt = d instanceof Date ? d : new Date(d);
  if (!d || isNaN(dt.getTime())) return null;
  const step = 15 * 60 * 1000;
  const p = tzParts(new Date(Math.round(dt.getTime() / step) * step), tz);
  let h = p.h;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return { time: `${h}:${String(p.min).padStart(2, '0')}`, ampm };
}

export function money(v) {
  const n = parseFloat(v);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;
}

// ── payload builder ──────────────────────────────────────────────────────────
// Builds the exact keyed payload for approval_requests.payload, plus a readable
// mirror and any problems. TIME values are intentionally NOT put in the keyed
// payload (they don't prefill) — they go into the comment as "pick this" hints.
//
// input: {
//   kind, woNumber, buildingRaw, requestorEmail, vendor,
//   comment,                         // free text (reason / note)
//   nteAmount,                       // number|string  (cbre_nte)
//   targetAt,                        // date/ts         (cbre_target_date)
//   arrivalAt,                       // date/ts         (cbre_eta)
//   startAt, endAt,                  // date/ts         (cbre_complete)
//   assetBarcode,                    // string          (cbre_tag_equipment)
// }
// returns { payload, readable, timeHints:[...], problems:[...] }
export function buildCbrePayload(input) {
  const a = ACTIONS[input.kind];
  const problems = [];
  const timeHints = [];
  if (!a) {
    return { payload: null, readable: null, timeHints, problems: [`unknown kind ${input.kind}`] };
  }

  // UPS Building Code is REQUIRED on every work-order action of this form, so a
  // missing one is a hard problem — queueing it anyway produced submissions with
  // an empty building dropdown that had to be filled in by hand every time.
  const code = buildingCode(input.buildingRaw);
  if (!code) {
    problems.push('missing UPS building code (work order has no ups_building_code and no code in building)');
  } else if (!/^[A-Z]{5}$/.test(code)) {
    problems.push(`building code "${code}" is not 5 letters`);
  }
  if (!input.woNumber) problems.push('missing work order number');
  if (!input.requestorEmail) problems.push('missing requestor email');
  if (!input.vendor) problems.push('missing vendor');

  const payload = {
    [K.action]: a.value,
    [K.requestorEmail]: input.requestorEmail,
    [K.workOrder]: input.woNumber,
    [K.vendor]: input.vendor,
  };
  if (code) payload[K.buildingCode] = code;

  const readable = {
    action: a.value,
    workOrder: input.woNumber,
    vendor: input.vendor,
    buildingCodeRaw: input.buildingRaw,
    buildingCodeSent: code,
  };

  // A single date+time+ampm triple: set date + ampm in the payload, push the
  // time into timeHints for the comment.
  const applyDT = (at, kDate, kTime, kAmpm, label) => {
    const dstr = fmtDate(at);
    const t = to12h(at);
    if (dstr) payload[kDate] = dstr;
    if (t) {
      payload[kAmpm] = t.ampm;
      timeHints.push(`${label}: ${t.time} ${t.ampm}`);
      readable[label] = `${dstr || '?'} ${t.time} ${t.ampm}`;
    } else if (dstr) {
      readable[label] = dstr;
    }
    if (!dstr) problems.push(`missing ${label} date`);
  };

  if (input.kind === 'cbre_nte') {
    const amt = money(input.nteAmount);
    if (!amt) problems.push('missing / invalid NTE amount');
    else { payload[K.nteAmount] = amt; readable.nteAmount = amt; }
  }
  if (input.kind === 'cbre_target_date') {
    applyDT(input.targetAt, K.targetDate, K.targetTime, K.targetAmpm, 'Target');
  }
  if (input.kind === 'cbre_eta') {
    applyDT(input.arrivalAt, K.arrivalDate, K.arrivalTime, K.arrivalAmpm, 'Arrival');
  }
  if (input.kind === 'cbre_complete') {
    applyDT(input.startAt, K.startDate, K.startTime, K.startAmpm, 'Start');
    applyDT(input.endAt, K.endDate, K.endTime, K.endAmpm, 'End');
  }
  if (input.kind === 'cbre_tag_equipment') {
    if (!input.assetBarcode) problems.push('missing asset barcode');
    else { payload[K.assetBarcode] = input.assetBarcode; readable.assetBarcode = input.assetBarcode; }
  }

  // Comment: caller text first, then any time hints (so the person knows exactly
  // which time to pick in the dropdown the form won't let us prefill).
  let comment = (input.comment || '').trim();
  if (timeHints.length) {
    comment = (comment ? comment + ' — ' : '') + 'Please select: ' + timeHints.join(', ');
  }
  if (comment) { payload[K.comment] = comment; readable.comment = comment; }

  return { payload, readable, timeHints, problems };
}

// Reverse lookup: an exact Action value string (as it appears in a CBRE
// confirmation email) → our internal kind. Case-insensitive. null if unknown.
export function kindFromActionValue(value) {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  for (const [kind, def] of Object.entries(ACTIONS)) {
    if (def.value.toLowerCase() === v) return kind;
  }
  return null;
}
