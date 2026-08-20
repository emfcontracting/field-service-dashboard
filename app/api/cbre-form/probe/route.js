// app/api/cbre-form/probe/route.js
// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY ONLY — reads the CBRE Vendor App form's definition to learn its
// field keys. Submits nothing; sends no data to CBRE.
//
// EMF has CBRE's permission to automate submissions through the Vendor App
// form. CBRE's restriction is on API access into VAWS, which this never touches.
//
// SCHEMA (learned in v3): every control carries a short `key` (e.g. "GY7jE7PwJ")
// which is the identifier the payload uses. `logic` holds SHOW_COMPONENT rules
// predicated on the Action control's key, which is how the form reveals
// different fields per action.
//
// DELETE THIS ROUTE once the map is captured. It is scaffolding.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FORM_ID = '019aa33a6ffd70a7983bbf4af282307a';
const FORM_URL = `https://app.smartsheet.com/b/form/${FORM_ID}`;

function collectRaw(node, acc = [], depth = 0) {
  if (!node || depth > 14 || acc.length > 60) return acc;
  if (Array.isArray(node)) {
    for (const i of node) collectRaw(i, acc, depth + 1);
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if ('key' in node && ('label' in node || 'title' in node)) acc.push(node);
  for (const k of Object.keys(node)) collectRaw(node[k], acc, depth + 1);
  return acc;
}

// Pull the Action values that reveal a given control, so we know which fields
// belong to which action without submitting anything to find out.
function shownBy(control) {
  const out = new Set();
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.value && n.value.value) out.add(n.value.value);
    if (n.values && Array.isArray(n.values.values)) {
      n.values.values.forEach((v) => out.add(`NOT:${v}`));
    }
    Object.values(n).forEach(walk);
  };
  walk(control.logic);
  return [...out];
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

    // Compact map: everything needed to build a payload, nothing else.
    const fields = raw.map((c) => ({
      label: c.label ?? c.title ?? null,
      key: c.key,
      type: c.type,
      valueType: c.valueType ?? null,
      required: !!c.required,
      shownWhenActionIs: shownBy(c),
    }));

    // The Action control's choices, verbatim — these strings must match exactly.
    const action = raw.find((c) => (c.label ?? '') === 'Action');
    const actionOptions = Array.isArray(action?.options)
      ? action.options.map((o) => (typeof o === 'string' ? o : o?.value ?? o?.label ?? null))
      : null;

    // Anything the form posts alongside the answers.
    const formKeyish = {
      formId: definition?.formId ?? definition?.id ?? null,
      version: definition?.version ?? null,
      confirmationType: definition?.confirmation?.type ?? null,
      topLevelKeys: Object.keys(definition || {}),
    };

    return Response.json({
      note: 'Discovery only. Nothing submitted.',
      endpoint,
      actionKey: action?.key ?? null,
      actionOptions,
      formKeyish,
      fieldCount: fields.length,
      fields,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
