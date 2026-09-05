// app/api/invoice-payments/cron/route.js
// ─────────────────────────────────────────────────────────────────────────────
// QuickBooks ↔ FSM invoice linking + CBRE payment tracking, both driven by
// email (no QuickBooks API needed):
//
// Phase A — QB invoice emails (Gmail label "invoice-sent", sender
//   quickbooks@notification.intuit.com, subject "Invoice <n> from EMF
//   Contracting LLC"). The mail BODY carries no WO number — it lives in the
//   attached invoice PDF. We extract the PDF text (zlib inflate + Tj/TJ
//   harvesting, no external dependency) and link the QB invoice number to
//   every WO found in it: work_orders.qb_invoice_number + the WO's latest
//   FSM invoice row. Combined invoices (several WOs on one QB invoice) get
//   the same number on each WO.
//
// Phase B — Coupa paid emails (sender do_not_reply@cbre.coupahost.com,
//   subject "Invoice #<n>_UPS marked as Paid by CBRE"). Matched via the QB
//   number from Phase A: invoices.status='paid' + paid_at=mail date, plus a
//   comment marker on the WO. Reads the Gmail label "invoice-paid" when it
//   exists (filter recommended), otherwise searches INBOX by sender.
//
// Params: ?days=35 (search window), ?beforeDays=0 (window end, for chunked
// backfills), ?phase=qb|paid (default both), ?dryRun=true, ?manual=true
// (same CRON_SECRET guard as email-sync).
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from '@supabase/supabase-js';
import Imap from 'imap';
import { simpleParser } from 'mailparser';
import zlib from 'zlib';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function connectIMAP() {
  // This route reads the MAIN mailbox (emfcontractingsc@gmail.com): the QB
  // invoice mails and the Coupa paid mails only arrive there. EMAIL_IMPORT_*
  // points at the wo.@ import mailbox (whose read-status is load-bearing for
  // the dispatch import), so use dedicated credentials with a fallback.
  // NOTE: this route never marks anything as read, in any mailbox.
  const email = process.env.INVOICE_EMAIL_USER || process.env.EMAIL_IMPORT_USER;
  const password = process.env.INVOICE_EMAIL_PASSWORD || process.env.EMAIL_IMPORT_PASSWORD;
  if (!email || !password) throw new Error('IMAP credentials not configured');
  return new Imap({
    user: email,
    password,
    host: 'imap.gmail.com',
    port: 993,
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  });
}

