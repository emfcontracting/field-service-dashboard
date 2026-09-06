// app/api/email-import/backfill/route.js
// Backfill scanner - finds CBRE work orders that the cron auto-import missed.
//
// WHY THIS EXISTS:
// The cron (/api/email-import/cron) only imports emails that are UNSEEN, from
// the last 7 days, and have "Work Order"/"Dispatch" in the subject. Anything
// already read, older, or worded differently is skipped forever. This endpoint
// bypasses all of that: it scans a configurable window (default 90 days)
// regardless of read status.
//
// IMPORTANT - TYPE FILTERING:
// CBRE sends many WO-related emails that are NOT new dispatches:
//   - "Notice of Cancellation of WO# ..."   (cancellation)
//   - "Reassignment of Work Order ..."      (reassignment)
//   - "OVD Alert - Work Order #..."         (alert)
//   - "... ESCALATION"                       (escalation)
// Importing those as fresh 'pending' work orders would create garbage. So every
// candidate is CLASSIFIED, and by default only category 'dispatch' is imported.
// Status-change notices for EXISTING work orders are handled by /api/email-sync.
//
// USAGE:
//   GET  /api/email-import/backfill?days=90               -> DRY RUN report (imports nothing)
//   GET  /api/email-import/backfill?days=90&types=dispatch -> same, explicit
//   POST /api/email-import/backfill?days=90               -> import missing DISPATCHES only (default)
//   POST /api/email-import/backfill?days=90&types=dispatch,reassignment -> override allowed types
//
// Recommended: run GET first, review, then POST.

import { createClient } from '@supabase/supabase-js';
import { fetchMessages, withImap, openBox, fetchRaw, parseMail, summarize, sinceDays } from '@/lib/imap';
import { parseCBREEmail, classifySubject, extractWoFromSubject } from '@/lib/cbreEmailParser';
import { requireAdmin } from '@/lib/serverAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Safety cap. With the WO-focused subject search below, real volume stays well
// under this, so the cap should not truncate the window the way a date-only
// scan does (which gets swamped by bids/invoices/newsletters).
const MAX_CANDIDATES = 2500;

// Categories that POST will import unless overridden via ?types=
const DEFAULT_IMPORT_TYPES = ['dispatch'];

// IMAP + parsing live in lib/imap.js / lib/cbreEmailParser.js.
// PHASE 1: lightweight headers (subject + date + read flag) for WO-related
// e-mails in the window — WO-focused subject search keeps volume low so the
// cap does not truncate the window. No bodies → fast and timeout-safe.
async function scanHeaders(days) {
  const { messages } = await fetchMessages({
    account: 'import',
    box: 'INBOX',
    criteria: [
      sinceDays(days),
      ['OR',
        ['OR', ['SUBJECT', 'Work Order'], ['SUBJECT', 'Workorder']],
        ['OR', ['SUBJECT', 'WO#'], ['SUBJECT', 'Dispatch']]
      ]
    ],
    newestFirst: true,
    limit: MAX_CANDIDATES,
    bodies: 'HEADER.FIELDS (SUBJECT DATE)',
  });
  return messages.map((m) => {
    const { wo, matchType } = extractWoFromSubject(m.subject);
    return { uid: m.uid, subject: m.subject, date: m.date || null, isRead: m.seen, wo_number: wo, matchType, category: classifySubject(m.subject) };
  });
}

// PHASE 2 (import only): full bodies for a specific set of UIDs.
async function fetchBodiesByUid(uids) {
  if (!uids || uids.length === 0) return [];
  return withImap('import', async (imap) => {
    await openBox(imap, 'INBOX', true);
    const raws = await fetchRaw(imap, uids);
    const out = [];
    for (const r of raws) {
      const parsed = await parseMail(r.raw);
      if (parsed) out.push(summarize(parsed, { uid: r.uid, flags: r.flags }));
    }
    return out;
  });
}

function parseTypes(searchParams) {
  const raw = (searchParams.get('types') || '').trim();
  if (!raw) return DEFAULT_IMPORT_TYPES;
  if (raw.toLowerCase() === 'all') {
    return ['dispatch', 'cancellation', 'reassignment', 'escalation', 'alert', 'other'];
  }
  return raw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}

