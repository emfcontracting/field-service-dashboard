// lib/imap.js
// -----------------------------------------------------------------------------
// THE IMAP access for FSM. One connect, one search+fetch+parse, one flag
// writer — used by the dispatch import, e-mail sync, vendor confirmations,
// invoice/payment mails, photo/receipt/write-up verification and the backend
// health check. Before this file each of those ten routes carried its own
// copy of the ~80-line connect/openBox/search/fetch/simpleParser dance, and
// they had drifted (string vs Buffer bodies, html-first vs text-first, one
// connection per flag write …).
//
// Accounts (env):
//   import  EMAIL_IMPORT_USER / EMAIL_IMPORT_PASSWORD  — wo.emfcontractingsc@gmail.com.
//           Its read/unread state is LOAD-BEARING for the dispatch import:
//           never mark anything read there except through the import itself.
//   main    INVOICE_EMAIL_USER / INVOICE_EMAIL_PASSWORD (fallback: import) —
//           emfcontractingsc@gmail.com: QuickBooks invoice + Coupa payment mails.
//   photos  SMTP_USER / SMTP_PASSWORD — the mailbox technicians send photos,
//           receipts and write-ups to.
//
// Everything is promise-based and always ends the connection, also on error
// and on timeout. Nothing here marks mail as read unless you call addFlags.
// -----------------------------------------------------------------------------
import Imap from 'imap';
import { simpleParser } from 'mailparser';

const HOST = 'imap.gmail.com';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const ACCOUNTS = {
  import: () => ({ user: process.env.EMAIL_IMPORT_USER, password: process.env.EMAIL_IMPORT_PASSWORD }),
  main:   () => ({ user: process.env.INVOICE_EMAIL_USER || process.env.EMAIL_IMPORT_USER, password: process.env.INVOICE_EMAIL_PASSWORD || process.env.EMAIL_IMPORT_PASSWORD }),
  photos: () => ({ user: process.env.SMTP_USER, password: process.env.SMTP_PASSWORD }),
};

export function imapCredentials(account = 'import') {
  if (account && typeof account === 'object') return account;      // explicit { user, password }
  const get = ACCOUNTS[account];
  if (!get) throw new Error(`unknown IMAP account "${account}"`);
  const c = get();
  if (!c.user || !c.password) throw new Error(`IMAP credentials not configured (${account})`);
  return c;
}

/** "05-Jan-2026" — the only date format IMAP SEARCH accepts. */
export function fmtImapDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
}
/** ['SINCE', 'DD-MMM-YYYY'] for N days back. */
export function sinceDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return ['SINCE', fmtImapDate(d)];
}
/** ['BEFORE', 'DD-MMM-YYYY'] for N days back. */
export function beforeDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return ['BEFORE', fmtImapDate(d)];
}

export function connectIMAP(account = 'import', { authTimeout, connTimeout } = {}) {
  const { user, password } = imapCredentials(account);
  return new Imap({
    user, password,
    host: HOST, port: 993, tls: true,
    tlsOptions: { servername: HOST },
    ...(authTimeout ? { authTimeout } : {}),
    ...(connTimeout ? { connTimeout } : {}),
  });
}

/**
 * Open a connection, run `fn(imap)` once it is ready, always end it.
 * Resolves with fn's result; rejects on connection error, fn error, or after
 * `timeoutMs` (0 = none).
 */
export function withImap(account, fn, { timeoutMs = 0, authTimeout, connTimeout } = {}) {
  return new Promise((resolve, reject) => {
    let imap;
    try { imap = connectIMAP(account, { authTimeout, connTimeout }); } catch (e) { return reject(e); }
    let settled = false;
    const end = () => { try { imap.end(); } catch { /* already closed */ } };
    const done = (err, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      end();
      err ? reject(err) : resolve(value);
    };
    const timer = timeoutMs > 0 ? setTimeout(() => done(new Error(`IMAP timed out after ${timeoutMs} ms`)), timeoutMs) : null;

    imap.once('ready', () => {
      Promise.resolve()
        .then(() => fn(imap))
        .then((v) => done(null, v), (e) => done(e));
    });
    imap.on('error', (err) => done(err));
    imap.connect();
  });
}

export const openBox = (imap, name = 'INBOX', readOnly = true) =>
  new Promise((resolve, reject) => imap.openBox(name, readOnly, (err, box) => (err ? reject(new Error(`Could not open ${name}: ${err.message}`)) : resolve(box))));

export const search = (imap, criteria) =>
  new Promise((resolve, reject) => imap.search(criteria, (err, uids) => (err ? reject(err) : resolve(uids || []))));

/**
 * Fetch raw messages for `uids` → [{ uid, seqno, flags, attrs, raw:Buffer }].
 * `bodies` '' = whole message; 'HEADER.FIELDS (SUBJECT DATE)' = headers only.
 */
export function fetchRaw(imap, uids, { bodies = '', markSeen = false, struct = false } = {}) {
  return new Promise((resolve, reject) => {
    if (!uids || !uids.length) return resolve([]);
    const out = [];
    const f = imap.fetch(uids, { bodies, markSeen, struct });
    f.on('message', (msg, seqno) => {
      const chunks = [];
      let attrs = {};
      msg.on('body', (stream) => stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c))));
      msg.once('attributes', (a) => { attrs = a || {}; });
      msg.once('end', () => out.push({ uid: attrs.uid, seqno, flags: attrs.flags || [], attrs, raw: Buffer.concat(chunks) }));
    });
    f.once('error', reject);
    f.once('end', () => resolve(out));
  });
}

