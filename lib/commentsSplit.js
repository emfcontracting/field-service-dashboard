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

// Bracket tags the system writes: ALL CAPS words, no digits. e.g. [MIGRATED],
// [PHOTOS OVERRIDE], [CBRE QUOTE_APPROVED], [CBRE VENDOR APP CONFIRMED].
const SYSTEM_TAG = /^\[[A-Z][A-Z _]*\]/;

// Events appended by check-in / check-out / mark-complete, EN + ES, with any
// trailing "(GPS: …)", "[PENDING SYNC]" or "[SYNCED]" markers.
const SYSTEM_EVENT =
  /\s-\s*(✓\s*CHECKED IN|⏸\s*CHECKED OUT|✅\s*MARKED COMPLETE|✓\s*ENTRADA|⏸\s*SALIDA|✅\s*MARCADO COMPLETO)\b/i;

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
  const first = String(entry).trim().split('\n')[0].trim();
  if (SYSTEM_TAG.test(first)) return true;
  if (SYSTEM_EVENT.test(first)) return true;
  return false;
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
