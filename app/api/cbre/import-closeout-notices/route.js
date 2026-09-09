// app/api/cbre/import-closeout-notices/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Reads CBRE's close-out warning e-mails and puts the deadline on the work
// order. Seven days' notice, previously ignored entirely.
//
// WHY ITS OWN ROUTE: the dispatch importer searches the mailbox for subjects
// containing "Work Order" or "Dispatch" and marks what it takes as read. These
// notices match neither term, and the mailbox rule here is absolute — nothing
// marks mail as read. So this route searches its own subject term, reads in
// read-only mode, and touches no flags. Re-running it is harmless: the stamp is
// idempotent per work order and deadline.
//
// WHAT IT WRITES: cbre_closeout_flagged_at, cbre_closeout_deadline and
// cbre_closeout_days_past_target, plus a comment on the work order. From then
// on lib/agingRisk.js uses CBRE's own date instead of reckoning one, and the
// badge in the work orders table counts down to it.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import { fetchMessages, sinceDays } from '@/lib/imap';
import { requireCronOrStaff, cronHeaders } from '@/lib/serverAuth';
import { withCronRun } from '@/lib/cronRun';
import { parseCloseoutNotice, CLOSEOUT_SUBJECT_TERM, CLOSEOUT_SENDER } from '@/lib/cbreCloseoutNotice';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DEFAULT_DAYS = 30;

async function GET_impl(request) { return handle(request); }
async function POST_impl(request) { return handle(request); }

async function handle(request) {
  const { searchParams } = new URL(request.url);
  const auth = await requireCronOrStaff(request);
  if (!auth.ok) return auth.response;

  const days = Math.max(parseInt(searchParams.get('days') || DEFAULT_DAYS, 10) || DEFAULT_DAYS, 1);
  const dryRun = searchParams.get('dryRun') === 'true';
  const notify = searchParams.get('notify') !== 'false';
  const anySender = searchParams.get('anySender') === 'true';
  const deliveryMethod = searchParams.get('via') === 'sms' ? 'sms' : 'email';

  const result = {
    scanned: 0, stamped: 0, unchanged: 0, dryRun, days,
    wrongSender: [], unreadable: [], notFound: [], rows: [], errors: [],
  };

  try {
    // readOnly, no flags touched — see the header.
    const { messages } = await fetchMessages({
      account: 'import',
      box: 'INBOX',
      criteria: [sinceDays(days), ['SUBJECT', CLOSEOUT_SUBJECT_TERM]],
      bodyPreference: 'text',
    });
    result.scanned = messages.length;
    if (!messages.length) {
      return Response.json({ ...result, message: 'No close-out warnings in the mailbox.' });
    }

    // Newest notice per work order wins: CBRE re-sends, and the latest deadline
    // is the one that counts.
    const latest = new Map();
    for (const m of messages) {
      // The subject search alone would take anything worded like this. Only
      // CBRE's own automation gets to set a deadline on our work orders.
      if (!anySender && !String(m.from || '').toLowerCase().includes(CLOSEOUT_SENDER)) {
        result.wrongSender.push(`${m.from} — ${String(m.subject).slice(0, 60)}`);
        continue;
      }
      const parsed = parseCloseoutNotice(m.subject, m.text || m.body || '', m.date);
      if (!parsed.ok) { result.unreadable.push(`${m.subject?.slice(0, 70)}: ${parsed.reason}`); continue; }
      const prev = latest.get(parsed.woNumber);
      if (!prev || parsed.deadline > prev.deadline) latest.set(parsed.woNumber, parsed);
    }

    for (const [woNumber, p] of latest) {
      const { data: wo, error: woErr } = await supabase
        .from('work_orders')
        .select('wo_id, wo_number, comments, cbre_closeout_deadline')
        .eq('wo_number', woNumber)
        .maybeSingle();
      if (woErr) { result.errors.push(`${woNumber}: ${woErr.message}`); continue; }
      if (!wo) { result.notFound.push(woNumber); continue; }

      const deadlineIso = p.deadline.toISOString();
      if (wo.cbre_closeout_deadline && new Date(wo.cbre_closeout_deadline).getTime() >= p.deadline.getTime()) {
        result.unchanged++;
        continue;
      }

      const row = {
        wo_number: woNumber,
        deadline: deadlineIso.slice(0, 10),
        daysPastTarget: p.daysPastTarget,
        orderStatus: p.orderStatus,
      };
      if (dryRun) { result.rows.push(row); result.stamped++; continue; }

      const note =
        `[CBRE CLOSE-OUT WARNING] ${p.flaggedAt.toISOString().slice(0, 16).replace('T', ' ')}\n` +
        `${p.note}` +
        (p.orderStatusLabel ? `\nOrder status at CBRE: ${p.orderStatusLabel}` : '');

      const { error: uErr } = await supabase
        .from('work_orders')
        .update({
          cbre_closeout_flagged_at: p.flaggedAt.toISOString(),
          cbre_closeout_deadline: deadlineIso,
          cbre_closeout_days_past_target: p.daysPastTarget,
          comments: wo.comments ? `${wo.comments}\n\n${note}` : note,
        })
        .eq('wo_id', wo.wo_id);
      if (uErr) { result.errors.push(`${woNumber}: ${uErr.message}`); continue; }

      result.stamped++;
      result.rows.push(row);
    }

    if (notify && !dryRun && result.stamped > 0) {
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

        const soonest = result.rows.map((r) => r.deadline).sort()[0];
        const list = result.rows.map((r) => `${r.wo_number} (${r.deadline})`).join(', ');
        const message =
          `CBRE will close ${result.stamped} work order${result.stamped === 1 ? '' : 's'} for age` +
          `${soonest ? `, the first on ${soonest}` : ''}: ${list}. ` +
          `Once closed they cannot be reopened for billing: ${base}/dashboard?view=workorders`;

        const res = await fetch(`${base}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...cronHeaders() },
          body: JSON.stringify({
            type: 'cbre_status_update',
            recipients: staff || [],
            customMessage: message,
            linkTarget: 'dashboard',
            deliveryMethod,
          }),
        });
        result.notified = res.ok;
        if (!res.ok) result.errors.push(`notify failed: HTTP ${res.status}`);
      } catch (nErr) {
        result.errors.push(`notify error: ${nErr.message}`);
      }
    }

    return Response.json(result);
  } catch (err) {
    return Response.json({ ...result, error: err.message }, { status: 500 });
  }
}

export const GET = (request) => withCronRun('cbre/import-closeout-notices', request, () => GET_impl(request));
export const POST = (request) => withCronRun('cbre/import-closeout-notices', request, () => POST_impl(request));
