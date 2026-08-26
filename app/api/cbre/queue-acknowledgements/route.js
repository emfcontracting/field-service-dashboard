// app/api/cbre/queue-acknowledgements/route.js
// ─────────────────────────────────────────────────────────────────────────────
// PRODUCER — turns work orders that CBRE has not been told about into rows in
// approval_requests, ready for Daniel to approve in the Approvals tab.
//
// It does NOT contact CBRE. It writes queue rows and sends one notification.
// A separate sender acts on rows that have been approved. That split is
// deliberate: a bug here can create noise, but it can never submit anything.
//
// Idempotency comes from the unique index uq_approval_requests_live, so running
// this twice cannot double-queue the same work order. Conflicts are ignored.
//
// Field keys are CBRE's own, captured from the Vendor App form definition:
//   Action PbOqlOgpG · Requestor Email WaG1J2w0J · Work Order # GY7jE7PwJ
//   Vendor aKvjgv3dl · UPS Building Code 6wAdpAQzv
// Acknowledge Work requires: Action, Requestor Email, Work Order #, Vendor,
// UPS Building Code AND Comment/Reason. No file upload.
//
// NOTE: an earlier version omitted the comment because the form's visibility
// logic appeared to exclude it for this action. That reading was wrong — the
// rendered form marks it required. The nested predicates are not safe to infer
// from; trust the rendered form.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FIELD = {
  action: 'PbOqlOgpG',
  requestorEmail: 'WaG1J2w0J',
  workOrder: 'GY7jE7PwJ',
  vendor: 'aKvjgv3dl',
  buildingCode: '6wAdpAQzv',
  comment: 'yZpQ0pqkp',
};

const ACTION_VALUE = 'Acknowledge Work';

// Deliberately conservative default. 123 acknowledgements arriving at CBRE in
// one burst would be a bad first impression regardless of how correct they are.
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

// Do not acknowledge ancient work orders. The queue legitimately contains 123
// rows, but 86 are over a month old and 10 are over six months — those were
// acknowledged long ago by phone or in VAWS and simply never recorded here.
// Telling CBRE in August that we accept a work order from last December would
// be nonsense, and might reopen something that is closed. Override per call
// with ?maxAgeDays=, and only do that deliberately.
const DEFAULT_MAX_AGE_DAYS = 14;

// CBRE work order numbers look like C3270457, P3209068, PJ3118923, ST2705334.
// Anything else is ours (EMF-PJ-03) or another system's and must never be
// posted into CBRE's form.
const CBRE_WO_PATTERN = /^(C|P|PJ|ST|COU)\d+$/i;

// Set these in Vercel rather than hardcoding a person into the repo.
const REQUESTOR_EMAIL = process.env.CBRE_REQUESTOR_EMAIL || 'emfcontractingsc@gmail.com';
const VENDOR_NAME = process.env.CBRE_VENDOR_NAME || 'EMF Contracting LLC(Gaston)';

// Comment/Reason is required for Acknowledge Work. Keep it factual — it is a
// permanent record on CBRE's side. Override with CBRE_ACK_COMMENT if you want
// different wording; {WO} and {DATE} are substituted.
const ACK_COMMENT_TEMPLATE =
  process.env.CBRE_ACK_COMMENT ||
  'Work order received and accepted by EMF Contracting LLC. Assigned to technician on {DATE}.';

function ackComment(wo) {
  const assigned = wo.assigned_to_field_at || wo.date_entered;
  const date = assigned ? String(assigned).slice(0, 10) : 'receipt';
  return ACK_COMMENT_TEMPLATE.replace('{WO}', wo.wo_number || '').replace('{DATE}', date);
}

// The FSM stores buildings as "GAAUG - AUGUSTA" or sometimes bare "SCFLO".
// CBRE's dropdown expects its own exact string, so we keep the raw value AND
// the bare code; the sender resolves it against the live option list and fails
// loudly if it cannot match, rather than guessing.
function buildingCode(raw) {
  if (!raw) return null;
  return String(raw).split('-')[0].trim().toUpperCase();
}

export async function GET(request) {
  return handle(request);
}
export async function POST(request) {
  return handle(request);
}

