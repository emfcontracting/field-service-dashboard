// app/api/cbre/queue-holds/route.js
// ─────────────────────────────────────────────────────────────────────────────
// PRODUCER — tells CBRE that a work order is on hold, before the close-out
// sweep takes it.
//
// WHY: the Supplier Training Guide is explicit — "If you are awaiting materials
// for a work order or if it's an on-going project that you cannot complete at
// this time, you should place the work order on hold." We never have. Work
// orders sat waiting on parts or on CBRE's own approver until the monthly sweep
// closed them, and a closed one "cannot be reopened for billing". That is how
// the fifteen sub work orders happened, and $29,794.89 with them.
//
// WHY A TARGET-DATE CHANGE AND NOT A "HOLD": CBRE's Vendor App form has eleven
// Actions and none of them is a hold — the hold lives in VAWS itself. But the
// sweep does not read a hold flag, it reads the target completion date: "review
// all work orders in your queue that have a target completion date of 90 prior
// or earlier". Moving that date is what actually stops the clock, and "Change
// Completion Target Date" carries a comment field, so one submission both moves
// the date and puts the reason on CBRE's record.
//
// The proposed date is today plus a lead-time allowance (30 days by default,
// CBRE_HOLD_EXTENSION_DAYS to change it). It is a forecast, which is what a
// target date is — but it is a forecast nobody has confirmed, so it is written
// into the queue row where the office sees it and can change it before
// submitting, rather than being quietly sent.
//
// It does NOT contact CBRE. It writes queue rows only.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { requireCronOrStaff, cronHeaders } from '@/lib/serverAuth';
import { withCronRun } from '@/lib/cronRun';
import { CBRE_WO_PATTERN } from '@/lib/cbreEmailParser';
import { buildCbrePayload, fmtDate } from '@/lib/cbreVendorForm';
import { agingRisk, isAgingExposed } from '@/lib/agingRisk';
import { siteCode } from '@/lib/siteDistances';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const EXTENSION_DAYS = parseInt(process.env.CBRE_HOLD_EXTENSION_DAYS || '30', 10) || 30;

const REQUESTOR_EMAIL = process.env.CBRE_REQUESTOR_EMAIL || 'emfcontractingsc@gmail.com';
const VENDOR_NAME = process.env.CBRE_VENDOR_NAME || 'EMF Contracting LLC(Gaston)';

// Only these levels are worth a submission. A fresh work order that happens to
// be waiting on a part does not need CBRE told — the sweep is nowhere near it,
// and a target change on every hold would be noise on their record.
const REPORTABLE_LEVELS = ['at_risk', 'past_due'];

// How each hold reads on CBRE's permanent record. Plain, factual, and it names
// the date the wait started so the note can be checked.
const HOLD_TEXT = {
  parts_ordered: (since) =>
    `On hold awaiting material${since ? ` since ${since}` : ''}. Requesting a target completion date extension so the work order is not closed out while parts are on order.`,
  equipment_backorder: (since) =>
    `On hold — equipment on back order${since ? ` since ${since}` : ''}. Requesting a target completion date extension so the work order is not closed out while we wait on the supplier.`,
  cbre_approval: (since) =>
    `On hold pending CBRE quote approval${since ? ` since ${since}` : ''}. Requesting a target completion date extension so the work order is not closed out while the quote is with the approver.`,
  site_access: (since) =>
    `On hold — no site access${since ? ` since ${since}` : ''}. Requesting a target completion date extension.`,
  return_trip_wait: (since) =>
    `On hold awaiting return-trip release${since ? ` since ${since}` : ''}. Requesting a target completion date extension.`,
  other: (since) =>
    `On hold${since ? ` since ${since}` : ''}. Requesting a target completion date extension so the work order is not closed out.`,
};

