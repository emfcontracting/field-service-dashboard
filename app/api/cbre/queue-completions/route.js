// app/api/cbre/queue-completions/route.js
// ─────────────────────────────────────────────────────────────────────────────
// PRODUCER — turns completed work orders that are ready for CBRE into
// "Complete A Work Order" rows in approval_requests, ready for approval in the
// Approvals tab. Mirrors queue-acknowledgements / queue-nte-requests.
//
// Start / End come from the technician's first check-in and last check-out
// (work_orders.time_in / time_out, completion date as the end fallback). The
// readiness rules live in lib/completionReadiness.js and are shared with the
// CBRE Data Entry view, so what that view shows as "ready" is exactly what
// lands here.
//
// It does NOT contact CBRE. It writes queue rows only. A human approves each
// one and submits CBRE's own prefilled form by hand (the time dropdowns have
// to be picked there — the intended times are written into the comment).
//
// Idempotency:
//   • the unique index uq_approval_requests_live blocks a second live row per
//     (kind, wo_id);
//   • "Mark submitted" in the Approvals tab (and CBRE's confirmation e-mail via
//     sync-vendor-confirmations) stamps cbre_completion_submitted_at and
//     completion_transferred, so the WO drops out of the query;
//   • a completion the office already reported by hand ("Mark transferred" in
//     CBRE Data Entry) is excluded the same way.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { COMPLETION_SELECT, completionReadinessCheck, buildCompletionApprovalRow, isActiveWo } from '@/lib/completionReadiness';
import { requireCronOrStaff } from '@/lib/serverAuth';
import { withCronRun } from '@/lib/cronRun';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

async function GET_impl(request) { return handle(request); }
async function POST_impl(request) { return handle(request); }

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
    skipped: 0,               // live row already exists (expected)
    excluded: {
      notACbreNumber: [],
      noBuildingCode: [],
      notReady: [],           // "WO (reason)" — same reasons the Data Entry view shows
      rejected: [],           // office rejected an earlier Complete request → not re-queued
      problems: [],
    },
    errors: [],
    rows: [],
  };

  try {
    // Completed, still in the office's hands, not yet reported.
    const { data: wos, error: wErr } = await supabase
      .from('work_orders')
      .select(COMPLETION_SELECT)
      .eq('status', 'completed')
      .eq('completion_transferred', false)
      .is('cbre_completion_submitted_at', null)
      .eq('acknowledged', false)
      .eq('is_locked', false)
      .order('date_completed', { ascending: false, nullsFirst: false })
      .limit(200);
    if (wErr) throw new Error(`work order query failed: ${wErr.message}`);
    if (!wos?.length) return Response.json({ ...result, message: 'Nothing to report.' });

    // A Complete request the office REJECTED in the Approvals tab must not come
    // back every 15 minutes. Those WOs stay in CBRE Data Entry (marked as
    // rejected) where the office re-sends by hand once the problem is fixed.
    const { data: rejectedRows, error: rErr } = await supabase
      .from('approval_requests')
      .select('wo_id')
      .eq('kind', 'cbre_complete')
      .eq('status', 'rejected')
      .in('wo_id', wos.map((w) => w.wo_id));
    if (rErr) throw new Error(`approval query failed: ${rErr.message}`);
    const rejectedWo = new Set((rejectedRows || []).map((r) => r.wo_id));

    for (const wo of wos) {
      if (!isActiveWo(wo)) continue;
      if (rejectedWo.has(wo.wo_id)) { result.excluded.rejected.push(wo.wo_number); continue; }
      const num = String(wo.wo_number || '').trim();
      const r = completionReadinessCheck(wo);
      if (!r.ready) {
        if (r.reason === 'not_cbre') result.excluded.notACbreNumber.push(wo.wo_number);
        else result.excluded.notReady.push(`${num} (${r.reason})`);
        continue;
      }

      const { row, problems } = buildCompletionApprovalRow(wo);
      if (!row) {
        if (problems.some((p) => /building/.test(p)))
          result.excluded.noBuildingCode.push(`${num} (${wo.ups_building_code || wo.building || 'null'})`);
        else result.excluded.problems.push(`${num}: ${problems.join('; ')}`);
        continue;
      }

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
      result.rows.push({ approval_id: data.approval_id, wo_number: wo.wo_number });
      if (result.queued >= limit) break;
    }

    return Response.json({ ...result, message: `Queued ${result.queued} completion(s).` });
  } catch (e) {
    return Response.json({ ...result, error: e.message }, { status: 500 });
  }
}

// Run log (cron_runs) — see lib/cronRun.js. Response is passed through unchanged.
export const GET = (request) => withCronRun('cbre/queue-completions', request, () => GET_impl(request));
export const POST = (request) => withCronRun('cbre/queue-completions', request, () => POST_impl(request));
