// app/api/cbre-form/probe/route.js
// ─────────────────────────────────────────────────────────────────────────────
// DISCOVERY ONLY — reads the CBRE Vendor App form's own definition so we can
// learn its field identifiers. Submits nothing; sends no data to CBRE.
//
// EMF has CBRE's permission to automate submissions through the Vendor App
// form. CBRE's restriction is on API access into VAWS behind their security,
// which this does not touch.
//
// HOW IT WORKS: the form page ships its whole schema inline as
//   window.formDefinition = "<base64 of JSON>"
// and posts to window.formEndpoint. We decode that definition and report the
// field list, so the submitter can be written against the real ids.
//
// DELETE THIS ROUTE once the field map is captured. It is scaffolding.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const FORM_ID = '019aa33a6ffd70a7983bbf4af282307a';
const FORM_URL = `https://app.smartsheet.com/b/form/${FORM_ID}`;

// Recursively walk the decoded definition and pull out anything that looks
// like a field, whatever the nesting turns out to be.
function collectFields(node, acc = [], depth = 0) {
  if (!node || depth > 12) return acc;
  if (Array.isArray(node)) {
    for (const item of node) collectFields(item, acc, depth + 1);
    return acc;
  }
  if (typeof node !== 'object') return acc;

  const looksLikeField =
    'label' in node || 'title' in node || 'displayValue' in node || 'fieldId' in node;

  if (looksLikeField) {
    acc.push({
      label: node.label ?? node.title ?? node.displayValue ?? null,
      fieldId: node.fieldId ?? node.id ?? null,
      columnId: node.columnId ?? null,
      objectId: node.objectId ?? null,
      type: node.type ?? node.fieldType ?? node.controlType ?? null,
      required: node.required ?? node.isRequired ?? null,
      // Dropdown choices, however they are spelled.
      options:
        node.options ?? node.choices ?? node.values ?? node.picklistOptions ?? null,
      // Which other field/value reveals this one — the form is conditional.
      conditional:
        node.conditionalRule ?? node.condition ?? node.visibilityRule ?? null,
    });
  }

  for (const key of Object.keys(node)) {
    collectFields(node[key], acc, depth + 1);
  }
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

  try {
    const res = await fetch(FORM_URL, {
      headers: {
        'User-Agent': 'EMF-Contracting-FSM/1.0 (authorised vendor form integration)',
        Accept: 'text/html,application/json,*/*',
      },
      redirect: 'follow',
    });
    const html = await res.text();

    const endpoint = (html.match(/window\.formEndpoint\s*=\s*"([^"]+)"/) || [])[1] || null;
    const b64 = (html.match(/window\.formDefinition\s*=\s*"([^"]+)"/) || [])[1] || null;

    if (!b64) {
      return Response.json({
        note: 'Discovery only. Nothing was submitted.',
        error: 'window.formDefinition not found',
        endpoint,
        bytes: html.length,
        head: html.slice(0, 1200),
      });
    }

    let definition = null;
    let decodeError = null;
    try {
      const json = Buffer.from(b64, 'base64').toString('utf8');
      definition = JSON.parse(json);
    } catch (e) {
      decodeError = e.message;
      // Padding is sometimes stripped — retry with it restored.
      try {
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        definition = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
        decodeError = null;
      } catch (e2) {
        decodeError = `${e.message} / retry: ${e2.message}`;
      }
    }

    const fields = definition ? collectFields(definition) : [];

    return Response.json({
      note: 'Discovery only. Nothing was submitted to CBRE.',
      probedAt: new Date().toISOString(),
      formUrl: FORM_URL,
      endpoint,
      decodeError,
      formName: definition?.name ?? null,
      // Top-level keys, so we can see the overall shape at a glance.
      topLevelKeys: definition ? Object.keys(definition) : [],
      fieldCount: fields.length,
      fields,
      // Kept last and trimmed: full definition for anything the walker missed.
      definitionSample: definition
        ? JSON.stringify(definition).slice(0, 12000)
        : null,
    });
  } catch (err) {
    return Response.json({ error: err.message, formUrl: FORM_URL }, { status: 500 });
  }
}
