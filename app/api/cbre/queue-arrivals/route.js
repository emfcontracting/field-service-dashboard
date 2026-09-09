// app/api/cbre/queue-arrivals/route.js
// ─────────────────────────────────────────────────────────────────────────────
// PRODUCER — reports site arrival to CBRE for emergency work.
//
// WHY: CBRE calculates our Response Rate from the arrival time we enter (VAWS
// "Site Arrival", target 85% on time). We have never sent one — the 09.09 grid
// export shows exactly 1 of 105 work orders at DAR — because our technicians
// check in in the FSM app, not in VAWS. This closes that loop.
//
// WHAT IT REPORTS: work_orders.time_in, the technician's first check-in. That
// is a real observation and the only arrival timestamp we hold. Nothing here
// invents a time.
//
// THE DISTANCE CHECK: lib/siteDistances.js says how long the drive from the
// Columbia Air Hub to that site takes, and therefore what an arrival can
// plausibly look like. A check-in inside the window is queued ready to send.
// One outside it is still queued — nothing is hidden — but flagged, and when
// the timestamp itself cannot be right (before dispatch, or one of the sixteen
// corrupt values in the data) the date is deliberately LEFT OUT of the payload
// so it cannot be submitted by accident. A wrong arrival on CBRE's permanent
// record is worse than a missing one.
//
// SCOPE: P1 and P2 only. That is where the response rate bites and where a
// check-in really is the arrival. A P4 attended next Tuesday is within its own
// target and does not need chasing.
//
// It does NOT contact CBRE. It writes queue rows. A human approves each one and
// submits CBRE's prefilled form by hand — the time dropdown has to be picked
// there, so the intended time goes into the comment.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { requireCronOrStaff, cronHeaders } from '@/lib/serverAuth';
import { withCronRun } from '@/lib/cronRun';
import { CBRE_WO_PATTERN } from '@/lib/cbreEmailParser';
import { extractPriorityCode } from '@/lib/priorityCodes';
import { buildCbrePayload, fmtDate, to12h } from '@/lib/cbreVendorForm';
import { checkArrival, siteCode } from '@/lib/siteDistances';
import { isDisputeActive } from '@/lib/disputeStatus';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

// An arrival reported three weeks late tells CBRE nothing and looks worse than
// silence. Override with ?maxAgeDays= deliberately, e.g. for a one-off backfill.
const DEFAULT_MAX_AGE_DAYS = 7;

// Legacy priority words from the old parser that mean P1/P2 work.
const URGENT_LEGACY = new Set(['emergency', 'urgent', 'high']);
const URGENT_CODES = new Set(['P1', 'P2']);

const REQUESTOR_EMAIL = process.env.CBRE_REQUESTOR_EMAIL || 'emfcontractingsc@gmail.com';
const VENDOR_NAME = process.env.CBRE_VENDOR_NAME || 'EMF Contracting LLC(Gaston)';

function isUrgent(priority) {
  const code = extractPriorityCode(priority);
  if (code) return URGENT_CODES.has(code);
  return URGENT_LEGACY.has(String(priority || '').trim().toLowerCase());
}

