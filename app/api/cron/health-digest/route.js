// app/api/cron/health-digest/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Daily health digest (07:00 ET) — mailed to the admins.
//
// Reads cron_runs (lib/cronRun.js) and a handful of business tables and says,
// in one screen, what needs a human today:
//   • jobs that failed in the last 24 h (with the last error text)
//   • jobs that have not logged a success for longer than 2× their interval
//     — catches a cron that stopped running without ever throwing
//   • QuickBooks: needs_reconnect, or a refresh token older than 90 days
//   • approvals pending > 48 h, NTE requests waiting at CBRE > 14 days,
//     sub-WO requests waiting > 21 days, draft invoices older than 14 days
//
// GET ?dryRun=true returns the digest as JSON/HTML without sending.
// Schedule (vercel.json): 0 11 * * *  = 07:00 EDT / 06:00 EST.
// ─────────────────────────────────────────────────────────────────────────────
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireCronOrAdmin, serviceClient, SUPERUSER_EMAIL } from '@/lib/serverAuth';
import { withCronRun } from '@/lib/cronRun';
import { invoiceBlocker, INVOICE_WO_SELECT } from '@/lib/invoiceReadiness';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const H = 3600 * 1000;
const D = 24 * H;

// job → expected interval (ms). Stale = no successful run within 2× interval
// (never less than 1 h, so a single slow run does not alarm).
const EXPECTED = {
  'email-import/cron':              10 * 60 * 1000,
  'email-sync':                     30 * 60 * 1000,
  'cbre/queue-acknowledgements':    15 * 60 * 1000,
  'cbre/queue-nte-requests':        15 * 60 * 1000,
  'cbre/queue-completions':         15 * 60 * 1000,
  'cbre/sync-vendor-confirmations': 15 * 60 * 1000,
  'invoice-payments/cron':          60 * 60 * 1000,
  'quickbooks/pull-payments':       24 * H,
  'availability/reminder-cron':     24 * H,
  'cron/health-digest':             24 * H,
};