// Shared: scan window, classify candidates against the DB and the type filter.
async function buildReport(days, allowedTypes) {
  const candidates = await scanHeaders(days);

  const withWo = candidates.filter(c => c.wo_number);
  const noWo = candidates.filter(c => !c.wo_number);

  // Group all candidate emails by WO number so we can reason across the whole
  // history of each WO in the window (e.g. dispatched on the 4th, cancelled on
  // the 15th). A cancellation SUPERSEDES a dispatch: a WO that was dispatched
  // and later cancelled must NOT be imported as a fresh 'pending' order.
  const groups = new Map();
  for (const c of withWo) {
    if (!groups.has(c.wo_number)) groups.set(c.wo_number, []);
    groups.get(c.wo_number).push(c);
  }

  const uniqueWos = [];
  for (const [woNumber, list] of groups.entries()) {
    const hasDispatch = list.some(e => e.category === 'dispatch');
    const hasCancellation = list.some(e => e.category === 'cancellation');

    // Representative email: the dispatch email if present (its body is needed to
    // parse building/NTE on import); otherwise the most recent email.
    const byNewest = (a, b) => new Date(b.date || 0) - new Date(a.date || 0);
    const dispatchEmail = list.filter(e => e.category === 'dispatch').sort(byNewest)[0];
    const newest = list.slice().sort(byNewest)[0];
    const rep = dispatchEmail || newest;

    // Effective category: cancellation wins, then dispatch, else the rep's own.
    let effectiveCategory;
    if (hasCancellation) effectiveCategory = 'cancellation';
    else if (hasDispatch) effectiveCategory = 'dispatch';
    else effectiveCategory = rep.category;

    uniqueWos.push({
      ...rep,
      wo_number: woNumber,
      category: effectiveCategory,
      // Keep the dispatch email's uid for the body fetch even if relabelled.
      uid: (dispatchEmail || rep).uid,
      cancelledAfterDispatch: hasDispatch && hasCancellation
    });
  }

  // Which already exist in the DB?
  const woNumbers = uniqueWos.map(c => c.wo_number);
  let existingSet = new Set();
  if (woNumbers.length > 0) {
    const { data: existing } = await supabase
      .from('work_orders')
      .select('wo_number')
      .in('wo_number', woNumbers);
    existingSet = new Set((existing || []).map(w => w.wo_number));
  }

  const missingAll = uniqueWos.filter(c => !existingSet.has(c.wo_number));

  // Split missing into importable (allowed type) vs excluded (other types).
  const importable = missingAll.filter(c => allowedTypes.includes(c.category));
  const excluded = missingAll.filter(c => !allowedTypes.includes(c.category));

  // Category counts across all missing (for awareness).
  const categorySummary = {};
  for (const c of missingAll) {
    categorySummary[c.category] = (categorySummary[c.category] || 0) + 1;
  }

  const shape = (c) => ({
    wo_number: c.wo_number,
    subject: c.subject,
    date: c.date,
    wasRead: c.isRead,
    category: c.category,
    cancelledAfterDispatch: !!c.cancelledAfterDispatch,
    matchType: c.matchType,
    uid: c.uid
  });

  return {
    windowDays: days,
    allowedTypes,
    scannedEmails: candidates.length,
    capped: candidates.length >= MAX_CANDIDATES,
    uniqueWorkOrders: uniqueWos.length,
    missingTotal: missingAll.length,
    dispatchedThenCancelled: missingAll.filter(c => c.cancelledAfterDispatch).length,
    categorySummary,
    importable: importable
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .map(shape),
    excluded: excluded
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .map(shape),
    alreadyImported: uniqueWos.filter(c => existingSet.has(c.wo_number)).map(c => c.wo_number),
    noWoNumber: noWo.slice(0, 25).map(c => ({ subject: c.subject, date: c.date }))
  };
}

