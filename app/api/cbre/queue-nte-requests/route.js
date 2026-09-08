// app/api/cbre/queue-nte-requests/route.js
// ─────────────────────────────────────────────────────────────────────────────
// PRODUCER — turns written NTE increases that a technician created in FSM
// (work_order_quotes.nte_status = 'pending', i.e. NOT yet uploaded to CBRE)
// into "Submit NTE Request" rows in approval_requests, ready for approval in
// the Approvals tab.
//
// Why quotes and not cbre_status: `cbre_status = 'quote_submitted'` is what
// CBRE's own "Quote Submitted" confirmation e-mail (email-sync) sets AFTER the
// request has been submitted in the Vendor Activity Website. Keying on it —
// as the first version of this producer did — queued a duplicate request for
// every NTE that was already at CBRE (53 rows on 2026-09-06, all rejected).
// The technician's quote is the only signal that says "written, not sent".
//
// It does NOT contact CBRE. It writes queue rows only. A human approves each one
// and submits CBRE's own prefilled form by hand. Mirrors queue-acknowledgements.
//
// Idempotency:
//   • the unique index uq_approval_requests_live blocks a second live row per
//     (kind, wo_id);
//   • "Mark submitted" in the Approvals tab moves the quote to
//     nte_status = 'submitted' (payload._quote_id) and stamps
//     work_orders.cbre_nte_submitted_at, so the quote drops out of this query;
//   • a quote that is OLDER than the last submission recorded on the WO
//     (cbre_nte_submitted_at / cbre_quote_submitted_at / CBRE-confirmed status)
//     is treated as already handled and skipped — that covers quotes the office
//     uploaded by hand without pressing "Mark submitted".
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { buildCbrePayload } from '@/lib/cbreVendorForm';
import { requireCronOrStaff } from '@/lib/serverAuth';
import { withCronRun } from '@/lib/cronRun';
import { CBRE_WO_PATTERN } from '@/lib/cbreEmailParser';

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


// cbre_status values that mean "CBRE already has a quote from us" — a pending
// quote created BEFORE that status was set is a duplicate, not new work.
const CBRE_HAS_QUOTE = ['quote_submitted', 'quote_approved'];
// Nothing to request on these. CPW ("closed, waiting paperwork") is NOT in the
// list: CBRE still expects our invoice there, and an NTE increase is exactly
// what such a WO usually needs.
const CBRE_CLOSED = ['cancelled', 'CMP', 'CA1', 'CA2', 'CIR', 'CIS'];

const REQUESTOR_EMAIL = process.env.CBRE_REQUESTOR_EMAIL || 'emfcontractingsc@gmail.com';
const VENDOR_NAME = process.env.CBRE_VENDOR_NAME || 'EMF Contracting LLC(Gaston)';
const NTE_COMMENT_TEMPLATE =
  process.env.CBRE_NTE_COMMENT ||
  'NTE increase requested by EMF Contracting LLC to complete the work order.';

async function GET_impl(request) { return handle(request); }
async function POST_impl(request) { return handle(request); }

function ts(v) {
  const t = v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t : 0;
}

