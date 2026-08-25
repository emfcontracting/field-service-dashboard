// app/api/cbre/queue-nte-requests/route.js
// ─────────────────────────────────────────────────────────────────────────────
// PRODUCER — turns work orders where EMF has submitted a quote to CBRE
// (cbre_status = 'quote_submitted') and an NTE amount is set into "Submit NTE
// Request" rows in approval_requests, ready for approval in the Approvals tab.
//
// It does NOT contact CBRE. It writes queue rows only. A human approves each one
// and submits CBRE's own prefilled form by hand. Mirrors queue-acknowledgements.
//
// Idempotency: the unique index uq_approval_requests_live blocks a second live
// row per (kind, wo_id); and once submitted, markSubmitted stamps
// cbre_nte_submitted_at, which this query excludes — so it is never re-queued.
//
// FIRST-RUN NOTE: NTE requests already sent to CBRE by email will surface here
// once (they have no cbre_nte_submitted_at yet). That is why nothing is sent
// automatically — reject in the Approvals tab any that were already handled.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { buildCbrePayload } from '@/lib/cbreVendorForm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Conservative on purpose, same as acknowledgements: a burst of NTE requests
// landing at CBRE at once is a bad look even when each is correct.
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 50;

const CBRE_WO_PATTERN = /^(C|P|PJ|ST|COU)\d+$/i;

const REQUESTOR_EMAIL = process.env.CBRE_REQUESTOR_EMAIL || 'emfcontractingsc@gmail.com';
const VENDOR_NAME = process.env.CBRE_VENDOR_NAME || 'EMF Contracting LLC(Gaston)';
const NTE_COMMENT_TEMPLATE =
  process.env.CBRE_NTE_COMMENT ||
  'NTE increase requested by EMF Contracting LLC to complete the work order.';

export async function GET(request) { return handle(request); }
export async function POST(request) { return handle(request); }

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

  const result = {
    queued: 0,
    skipped: 0,
    excluded: { notACbreNumber: [], noBuildingCode: [], noAmount: [], problems: [] },
    errors: [],
    rows: [],
  };

  try {
    const { data: candidates, error: qErr } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, ups_building_code, nte, cbre_status, building, priority, date_entered')
      .eq('cbre_status', 'quote_submitted')
      .is('cbre_nte_submitted_at', null)
      .not('nte', 'is', null)
      .order('date_entered', { ascending: false })
      .limit(Math.min(limit * 6, 200));
    if (qErr) throw new Error(`query failed: ${qErr.message}`);
    if (!candidates?.length) return Response.json({ ...result, message: 'Nothing to submit.' });

    for (const wo of candidates) {
      const num = String(wo.wo_number || '').trim();
      if (!CBRE_WO_PATTERN.test(num)) { result.excluded.notACbreNumber.push(wo.wo_number); continue; }

      const amt = parseFloat(wo.nte);
      if (!Number.isFinite(amt) || amt <= 0) { result.excluded.noAmount.push(wo.wo_number); continue; }

      const built = buildCbrePayload({
        kind: 'cbre_nte',
        woNumber: wo.wo_number,
        buildingRaw: wo.ups_building_code,
        requestorEmail: REQUESTOR_EMAIL,
        vendor: VENDOR_NAME,
        nteAmount: wo.nte,
        comment: NTE_COMMENT_TEMPLATE,
      });
      if (built.problems.length) {
        if (built.problems.some((p) => /building/.test(p)))
          result.excluded.noBuildingCode.push(`${wo.wo_number} (${wo.ups_building_code || 'null'})`);
        else result.excluded.problems.push(`${wo.wo_number}: ${built.problems.join('; ')}`);
        continue;
      }

      const row = {
        kind: 'cbre_nte',
        wo_id: wo.wo_id,
        wo_number: wo.wo_number,
        title: `Submit NTE $${built.readable.nteAmount} for ${wo.wo_number} to CBRE`,
        summary: `${wo.ups_building_code || 'unknown site'} · ${wo.building || ''} · NTE $${built.readable.nteAmount}`,
        payload: { ...built.payload, _readable: built.readable },
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
        if (error.code === '23505') result.skipped++;         // already queued — expected
        else result.errors.push(`${wo.wo_number}: ${error.message}`);
        continue;
      }
      result.queued++;
      result.rows.push({ approval_id: data.approval_id, wo_number: wo.wo_number });
      if (result.queued >= limit) break;
    }

    return Response.json({ ...result, message: `Queued ${result.queued} NTE request(s).` });
  } catch (e) {
    return Response.json({ ...result, error: e.message }, { status: 500 });
  }
}