/** mailparser on a raw message; null instead of throwing (one bad mail must not sink a run). */
export async function parseMail(raw) {
  try { return await simpleParser(raw); }
  catch (e) { console.error('[imap] parse error:', e.message); return null; }
}

/**
 * The shape every route works with.
 *   body: html-first (`bodyPreference: 'html'`, default — the CBRE dispatch
 *   mails are HTML tables) or text-first ('text' — remittances, confirmations).
 */
export function summarize(parsed, { uid, flags = [], withAttachments = false, bodyPreference = 'html' } = {}) {
  const text = parsed?.text || '';
  const html = parsed?.html || '';
  const textAsHtml = parsed?.textAsHtml || '';
  return {
    uid,
    seen: flags.includes('\\Seen'),
    flags,
    subject: parsed?.subject || '',
    from: parsed?.from?.text || '',
    to: parsed?.to?.text || '',
    date: parsed?.date || new Date(),
    text, html, textAsHtml,
    body: bodyPreference === 'text' ? (text || html) : (html || textAsHtml || text),
    attachments: withAttachments ? (parsed?.attachments || []) : [],
  };
}

/**
 * Search + fetch + parse in one go.
 *
 *   const { messages, box } = await fetchMessages({
 *     account: 'import', box: 'INBOX', criteria: ['UNSEEN', sinceDays(7)],
 *   });
 *
 * Options: readOnly (default true — open read-only unless flags will be
 * written), limit + newestFirst (cap on UIDs), bodies (see fetchRaw),
 * withAttachments, bodyPreference, timeoutMs, fallback ({ box, criteria })
 * used when `box` cannot be opened (missing Gmail label → INBOX + FROM).
 */
export async function fetchMessages({
  account = 'import', box = 'INBOX', criteria = ['ALL'], readOnly = true,
  limit = 0, newestFirst = false, bodies = '', withAttachments = false,
  bodyPreference = 'html', timeoutMs = 0, fallback = null, authTimeout, connTimeout,
} = {}) {
  return withImap(account, async (imap) => {
    let usedBox = box;
    let usedCriteria = criteria;
    try {
      await openBox(imap, box, readOnly);
    } catch (e) {
      if (!fallback) throw e;
      usedBox = fallback.box || 'INBOX';
      usedCriteria = fallback.criteria || criteria;
      await openBox(imap, usedBox, readOnly);
    }
    let uids = await search(imap, usedCriteria);
    if (newestFirst) uids = [...uids].sort((a, b) => b - a);
    if (limit > 0) uids = uids.slice(0, limit);
    if (!uids.length) return { messages: [], box: usedBox, uids: [] };
    const raws = await fetchRaw(imap, uids, { bodies });
    const messages = [];
    for (const r of raws) {
      const parsed = await parseMail(r.raw);
      if (!parsed) continue;
      messages.push(summarize(parsed, { uid: r.uid, flags: r.flags, withAttachments, bodyPreference }));
    }
    return { messages, box: usedBox, uids };
  }, { timeoutMs, authTimeout, connTimeout });
}

/** Add IMAP flags (default \Seen) to UIDs in one connection. */
export function addFlags({ account = 'import', box = 'INBOX', uids, flags = ['\\Seen'] }) {
  const list = (Array.isArray(uids) ? uids : [uids]).filter((u) => u != null);
  if (!list.length) return Promise.resolve(0);
  return withImap(account, async (imap) => {
    await openBox(imap, box, false);
    await new Promise((resolve, reject) => imap.addFlags(list, flags, (err) => (err ? reject(err) : resolve())));
    return list.length;
  });
}

/** Connection probe for the health check. Never throws. */
export async function checkConnection({ account = 'import', timeoutMs = 10000 } = {}) {
  try {
    await withImap(account, async () => true, { timeoutMs });
    return { ok: true, error: null };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Photo / receipt / write-up verification: find mails in the technicians'
 * mailbox whose subject contains one of `terms` AND `contains` (the WO number).
 * Never throws — returns { found, emails:[{subject, from, date}], error } so the
 * verify routes can answer "not found" instead of 500 when Gmail is slow.
 */
export async function findMailsBySubject({ account = 'photos', box = 'INBOX', terms = [], contains = '', timeoutMs = 12000 } = {}) {
  const results = { found: false, emails: [], error: null };
  try {
    await withImap(account, async (imap) => {
      await openBox(imap, box, true);
      const sets = await Promise.all(terms.map((t) => search(imap, [['SUBJECT', t]]).catch(() => [])));
      const uids = [...new Set(sets.flat())];
      if (!uids.length) return;
      const raws = await fetchRaw(imap, uids, { bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)' });
      const needle = String(contains || '').toUpperCase();
      for (const r of raws) {
        const parsed = await parseMail(r.raw);
        const subject = parsed?.subject || '';
        if (needle && !subject.toUpperCase().includes(needle)) continue;
        results.emails.push({ subject, from: parsed?.from?.text || '', date: parsed?.date ? parsed.date.toISOString() : '' });
        results.found = true;
      }
    }, { timeoutMs, authTimeout: 8000, connTimeout: 8000 });
  } catch (e) {
    results.error = e.message;
  }
  return results;
}
