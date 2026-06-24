// app/api/email-import/backfill/route.js
// Backfill scanner - finds CBRE work orders that the cron auto-import missed.
//
// WHY THIS EXISTS:
// The cron (/api/email-import/cron) only fetches emails that are:
//   1. UNSEEN (unread)
//   2. From the last 7 days
//   3. Have "Work Order" or "Dispatch" literally in the subject
// Any dispatch that was already opened in Gmail, arrived earlier, or uses a
// different subject wording (common for PJ project dispatches) gets silently
// skipped forever. This endpoint bypasses ALL three limits:
//   - scans regardless of read status
//   - scans a configurable window (default 90 days / ~3 months)
//   - NO narrow subject pre-filter; the WO-number regex is the only gate
//
// USAGE:
//   GET  /api/email-import/backfill?days=90   -> DRY RUN report (preview only, imports nothing)
//   POST /api/email-import/backfill?days=90   -> imports every "missing" work order found in the window
//
// Recommended flow: run GET first, review the "missing" list, then POST to import.

import { createClient } from '@supabase/supabase-js';
import Imap from 'imap';
import { simpleParser } from 'mailparser';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Hard safety cap so a huge window can never blow up a serverless invocation.
const MAX_CANDIDATES = 1500;

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

// Robust WO-number extraction from a subject line.
// Layer 1 (canonical): "...Work Order ST3162410..." / "PM Work Order P2919408" / underscores.
// Layer 2 (loose):     any "<1-3 letters><6+ digits>" token, e.g. a project subject
//                      "Project Assignment PJ3118923" that omits the words "Work Order".
// Returns { wo: string|null, matchType: 'canonical' | 'loose' | null }
function extractWoFromSubject(subject) {
  const s = subject || '';

  const canonical = s.match(/(?:PM[\s_]+)?Work[\s_]+Order[\s_]+([A-Z]{0,3}\d+)/i);
  if (canonical && canonical[1]) {
    return { wo: canonical[1].toUpperCase(), matchType: 'canonical' };
  }

  // Loose: letter-prefixed CBRE WO token. Require >=6 digits to avoid catching
  // phone numbers, priority codes (P2), dates, etc. Prefix is 1-3 letters here
  // (a bare number with no prefix is too risky for a loose scan).
  const loose = s.match(/\b([A-Z]{1,3}\d{6,})\b/i);
  if (loose && loose[1]) {
    return { wo: loose[1].toUpperCase(), matchType: 'loose' };
  }

  return { wo: null, matchType: null };
}

// PHASE 1: fetch lightweight headers (subject + date + read flag) for every
// message in the window. No bodies -> fast and timeout-safe.
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

        // Only filter by date. Deliberately NO subject filter - the WO regex is the gate.
        imap.search([['SINCE', sinceDate]], (err, results) => {
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
                    matchType
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
// caller with the value already extracted during the scan, so a non-canonical
// subject (e.g. a project dispatch) still imports with the correct WO number.
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
    const pCode = priorityMatch[1].toUpperCase();
    const pText = (priorityMatch[2] || '').toLowerCase();
    const pNum = parseInt(pCode.replace('P', ''));
    if (pNum === 1 || pText.includes('emergency')) workOrder.priority = 'emergency';
    else if (pNum === 2 || pText.includes('urgent') || pText.includes('24 hour')) workOrder.priority = 'high';
    else if (pNum === 3 || pNum === 4 || pText.includes('48 hour') || pText.includes('72 hour')) workOrder.priority = 'medium';
    else workOrder.priority = 'low';
  }

  const dateMatch = cleanBody.match(/Date Entered:\s*([A-Za-z]+\s+\d+\s+\d+\s+[\d:]+\s*[AP]?M?)/i);
  if (dateMatch) {
    try {
      const parsed = new Date(dateMatch[1].replace(/\s+/g, ' ').trim());
      if (!isNaN(parsed.getTime())) workOrder.date_entered = parsed.toISOString();
    } catch (e) { /* keep default */ }
  }

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
  if (workOrder.requestor_phone) comments.push(`Contact Phone: ${workOrder.requestor_phone}`);
  const targetMatch = cleanBody.match(/Target Completion:\s*([A-Za-z]+\s+\d+\s+\d+)/i);
  if (targetMatch) comments.push(`Target Completion: ${targetMatch[1].trim()}`);
  const tagMatch = cleanBody.match(/Tag Number:\s*(\d+)/i);
  if (tagMatch) comments.push(`Asset Tag: ${tagMatch[1]}`);
  comments.push(`[Backfill-imported from CBRE ${isPM ? 'PM ' : ''}email on ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} EST]`);
  workOrder.comments = comments.join('\n');

  return workOrder;
}

