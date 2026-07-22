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
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { buildContactLines } from '../contactParser';
import { parseCbreDateEntered } from '../parseCbreDate';
import { PRIORITY_CODES } from '@/lib/priorityCodes';

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

function connectIMAP() {
  const email = process.env.EMAIL_IMPORT_USER;
  const password = process.env.EMAIL_IMPORT_PASSWORD;
  if (!email || !password) {
    throw new Error('IMAP credentials not configured');
  }
  return new Imap({
    user: email,
    password: password,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false }
  });
}

function formatIMAPDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

// Classify a subject line into the kind of CBRE notice it is.
// Order matters: a "Cancellation of Work Order" must NOT be read as a dispatch.
function classifySubject(subject) {
  const s = (subject || '').toLowerCase();

  // Real new dispatch indicators (some are prefixed "ALERT:" / "Principal Workorder Created").
  const looksDispatch =
    s.includes('dispatch of work order') ||
    s.includes('dispatch_of_work_order') ||
    s.includes('pm work order') ||
    s.includes('principal workorder');

  if (looksDispatch) {
    // ...but a cancellation/reassignment OF a work order is not a new dispatch.
    if (s.includes('cancellation') || s.includes('cancelled') || s.includes('canceled')) return 'cancellation';
    if (s.includes('reassignment') || s.includes('reassigned')) return 'reassignment';
    return 'dispatch';
  }

  if (s.includes('cancellation') || s.includes('cancelled') || s.includes('canceled')) return 'cancellation';
  if (s.includes('reassignment') || s.includes('reassigned')) return 'reassignment';
  if (s.includes('escalation')) return 'escalation';
  if (s.includes('ovd alert') || s.includes('alert')) return 'alert';
  return 'other';
}

// Robust WO-number extraction from a subject line.
// Layer 1 (canonical): "...Work Order ST3162410..." / "PM Work Order P2919408".
// Layer 2 (loose):     any "<1-3 letters><6+ digits>" token (covers "WO# C2765194",
//                      "OVD Alert - Work Order #C2856093", project subjects, etc.).
function extractWoFromSubject(subject) {
  const s = subject || '';

  const canonical = s.match(/(?:PM[\s_]+)?Work[\s_]+Order[\s_]+([A-Z]{0,3}\d+)/i);
  if (canonical && canonical[1]) {
    return { wo: canonical[1].toUpperCase(), matchType: 'canonical' };
  }

  const loose = s.match(/\b([A-Z]{1,3}\d{6,})\b/i);
  if (loose && loose[1]) {
    return { wo: loose[1].toUpperCase(), matchType: 'loose' };
  }

  return { wo: null, matchType: null };
}