const holdComment = (reason, since) => (HOLD_TEXT[reason] || HOLD_TEXT.other)(since);

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
  const extensionDays = Math.max(
    parseInt(searchParams.get('extensionDays') || EXTENSION_DAYS, 10) || EXTENSION_DAYS,
    1
  );
  // Include the merely-aging ones too, for a deliberate catch-up run.
  const includeWatch = searchParams.get('includeWatch') === 'true';
  const notify = searchParams.get('notify') !== 'false';
  const deliveryMethod = searchParams.get('via') === 'sms' ? 'sms' : 'email';

  const levels = includeWatch ? [...REPORTABLE_LEVELS, 'watch'] : REPORTABLE_LEVELS;

  const result = {
    queued: 0,
    skipped: 0,
    dryRun,
    limit,
    extensionDays,
    excluded: { notExposed: [], notAging: [], notACbreNumber: [], noBuildingCode: [] },
    byReason: {},
    byLevel: {},
    rows: [],
    errors: [],
  };

  try {
    const { data: candidates, error: qErr } = await supabase
      .from('work_orders')
      .select([
        'wo_id', 'wo_number', 'building', 'priority', 'status',
        'date_entered', 'created_at', 'target_completion_at', 'date_completed',
        'waiting_reason', 'waiting_since',
        'cbre_hold_reported_at', 'cbre_posting_status',
        'qb_invoice_number', 'vwas_invoice_submitted',
        'acknowledged', 'is_locked', 'dispute_status',
      ].join(','))
      .not('waiting_reason', 'is', null)
      .is('cbre_hold_reported_at', null)
      .order('waiting_since', { ascending: true, nullsFirst: false })   // longest wait first
      .limit(200);
    if (qErr) throw new Error(`work order read failed: ${qErr.message}`);

    if (!candidates?.length) {
      return Response.json({ ...result, message: 'Nothing on hold to report.' });
    }

    const target = new Date();
    target.setDate(target.getDate() + extensionDays);
    const targetStr = fmtDate(target);

    for (const wo of candidates) {
      if (!CBRE_WO_PATTERN.test(String(wo.wo_number || '').trim())) {
        result.excluded.notACbreNumber.push(wo.wo_number);
        continue;
      }
      // Closed, disputed, already in CBRE's chain or already invoiced — the
      // sweep cannot take it, so there is nothing to protect against.
      if (!isAgingExposed(wo)) {
        result.excluded.notExposed.push(wo.wo_number);
        continue;
      }
      const risk = agingRisk(wo);
      if (!risk || !levels.includes(risk.level)) {
        result.excluded.notAging.push(`${wo.wo_number} (${risk ? `${risk.level}, ${risk.days}d` : 'no basis'})`);
        continue;
      }
      const code = siteCode(wo.building);
      if (!code) {
        result.excluded.noBuildingCode.push(`${wo.wo_number} (${wo.building || 'null'})`);
        continue;
      }

      const since = wo.waiting_since ? fmtDate(wo.waiting_since) : null;
      const { payload, readable, problems } = buildCbrePayload({
        kind: 'cbre_target_date',
        woNumber: wo.wo_number,
        buildingRaw: wo.building,
        requestorEmail: REQUESTOR_EMAIL,
        vendor: VENDOR_NAME,
        targetAt: target,
        comment: holdComment(wo.waiting_reason, since),
      });
      if (problems.length) {
        result.errors.push(`${wo.wo_number}: ${problems.join('; ')}`);
        continue;
      }

      payload._readable = {
        ...readable,
        holdReason: wo.waiting_reason,
        waitingSince: wo.waiting_since || null,
        proposedTarget: targetStr,
        // Says out loud that the date is ours, not CBRE's, and not confirmed by
        // anyone — change it in the form if you know better.
        warning: `Proposed target ${targetStr} is ${extensionDays} days out and is our estimate, not a confirmed date. Change it on the form if you know when the work can actually be done.`,
        agingDays: risk.days,
        agingLevel: risk.level,
        agingBasis: risk.source,
        closeDate: risk.closeDate,
        deadlineFromCbre: risk.fromCbre,
      };

      result.byReason[wo.waiting_reason] = (result.byReason[wo.waiting_reason] || 0) + 1;
      result.byLevel[risk.level] = (result.byLevel[risk.level] || 0) + 1;

      const row = {
        kind: 'cbre_target_date',
        wo_id: wo.wo_id,
        wo_number: wo.wo_number,
        title: `Report hold on ${wo.wo_number} — extend target to ${targetStr}`,
        summary: [
          code,
          wo.waiting_reason.replace(/_/g, ' '),
          since ? `waiting since ${since}` : null,
          `${risk.days}d past target`,
          risk.level === 'past_due' ? 'PAST CBRE cut-off' : `closes in ${risk.daysToClose}d`,
        ].filter(Boolean).join(' · '),
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
        if (error.code === '23505') { result.skipped++; }   // a target-date row is already live
        else { result.errors.push(`${wo.wo_number}: ${error.message}`); }
        continue;
      }
      result.queued++;
      result.rows.push({ approval_id: data.approval_id, wo_number: wo.wo_number, reason: wo.waiting_reason, days: risk.days });
      if (result.queued >= limit) break;
    }

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
          `${result.queued} work order${result.queued === 1 ? '' : 's'} on hold and close to CBRE's close-out: ${list}. ` +
          `Each one needs a target date before month end: ${base}/dashboard?view=approvals`;

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

export const GET = (request) => withCronRun('cbre/queue-holds', request, () => GET_impl(request));
export const POST = (request) => withCronRun('cbre/queue-holds', request, () => POST_impl(request));
