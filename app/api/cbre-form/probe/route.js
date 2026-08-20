// app/api/cbre-form/probe/route.js
// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY ONLY — reads the CBRE Vendor App form's own definition so we can
// learn its field identifiers. Submits nothing; sends no data to CBRE.
//
// EMF has CBRE's permission to automate submissions through the Vendor App
// form. CBRE's restriction is on API access into VAWS behind their security,
// which this does not touch.
//
// The form page is JavaScript-rendered, so the field ids aren't in the raw
// HTML — they come from a config payload. This route fetches the form from the
// server (Vercel can reach smartsheet.com; our tooling cannot) and reports
// what it finds, so the real submitter can be written against facts.
//
// DELETE THIS ROUTE once the field map is captured. It is scaffolding.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FORM_ID = '019aa33a6ffd70a7983bbf4af282307a';
const FORM_URL = `https://app.smartsheet.com/b/form/${FORM_ID}`;

// The labels we already know from the rendered form. Finding these in a
// payload tells us we're looking at the right blob.
const KNOWN_LABELS = [
  'Action',
  'Requestor Email',
  'Work Order #',
  'Vendor',
  'UPS Building Code',
  'NTE Request Amount',
  'Arrival Date',
  'Arrival Time',
  'Comment/Reason/File Description',
];

// Extract anything that looks like a field definition, without assuming the
// schema up front.
function extract(text) {
  if (!text) return null;

  const labelsPresent = KNOWN_LABELS.filter((l) => text.includes(l));

  // Long digit strings are Smartsheet column/object ids.
  const numericIds = [...new Set(text.match(/\b\d{15,19}\b/g) || [])].slice(0, 60);

  // Key/value pairs that smell like form field metadata.
  const pairs = [];
  const re =
    /"(fieldId|columnId|objectId|questionId|controlId|label|title|name|type)"\s*:\s*("(?:[^"\\]|\\.)*"|\d+|true|false)/g;
  let m;
  while ((m = re.exec(text)) !== null && pairs.length < 200) {
    pairs.push(`${m[1]}:${m[2]}`);
  }

  // Any embedded JSON blobs — often the config is inlined in a script tag.
  const blobs = [];
  const blobRe = /<script[^>]*>([\s\S]{200,}?)<\/script>/g;
  let b;
  while ((b = blobRe.exec(text)) !== null && blobs.length < 6) {
    const body = b[1];
    if (KNOWN_LABELS.some((l) => body.includes(l))) {
      blobs.push(body.slice(0, 4000));
    }
  }

  return { labelsPresent, numericIds, pairs, matchingScriptBlobs: blobs };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    searchParams.get('probe_key') !== process.env.CRON_SECRET
  ) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const res = await fetch(FORM_URL, {
      headers: {
        // Identify honestly rather than impersonating a browser.
        'User-Agent': 'EMF-Contracting-FSM/1.0 (authorised vendor form integration)',
        Accept: 'text/html,application/json,*/*',
      },
      redirect: 'follow',
    });

    const text = await res.text();

    return Response.json({
      note: 'Discovery only. Nothing was submitted to CBRE.',
      formUrl: FORM_URL,
      probedAt: new Date().toISOString(),
      status: res.status,
      contentType: res.headers.get('content-type'),
      bytes: text.length,
      extracted: extract(text),
      // Raw head, so the shape is visible even if the extractor misses.
      head: text.slice(0, 1500),
    });
  } catch (err) {
    return Response.json(
      { error: err.message, formUrl: FORM_URL, probedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