const fmtAge = (ms) => {
  if (ms == null) return 'never';
  if (ms < H) return `${Math.round(ms / 60000)} min`;
  if (ms < D) return `${(ms / H).toFixed(1)} h`;
  return `${(ms / D).toFixed(1)} d`;
};
const fmtWhen = (iso) => iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function buildDigest(db) {
  const now = Date.now();
  const since24 = new Date(now - D).toISOString();
  const since7 = new Date(now - 7 * D).toISOString();

  // ── cron_runs ──────────────────────────────────────────────────────────────
  const { data: runs, error: runsErr } = await db
    .from('cron_runs')
    .select('job, trigger, status, started_at, duration_ms, error, summary')
    .gte('started_at', since7)
    .order('started_at', { ascending: false })
    .limit(5000);
  if (runsErr) throw new Error(`cron_runs: ${runsErr.message}`);

  const jobs = {};
  for (const r of runs || []) {
    const j = jobs[r.job] ||= { job: r.job, runs24: 0, errors24: 0, lastOk: null, lastError: null, lastErrorAt: null, lastRun: null, durations: [] };
    if (!j.lastRun) j.lastRun = r.started_at;
    if (r.status === 'ok' && !j.lastOk) j.lastOk = r.started_at;
    if (r.status === 'error' && !j.lastError) { j.lastError = r.error; j.lastErrorAt = r.started_at; }
    if (r.started_at >= since24) {
      j.runs24++;
      if (r.status === 'error') j.errors24++;
      if (r.duration_ms) j.durations.push(r.duration_ms);
    }
  }
  for (const job of Object.keys(EXPECTED)) jobs[job] ||= { job, runs24: 0, errors24: 0, lastOk: null, lastError: null, lastErrorAt: null, lastRun: null, durations: [] };

  // How long has the run log existed? A daily job that simply has not had its
  // first slot since logging started is "pending", not dead.
  const oldestRun = (runs || []).length ? Math.min(...runs.map((r) => new Date(r.started_at).getTime())) : now;
  const loggingAge = now - oldestRun;

  const jobRows = Object.values(jobs).map((j) => {
    const interval = EXPECTED[j.job];
    const okAge = j.lastOk ? now - new Date(j.lastOk).getTime() : null;
    const pending = interval ? (okAge == null && loggingAge < 2 * interval) : false;
    const stale = interval && !pending ? (okAge == null || okAge > Math.max(2 * interval, H)) : false;
    const p50 = j.durations.length ? j.durations.sort((a, b) => a - b)[Math.floor(j.durations.length / 2)] : null;
    return { ...j, okAge, stale, pending, p50, scheduled: !!interval };
  }).sort((a, b) => (b.stale - a.stale) || (b.errors24 - a.errors24) || a.job.localeCompare(b.job));

  // ── QuickBooks ─────────────────────────────────────────────────────────────
  const { data: qb } = await db
    .from('quickbooks_settings')
    .select('realm_id, connected_at, last_sync_at, token_expires_at, needs_reconnect, last_error, last_error_at')
    .eq('is_active', true)
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const qbIssues = [];
  if (!qb) qbIssues.push('QuickBooks is not connected.');
  else {
    if (qb.needs_reconnect) qbIssues.push(`QuickBooks needs to be reconnected (${qb.last_error || 'refresh token rejected'}, ${fmtWhen(qb.last_error_at)}). Settings → QuickBooks → Connect.`);
    const connectedAge = qb.connected_at ? now - new Date(qb.connected_at).getTime() : null;
    if (connectedAge != null && connectedAge > 90 * D && !qb.needs_reconnect)
      qbIssues.push(`QuickBooks refresh token is ${Math.round(connectedAge / D)} days old — Intuit expires them after ~100 days; reconnect before it fails.`);
    if (!qb.needs_reconnect && qb.last_error) qbIssues.push(`Last QuickBooks error ${fmtWhen(qb.last_error_at)}: ${qb.last_error}`);
  }

  // ── Business signals ───────────────────────────────────────────────────────
  const [{ count: approvalsOld }, { data: waiting }, { data: subWo }, { data: staleDraftRows }, { count: openEsc }] = await Promise.all([
    db.from('approval_requests').select('approval_id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', new Date(now - 48 * H).toISOString()),
    db.from('work_orders').select('wo_number, cbre_quote_submitted_at, cbre_status_updated_at').eq('cbre_status', 'quote_submitted'),
    db.from('work_orders').select('wo_number, dispute_requested_at, dispute_sub_wo').eq('dispute_status', 'sub_wo_requested').is('dispute_sub_wo', null),
    // Old drafts worth chasing. Anything the invoice guard puts on hold (NTE
    // request pending at CBRE, work order closed there, open dispute) is
    // waiting for CBRE, not for us — invoiceBlocker() filters those out below.
    db.from('invoices').select(`invoice_id, total, qb_invoice_number, qb_invoice_id, quickbooks_invoice_id, work_order:work_orders!inner(${INVOICE_WO_SELECT})`)
      .eq('status', 'draft').lt('created_at', new Date(now - 14 * D).toISOString())
      .neq('work_order.status', 'cancelled'),
    db.from('work_orders').select('wo_id', { count: 'exact', head: true }).eq('escalation', true)
      .not('status', 'in', '(completed,cancelled,rejected)').or('is_locked.is.null,is_locked.eq.false'),
  ]);
  const waitingOld = (waiting || []).filter((w) => {
    const t = w.cbre_quote_submitted_at || w.cbre_status_updated_at;
    return t && now - new Date(t).getTime() > 14 * D;
  });
  const subWoOld = (subWo || []).filter((w) => w.dispute_requested_at && now - new Date(w.dispute_requested_at).getTime() > 21 * D);
  // Split the old drafts: the office can act on one group, the other is waiting
  // for CBRE (NTE approval, sub work order) and must not read as our backlog.
  const staleDrafts = (staleDraftRows || []).map((inv) => ({ inv, blocker: invoiceBlocker(inv, inv.work_order) }));
  const draftsActionable = staleDrafts.filter((d) => !d.blocker.blocked);
  const draftsOnHold = staleDrafts.filter((d) => d.blocker.blocked);
  const onHoldValue = draftsOnHold.reduce((sum, d) => sum + (parseFloat(d.inv.total) || 0), 0);

  const signals = [
    { label: 'Approvals pending > 48 h', value: approvalsOld || 0, warn: (approvalsOld || 0) > 0, hint: 'Dashboard → Approvals' },
    { label: 'NTE requests waiting at CBRE > 14 days', value: waitingOld.length, warn: waitingOld.length > 0, hint: 'Escalations → Waiting on CBRE (copy list for CBRE)', detail: waitingOld.map((w) => w.wo_number).slice(0, 15).join(', ') },
    { label: 'Sub-WO requests without answer > 21 days', value: subWoOld.length, warn: subWoOld.length > 0, hint: 'Escalations → Sub-WO req.', detail: subWoOld.map((w) => w.wo_number).join(', ') },
    { label: 'Draft invoices older than 14 days (ready to send)', value: draftsActionable.length, warn: draftsActionable.length > 0, hint: 'Invoicing', detail: draftsActionable.map((d) => d.inv.work_order?.wo_number).filter(Boolean).slice(0, 15).join(', ') },
    { label: 'Invoices on hold (CBRE not ready)', value: draftsOnHold.length, warn: false, hint: `Invoicing → On Hold · $${onHoldValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} parked`, detail: draftsOnHold.map((d) => `${d.inv.work_order?.wo_number || '?'} (${d.blocker.reason})`).slice(0, 15).join(', ') },
    { label: 'Active work orders in escalation', value: openEsc || 0, warn: (openEsc || 0) > 0, hint: 'Work Orders → Escalation filter' },
  ];

  const failing = jobRows.filter((j) => j.errors24 > 0);
  const stale = jobRows.filter((j) => j.stale);
  const attention = failing.length + stale.length + qbIssues.length + signals.filter((s) => s.warn).length;

  return { generatedAt: new Date().toISOString(), attention, jobs: jobRows, failing, stale, qb: qb ? { realm_id: qb.realm_id, connected_at: qb.connected_at, needs_reconnect: qb.needs_reconnect } : null, qbIssues, signals };
}

