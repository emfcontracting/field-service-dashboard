// app/api/cbre-form/probe/route.js
// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY ONLY — reads the CBRE Vendor App form's definition. Submits nothing.
//
// v5 answers the two questions left before a sender can be written:
//   1. Is there an active CAPTCHA? (captchaSiteKey / settings)
//   2. What are the exact option strings for the Vendor and UPS Building Code
//      dropdowns? SELECT_INPUT values must match character for character.
//
// Field keys already captured:
//   Action PbOqlOgpG · Requestor Email WaG1J2w0J · Work Order # GY7jE7PwJ
//   Vendor aKvjgv3dl · UPS Building Code 6wAdpAQzv · NTE Amount 5wAdLAyzm
//   Comment yZpQ0pqkp · File Upload ATTACHMENT
//
// DELETE THIS ROUTE once captured. It is scaffolding.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FORM_ID = '019aa33a6ffd70a7983bbf4af282307a';
const FORM_URL = `https://app.smartsheet.com/b/form/${FORM_ID}`;

const VENDOR_KEY = 'aKvjgv3dl';
const BUILDING_KEY = '6wAdpAQzv';

function collectRaw(node, acc = [], depth = 0) {
  if (!node || depth > 14 || acc.length > 60) return acc;
  if (Array.isArray(node)) { for (const i of node) collectRaw(i, acc, depth + 1); return acc; }
  if (typeof node !== 'object') return acc;
  if ('key' in node && ('label' in node || 'title' in node)) acc.push(node);
  for (const k of Object.keys(node)) collectRaw(node[k], acc, depth + 1);
  return acc;
}

const optStrings = (c) =>
  Array.isArray(c?.options)
    ? c.options.map((o) => (typeof o === 'string' ? o : o?.value ?? o?.label ?? JSON.stringify(o)))
    : null;

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

  // Only return building options matching this filter, so the response stays
  // small — CBRE's building list is long and we only serve a dozen sites.
  const filter = (searchParams.get('filter') || 'GAAUG,SCSMV,SCCHA,SCMYR,SCFLO,SCSMT,SCLON,SCTON,SCAIK,SCCOL,SCCAH,GASNH')
    .split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

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
    const def = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    const raw = collectRaw(def);

    const vendor = raw.find((c) => c.key === VENDOR_KEY);
    const building = raw.find((c) => c.key === BUILDING_KEY);
    const buildingOpts = optStrings(building) || [];

    // Does the page actually load a captcha script, regardless of the config?
    const captchaInPage = ['grecaptcha', 'recaptcha', 'hcaptcha', 'turnstile']
      .filter((k) => html.toLowerCase().includes(k));

    return Response.json({
      note: 'Discovery only. Nothing submitted.',
      endpoint,

      // ── the gating question ──
      captchaSiteKey: def?.captchaSiteKey ?? null,
      captchaSiteKeyType: typeof def?.captchaSiteKey,
      captchaScriptsReferencedInPage: captchaInPage,
      settings: def?.settings ? JSON.stringify(def.settings).slice(0, 900) : null,
      formStatus: def?.formStatus ?? null,

      // ── the dropdown values ──
      vendorOptions: optStrings(vendor),
      buildingOptionCount: buildingOpts.length,
      buildingOptionsMatchingOurSites: buildingOpts.filter((o) =>
        filter.some((f) => String(o).toUpperCase().includes(f))
      ),
      buildingOptionsSample: buildingOpts.slice(0, 5),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
