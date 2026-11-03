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
import { fetchMessages, sinceDays } from '@/lib/imap';
import { kindsFromActionValue, ACTIONS } from '@/lib/cbreVendorForm';
import { requireCronOrStaff } from '@/lib/serverAuth';
import { withCronRun } from '@/lib/cronRun';
import { acknowledgeSubmittedCompletions, autoAcknowledgeNote } from '@/lib/completionAcknowledge';
import { applySubmissionStatus } from '@/lib/cbreSubmissionStatus';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const FROM_ADDR = 'forms@app.smartsheet.com';
const SUBJECT_MATCH = 'Confirmation - Vendor App Submission';

// The other half of the loop: CBRE can DECLINE a submission, and that arrives
// as its own mail with its own subject. Nothing read it until 2026-11-03, so
// every target-date request ever declined still sat at 'sent' on our side —
// all 41 of them — and the office had no way to know. Matched on subject
// alone, deliberately: the confirmation comes from forms@app.smartsheet.com
// while the decline is sent by the sheet's automation, and the exact sender is
// not something we should depend on.
const REJECT_SUBJECT = 'Vendor App Submission Rejection';

// Per-kind work-order stamp applied when a confirmation closes the loop, so the
// automatic producers do not re-queue an already-submitted item.
const WO_STAMP = {
  cbre_acknowledge: (now) => ({ cbre_acknowledged_at: now, cbre_acknowledged_via: 'vendor_app_form' }),
  cbre_nte:         (now) => ({ cbre_nte_submitted_at: now, cbre_quote_submitted_at: now, cbre_quote_submitted_via: 'vendor_app_form' }),
  cbre_complete:    (now) => ({ cbre_completion_submitted_at: now, completion_transferred: true, completion_transferred_at: now }),
  cbre_arrival:     (now) => ({ cbre_arrival_submitted_at: now }),
  // cbre_decline has no timestamp column of its own; the status write below
  // is the whole record. Listed here so the kind is visibly accounted for.
  cbre_decline:     () => ({}),
};

// IMAP lives in lib/imap.js.
async function fetchConfirmations(searchDays) {
  const { messages } = await fetchMessages({
    account: 'import',
    box: 'INBOX',
    criteria: [['FROM', FROM_ADDR], ['SUBJECT', SUBJECT_MATCH], sinceDays(searchDays)],
    bodyPreference: 'text',
  });
  return messages;
}

async function fetchRejections(searchDays) {
  const { messages } = await fetchMessages({
    account: 'import',
    box: 'INBOX',
    criteria: [['SUBJECT', REJECT_SUBJECT], sinceDays(searchDays)],
    bodyPreference: 'text',
  });
  return messages;
}

// Smartsheet sends these as a SINGLE text/html part — there is no text/plain
// (verified on the raw MIME of a confirmation from 2026-11-03:
// `Content-Type: text/html; charset="UTF-8"`, no multipart). Until then this
// fell through to a flat tag strip, which contains no "| Label | Value |" rows
// at all, so field() below matched nothing and this route confirmed exactly
// zero of 673 submitted rows since it was written. The pipe table it was
// built against is Gmail's rendering of the mail, not the mail.
//
// So the rows are rebuilt from the HTML table: cell ends become "|", row ends
// become line breaks. Values arrive split across one <span> per word, hence
// the whitespace collapse. Both the confirmation and the rejection loop parse
// through here.
const HTML_ENTITIES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