function renderHtml(d) {
  const tone = d.attention ? '#b45309' : '#047857';
  const head = d.attention ? `${d.attention} item${d.attention === 1 ? '' : 's'} need attention` : 'All green';
  const row = (cells) => `<tr>${cells.map((c) => `<td style="padding:4px 8px;border-bottom:1px solid #eee;font-size:13px;vertical-align:top">${c}</td>`).join('')}</tr>`;
  const jobsTable = `<table style="border-collapse:collapse;width:100%"><tr>${['Job', 'Runs 24 h', 'Errors', 'Last success', 'Median', 'Last error'].map((h) => `<th style="text-align:left;padding:4px 8px;border-bottom:2px solid #ddd;font-size:12px;color:#555">${h}</th>`).join('')}</tr>` +
    d.jobs.map((j) => row([
      `${j.stale ? '🔴 ' : j.pending ? '⚪ ' : j.errors24 ? '🟠 ' : '🟢 '}<code>${esc(j.job)}</code>${j.scheduled ? '' : ' <span style="color:#888">(on demand)</span>'}`,
      j.runs24,
      j.errors24 ? `<b style="color:#b91c1c">${j.errors24}</b>` : '0',
      j.lastOk ? `${fmtWhen(j.lastOk)} <span style="color:#888">(${fmtAge(j.okAge)} ago)</span>` : (j.pending ? '<span style="color:#888">not due yet since logging started</span>' : '<b style="color:#b91c1c">never</b>'),
      j.p50 != null ? `${(j.p50 / 1000).toFixed(1)} s` : '—',
      j.lastError ? `<span style="color:#b91c1c">${esc(j.lastError).slice(0, 220)}</span> <span style="color:#888">${fmtWhen(j.lastErrorAt)}</span>` : '',
    ])).join('') + '</table>';
  const signalsTable = `<table style="border-collapse:collapse;width:100%">` + d.signals.map((s) => row([
    `${s.warn ? '🟠' : '🟢'} ${esc(s.label)}`, `<b>${s.value}</b>`, `<span style="color:#666">${esc(s.hint)}</span>${s.detail ? `<br><span style="font-family:monospace;font-size:12px">${esc(s.detail)}</span>` : ''}`,
  ])).join('') + '</table>';
  const qbBlock = d.qbIssues.length
    ? `<ul style="margin:6px 0 0 18px;color:#b91c1c">${d.qbIssues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
    : `<div style="color:#047857">🟢 Connected (realm ${esc(d.qb?.realm_id)}, since ${fmtWhen(d.qb?.connected_at)})</div>`;
  return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;color:#222;max-width:900px">
    <h2 style="margin:0 0 4px">PCS FieldService — Health Digest</h2>
    <div style="color:#666;font-size:13px">${fmtWhen(d.generatedAt)} ET</div>
    <h3 style="color:${tone};margin:14px 0 8px">${head}</h3>
    <h4 style="margin:16px 0 6px">Scheduled jobs (last 24 h)</h4>${jobsTable}
    <h4 style="margin:16px 0 6px">QuickBooks</h4>${qbBlock}
    <h4 style="margin:16px 0 6px">Needs a human</h4>${signalsTable}
    <p style="color:#888;font-size:12px;margin-top:18px">Source: cron_runs (lib/cronRun.js), quickbooks_settings, approval_requests, work_orders, invoices. Stale = no successful run within 2× the job's interval.</p>
  </div>`;
}

