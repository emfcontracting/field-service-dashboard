// app/api/cbre-form/probe/route.js
// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY ONLY — reads the CBRE Vendor App form's definition to learn its
// field identifiers. Submits nothing; sends no data to CBRE.
//
// EMF has CBRE's permission to automate submissions through the Vendor App
// form. CBRE's restriction is on API access into VAWS, which this never touches.
//
// The form ships its schema inline as window.formDefinition = "<base64 JSON>"
// and posts to window.formEndpoint. v3 keeps the response SMALL and returns the
// RAW field objects, because the identifier keys are not named what we guessed.
//
// DELETE THIS ROUTE once the field map is captured. It is scaffolding.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FORM_ID = '019aa33a6ffd70a7983bbf4af282307a';
const FORM_URL = `https://app.smartsheet.com/b/form/${FORM_ID}`;

// Collect objects that carry a human label — those are the form controls.
function collectRaw(node, acc = [], depth = 0) {
  if (!node || depth > 14 || acc.length > 60) return acc;
  if (Array.isArray(node)) {
    for (const i of node) collectRaw(i, acc, depth + 1);
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if ('label' in node || 'title' in node) acc.push(node);
  for (const k of Object.keys(node)) collectRaw(node[k], acc, depth + 1);
  return acc;
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

  const want = (searchParams.get('label') || 'Work Order #').toLowerCase();

  try {
    const res = await fetch(FORM_URL, {
      headers: {
        'User-Agent': 'EMF-Contracting-FSM/1.0 (authorised vendor form integration)',
        Accept: 'text/html,*/*',
      },
      redirect: 'follow',
    });
    const html = await res.text();

    const endpoint = (html.match(/window\.formEndpoint\s*=\s*"([^"]+)"/) || [])[1] || null;
    const b64 = (html.match(/window\.formDefinition\s*=\s*"([^"]+)"/) || [])[1] || null;
    if (!b64) return Response.json({ error: 'formDefinition not found', endpoint });

    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const definition = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));

    const raw = collectRaw(definition);

    // Every distinct key name used across all control objects. This tells us
    // what the identifier is actually called.
    const allKeys = [...new Set(raw.flatMap((o) => Object.keys(o)))].sort();

    // One control in full, verbatim — the one whose label matches ?label=
    const match =
      raw.find((o) => String(o.label ?? o.title ?? '').toLowerCase() === want) ||
      raw.find((o) => String(o.label ?? o.title ?? '').toLowerCase().includes(want)) ||
      raw[0] ||
      null;

    return Response.json({
      note: 'Discovery only. Nothing submitted.',
      endpoint,
      controlCount: raw.length,
      allKeys,
      labels: raw.map((o) => o.label ?? o.title).filter(Boolean).slice(0, 25),
      // Raw object, trimmed so the response stays readable.
      matchedLabel: match ? (match.label ?? match.title) : null,
      matchedRaw: match ? JSON.stringify(match).slice(0, 2500) : null,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