// CBRE's form has no "Site Arrival" option — "Update Next Arrival Time" is the
// only Action carrying arrival fields. Say plainly in the comment that this is
// an actual arrival, not a planned one, so whoever keys it into VAWS puts it in
// the right box.
function arrivalComment(wo, check) {
  const t = to12h(wo.time_in);
  const when = `${fmtDate(wo.time_in) || '?'}${t ? ` ${t.time} ${t.ampm}` : ''}`;
  const base = `Technician arrived on site ${when} ET. Actual arrival, not an estimate — please record as Site Arrival.`;
  return check.verdict === 'late'
    ? `${base} Response ${check.hours.toFixed(1)}h from dispatch.`
    : base;
}

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
  const maxAgeDays = Math.max(
    parseInt(searchParams.get('maxAgeDays') || DEFAULT_MAX_AGE_DAYS, 10) || DEFAULT_MAX_AGE_DAYS,
    0
  );
  // By default only work still in flight: once completion has gone to CBRE the
  // arrival is on the completion record anyway and a late DAR is noise.
  const includeCompleted = searchParams.get('includeCompleted') === 'true';
  // All priorities, for a deliberate one-off. The default is P1/P2 — see header.
  const allPriorities = searchParams.get('allPriorities') === 'true';
  const notify = searchParams.get('notify') !== 'false';
  const deliveryMethod = searchParams.get('via') === 'sms' ? 'sms' : 'email';

  const result = {
    queued: 0,
    flagged: 0,          // queued, but needs a human decision
    skipped: 0,          // live row already exists (expected)
    dryRun,
    limit,
    maxAgeDays,
    excluded: { notUrgent: [], tooOld: [], notACbreNumber: [], noBuildingCode: [], alreadyCompleted: [], notActive: [], isSubWo: [], noCheckIn: [] },
    byVerdict: {},
    rows: [],
    errors: [],
  };

  try {
    const { data: candidates, error: qErr } = await supabase
      .from('work_orders')
      .select([
        'wo_id', 'wo_number', 'building', 'priority', 'status',
        'created_at', 'date_entered', 'time_in',
        'cbre_arrival_submitted_at', 'cbre_completion_submitted_at', 'completion_transferred',
        'acknowledged', 'is_locked', 'dispute_status', 'dispute_sub_wo',
      ].join(','))
      .not('time_in', 'is', null)
      .is('cbre_arrival_submitted_at', null)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit * 20, 400));      // over-fetch; the guards below drop most
    if (qErr) throw new Error(`work order read failed: ${qErr.message}`);

    if (!candidates?.length) {
      return Response.json({ ...result, message: 'No arrivals to report.' });
    }

    // Sub work orders carry the ORIGINAL's check-in: the crew was on site months
    // ago, the sub is only the billing vehicle CBRE asked for. Reporting that
    // check-in as an arrival on the sub would backdate it before the sub was
    // even dispatched — which CBRE refuses outright, and which would be a false
    // date anyway. All ten of them show up in the data as arrivals 240 to 326
    // days "before" dispatch. Skip them at the source.
    const { data: subRows } = await supabase
      .from('work_orders')
      .select('dispute_sub_wo')
      .not('dispute_sub_wo', 'is', null);
    const subNumbers = new Set((subRows || []).map((r) => String(r.dispute_sub_wo).trim()).filter(Boolean));

    const now = Date.now();

    for (const wo of candidates) {
      // ── Guards. Every exclusion is reported, never silent. ────────────────
      if (!allPriorities && !isUrgent(wo.priority)) {
        result.excluded.notUrgent.push(`${wo.wo_number} (${wo.priority || 'none'})`);
        continue;
      }
      if (!CBRE_WO_PATTERN.test(String(wo.wo_number || '').trim())) {
        result.excluded.notACbreNumber.push(wo.wo_number);
        continue;
      }
      if (wo.acknowledged || wo.is_locked || isDisputeActive(wo)) {
        result.excluded.notActive.push(wo.wo_number);
        continue;
      }
      if (subNumbers.has(String(wo.wo_number).trim())) {
        result.excluded.isSubWo.push(wo.wo_number);
        continue;
      }
      if (!includeCompleted && (wo.cbre_completion_submitted_at || wo.completion_transferred)) {
        result.excluded.alreadyCompleted.push(wo.wo_number);
        continue;
      }
      const basis = wo.created_at || wo.date_entered;
      const ageDays = basis ? (now - new Date(basis).getTime()) / 86400000 : null;
      if (maxAgeDays > 0 && ageDays != null && ageDays > maxAgeDays) {
        result.excluded.tooOld.push(`${wo.wo_number} (${ageDays.toFixed(0)}d)`);
        continue;
      }
      const code = siteCode(wo.building);
      if (!code) {
        result.excluded.noBuildingCode.push(`${wo.wo_number} (${wo.building || 'null'})`);
        continue;
      }

      // ── The distance check ────────────────────────────────────────────────
      const check = checkArrival(wo);
      result.byVerdict[check.verdict] = (result.byVerdict[check.verdict] || 0) + 1;

      if (check.verdict === 'no_data') {
        result.excluded.noCheckIn.push(wo.wo_number);
        continue;
      }

      // report:false → queue it so the office sees the problem, but do NOT put
      // a date we do not believe into CBRE's form.
      const { payload, readable, problems } = buildCbrePayload({
        kind: 'cbre_arrival',
        woNumber: wo.wo_number,
        buildingRaw: wo.building,
        requestorEmail: REQUESTOR_EMAIL,
        vendor: VENDOR_NAME,
        arrivalAt: check.report ? wo.time_in : null,
        comment: check.report
          ? arrivalComment(wo, check)
          : `Arrival not filled in: ${check.note}. Fix the check-in time on the work order first.`,
      });

      payload._readable = {
        ...readable,
        checkIn: wo.time_in,
        dispatched: basis,
        responseHours: check.hours != null ? Number(check.hours.toFixed(2)) : null,
        expectedWindow: check.window ? `${check.window.minH.toFixed(1)}–${check.window.maxH.toFixed(1)}h` : null,
        driveHours: check.window?.driveH ?? null,
        verdict: check.verdict,
        ...(check.flag ? { warning: check.note } : {}),
      };

      const flagged = !!check.flag;
      const mark = flagged ? (check.report ? '⚠ ' : '⛔ ') : '';
      const row = {
        kind: 'cbre_arrival',
        wo_id: wo.wo_id,
        wo_number: wo.wo_number,
        title: `${mark}Report arrival ${wo.wo_number} to CBRE`,
        summary: [
          code,
          extractPriorityCode(wo.priority) || wo.priority || 'no priority',
          check.hours != null ? `${check.hours.toFixed(1)}h after dispatch` : 'no dispatch time',
          check.note,
        ].filter(Boolean).join(' · '),
        payload,
        status: 'pending',
      };

      // A payload problem that is not the deliberately-blank date is a real bug.
      const realProblems = problems.filter((p) => check.report || !/arrival date/i.test(p));
      if (realProblems.length) {
        result.errors.push(`${wo.wo_number}: ${realProblems.join('; ')}`);
        continue;
      }

      if (dryRun) {
        result.rows.push(row);
        result.queued++;
        if (flagged) result.flagged++;
        if (result.queued >= limit) break;
        continue;
      }

      const { data, error } = await supabase
        .from('approval_requests')
        .insert(row)
        .select('approval_id')
        .single();

      if (error) {
        if (error.code === '23505') { result.skipped++; }   // already queued — expected
        else { result.errors.push(`${wo.wo_number}: ${error.message}`); }
        continue;
      }
      result.queued++;
      if (flagged) result.flagged++;
      result.rows.push({ approval_id: data.approval_id, wo_number: wo.wo_number, verdict: check.verdict });
      if (result.queued >= limit) break;
    }

    // ── One notification for the batch ──────────────────────────────────────
    if (notify && !dryRun && result.queued > 0) {
      try {
        const { data: staff } = await supabase
          .from('users')
          .select('user_id, email, phone, sms_carrier, first_name, last_name, role')
          .in('role', ['admin', 'office_staff'])
          .eq('is_active', true);

        const base =
          process.env.NEXT_PUBLIC_BASE_URL ||
          (process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : null) ||
          (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');

        const list = result.rows.map((r) => r.wo_number).filter(Boolean).join(', ');
        const message =
          `${result.queued} site arrival${result.queued === 1 ? '' : 's'} ready to report to CBRE` +
          `${result.flagged ? ` (${result.flagged} need${result.flagged === 1 ? 's' : ''} a look first)` : ''}: ${list}. ` +
          `Approve in the dashboard: ${base}/dashboard?view=approvals`;

        const res = await fetch(`${base}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...cronHeaders() },
          body: JSON.stringify({
            type: 'approval_needed',
            recipients: staff || [],
            customMessage: message,
            linkTarget: 'dashboard',
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

// Run log (cron_runs) — see lib/cronRun.js. Response is passed through unchanged.
export const GET = (request) => withCronRun('cbre/queue-arrivals', request, () => GET_impl(request));
export const POST = (request) => withCronRun('cbre/queue-arrivals', request, () => POST_impl(request));