// Not exported: a Next.js route file should only export its handlers and the
// route segment config.
function htmlToPipeRows(html) {
  return String(html || '')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/\s*t[dh]\s*>/gi, ' \u0002 ')     // cell boundary
    .replace(/<\/\s*tr\s*>/gi, ' \u0002\u0001')   // row boundary
    .replace(/<[^>]*>/g, ' ')
    .replace(/&([a-zA-Z]+|#\d+);/g, (m, n) => (HTML_ENTITIES[n] !== undefined ? HTML_ENTITIES[n] : m))
    .replace(/\s+/g, ' ')
    .split('\u0001')
    .map((row) => row.split('\u0002').map((c) => c.trim()).filter(Boolean))
    .filter((cells) => cells.length)
    .map((cells) => '| ' + cells.join(' | ') + ' |')
    .join('\n');
}

// Why a message could not be parsed, in one short line. Only built for the
// dryRun report — it is the difference between "the mail never arrived in a
// readable form" and "the table looks different than we think".
function parseDiag(e, text) {
  const t = String(e?.text || ''), h = String(e?.html || '');
  const head = String(text || '').replace(/\s+/g, ' ').slice(0, 120);
  return `text=${t.length} html=${h.length} parsed=${String(text || '').length} head="${head}"`;
}

function bodyText(e) {
  // The HTML wins whenever there is any, because it is the only place the
  // table structure survives. mailparser hands us a `text` field even for
  // these html-only mails — it converts the HTML itself — and that conversion
  // flattens the table into prose. Worse, it does contain pipe characters, but
  // in the footer ("© 2026 Smartsheet Inc. | Contact | Privacy Policy | …"),
  // not in a table. A first attempt at this preferred `text` whenever it held
  // a pipe and therefore never looked at the HTML at all: 95 of 95 mails still
  // failed to parse, with text=2105 html=7837 in the dry run.
  const rows = htmlToPipeRows(e?.html);
  if (rows) return rows;
  const text = String(e?.text || '');
  if (text.trim()) return text;
  return String(e?.html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
}

// The confirmation body is a table of "| Label | Value |" rows.
function field(text, label) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = text.match(new RegExp('\\|\\s*' + esc + '\\s*\\|\\s*([^|\\n]+?)\\s*\\|'));
  return m ? m[1].trim() : null;
}

async function GET_impl(request) { return handle(request); }
async function POST_impl(request) { return handle(request); }

async function handle(request) {
  const { searchParams } = new URL(request.url);
  const auth = await requireCronOrStaff(request);
  if (!auth.ok) return auth.response;

  const searchDays = Math.min(Math.max(parseInt(searchParams.get('searchDays') || '14', 10) || 14, 1), 90);
  const dryRun = searchParams.get('dryRun') === 'true';

  const result = {
    scanned: 0, confirmed: 0, skipped: 0, unmatched: [], errors: [], rows: [],
    rejectionsScanned: 0, rejected: 0, rejectionsUnmatched: [], rejectedRows: [],
  };

  try {
    const emails = await fetchConfirmations(searchDays);
    result.scanned = emails.length;

    for (const e of emails) {
      const text = bodyText(e);
      const actionVal = field(text, 'Action');
      const woNum = field(text, 'Work Order #');
      if (!actionVal || !woNum) {
        result.unmatched.push(
          dryRun ? `parse-failed · ${parseDiag(e, text)}` : 'parse-failed (Action/WO# not found)'
        );
        continue;
      }

      // One Action string can belong to several kinds ("Update Next Arrival
      // Time" is both the manual ETA and the automatic arrival report), so we
      // look for an open row of ANY of them and take the kind from the row.
      const kinds = kindsFromActionValue(actionVal);
      if (!kinds.length) { result.unmatched.push(`${woNum}: unknown action "${actionVal}"`); continue; }

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
        .select('approval_id, status, confirmed_at, kind, payload')
        .eq('wo_id', wo.wo_id)
        .in('kind', kinds)
        .in('status', ['sent', 'approved'])
        .is('confirmed_at', null)
        .order('sent_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (rErr) { result.errors.push(`${woNum}: ${rErr.message}`); continue; }
      const row = rows && rows[0];
      if (!row) { result.skipped++; continue; }   // already confirmed, or nothing sent

      const kind = row.kind;                       // the row's own kind, not a guess
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
        const patch = WO_STAMP[kind](whenIso);
        if (Object.keys(patch).length) {
          await supabase.from('work_orders').update(patch).eq('wo_id', wo.wo_id);
        }
      }
      // The same cbre_status write the Approvals tab makes when the office
      // marks a row submitted by hand — this is the path for the rows it
      // forgot. Guarded, so a confirmation that arrives after CBRE has already
      // approved the quote cannot pull the work order back.
      const { error: statusErr } = await applySubmissionStatus(supabase, kind, [wo.wo_id], whenIso);
      if (statusErr) result.errors.push(`${woNum}: CBRE status update failed: ${statusErr.message}`);
      // A confirmed completion means CBRE has the work order closed on their
      // side and is waiting for the invoice — the same single step as the
      // "Acknowledge Completion & Lock" button, done without the office having
      // to walk back into the ticket.
      let autoAcked = false;
      if (kind === 'cbre_complete') {
        const { count, error: ackErr } = await acknowledgeSubmittedCompletions(
          supabase, [wo.wo_id], whenIso, null
        );
        if (ackErr) result.errors.push(`${woNum}: acknowledge failed: ${ackErr.message}`);
        autoAcked = count > 0;
      }
      // A target-date change is only a hold report when the producer said so in
      // the payload; a routine date change must not stamp it.
      if (kind === 'cbre_target_date' && row.payload?._readable?.holdReason) {
        await supabase.from('work_orders').update({ cbre_hold_reported_at: whenIso }).eq('wo_id', wo.wo_id);
      }

      // 3) note it on the work order.
      const note = `[CBRE VENDOR APP CONFIRMED] ${whenIso.slice(0, 16).replace('T', ' ')}\n✓ ${label} confirmed by CBRE/Smartsheet`
        + (autoAcked ? `\n\n${autoAcknowledgeNote(whenIso)}` : '');
      const merged = wo.comments ? `${wo.comments}\n\n${note}` : note;
      const { error: cErr } = await supabase.from('work_orders').update({ comments: merged }).eq('wo_id', wo.wo_id);
      if (cErr) result.errors.push(`${woNum}: comment update failed: ${cErr.message}`);

      result.confirmed++;
      result.rows.push({ wo_number: woNum, kind, action: label });
    }

    // ── Declines ────────────────────────────────────────────────────────────
    // Same parse, opposite outcome. A decline is never acted on automatically:
    // the row is marked rejected and the reason written onto the work order, so
    // a person decides what to do instead. Nothing is re-queued.
    const rejections = await fetchRejections(searchDays);
    result.rejectionsScanned = rejections.length;

    for (const e of rejections) {
      const text = bodyText(e);
      const actionVal = field(text, 'Action');
      const woNum = field(text, 'Work Order #');
      if (!actionVal || !woNum) {
        result.rejectionsUnmatched.push(
          dryRun ? `parse-failed · ${parseDiag(e, text)}` : 'parse-failed (Action/WO# not found)'
        );
        continue;
      }

      const kinds = kindsFromActionValue(actionVal);
      if (!kinds.length) { result.rejectionsUnmatched.push(`${woNum}: unknown action "${actionVal}"`); continue; }

      const { data: wo, error: woErr } = await supabase
        .from('work_orders')
        .select('wo_id, wo_number, comments')
        .eq('wo_number', woNum)
        .maybeSingle();
      if (woErr) { result.errors.push(`${woNum}: ${woErr.message}`); continue; }
      if (!wo) { result.rejectionsUnmatched.push(`${woNum}: work order not found`); continue; }

      const { data: rows, error: rErr } = await supabase
        .from('approval_requests')
        .select('approval_id, status, kind, reject_reason')
        .eq('wo_id', wo.wo_id)
        .in('kind', kinds)
        .in('status', ['sent', 'approved'])
        .order('sent_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(1);
      if (rErr) { result.errors.push(`${woNum}: ${rErr.message}`); continue; }
      const row = rows && rows[0];
      if (!row) { result.skipped++; continue; }

      const whenIso = (e.date instanceof Date ? e.date : new Date(e.date)).toISOString();
      const label = ACTIONS[row.kind]?.value || row.kind;

      if (dryRun) {
        result.rejectedRows.push({ wo_number: woNum, kind: row.kind, action: label, would_reject: row.approval_id });
        result.rejected++;
        continue;
      }

      const { error: uErr } = await supabase
        .from('approval_requests')
        .update({
          status: 'rejected',
          decided_at: whenIso,
          reject_reason: row.reject_reason || `Declined by CBRE (${label})`,
        })
        .eq('approval_id', row.approval_id)
        .in('status', ['sent', 'approved']);   // idempotent guard
      if (uErr) { result.errors.push(`${woNum}: ${uErr.message}`); continue; }

      const note = `[CBRE VENDOR APP DECLINED] ${whenIso.slice(0, 16).replace('T', ' ')}\n✗ ${label} was declined by CBRE. Nothing was changed on their side — decide what to send instead.`;
      const merged = wo.comments ? `${wo.comments}\n\n${note}` : note;
      const { error: cErr } = await supabase.from('work_orders').update({ comments: merged }).eq('wo_id', wo.wo_id);
      if (cErr) result.errors.push(`${woNum}: comment update failed: ${cErr.message}`);

      result.rejected++;
      result.rejectedRows.push({ wo_number: woNum, kind: row.kind, action: label });
    }

    return Response.json({
      ...result,
      message: `Confirmed ${result.confirmed} of ${result.scanned} scanned; ${result.rejected} decline(s) of ${result.rejectionsScanned}.`,
    });
  } catch (e) {
    return Response.json({ ...result, error: e.message }, { status: 500 });
  }
}

// Run log (cron_runs) — see lib/cronRun.js. Response is passed through unchanged.
export const GET = (request) => withCronRun('cbre/sync-vendor-confirmations', request, () => GET_impl(request));
export const POST = (request) => withCronRun('cbre/sync-vendor-confirmations', request, () => POST_impl(request));