// GET: dry-run report
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days')) || 90, 365);
    const allowedTypes = parseTypes(searchParams);

    const email = process.env.EMAIL_IMPORT_USER;
    const password = process.env.EMAIL_IMPORT_PASSWORD;
    if (!email || !password) {
      return Response.json({ success: false, error: 'IMAP not configured' }, { status: 400 });
    }

    const report = await buildReport(days, allowedTypes);

    return Response.json({
      success: true,
      mode: 'dry-run',
      message: report.importable.length > 0
        ? `Found ${report.importable.length} importable work order(s) [types: ${allowedTypes.join(', ')}] in the last ${days} days. ${report.excluded.length} other WO-related notice(s) (cancellations/reassignments/alerts) are listed under "excluded" and will NOT be imported. POST to import.`
        : `No importable work orders [types: ${allowedTypes.join(', ')}] found in the last ${days} days. (${report.excluded.length} excluded notice(s) found — see "excluded".)`,
      note: report.capped
        ? `Scan hit the ${MAX_CANDIDATES}-email cap; the window may be incomplete at its oldest end. Narrow with a smaller ?days= if you need certainty for older orders.`
        : undefined,
      ...report
    });
  } catch (error) {
    console.error('Backfill dry-run error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: import the missing work orders of the allowed type(s).
export async function POST(request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days')) || 90, 365);
    const allowedTypes = parseTypes(searchParams);

    const email = process.env.EMAIL_IMPORT_USER;
    const password = process.env.EMAIL_IMPORT_PASSWORD;
    if (!email || !password) {
      return Response.json({ success: false, error: 'IMAP not configured' }, { status: 400 });
    }

    const report = await buildReport(days, allowedTypes);

    if (report.importable.length === 0) {
      return Response.json({
        success: true,
        message: `Nothing to import for types [${allowedTypes.join(', ')}] in the last ${days} days.`,
        imported: 0,
        windowDays: days,
        allowedTypes,
        excludedCount: report.excluded.length,
        alreadyImported: report.alreadyImported
      });
    }

    // Fetch bodies only for the importable set.
    const importableByUid = new Map(report.importable.map(m => [m.uid, m]));
    const fullEmails = await fetchBodiesByUid(report.importable.map(m => m.uid));

    const results = { imported: 0, skipped: 0, errors: [], workOrders: [] };

    for (const fe of fullEmails) {
      const meta = importableByUid.get(fe.uid);
      const knownWo = meta?.wo_number;
      try {
        const parsed = parseCBREEmail(fe.subject, fe.body);
        const woNumber = knownWo || parsed.wo_number;
        if (!woNumber) {
          results.skipped++;
          results.errors.push(`UID ${fe.uid}: could not resolve WO number`);
          continue;
        }

        const { data: insertedRows, error: insertError } = await supabase
          .from('work_orders')
          .upsert({
            wo_number: woNumber,
            building: parsed.building,
            priority: parsed.priority,
            date_entered: parsed.date_entered,
            work_order_description: parsed.work_order_description,
            requestor: parsed.requestor,
            requestor_phone: parsed.requestor_phone || null,
            status: 'pending',
            comments: parsed.comments,
            nte: parsed.nte || 0
          }, { onConflict: 'wo_number', ignoreDuplicates: true })
          .select();

        if (insertError) {
          results.errors.push(`${woNumber}: ${insertError.message}`);
          continue;
        }

        // No row returned = conflict = already existed (race caught at insert).
        if (!insertedRows || insertedRows.length === 0) {
          results.skipped++;
          continue;
        }

        results.imported++;
        results.workOrders.push({ wo_number: woNumber, building: parsed.building, priority: parsed.priority });
      } catch (err) {
        results.errors.push(`UID ${fe.uid}: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      mode: 'import',
      message: `Backfill imported ${results.imported} ${allowedTypes.join('/')} work order(s) from the last ${days} days, skipped ${results.skipped}. (${report.excluded.length} other notice(s) intentionally not imported.)`,
      windowDays: days,
      allowedTypes,
      duration: `${Date.now() - startTime}ms`,
      ...results
    });
  } catch (error) {
    console.error('Backfill import error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
