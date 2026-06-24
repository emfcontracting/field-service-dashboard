// app/api/email-import/contactParser.js
// Shared helper for parsing the CBRE "Contact Names and Phone Numbers" block
// out of a normalized (single-line) dispatch email body.
//
// Used by:
//   - app/api/email-import/route.js        (manual paste / IMAP preview)
//   - app/api/email-import/cron/route.js   (automatic 10-min import)
//   - app/api/email-import/manual/route.js (import by WO number)
//
// The CONTACT person names + phones change from email to email, so we never
// hardcode people — we anchor on the stable CBRE CATEGORY labels and extract
// whatever name/org/phone follows each one.
//
// To support a NEW CBRE category (e.g. "Refrigeration"), just add it to
// CONTACT_LABELS below. Anything not listed is treated as part of the previous
// category's value, so keeping this list current keeps the block clean.

// Order does not matter here — positions are detected at runtime.
// `match`   = exact label text as it appears in the email (before the colon)
// `display` = how it should read in the WO comments block
// `boundary`= true means it delimits sections but is NOT output on its own
//             (the Requestor goes into its own requestor / requestor_phone
//              fields, so we use it only as a boundary, never print it here)
const CONTACT_LABELS = [
  { match: 'Work Order Requestor Name and Phone', display: 'Requestor', boundary: true },
  { match: 'Work Order Dispatcher',               display: 'Dispatcher' },
  { match: 'Conveyors',                           display: 'Conveyors' },
  { match: 'Environmental',                       display: 'Environmental' },
  { match: 'Capital',                             display: 'Capital' },
  { match: 'Refrigeration',                       display: 'Refrigeration' },
  { match: 'Electrical',                          display: 'Electrical' },
  { match: 'Fire',                                display: 'Fire' },
  { match: 'Security',                            display: 'Security' },
  { match: 'GTSG',                                display: 'GTSG' },
];

// Matches US phone formats: "720-216-9999", "(912) 650-1081", "555.555.5555"
const PHONE_REGEX = /(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/;

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Turn a raw value like "Larry Bryant, UPS, 720-216-9999" into
// "Conveyors: Larry Bryant (UPS) – 720-216-9999".
// Returns null when there's nothing meaningful to show.
function formatContact(display, rawValue) {
  const value = (rawValue || '').replace(/\s+/g, ' ').replace(/,\s*$/, '').trim();
  if (!value) return null;

  // Pull out a phone number if present, then remove it from the remainder.
  let phone = '';
  const pm = value.match(PHONE_REGEX);
  if (pm) phone = pm[1].replace(/\s+/g, ' ').trim();

  const rest = value
    .replace(PHONE_REGEX, '')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/, '')
    .replace(/^\s*,/, '')
    .trim();

  const parts = rest.split(',').map(p => p.trim()).filter(Boolean);

  let line = `${display}: `;
  if (parts.length === 0) {
    // Only a phone, no name/org
    line += phone;
  } else {
    const name = parts[0];
    const org = parts.slice(1).join(', ');
    line += org ? `${name} (${org})` : name;
    if (phone) line += ` – ${phone}`;
  }

  const out = line.trim();
  // Guard against an empty "Label:" with nothing after it.
  return out.endsWith(':') ? null : out;
}

/**
 * Parse the contact block from a cleaned (whitespace-normalized) email body.
 * Returns an array of formatted lines (excluding the requestor), e.g.:
 *   [
 *     "Dispatcher: Jacquet Scarbrough – 555-555-5555",
 *     "Conveyors: Larry Bryant (UPS) – 720-216-9999",
 *     "Environmental: Vincent Mollo (UPS)",
 *     "Capital: Sean Edwards (UPS) – (912) 650-1081",
 *     "GTSG: See link below for Contact Tree"
 *   ]
 * Returns [] when no contact labels are found.
 *
 * @param {string} cleanBody - body already run through the route's cleanBody
 *                             normalization (HTML stripped, whitespace collapsed).
 */
export function buildContactLines(cleanBody) {
  const body = cleanBody || '';
  if (!body) return [];

  // Prefer scoping to the contact section header when present, so we don't
  // accidentally pick up a "Requestor" mention elsewhere in the email.
  const headerIdx = body.search(/Contact Names and Phone Numbers/i);
  const scope = headerIdx >= 0 ? body.slice(headerIdx) : body;

  // Locate each known label within the scope.
  const found = [];
  for (const def of CONTACT_LABELS) {
    const re = new RegExp(escapeRegExp(def.match) + '\\s*:', 'i');
    const m = scope.match(re);
    if (m && m.index != null) {
      found.push({ def, start: m.index, valueStart: m.index + m[0].length });
    }
  }
  if (found.length === 0) return [];

  // Sort by position so each value runs until the next detected label.
  found.sort((a, b) => a.start - b.start);

  const lines = [];
  for (let i = 0; i < found.length; i++) {
    const cur = found[i];
    const next = found[i + 1];
    if (cur.def.boundary) continue; // requestor — handled as its own field

    const rawValue = scope.slice(cur.valueStart, next ? next.start : undefined);
    const formatted = formatContact(cur.def.display, rawValue);
    if (formatted) lines.push(formatted);
  }

  return lines;
}