async function handle(request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    searchParams.get('key') !== process.env.CRON_SECRET
  ) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || DEFAULT_LIMIT, 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const dryRun = searchParams.get('dryRun') === 'true';
  const maxAgeDays = Math.max(
    parseInt(searchParams.get('maxAgeDays') || DEFAULT_MAX_AGE_DAYS, 10) || DEFAULT_MAX_AGE_DAYS,
    0
  );
  const notify = searchParams.get('notify') !== 'false';
  const deliveryMethod = searchParams.get('via') === 'sms' ? 'sms' : 'email';

  const result = {
    queued: 0,
    skipped: 0,
    dryRun,
    limit,
    maxAgeDays,
    excluded: { tooOld: [], notACbreNumber: [], noBuildingCode: [] },
    rows: [],
    errors: [],
  };

  try {
    // Newest first: a fresh work order is the one CBRE is actually waiting on.
    const { data: candidates, error: qErr } = await supabase
      .from('cbre_acknowledgement_queue')
      .select('wo_id, wo_number, ups_building_code, priority, status, date_entered, assigned_to_field_at, days_since_dispatch')
      .order('date_entered', { ascending: false })
      .limit(Math.min(limit * 6, 200));   // over-fetch; guards below drop some
    if (qErr) throw new Error(`queue read failed: ${qErr.message}`);

    if (!candidates?.length) {
      return Response.json({ ...result, message: 'Nothing to acknowledge.' });
    }

    // Some work orders carry the site code only in `building`, not
    // ups_building_code. Fetch it so we fall back instead of excluding them.
    const woIds = candidates.map((c) => c.wo_id).filter(Boolean);
    const buildingByWo = {};
    if (woIds.length) {
      const { data: bset } = await supabase.from('work_orders').select('wo_id, building').in('wo_id', woIds);
      (bset || []).forEach((b) => { buildingByWo[b.wo_id] = b.building; });
    }

    for (const wo of candidates) {
      // ── Guards. Each exclusion is reported, never silent. ────────────────
      const age = wo.days_since_dispatch ?? 0;
      if (maxAgeDays > 0 && age > maxAgeDays) {
        result.excluded.tooOld.push(`${wo.wo_number} (${age}d)`);
        continue;
      }
      if (!CBRE_WO_PATTERN.test(String(wo.wo_number || '').trim())) {
        result.excluded.notACbreNumber.push(wo.wo_number);
        continue;
      }

      const rawBldg = wo.ups_building_code || buildingByWo[wo.wo_id];
      const code = buildingCode(rawBldg);
      if (!code || !/^[A-Z]{5}$/.test(code)) {
        result.excluded.noBuildingCode.push(`${wo.wo_number} (${rawBldg || 'null'})`);
        continue;
      }
      const payload = {
        // Exactly what will be posted, keyed by CBRE's field ids.
        [FIELD.action]: ACTION_VALUE,
        [FIELD.requestorEmail]: REQUESTOR_EMAIL,
        [FIELD.workOrder]: wo.wo_number,
        [FIELD.vendor]: VENDOR_NAME,
        [FIELD.buildingCode]: code,
        [FIELD.comment]: ackComment(wo),
        // Human-readable mirror, so the Approvals tab is legible without a
        // lookup table. The sender uses the keyed values above, not these.
        _readable: {
          action: ACTION_VALUE,
          requestorEmail: REQUESTOR_EMAIL,
          workOrder: wo.wo_number,
          vendor: VENDOR_NAME,
          buildingCodeRaw: rawBldg,
          buildingCodeSent: code,
          comment: ackComment(wo),
        },
      };

      const row = {
        kind: 'cbre_acknowledge',
        wo_id: wo.wo_id,
        wo_number: wo.wo_number,
        title: `Acknowledge ${wo.wo_number} to CBRE`,
        summary: `${wo.ups_building_code || 'unknown site'} · ${wo.priority || 'no priority'} · dispatched ${wo.date_entered} (${wo.days_since_dispatch}d ago)`,
        payload,
        status: 'pending',
      };

      if (dryRun) {
        result.rows.push(row);
        result.queued++;
        if (result.queued >= limit) break;
        continue;
      }

      const { data, error } = await supabase
        .from('approval_requests')
        .insert(row)
        .select('approval_id')
        .single();

      if (error) {
        // 23505 = unique violation = already queued. Expected, not a failure.
        if (error.code === '23505') {
          result.skipped++;
        } else {
          result.errors.push(`${wo.wo_number}: ${error.message}`);
        }
        continue;
      }
      result.queued++;
      result.rows.push({ approval_id: data.approval_id, wo_number: wo.wo_number });
      if (result.queued >= limit) break;
    }

    // ── One notification for the batch, not one per row ──────────────────────
    if (notify && !dryRun && result.queued > 0) {
      try {
        const { data: staff } = await supabase
          .from('users')
          .select('user_id, email, phone, sms_carrier, first_name, last_name, role')
          .in('role', ['admin', 'office_staff'])
          .eq('is_active', true);

        // VERCEL_URL is the deployment-specific host, which Vercel's Deployment
        // Protection answers with 401 — that is what broke the first run.
        // VERCEL_PROJECT_PRODUCTION_URL is the public production domain.
        const base =
          process.env.NEXT_PUBLIC_BASE_URL ||
          (process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : null) ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
        result.notifyBase = base;   // surfaced so a 401 is diagnosable

        const list = result.rows.map((r) => r.wo_number).filter(Boolean).join(', ');
        const message =
          `${result.queued} work order${result.queued === 1 ? '' : 's'} need${result.queued === 1 ? 's' : ''} ` +
          `CBRE acknowledgement: ${list}. Approve in the dashboard: ${base}/dashboard?view=approvals`;

        const res = await fetch(`${base}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'approval_needed',
            recipients: staff || [],
            customMessage: message,
            deliveryMethod,
          }),
        });
        result.notified = res.ok;
        if (!res.ok) result.errors.push(`notify failed: HTTP ${res.status}`);

        if (res.ok) {
          await supabase
            .from('approval_requests')
            .update({ notified_at: new Date().toISOString() })
            .in('approval_id', result.rows.map((r) => r.approval_id).filter(Boolean));
        }
      } catch (nErr) {
        result.errors.push(`notify error: ${nErr.message}`);
      }
    }

    return Response.json(result);
  } catch (err) {
    return Response.json({ ...result, error: err.message }, { status: 500 });
  }
}
