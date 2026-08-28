// lib/commentsSplit.js
// ─────────────────────────────────────────────────────────────────────────────
// SPLITS the historic work_orders.comments log into two streams:
//
//   comments  — what a PERSON wrote   → work_orders.tech_comments  (invoices!)
//   notes     — what the SYSTEM wrote → work_orders.comments       (activity log)
//
// One shared classifier so the backfill and the app agree exactly. The log is a
// text blob of entries separated by blank lines:
//
//   [4/13/2026, 3:34:23 PM] Stephen Jordan - ✓ CHECKED IN        <- system
//   [4/13/2026, 4:38:43 PM] Stephen: replaced the belt            <- comment
//   [CBRE QUOTE_APPROVED] ...multi-line...                        <- system
//
// UNKNOWN entries count as COMMENTS on purpose: that matches what invoices did
// before (they only stripped check-in/out lines), so nothing a tech wrote can
// silently disappear from a bill.
// ─────────────────────────────────────────────────────────────────────────────

// Everything the system writes into the log. Collected from the actual writers
// (email-import, email-sync, check-in/out, verify-*, returnToTech, CBRE sync) —
// see claude/comments-notes-split-feature.md. Missing one here would put system
// text on an invoice, so this list is deliberately explicit.

// Markers that identify the CBRE import header block anywhere in the entry.
// The header is built with single \n and always carries one of these, so it is
// recognised as a whole even though its lines look like "Label: value".
const IMPORT_MARKER = /(\[(Auto-)?Imported from CBRE\b|📞\s*CBRE Contacts)/i;

// Patterns tested against the entry's FIRST line.
const SYSTEM_FIRST_LINE = [
  /^\[[A-Z][A-Z0-9 _]*\]/,                                            // [MIGRATED] [PHOTOS OVERRIDE] [CBRE QUOTE_APPROVED]
  /^\[CBRE\b/i,                                                        // [CBRE X — IGNORED, …] / — NOT APPLIED
  /^\[PM\b/i,                                                          // [PM - Preventive Maintenance]
  /^(Address|Location|Contact Phone|Target Completion|Asset Tag):\s/i,  // import header, first line
  /\s-\s*[✓✔]\s*(CHECKED IN|ENTRADA)\b/i,                             // both check marks are in use
  /\s-\s*[⏸⏹]\s*(CHECKED OUT|SALIDA)\b/i,
  /\s-\s*✅\s*(MARKED COMPLETE|MARCADO COMPLETO|WORK ORDER COMPLETED)\b/i,
  /🔄\s*RETURNED FROM INVOICING/i,
  // Flag lifecycle notes: "[ts] Name — 🚩 FLAGGED MISSING DATA", 🔵 FLAGGED FOR
  // STATUS UPDATE, 💤 SNOOZED …, ✅ MARKED … AS FIXED / RESOLVED … / FOLLOWED UP.
  // Shape is "[timestamp] Name — <emoji> …" (em dash, no colon) — only system
  // writers produce it, tech comments are "[timestamp] Name: text".
  /^\[[^\]]+\]\s+[^:\n]+\s—\s*(🚩|🔵|✅|💤)/u,
];

// Split the blob into entries, keeping each entry's internal line breaks.
export function splitEntries(text) {
  if (!text) return [];
  return String(text)
    .split(/\n\s*\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// True when this entry was written by the system, not by a person.
export function isSystemEntry(entry) {
  if (!entry) return false;
  const text = String(entry);
  if (IMPORT_MARKER.test(text)) return true;          // whole CBRE import header
  const first = text.trim().split('\n')[0].trim();
  return SYSTEM_FIRST_LINE.some((re) => re.test(first));
}

// blob -> { comments, notes } — both plain text blobs in the original order.
export function splitCommentLog(text) {
  const comments = [];
  const notes = [];
  for (const entry of splitEntries(text)) {
    (isSystemEntry(entry) ? notes : comments).push(entry);
  }
  return { comments: comments.join('\n\n'), notes: notes.join('\n\n') };
}

// Human-written entries only, as text. Used for invoices and the CBRE dialog.
export function commentsOnly(text) {
  return splitCommentLog(text).comments;
}

// The value invoices should bill from: the dedicated field when present, else
// the human part of the legacy log (so old work orders keep working).
export function billableComments(wo) {
  if (!wo) return '';
  const dedicated = (wo.tech_comments || '').trim();
  if (dedicated) return dedicated;
  return commentsOnly(wo.comments) || commentsOnly(wo.comments_english) || '';
}
