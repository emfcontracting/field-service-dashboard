// app/api/cbre/sync-vendor-confirmations/route.js
// ─────────────────────────────────────────────────────────────────────────────
// Reads the "Confirmation - Vendor App Submission (Production)" emails that
// Smartsheet sends back after a Vendor App form is submitted, matches each to
// the approval_requests row it confirms, and:
//   • stamps confirmed_at on that row (drives a "✓ CBRE confirmed" badge)
//   • notes it on the work order's comments
//   • closes the loop if the row was only 'approved' (a human submitted the
//     form but forgot to mark it) — marks it sent + stamps the WO per kind.
//
// Reads the same Gmail (EMAIL_IMPORT_USER) as email-sync, where CBRE mail lands.
// Nothing is sent. Idempotent via confirmed_at. Mirrors email-sync's IMAP code.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { kindFromActionValue, ACTIONS } from '@/lib/cbreVendorForm';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FROM_ADDR = 'forms@app.smartsheet.com';
const SUBJECT_MATCH = 'Confirmation - Vendor App Submission';

// Per-kind work-order stamp applied when a confirmation closes the loop, so the
// automatic producers do not re-queue an already-submitted item.
const WO_STAMP = {
  cbre_acknowledge: (now) => ({ cbre_acknowledged_at: now, cbre_acknowledged_via: 'vendor_app_form' }),
  cbre_nte:         (now) => ({ cbre_nte_submitted_at: now }),
  cbre_complete:    (now) => ({ cbre_completion_submitted_at: now }),
};

function connectIMAP() {
  const email = process.env.EMAIL_IMPORT_USER;
  const password = process.env.EMAIL_IMPORT_PASSWORD;
  if (!email || !password) throw new Error('IMAP credentials not configured');
  return new Imap({ user: email, password, host: 'imap.gmail.com', port: 993, tls: true, tlsOptions: { rejectUnauthorized: false } });
}

