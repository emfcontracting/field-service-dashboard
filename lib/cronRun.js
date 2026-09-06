// lib/cronRun.js
// -----------------------------------------------------------------------------
// Run log for scheduled jobs and other background work (table cron_runs).
//
// Until now only email-import wrote to system_logs; everything else lived for
// seven days in Vercel's function logs. A cron that 500s on every run (the
// NTE producer did, for weeks), a query against a missing column, a token
// refresh that silently fails — none of it was visible anywhere. Every wrapped
// job now leaves one row per run: when, how long, ok/error, a compact summary
// of what it reported, and the error text. /api/cron/health-digest reads the
// table every morning and mails what needs attention.
//
//   export const GET = (request) => withCronRun('email-sync', request, () => GET_impl(request));
//
// withCronRun never changes the route's response: it returns exactly what the
// handler returned (or re-throws what it threw). Logging failures are
// swallowed — the run log must never break the job it observes.
// -----------------------------------------------------------------------------
import { serviceClient, isCronRequest } from './serverAuth';

const SUMMARY_MAX_CHARS = 4000;

/** Reduce an arbitrary JSON payload to counts, flags and short strings. */
export function compactSummary(value, depth = 0) {
  if (value == null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.length > 200 ? value.slice(0, 200) + '…' : value;
  if (depth >= 3) return Array.isArray(value) ? `[${value.length}]` : '{…}';
  if (Array.isArray(value)) {
    // Arrays are what blow up a summary (lists of WO numbers, rows, e-mails):
    // keep the count and a small sample of primitive members.
    const sample = value.filter((v) => typeof v !== 'object').slice(0, 5).map((v) => compactSummary(v, depth + 1));
    return { count: value.length, ...(sample.length ? { sample } : {}) };
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/token|secret|password|authorization/i.test(k)) continue;
      out[k] = compactSummary(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

function capJson(obj) {
  try {
    const s = JSON.stringify(obj);
    if (s.length <= SUMMARY_MAX_CHARS) return obj;
    return { _truncated: true, head: s.slice(0, SUMMARY_MAX_CHARS) };
  } catch {
    return null;
  }
}

/** Insert one cron_runs row. Never throws. */
export async function recordRun(row) {
  try {
    const { error } = await serviceClient().from('cron_runs').insert({
      job: row.job,
      trigger: row.trigger || 'cron',
      status: row.status || 'ok',
      http_status: row.http_status ?? null,
      started_at: row.started_at,
      finished_at: row.finished_at || new Date().toISOString(),
      duration_ms: row.duration_ms ?? null,
      summary: row.summary ? capJson(compactSummary(row.summary)) : null,
      error: row.error ? String(row.error).slice(0, 2000) : null,
    });
    if (error) console.error(`cron_runs insert failed for ${row.job}:`, error.message);
  } catch (e) {
    console.error(`cron_runs insert threw for ${row.job}:`, e?.message || e);
  }
}

/**
 * Wrap a route handler. `handler` returns a Response (NextResponse.json …).
 * Status is 'error' when the handler throws, answers >= 400, or answers JSON
 * with a top-level `error` / `success: false`.
 */
export async function withCronRun(job, request, handler, opts = {}) {
  const startedAt = new Date();
  const trigger = opts.trigger || (request && isCronRequest(request) ? 'cron' : 'manual');
  let status = 'ok', error = null, summary = null, httpStatus = null;
  try {
    const res = await handler();
    httpStatus = res?.status ?? 200;
    if (res && typeof res.clone === 'function') {
      try {
        const body = await res.clone().json();
        summary = body;
        if (body && typeof body === 'object') {
          if (body.error) { status = 'error'; error = typeof body.error === 'string' ? body.error : JSON.stringify(body.error); }
          else if (body.success === false) { status = 'error'; error = body.message || body.reason || 'success:false'; }
        }
      } catch { /* not JSON — fine */ }
    }
    if (httpStatus >= 400 && status === 'ok') { status = 'error'; error = `HTTP ${httpStatus}`; }
    // 401/403 on a cron route means the schedule is misconfigured, not the job.
    if (httpStatus === 401 || httpStatus === 403) status = 'skipped';
    return res;
  } catch (e) {
    status = 'error';
    error = e?.message || String(e);
    throw e;
  } finally {
    const finishedAt = new Date();
    await recordRun({
      job, trigger, status, http_status: httpStatus,
      started_at: startedAt.toISOString(), finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt - startedAt, summary, error,
    });
  }
}

/**
 * Time a piece of background work that is not a route (QB token refresh,
 * push to QuickBooks …). `fn` may return a summary object.
 */
export async function trackRun(job, fn, opts = {}) {
  const startedAt = new Date();
  try {
    const summary = await fn();
    await recordRun({ job, trigger: opts.trigger || 'manual', status: 'ok', started_at: startedAt.toISOString(), duration_ms: Date.now() - startedAt, summary });
    return summary;
  } catch (e) {
    await recordRun({ job, trigger: opts.trigger || 'manual', status: 'error', started_at: startedAt.toISOString(), duration_ms: Date.now() - startedAt, error: e?.message || String(e) });
    throw e;
  }
}
