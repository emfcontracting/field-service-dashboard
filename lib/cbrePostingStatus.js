// lib/cbrePostingStatus.js
// ─────────────────────────────────────────────────────────────────────────────
// CBRE POSTING STATUS — the CBRE-side processing chain AFTER a tech completes
// the work. This is SEPARATE from `cbre_status` (which is for active tickets:
// escalation, quote_approved, pending_quote, etc.).
//
// This status lives in work_orders.cbre_posting_status and is populated by the
// weekly CBRE Sync sheet upload. It only applies once a WO has been completed
// by the tech (status 'completed' or 'acknowledged' / is_locked).
//
// Chain order (corrected by Daniel, EMF Contracting, Sep 2026 — the approvers
// come BEFORE the invoice-approved stage):
//   CPW → CIS → CA1 → CA2 → CIR → CMP
//   The 75-day payout clock starts when CIR or CMP first shows, whichever
//   comes first (Daniel, Sep 2026). cmp_date stores that anchor.
//
// CIA is NOT a step in that chain — it is the siding an invoice gets shunted
// onto. From the Supplier Training Guide: "If you submit your invoice before
// submitting your checklist to the Smartsheet, your invoice will be rejected and
// go into CIA audit status." Getting out of it is a manual act: put the
// checklist in the Smartsheet, then tell UPSPMISupport@cbre.com so the invoice
// is routed back for approval. Nothing moves on its own, which is exactly why
// an unrecognised CIA was dangerous — the invoice would sit there looking like
// an unknown code while the 90-day billing window ran out.
// ─────────────────────────────────────────────────────────────────────────────

export const CBRE_POSTING_STATUS = {
  CPW: {
    label: 'Order closed, waiting paperwork',
    short: 'CPW',
    emoji: '📂',
    step: 1,
    badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    dot: 'bg-orange-400',
  },
  CIS: {
    label: 'Completed, Invoice Saved',
    short: 'CIS',
    emoji: '💾',
    step: 2,
    badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    dot: 'bg-yellow-400',
  },
  CIR: {
    label: 'Completed, Invoice Approved',
    short: 'CIR',
    emoji: '📝',
    step: 5,
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-400',
  },
  CA1: {
    label: 'Completed, Awaiting Approver #1',
    short: 'CA1',
    emoji: '①',
    step: 3,
    badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    dot: 'bg-purple-400',
  },
  CA2: {
    label: 'Completed, Awaiting Approver #2',
    short: 'CA2',
    emoji: '②',
    step: 4,
    badge: 'bg-purple-500/15 text-purple-300 border-purple-500/40',
    dot: 'bg-purple-300',
  },
  CMP: {
    label: 'Completed / Posted (75 days to payout)',
    short: 'CMP',
    emoji: '✅',
    step: 6,
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  // Off the chain — see the header. step:null keeps it out of every ordered
  // rendering; the tracks show it as a flag beside the chain instead.
  CIA: {
    label: 'Invoice rejected into audit — PMI paperwork missing',
    short: 'CIA',
    emoji: '🛑',
    step: null,
    offPath: true,
    action: 'Put the PMI checklist in the Smartsheet, then e-mail UPSPMISupport@cbre.com so the invoice is routed back for approval.',
    badge: 'bg-red-500/15 text-red-400 border-red-500/30',
    dot: 'bg-red-400',
  },
};

// Where an off-path code proves the work order got to. An invoice can only be
// rejected into audit after it was submitted, so CIA implies CIS.
export const CBRE_POSTING_OFF_PATH = { CIA: 'CIS' };

// Who to notify to get an invoice out of CIA.
export const PMI_SUPPORT_EMAIL = 'UPSPMISupport@cbre.com';

// Ordered list of codes (chain order) — useful for progress display
export const CBRE_POSTING_ORDER = ['CPW', 'CIS', 'CA1', 'CA2', 'CIR', 'CMP'];

// All recognized posting codes (for the sync to know which codes belong here).
// Includes the off-path ones — recognising CIA is the whole point.
export const CBRE_POSTING_CODES = Object.keys(CBRE_POSTING_STATUS);

/** A posting code that stops the invoice rather than advancing it. */
export function isPostingOffPath(code) {
  if (!code) return false;
  return !!CBRE_POSTING_STATUS[String(code).toUpperCase().trim()]?.offPath;
}

/** What a human has to do to clear this code, or null when nothing is stuck. */
export function postingAction(code) {
  if (!code) return null;
  return CBRE_POSTING_STATUS[String(code).toUpperCase().trim()]?.action || null;
}

// Days from the payout-clock anchor (first CIR/CMP) to payment
export const CMP_TO_PAYOUT_DAYS = 75;

// Posting codes whose presence means the payout clock is running.
// CA1/CA2 come BEFORE CIR in the chain — the clock has not started there.
export const PAYOUT_CLOCK_CODES = ['CIR', 'CMP'];

// ─────────────────────────────────────────────────────────────────────────────
// Is this a known posting code?
// ─────────────────────────────────────────────────────────────────────────────
export function isPostingCode(code) {
  if (!code) return false;
  return CBRE_POSTING_CODES.includes(String(code).toUpperCase().trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse a raw CBRE status string from the sheet into { code, label }.
// Examples:
//   "CIR - Completed, Invoice Approved"  → { code: 'CIR', label: 'Completed, Invoice Approved' }
//   "CMP - Completed/Posted"             → { code: 'CMP', label: 'Completed/Posted' }
// ─────────────────────────────────────────────────────────────────────────────
export function parsePostingStatus(raw) {
  if (!raw || typeof raw !== 'string') return { code: null, label: null };
  const trimmed = raw.trim();
  const match = trimmed.match(/^([A-Z][A-Z0-9]{1,4})\s*[-–]\s*(.+)$/);
  if (match) {
    return { code: match[1].toUpperCase(), label: match[2].trim() };
  }
  const firstToken = trimmed.split(/\s/)[0];
  if (/^[A-Z][A-Z0-9]{1,4}$/.test(firstToken)) {
    return { code: firstToken.toUpperCase(), label: trimmed };
  }
  return { code: null, label: trimmed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge config lookup (safe fallback for unknown codes)
// ─────────────────────────────────────────────────────────────────────────────
export function postingBadgeConfig(code) {
  if (!code) return null;
  return CBRE_POSTING_STATUS[String(code).toUpperCase().trim()] || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compute estimated payout date once the payout clock is running (CIR or
// later). Anchor: cmp_date (set at first CIR/CMP), falling back to the last
// posting-status change for legacy rows without one.
// Returns { date, daysRemaining } or null if not applicable.
// ─────────────────────────────────────────────────────────────────────────────
export function computePostingPayoutDate(wo) {
  if (!wo) return null;
  const code = String(wo.cbre_posting_status || '').toUpperCase().trim();
  if (!PAYOUT_CLOCK_CODES.includes(code)) return null;
  const baseRaw = wo.cmp_date || wo.cbre_posting_updated_at;
  if (!baseRaw) return null;
  const base = new Date(baseRaw);
  if (isNaN(base.getTime())) return null;
  const date = new Date(base);
  date.setDate(date.getDate() + CMP_TO_PAYOUT_DAYS);
  const daysRemaining = Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24));
  return { date, daysRemaining };
}