function fmtIMAPDate(date) {
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(date.getDate()).padStart(2, '0')}-${m[date.getMonth()]}-${date.getFullYear()}`;
}

async function fetchConfirmations(searchDays) {
  return new Promise((resolve, reject) => {
    const imap = connectIMAP();
    const emails = [];
    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err) => {
        if (err) { imap.end(); return reject(new Error(`Could not open INBOX: ${err.message}`)); }
        const since = new Date();
        since.setDate(since.getDate() - searchDays);
        imap.search([['FROM', FROM_ADDR], ['SUBJECT', SUBJECT_MATCH], ['SINCE', fmtIMAPDate(since)]], (err, results) => {
          if (err) { imap.end(); return reject(err); }
          if (!results || !results.length) { imap.end(); return resolve([]); }
          const fetch = imap.fetch(results, { bodies: '', markSeen: false });
          const parsePromises = [];
          fetch.on('message', (msg) => {
            let buffer = '';
            msg.on('body', (stream) => { stream.on('data', (c) => { buffer += c.toString('utf8'); }); });
            msg.once('end', () => {
              parsePromises.push(new Promise((res) => {
                simpleParser(buffer, (err, parsed) => {
                  if (err) { res(); return; }
                  emails.push({ date: parsed.date || new Date(), text: parsed.text || '', html: parsed.html || '' });
                  res();
                });
              }));
            });
          });
          fetch.once('error', (err) => { imap.end(); reject(err); });
          fetch.once('end', async () => { await Promise.all(parsePromises); imap.end(); resolve(emails); });
        });
      });
    });
    imap.once('error', reject);
    imap.connect();
  });
}

// Prefer the plaintext part; fall back to a rough de-tagged HTML.
function bodyText(e) {
  if (e.text && e.text.trim()) return e.text;
  return String(e.html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
}

// The confirmation body is a table of "| Label | Value |" rows.
function field(text, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = text.match(new RegExp('\\|\\s*' + esc + '\\s*\\|\\s*([^|\\n]+?)\\s*\\|'));
  return m ? m[1].trim() : null;
}

export async function GET(request) { return handle(request); }
export async function POST(request) { return handle(request); }

async function handle(request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
    searchParams.get('key') !== process.env.CRON_SECRET
  ) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchDays = Math.min(Math.max(parseInt(searchParams.get('searchDays') || '14', 10) || 14, 1), 90);
  const dryRun = searchParams.get('dryRun') === 'true';

  const result = { scanned: 0, confirmed: 0, skipped: 0, unmatched: [], errors: [], rows: [] };

  try {
    const emails = await fetchConfirmations(searchDays);
    result.scanned = emails.length;

    for (const e of emails) {
      const text = bodyText(e);
      const actionVal = field(text, 'Action');
      const woNum = field(text, 'Work Order #');
      if (!actionVal || !woNum) { result.unmatched.push('parse-failed (Action/WO# not found)'); continue; }

      const kind = kindFromActionValue(actionVal);
      if (!kind) { result.unmatched.push(`${woNum}: unknown action "${actionVal}"`); continue; }

      const { data: wo, error: woErr } = await supabase
        .from('work_orders')
        .select('wo_id, wo_number, comments')
        .eq('wo_number', woNum)
        .maybeSingle();
      if (woErr) { result.errors.push(`${woNum}: ${woErr.message}`); continue; }
      if (!wo) { result.unmatched.push(`${woNum}: work order not found`); continue; }

      // The most recent submitted (or approved-but-unmarked) row of this kind.
      const { data: rows, error: rErr } = await supabase
        .from('approval_requests')
        .select('approval_id, status, confirmed_at')
        .eq('wo_id', wo.wo_id)
        .eq('kind', kind)
        .in('status', ['sent', 'approved'])
        .is('confirmed_at', null)
        .order('sent_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (rErr) { result.errors.push(`${woNum}: ${rErr.message}`); continue; }
      const row = rows && rows[0];
      if (!row) { result.skipped++; continue; }   // already confirmed, or nothing sent

      const whenIso = (e.date instanceof Date ? e.date : new Date(e.date)).toISOString();
      const label = ACTIONS[kind]?.value || kind;

      if (dryRun) {
        result.rows.push({ wo_number: woNum, kind, action: label, would_confirm: row.approval_id });
        result.confirmed++;
        continue;
      }

      // 1) confirm the approval row (+ close the loop if only 'approved').
      const patch = { confirmed_at: whenIso, confirmed_source: 'smartsheet_email' };
      if (row.status === 'approved') { patch.status = 'sent'; patch.sent_at = whenIso; }
      const { error: uErr } = await supabase
        .from('approval_requests')
        .update(patch)
        .eq('approval_id', row.approval_id)
        .is('confirmed_at', null);   // idempotent guard
      if (uErr) { result.errors.push(`${woNum}: ${uErr.message}`); continue; }

      // 2) keep the auto producers from re-queueing (mirror markSubmitted).
      if (WO_STAMP[kind]) {
        await supabase.from('work_orders').update(WO_STAMP[kind](whenIso)).eq('wo_id', wo.wo_id);
      }

      // 3) note it on the work order.
      const note = `[CBRE VENDOR APP CONFIRMED] ${whenIso.slice(0, 16).replace('T', ' ')}\n✓ ${label} confirmed by CBRE/Smartsheet`;
      const merged = wo.comments ? `${wo.comments}\n\n${note}` : note;
      const { error: cErr } = await supabase.from('work_orders').update({ comments: merged }).eq('wo_id', wo.wo_id);
      if (cErr) result.errors.push(`${woNum}: comment update failed: ${cErr.message}`);

      result.confirmed++;
      result.rows.push({ wo_number: woNum, kind, action: label });
    }

    return Response.json({ ...result, message: `Confirmed ${result.confirmed} of ${result.scanned} scanned.` });
  } catch (e) {
    return Response.json({ ...result, error: e.message }, { status: 500 });
  }
}