// Shared: scan window, classify candidates against the DB.
async function buildReport(days) {
  const candidates = await scanHeaders(days);

  const withWo = candidates.filter(c => c.wo_number);
  const noWo = candidates.filter(c => !c.wo_number);

  // Dedupe within the scan (same WO can appear in multiple emails).
  const seen = new Map();
  for (const c of withWo) {
    const existing = seen.get(c.wo_number);
    // Prefer canonical match and the most recent email per WO number.
    if (!existing ||
        (existing.matchType === 'loose' && c.matchType === 'canonical') ||
        (c.date && existing.date && new Date(c.date) > new Date(existing.date))) {
      seen.set(c.wo_number, c);
    }
  }
  const uniqueWos = Array.from(seen.values());

  // Which of these already exist in the DB?
  const woNumbers = uniqueWos.map(c => c.wo_number);
  let existingSet = new Set();
  if (woNumbers.length > 0) {
    const { data: existing } = await supabase
      .from('work_orders')
      .select('wo_number')
      .in('wo_number', woNumbers);
    existingSet = new Set((existing || []).map(w => w.wo_number));
  }

  const missing = uniqueWos.filter(c => !existingSet.has(c.wo_number));
  const alreadyImported = uniqueWos.filter(c => existingSet.has(c.wo_number));

  return {
    windowDays: days,
    scannedEmails: candidates.length,
    capped: candidates.length >= MAX_CANDIDATES,
    uniqueWorkOrders: uniqueWos.length,
    missing: missing
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .map(c => ({
        wo_number: c.wo_number,
        subject: c.subject,
        date: c.date,
        wasRead: c.isRead,
        matchType: c.matchType,
        uid: c.uid
      })),
    alreadyImported: alreadyImported.map(c => c.wo_number),
    noWoNumber: noWo.slice(0, 25).map(c => ({ subject: c.subject, date: c.date }))
  };
}

// GET: dry-run report
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days')) || 90, 365);

    const email = process.env.EMAIL_IMPORT_USER;
    const password = process.env.EMAIL_IMPORT_PASSWORD;
    if (!email || !password) {
      return Response.json({ success: false, error: 'IMAP not configured' }, { status: 400 });
    }

    const report = await buildReport(days);

    return Response.json({
      success: true,
      mode: 'dry-run',
      message: report.missing.length > 0
        ? `Found ${report.missing.length} work order(s) in the last ${days} days that are NOT yet imported. POST to this endpoint to import them.`
        : `No missing work orders found in the last ${days} days. Everything is already imported.`,
      ...report
    });
  } catch (error) {
    console.error('Backfill dry-run error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST: import the missing work orders found in the window.
export async function POST(request) {
  const startTime = Date.now();
  try {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get('days')) || 90, 365);

    const email = process.env.EMAIL_IMPORT_USER;
    const password = process.env.EMAIL_IMPORT_PASSWORD;
    if (!email || !password) {
      return Response.json({ success: false, error: 'IMAP not configured' }, { status: 400 });
    }

    const report = await buildReport(days);

    if (report.missing.length === 0) {
      return Response.json({
        success: true,
        message: `Nothing to import - all work orders in the last ${days} days already exist.`,
        imported: 0,
        windowDays: days,
        alreadyImported: report.alreadyImported
      });
    }

    // Map WO number -> uid for the missing set, then fetch only those bodies.
    const missingByUid = new Map(report.missing.map(m => [m.uid, m]));
    const fullEmails = await fetchBodiesByUid(report.missing.map(m => m.uid));

    const results = { imported: 0, skipped: 0, errors: [], workOrders: [] };

    for (const fe of fullEmails) {
      const meta = missingByUid.get(fe.uid);
      const knownWo = meta?.wo_number;
      try {
        const parsed = parseCBREEmail(fe.subject, fe.body);
        // Trust the WO number resolved during the scan (handles non-canonical subjects).
        const woNumber = knownWo || parsed.wo_number;
        if (!woNumber) {
          results.skipped++;
          results.errors.push(`UID ${fe.uid}: could not resolve WO number`);
          continue;
        }

        // Final duplicate guard (in case it was imported between scan and now).
        const { data: existing } = await supabase
          .from('work_orders')
          .select('wo_id')
          .eq('wo_number', woNumber)
          .single();
        if (existing) {
          results.skipped++;
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
      message: `Backfill imported ${results.imported} work order(s) from the last ${days} days, skipped ${results.skipped}.`,
      windowDays: days,
      duration: `${Date.now() - startTime}ms`,
      ...results
    });
  } catch (error) {
    console.error('Backfill import error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