// PHASE 1: fetch lightweight headers (subject + date + read flag) for WO-related
// emails in the window. WO-focused subject search keeps volume low so the cap
// does not truncate the window. No bodies -> fast and timeout-safe.
async function scanHeaders(days) {
  return new Promise((resolve, reject) => {
    const imap = connectIMAP();
    const candidates = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err) => {
        if (err) {
          imap.end();
          return reject(new Error(`Could not open INBOX: ${err.message}`));
        }

        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceDate = formatIMAPDate(since);

        // WO-related subjects only (dispatches, cancellations, reassignments,
        // OVD alerts). Excludes bids/invoices/newsletters that otherwise swamp
        // the scan. Classification + type filter decide what actually imports.
        const searchCriteria = [
          ['SINCE', sinceDate],
          ['OR',
            ['OR', ['SUBJECT', 'Work Order'], ['SUBJECT', 'Workorder']],
            ['OR', ['SUBJECT', 'WO#'], ['SUBJECT', 'Dispatch']]
          ]
        ];

        imap.search(searchCriteria, (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }
          if (!results || results.length === 0) {
            imap.end();
            return resolve([]);
          }

          // Newest first, capped.
          const uids = results.sort((a, b) => b - a).slice(0, MAX_CANDIDATES);

          const fetch = imap.fetch(uids, {
            bodies: 'HEADER.FIELDS (SUBJECT DATE)',
            struct: false
          });

          const parsePromises = [];

          fetch.on('message', (msg) => {
            let headerBuf = '';
            let uid;
            let flags = [];

            msg.on('body', (stream) => {
              stream.on('data', (chunk) => { headerBuf += chunk.toString('utf8'); });
            });
            msg.once('attributes', (attrs) => {
              uid = attrs.uid;
              flags = attrs.flags || [];
            });
            msg.once('end', () => {
              const p = new Promise((res) => {
                simpleParser(headerBuf, (err, parsed) => {
                  if (err) { res(); return; }
                  const subject = parsed.subject || '';
                  const { wo, matchType } = extractWoFromSubject(subject);
                  candidates.push({
                    uid,
                    subject,
                    date: parsed.date || null,
                    isRead: flags.includes('\\Seen'),
                    wo_number: wo,
                    matchType,
                    category: classifySubject(subject)
                  });
                  res();
                });
              });
              parsePromises.push(p);
            });
          });

          fetch.once('error', (err) => { imap.end(); reject(err); });
          fetch.once('end', async () => {
            await Promise.all(parsePromises);
            imap.end();
            resolve(candidates);
          });
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

// PHASE 2 (import only): fetch full bodies for a specific set of UIDs.
async function fetchBodiesByUid(uids) {
  return new Promise((resolve, reject) => {
    if (!uids || uids.length === 0) return resolve([]);
    const imap = connectIMAP();
    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err) => {
        if (err) { imap.end(); return reject(err); }

        const fetch = imap.fetch(uids, { bodies: '', markSeen: false });
        const parsePromises = [];

        fetch.on('message', (msg) => {
          let buffer = '';
          let uid;
          msg.on('body', (stream) => {
            stream.on('data', (chunk) => { buffer += chunk.toString('utf8'); });
          });
          msg.once('attributes', (attrs) => { uid = attrs.uid; });
          msg.once('end', () => {
            const p = new Promise((res) => {
              simpleParser(buffer, (err, parsed) => {
                if (err) { res(); return; }
                emails.push({
                  uid,
                  subject: parsed.subject || '',
                  from: parsed.from?.text || '',
                  date: parsed.date || new Date(),
                  body: parsed.html || parsed.textAsHtml || parsed.text || ''
                });
                res();
              });
            });
            parsePromises.push(p);
          });
        });

        fetch.once('error', (err) => { imap.end(); reject(err); });
        fetch.once('end', async () => {
          await Promise.all(parsePromises);
          imap.end();
          resolve(emails);
        });
      });
    });

    imap.once('error', reject);
    imap.connect();
  });
}

