// app/api/email-import/parseCbreDate.js
// ─────────────────────────────────────────────────────────────────────────────
// Parse CBRE's "Date Entered" field into a correct UTC ISO string.
//
// WHY THIS EXISTS:
// CBRE stamps this field in Eastern time and usually includes the source offset,
// e.g.  "Date Entered: Dec  2 2025  8:17AM UTC-05".
// The old parser captured only "Dec 2 2025 8:17AM" (the regex dropped the
// " UTC-05" suffix) and then did `new Date(str).toISOString()`. A bare date-time
// string with no zone is interpreted in the RUNTIME zone -- and on Vercel that
// is UTC. So an 8:17 AM Eastern dispatch got stored as 8:17 UTC, i.e. 4-5 hours
// early, on every import.
//
// This helper:
//   1. captures the offset when CBRE provides it (UTC-05 / UTC-04 / EST / EDT)
//      and honors it exactly, and
//   2. when no zone is present, assumes CBRE Eastern wall-clock (DST-aware via
//      Intl, no external library).
// Either way it returns a proper UTC instant (ISO string), or null when the
// field is absent/unparseable so the caller can keep its own default.
//
// Store the returned value in a timestamptz column; render it with
// { timeZone: 'America/New_York' } on the read side (see lib/activityLogExport).
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

// Offset (minutes, local - UTC) of America/New_York at a given wall-clock time.
// Technique: interpret the wall-clock as if it were UTC, format that instant in
// the target zone, and measure how far the zone's wall-clock lands from the UTC
// we fed in. That difference IS the zone offset, and it picks up DST correctly
// because Intl knows the rules for the specific date.
function easternOffsetMinutes(year, month, day, hour, minute) {
  const asUTC = Date.UTC(year, month, day, hour, minute);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const p = {};
  for (const part of dtf.formatToParts(new Date(asUTC))) {
    if (part.type !== 'literal') p[part.type] = part.value;
  }
  const zoned = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour), Number(p.minute)
  );
  return Math.round((zoned - asUTC) / 60000);
}

// Parse an already-cleaned email body (whitespace normalized, HTML stripped) and
// return date_entered as a UTC ISO string, or null if absent/unparseable.
export function parseCbreDateEntered(cleanBody) {
  if (!cleanBody) return null;

  // Capture the date-time AND an optional trailing zone token.
  //   group 1: "Dec 2 2025 8:17AM"     (month day year h:mm AM/PM)
  //   group 2: "UTC-05" | "UTC-5" | "EST" | "EDT"   (optional)
  const m = cleanBody.match(
    /Date Entered:\s*([A-Za-z]+\s+\d{1,2}\s+\d{4}\s+\d{1,2}:\d{2}\s*[AP]\.?M\.?)\s*(UTC[+-]\d{1,2}(?::?\d{2})?|E[SD]T)?/i
  );
  if (!m) return null;

  const parts = m[1]
    .replace(/\s+/g, ' ')
    .trim()
    .match(/^([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP])\.?M\.?$/i);
  if (!parts) return null;

  const month = MONTHS[parts[1].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;

  const day = Number(parts[2]);
  const year = Number(parts[3]);
  const minute = Number(parts[5]);
  let hour = Number(parts[4]) % 12;          // 12 -> 0, so 12 AM = 0
  if (/p/i.test(parts[6])) hour += 12;        // PM shifts by 12 (12 PM = 12)

  // Determine the UTC offset (minutes, local - UTC) of the SOURCE time.
  let offsetMin;
  const zone = (m[2] || '').toUpperCase();
  const utc = zone.match(/^UTC([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (utc) {
    const sign = utc[1] === '-' ? -1 : 1;
    const hh = Number(utc[2]);
    const mm = utc[3] ? Number(utc[3]) : 0;
    offsetMin = sign * (hh * 60 + mm);
  } else if (zone === 'EST') {
    offsetMin = -300;
  } else if (zone === 'EDT') {
    offsetMin = -240;
  } else {
    // No zone in the email -> assume CBRE Eastern wall-clock (DST-aware).
    offsetMin = easternOffsetMinutes(year, month, day, hour, minute);
  }

  // UTC instant = wall-clock minus the source offset.
  const utcMs = Date.UTC(year, month, day, hour, minute) - offsetMin * 60000;
  const d = new Date(utcMs);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