function recipients() {
  const env = process.env.DIGEST_TO || process.env.HEALTH_DIGEST_TO;
  if (env) return env.split(/[,;\s]+/).filter(Boolean);
  return [...new Set([SUPERUSER_EMAIL, 'emfcontractingsc@gmail.com'])];
}

async function handle(request) {
  const auth = await requireCronOrAdmin(request);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(request.url);
  const dryRun = searchParams.get('dryRun') === 'true';
  const wantHtml = searchParams.get('format') === 'html';

  const db = serviceClient();
  const digest = await buildDigest(db);
  const html = renderHtml(digest);
  const subject = `[PCS] Health digest — ${digest.attention ? `${digest.attention} to check` : 'all green'} — ${new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })}`;

  if (wantHtml) return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  if (dryRun) return NextResponse.json({ dryRun: true, subject, to: recipients(), attention: digest.attention, failing: digest.failing.length, stale: digest.stale.length, qbIssues: digest.qbIssues, signals: digest.signals.map((s) => ({ label: s.label, value: s.value })) });

  if (!process.env.EMAIL_PASS) return NextResponse.json({ error: 'EMAIL_PASS not configured — digest not sent', attention: digest.attention }, { status: 500 });
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.EMAIL_USER || 'emfcbre@gmail.com', pass: process.env.EMAIL_PASS },
  });
  await transporter.sendMail({
    from: `"PCS FieldService" <${process.env.EMAIL_USER || 'emfcbre@gmail.com'}>`,
    to: recipients().join(', '),
    subject,
    html,
  });

  // Housekeeping: keep 90 days of run history.
  let pruned = null;
  try { const { data } = await db.rpc('cron_runs_prune', { keep_days: 90 }); pruned = data; } catch { /* optional */ }

  return NextResponse.json({ sent: true, to: recipients(), subject, attention: digest.attention, failing: digest.failing.map((j) => j.job), stale: digest.stale.map((j) => j.job), qbIssues: digest.qbIssues.length, pruned });
}

export const GET = (request) => withCronRun('cron/health-digest', request, () => handle(request));
export const POST = GET;