// Full CBRE parser (mirrors cron/route.js). wo_number can be overridden by the
// caller with the value already extracted during the scan.
function parseCBREEmail(subject, body) {
  const workOrder = {
    wo_number: '',
    building: '',
    address: '',
    city: '',
    state: '',
    priority: 'medium',
    date_entered: new Date().toISOString(),
    work_order_description: '',
    requestor: '',
    requestor_phone: '',
    status: 'pending',
    comments: '',
    nte: 0
  };

  const isPM = (subject || '').toLowerCase().includes('pm work order') ||
               (body || '').toLowerCase().includes('preventive maintenance description');

  const cleanBody = (body || '')
    .replace(/=\r?\n/g, '')
    .replace(/=3D/g, '=')
    .replace(/=20/g, ' ')
    .replace(/=2F/g, '/')
    .replace(/=2C/g, ',')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  const woMatch = (subject || '').match(/(?:PM[\s_]+)?Work[\s_]+Order[\s_]+([A-Z]{0,3}\d+)/i);
  if (woMatch) workOrder.wo_number = woMatch[1].toUpperCase();

  const priorityMatch = cleanBody.match(/Priority[:\s_]*(P\d+)[\s\-_]*([^<\n]*)/i) ||
                        (subject || '').match(/Priority[:\s_]*(P\d+)/i);
  if (priorityMatch) {
    const pNum = parseInt(String(priorityMatch[1]).replace(/P/i, ''), 10);
    const canonical = `P${pNum}`;
    if (PRIORITY_CODES[canonical]) {
      // Store the real CBRE priority code (single source of truth).
      workOrder.priority = canonical;
    } else {
      const pText = (priorityMatch[2] || '').toLowerCase();
      if (pText.includes('emergency')) workOrder.priority = 'emergency';
      else if (pText.includes('urgent') || pText.includes('24 hour')) workOrder.priority = 'high';
      else if (pText.includes('48 hour') || pText.includes('72 hour')) workOrder.priority = 'medium';
      else workOrder.priority = 'low';
    }
  }

  // Extract Date Entered. CBRE stamps this in Eastern and usually includes the
  // source offset (e.g. "UTC-05"); parseCbreDateEntered honors it and returns a
  // correct UTC instant. Without it, the naive string is read in the runtime
  // zone (UTC on Vercel) and lands 4-5 hours early.
  const dateEntered = parseCbreDateEntered(cleanBody);
  if (dateEntered) workOrder.date_entered = dateEntered;

  const buildingMatch = cleanBody.match(/Building:\s*([^<\n]+?)(?=\s*Floor|\s*Area|\s*Country|$)/i);
  if (buildingMatch) workOrder.building = buildingMatch[1].trim().substring(0, 200);

  const addressMatch = cleanBody.match(/Address:\s*([^<\n]+?)(?=\s*Country|\s*Building|$)/i);
  if (addressMatch) workOrder.address = addressMatch[1].replace(/,\s*,/g, ',').replace(/,\s*$/, '').trim();

  const locationMatch = cleanBody.match(/Country,?\s*St,?\s*City[:\s]*(?:USA?),?\s*([A-Z]{2}),?\s*([A-Za-z\s]+)/i);
  if (locationMatch) {
    workOrder.state = locationMatch[1].trim();
    workOrder.city = locationMatch[2].trim();
  }

  let requestorMatch = cleanBody.match(/Work Order Requestor Name and Phone:\s*([^,<\n]+),?\s*([\d\-\(\)\s]+)?/i);
  if (!requestorMatch) requestorMatch = cleanBody.match(/UPS Site Contact:\s*([^(<\n]+)\s*\(?([\d\-]+)\)?/i);
  if (requestorMatch) {
    workOrder.requestor = requestorMatch[1].trim();
    if (requestorMatch[2]) workOrder.requestor_phone = requestorMatch[2].replace(/[^\d\-]/g, '').trim();
  }

  const nteMatch = cleanBody.match(/should not exceed\s*\*?\*?([\d,]+\.?\d*)\s*USD\*?\*?/i);
  if (nteMatch) workOrder.nte = parseFloat(nteMatch[1].replace(/,/g, '')) || 0;

  let description = '';
  let descMatch = cleanBody.match(/Problem Description:\s*(.+?)(?=Assignment Name|Notes to Vendor|Service Location|$)/is);
  if (!descMatch || !descMatch[1].trim()) {
    descMatch = cleanBody.match(/Preventive Maintenance Description:\s*(.+?)(?=Service Location|Asset|PM Action|$)/is);
  }
  const pmActionMatch = cleanBody.match(/PM Action Steps:\s*[-]+\s*(.+?)(?=If you have any questions|Assignment Name|$)/is);
  if (descMatch && descMatch[1]) description = descMatch[1].replace(/\s+/g, ' ').trim();
  if (pmActionMatch && pmActionMatch[1]) {
    const pmAction = pmActionMatch[1].replace(/\s+/g, ' ').trim();
    if (pmAction && !description.includes(pmAction)) {
      description = description ? `${description}\n\nPM Action: ${pmAction}` : pmAction;
    }
  }
  workOrder.work_order_description = description.substring(0, 2000);

  const comments = [];
  if (isPM) comments.push('[PM - Preventive Maintenance]');
  if (workOrder.address) comments.push(`Address: ${workOrder.address}`);
  if (workOrder.city && workOrder.state) comments.push(`Location: ${workOrder.city}, ${workOrder.state}`);
  // CBRE escalation contacts (Dispatcher / Conveyors / Environmental / Capital / GTSG ...)
  const contactLines = buildContactLines(cleanBody);
  if (contactLines.length > 0) {
    comments.push('📞 CBRE Contacts');
    contactLines.forEach(line => comments.push(line));
  }
  const targetMatch = cleanBody.match(/Target Completion:\s*([A-Za-z]+\s+\d+\s+\d+)/i);
  if (targetMatch) comments.push(`Target Completion: ${targetMatch[1].trim()}`);
  const tagMatch = cleanBody.match(/Tag Number:\s*(\d+)/i);
  if (tagMatch) comments.push(`Asset Tag: ${tagMatch[1]}`);
  comments.push(`[Backfill-imported from CBRE ${isPM ? 'PM ' : ''}email on ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST]`);
  workOrder.comments = comments.join('\n');

  return workOrder;
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