async function handle(request) {
  const { searchParams } = new URL(request.url);
  const auth = await requireCronOrStaff(request);
  if (!auth.ok) return auth.response;

  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') || DEFAULT_LIMIT, 10) || DEFAULT_LIMIT, 1),
    MAX_LIMIT
  );
  const dryRun = searchParams.get('dryRun') === 'true';

  const result = {
    queued: 0,
    skipped: 0,
    excluded: {
      notACbreNumber: [],
      noBuildingCode: [],
      noAmount: [],
      noIncrease: [],         // quote amount does not exceed the current NTE
      alreadySubmitted: [],   // quote older than the last submission recorded on the WO
      closed: [],             // WO cancelled / posted at CBRE
      problems: [],
    },
    errors: [],
    rows: [],
  };

  try {
    // 1) Written NTE increases not yet uploaded to CBRE (newest first).
    const { data: quotes, error: qErr } = await supabase
      .from('work_order_quotes')
      .select('quote_id, wo_id, new_nte_amount, grand_total, request_type, created_at, submitted_at')
      .eq('nte_status', 'pending')
      .or('is_verbal_nte.is.null,is_verbal_nte.eq.false')
      .order('created_at', { ascending: false })
      .limit(Math.min(limit * 6, 200));
    if (qErr) throw new Error(`quote query failed: ${qErr.message}`);
    if (!quotes?.length) return Response.json({ ...result, message: 'Nothing to submit.' });

    // Newest pending quote per work order wins.
    const latestByWo = new Map();
    for (const q of quotes) if (!latestByWo.has(q.wo_id)) latestByWo.set(q.wo_id, q);

    // 2) Their work orders.
    const { data: wos, error: wErr } = await supabase
      .from('work_orders')
      .select('wo_id, wo_number, nte, cbre_nte, cbre_status, cbre_status_updated_at, building, priority, date_entered, cbre_quote_submitted_at, cbre_nte_submitted_at')
      .in('wo_id', [...latestByWo.keys()]);
    if (wErr) throw new Error(`work order query failed: ${wErr.message}`);
    const woById = new Map((wos || []).map((w) => [w.wo_id, w]));

    for (const [woId, quote] of latestByWo) {
      const wo = woById.get(woId);
      if (!wo) continue;

      const num = String(wo.wo_number || '').trim();
      if (!CBRE_WO_PATTERN.test(num)) { result.excluded.notACbreNumber.push(wo.wo_number); continue; }

      if (CBRE_CLOSED.includes(wo.cbre_status)) {
        result.excluded.closed.push(`${num} (${wo.cbre_status})`);
        continue;
      }

      // Already at CBRE? Compare the quote's creation with the last submission
      // we know of. A later quote (second NTE increase / reconciliation) is new.
      const lastSubmitted = Math.max(
        ts(wo.cbre_nte_submitted_at),
        ts(wo.cbre_quote_submitted_at),
        CBRE_HAS_QUOTE.includes(wo.cbre_status) ? ts(wo.cbre_status_updated_at) : 0
      );
      if (lastSubmitted && ts(quote.created_at) <= lastSubmitted) {
        result.excluded.alreadySubmitted.push(num);
        continue;
      }

      const amt = parseFloat(quote.new_nte_amount) || parseFloat(quote.grand_total);
      if (!Number.isFinite(amt) || amt <= 0) { result.excluded.noAmount.push(num); continue; }
      // The NTE already covers the quote → it was granted (or the quote was
      // written against the current NTE). Nothing to request. cbre_nte is the
      // NTE as CBRE has it; `nte` may include a verbal approval that never
      // reached the portal, so it only counts when cbre_nte is unknown.
      const official = wo.cbre_nte != null ? parseFloat(wo.cbre_nte) : parseFloat(wo.nte);
      if (Number.isFinite(official) && amt <= official) {
        result.excluded.noIncrease.push(`${num} (NTE ${official} ≥ ${amt})`);
        continue;
      }

      const built = buildCbrePayload({
        kind: 'cbre_nte',
        woNumber: wo.wo_number,
        buildingRaw: wo.building,
        requestorEmail: REQUESTOR_EMAIL,
        vendor: VENDOR_NAME,
        nteAmount: amt,
        comment: NTE_COMMENT_TEMPLATE,
      });
      if (built.problems.length) {
        if (built.problems.some((p) => /building/.test(p)))
          result.excluded.noBuildingCode.push(`${num} (${wo.building || 'null'})`);
        else result.excluded.problems.push(`${num}: ${built.problems.join('; ')}`);
        continue;
      }

      const row = {
        kind: 'cbre_nte',
        wo_id: wo.wo_id,
        wo_number: wo.wo_number,
        title: `Submit NTE $${built.readable.nteAmount} for ${wo.wo_number} to CBRE`,
        summary: `${wo.building || 'unknown site'} · NTE $${built.readable.nteAmount}${quote.request_type === 'reconciliation' ? ' · reconciliation' : ''}`,
        // _quote_id is ours (underscore keys are not sent to the form); the
        // Approvals tab uses it to move the quote to 'submitted'.
        payload: { ...built.payload, _quote_id: quote.quote_id, _readable: { ...built.readable, quoteId: quote.quote_id, currentNte: wo.nte } },
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
        else result.errors.push(`${num}: ${error.message}`);
        continue;
      }
      result.queued++;
      result.rows.push({ approval_id: data.approval_id, wo_number: wo.wo_number, quote_id: quote.quote_id });
      if (result.queued >= limit) break;
    }

    return Response.json({ ...result, message: `Queued ${result.queued} NTE request(s).` });
  } catch (e) {
    return Response.json({ ...result, error: e.message }, { status: 500 });
  }
}

// Run log (cron_runs) — see lib/cronRun.js. Response is passed through unchanged.
export const GET = (request) => withCronRun('cbre/queue-nte-requests', request, () => GET_impl(request));
export const POST = (request) => withCronRun('cbre/queue-nte-requests', request, () => POST_impl(request));