const formatIMAPDate = (date) => {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${date.getDate().toString().padStart(2, '0')}-${months[date.getMonth()]}-${date.getFullYear()}`;
};

// Fetch emails from an IMAP folder (or INBOX filtered by sender when the
// folder doesn't exist). withAttachments keeps PDF buffers.
function fetchEmails({ folder, fromFilter, searchDays, beforeDays, withAttachments }) {
  return new Promise((resolve, reject) => {
    const imap = connectIMAP();
    const emails = [];
    let usedFolder = folder;

    const run = (boxName, criteria) => {
      imap.openBox(boxName, true, (err) => {
        if (err) {
          if (boxName !== 'INBOX' && fromFilter) {
            // Folder missing (label not created / no filter yet) → INBOX scan.
            usedFolder = 'INBOX';
            return run('INBOX', [...criteria, ['FROM', fromFilter]]);
          }
          imap.end();
          return reject(new Error(`Could not open ${boxName}: ${err.message}`));
        }
        imap.search(criteria, (err, results) => {
          if (err) { imap.end(); return reject(err); }
          if (!results || results.length === 0) { imap.end(); return resolve({ emails, usedFolder }); }
          const fetch = imap.fetch(results, { bodies: '', markSeen: false });
          const parsePromises = [];
          fetch.on('message', (msg) => {
            let buffer = Buffer.alloc(0);
            let uid;
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => { buffer = Buffer.concat([buffer, chunk]); });
            });
            msg.once('attributes', (attrs) => { uid = attrs.uid; });
            msg.once('end', () => {
              parsePromises.push(new Promise((done) => {
                simpleParser(buffer, (err, parsed) => {
                  if (!err && parsed) {
                    emails.push({
                      uid,
                      subject: parsed.subject || '',
                      from: parsed.from?.text || '',
                      date: parsed.date || new Date(),
                      body: parsed.text || parsed.html || '',
                      attachments: withAttachments ? (parsed.attachments || []) : [],
                    });
                  }
                  done();
                });
              }));
            });
          });
          fetch.once('error', (err) => { imap.end(); reject(err); });
          fetch.once('end', async () => {
            await Promise.all(parsePromises);
            imap.end();
            resolve({ emails, usedFolder });
          });
        });
      });
    };

    imap.once('ready', () => {
      const since = new Date();
      since.setDate(since.getDate() - searchDays);
      const criteria = [['SINCE', formatIMAPDate(since)]];
      if (beforeDays > 0) {
        const before = new Date();
        before.setDate(before.getDate() - beforeDays);
        criteria.push(['BEFORE', formatIMAPDate(before)]);
      }
      run(folder, criteria);
    });
    imap.once('error', reject);
    imap.connect();
  });
}

// Minimal PDF text extraction: inflate every stream, harvest (..)Tj / [..]TJ
// text-showing strings. Good enough for machine-generated QuickBooks PDFs.
function extractPdfText(buf) {
  let raw = '';
  let idx = 0;
  while (true) {
    const s = buf.indexOf('stream', idx);
    if (s === -1) break;
    let start = s + 6;
    if (buf[start] === 0x0d) start++;
    if (buf[start] === 0x0a) start++;
    const e = buf.indexOf('endstream', start);
    if (e === -1) break;
    try { raw += zlib.inflateSync(buf.slice(start, e)).toString('latin1'); } catch { /* not a text stream */ }
    idx = e + 9;
  }
  const lines = [];
  const re = /\((?:\\.|[^\\)])*\)\s*Tj|\[(?:[^\]]*)\]\s*TJ/g;
  let m;
  while ((m = re.exec(raw))) {
    const strs = m[0].match(/\((?:\\.|[^\\)])*\)/g) || [];
    lines.push(strs.map((x) => x.slice(1, -1).replace(/\\([()\\])/g, '$1')).join(''));
  }
  return lines.join('\n');
}

const extractWoNumbers = (text) => [...new Set((text.match(/\b(?:[A-Z]{1,2})?\d{7,}\b/g) || [])
  .filter((n) => /^[A-Z]/.test(n) || n.length >= 7))]
  .filter((n) => /^(?:[A-Z]{1,2})\d{7,}$/.test(n));

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      if (searchParams.get('manual') !== 'true') {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const searchDays = parseInt(searchParams.get('days')) || 35;
    const beforeDays = parseInt(searchParams.get('beforeDays')) || 0;
    const phase = searchParams.get('phase') || 'both';
    const dryRun = searchParams.get('dryRun') === 'true';

    const results = {
      qb: { processed: 0, linkedWOs: 0, linkedInvoices: 0, skipped: 0, notFound: [], noWoInPdf: [], errors: [] },
      paid: { processed: 0, invoicesPaid: 0, wosAnnotated: 0, alreadyPaid: 0, unmatched: [], errors: [], source: null },
      dryRun, searchDays, beforeDays,
    };

    // ── Phase A: QB invoice mails → link QB number to WOs + invoices ────────
    if (phase === 'both' || phase === 'qb') {
      try {
        const { emails } = await fetchEmails({
          folder: 'invoice-sent',
          fromFilter: 'quickbooks@notification.intuit.com',
          searchDays, beforeDays, withAttachments: true,
        });
        // Oldest first so a WO re-invoiced later ends up with the newest number.
        emails.sort((a, b) => new Date(a.date) - new Date(b.date));

        for (const mail of emails) {
          const subjMatch = (mail.subject || '').match(/Invoice\s+(\d+)\s+from\s+EMF/i);
          if (!subjMatch) continue;
          results.qb.processed++;
          const qbNumber = subjMatch[1];

          const pdf = (mail.attachments || []).find((a) =>
            (a.contentType || '').includes('pdf') || /\.pdf$/i.test(a.filename || ''));
          if (!pdf || !pdf.content) { results.qb.noWoInPdf.push(`${qbNumber} (no PDF)`); continue; }

          let woNumbers = [];
          try { woNumbers = extractWoNumbers(extractPdfText(pdf.content)); }
          catch (e) { results.qb.errors.push(`PDF parse failed for QB #${qbNumber}: ${e.message}`); continue; }
          if (woNumbers.length === 0) { results.qb.noWoInPdf.push(qbNumber); continue; }

          for (const woNumber of woNumbers) {
            const { data: wo } = await supabase
              .from('work_orders')
              .select('wo_id, wo_number, qb_invoice_number')
              .eq('wo_number', woNumber)
              .single();
            if (!wo) { results.qb.notFound.push(`${woNumber} (QB #${qbNumber})`); continue; }

            if (wo.qb_invoice_number === qbNumber) { results.qb.skipped++; }
            else if (!dryRun) {
              const { error } = await supabase
                .from('work_orders')
                .update({ qb_invoice_number: qbNumber })
                .eq('wo_id', wo.wo_id);
              if (error) { results.qb.errors.push(`WO ${woNumber}: ${error.message}`); continue; }
              results.qb.linkedWOs++;
            } else { results.qb.linkedWOs++; }

            // Latest FSM invoice for this WO carries the QB number too.
            const { data: inv } = await supabase
              .from('invoices')
              .select('invoice_id, qb_invoice_number')
              .eq('wo_id', wo.wo_id)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            if (inv && inv.qb_invoice_number !== qbNumber && !dryRun) {
              const { error } = await supabase
                .from('invoices')
                .update({ qb_invoice_number: qbNumber })
                .eq('invoice_id', inv.invoice_id);
              if (!error) results.qb.linkedInvoices++;
            } else if (inv && inv.qb_invoice_number !== qbNumber) {
              results.qb.linkedInvoices++;
            }
          }
        }
      } catch (e) {
        results.qb.errors.push(e.message);
      }
    }

    // ── Phase B: Coupa "marked as Paid" mails → paid_at ─────────────────────
    if (phase === 'both' || phase === 'paid') {
      try {
        const { emails, usedFolder } = await fetchEmails({
          folder: 'invoice-paid',
          fromFilter: 'cbre.coupahost.com',
          searchDays, beforeDays, withAttachments: false,
        });
        results.paid.source = usedFolder;

        // Newest mail per QB number wins. Two Coupa mail types:
        // "marked as Paid" (final) and "is Approved to Pay" (intermediate).
        const paidMap = {};
        const approvedMap = {};
        for (const mail of emails) {
          const subj = mail.subject || '';
          const paidM = subj.match(/Invoice\s+#?(\d+)(?:_[A-Za-z]+)?\s+marked\s+as\s+Paid/i);
          const apprM = subj.match(/Invoice\s+#?(\d+)(?:_[A-Za-z]+)?\s+is\s+Approved\s+to\s+Pay/i);
          if (paidM) {
            results.paid.processed++;
            const qbNumber = paidM[1];
            if (!paidMap[qbNumber] || new Date(mail.date) > new Date(paidMap[qbNumber].date)) {
              paidMap[qbNumber] = mail;
            }
          } else if (apprM) {
            results.paid.approvedToPayProcessed = (results.paid.approvedToPayProcessed || 0) + 1;
            const qbNumber = apprM[1];
            if (!approvedMap[qbNumber] || new Date(mail.date) > new Date(approvedMap[qbNumber].date)) {
              approvedMap[qbNumber] = mail;
            }
          }
        }

        // Approved-to-Pay: timestamp only (status stays), idempotent WO note.
        for (const [qbNumber, mail] of Object.entries(approvedMap)) {
          const approvedAt = new Date(mail.date).toISOString();
          const { data: invs } = await supabase
            .from('invoices')
            .select('invoice_id, approved_to_pay_at')
            .eq('qb_invoice_number', qbNumber);
          for (const inv of invs || []) {
            if (inv.approved_to_pay_at) continue;
            if (!dryRun) {
              await supabase
                .from('invoices')
                .update({ approved_to_pay_at: approvedAt })
                .eq('invoice_id', inv.invoice_id);
            }
            results.paid.approvedToPay = (results.paid.approvedToPay || 0) + 1;
          }
          const { data: wos } = await supabase
            .from('work_orders')
            .select('wo_id, wo_number, comments')
            .eq('qb_invoice_number', qbNumber);
          for (const wo of wos || []) {
            const marker = `[QB Invoice #${qbNumber} APPROVED TO PAY by CBRE`;
            if ((wo.comments || '').includes(marker)) continue;
            if (!dryRun) {
              const ts = new Date(mail.date).toLocaleDateString('en-US', { timeZone: 'America/New_York' });
              const note = `${marker} — ${ts}]`;
              const merged = wo.comments ? `${wo.comments}\n\n${note}` : note;
              await supabase.from('work_orders').update({ comments: merged }).eq('wo_id', wo.wo_id);
            }
          }
        }

        for (const [qbNumber, mail] of Object.entries(paidMap)) {
          const paidAt = new Date(mail.date).toISOString();

          const { data: invs } = await supabase
            .from('invoices')
            .select('invoice_id, status, paid_at')
            .eq('qb_invoice_number', qbNumber);
          const { data: wos } = await supabase
            .from('work_orders')
            .select('wo_id, wo_number, comments')
            .eq('qb_invoice_number', qbNumber);

          if ((!invs || invs.length === 0) && (!wos || wos.length === 0)) {
            // Not linked (yet) — Phase A hasn't seen this QB number. The mail
            // stays in the window, so the next run retries automatically.
            results.paid.unmatched.push(qbNumber);
            continue;
          }

          for (const inv of invs || []) {
            if (inv.status === 'paid' && inv.paid_at) { results.paid.alreadyPaid++; continue; }
            if (!dryRun) {
              const { error } = await supabase
                .from('invoices')
                .update({ status: 'paid', paid_at: paidAt })
                .eq('invoice_id', inv.invoice_id);
              if (error) { results.paid.errors.push(`Invoice ${inv.invoice_id}: ${error.message}`); continue; }
            }
            results.paid.invoicesPaid++;
          }

          for (const wo of wos || []) {
            const marker = `[QB Invoice #${qbNumber} marked PAID by CBRE`;
            if ((wo.comments || '').includes(marker)) continue;
            if (!dryRun) {
              const ts = new Date(mail.date).toLocaleDateString('en-US', { timeZone: 'America/New_York' });
              const note = `${marker} — ${ts}]`;
              const merged = wo.comments ? `${wo.comments}\n\n${note}` : note;
              const { error } = await supabase
                .from('work_orders')
                .update({ comments: merged })
                .eq('wo_id', wo.wo_id);
              if (error) { results.paid.errors.push(`WO ${wo.wo_number}: ${error.message}`); continue; }
            }
            results.paid.wosAnnotated++;
          }
        }
      } catch (e) {
        results.paid.errors.push(e.message);
      }
    }

    return Response.json({
      success: true,
      message: `QB: ${results.qb.processed} mails, ${results.qb.linkedWOs} WOs + ${results.qb.linkedInvoices} invoices linked. Paid: ${results.paid.processed} mails, ${results.paid.invoicesPaid} invoices marked paid, ${results.paid.unmatched.length} unmatched.`,
      ...results,
    });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
