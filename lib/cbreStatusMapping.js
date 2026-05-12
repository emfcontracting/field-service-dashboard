// lib/cbreStatusMapping.js
// ─────────────────────────────────────────────────────────────────────────────
// CBRE Status Code Mapping
//
// Default mapping based on CBRE Service Insight status codes.
// User can override these in /settings/cbre-mapping (stored in DB).
//
// Confirmed by Daniel (EMF Contracting), May 2026:
//   CMP = Posted, will be paid in 75 days (TRIGGER for payout countdown)
//   Approval workflow: CIS → CIR → CA1 → CA2 → CMP
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_CBRE_MAPPING = {
  // ── Approval Workflow (in order) ───────────────────────────────────────────
  'CIS': {
    label: 'Completed, Invoice Saved',
    target_type: 'invoice',
    target_status: 'draft',
    set_cmp_date: false,
    notes: 'Invoice saved in CBRE but not yet submitted',
  },
  'CIR': {
    label: 'Completed, Invoice Approved',
    target_type: 'invoice',
    target_status: 'accepted',
    set_cmp_date: false,
    notes: 'Invoice approved by CBRE, awaiting approver workflow',
  },
  'CA1': {
    label: 'Completed, Awaiting Approver #1',
    target_type: 'invoice',
    target_status: 'accepted',
    set_cmp_date: false,
    notes: 'Waiting for first approver in CBRE workflow',
  },
  'CA2': {
    label: 'Completed, Awaiting Approver #2',
    target_type: 'invoice',
    target_status: 'accepted',
    set_cmp_date: false,
    notes: 'Waiting for second approver in CBRE workflow',
  },
  'CMP': {
    label: 'Completed/Posted (75 days to payout)',
    target_type: 'invoice',
    target_status: 'accepted',
    set_cmp_date: true,                         // ← important: sets cmp_date if not yet set
    notes: 'Posted by CBRE. Payment expected 75 days from posting date.',
  },

  // ── Exceptions ─────────────────────────────────────────────────────────────
  'CIC': {
    label: 'Completed, Invoice Correction needed',
    target_type: 'invoice',
    target_status: 'rejected',
    set_cmp_date: false,
    notes: 'CBRE requests invoice correction',
  },
  'CPW': {
    label: 'Order closed, waiting paperwork',
    target_type: 'pending_invoice',             // ← special: WO is closed but no invoice yet
    target_status: 'completed',
    set_cmp_date: false,
    notes: 'WO is closed by CBRE but invoice has not been generated yet',
  },
};

// Days from CMP to payment
export const CMP_TO_PAYOUT_DAYS = 75;

// Default invoice date estimate (used when no CMP date yet)
export const DEFAULT_PAYOUT_DAYS = 90;

// ─────────────────────────────────────────────────────────────────────────────
// Parse the raw CBRE status string from the sheet.
// Examples:
//   "CIR - Completed, Invoice Approved"  →  { code: 'CIR', label: 'Completed, Invoice Approved' }
//   "CMP - Completed/Posted"              →  { code: 'CMP', label: 'Completed/Posted' }
// ─────────────────────────────────────────────────────────────────────────────
export function parseCbreStatus(raw) {
  if (!raw || typeof raw !== 'string') return { code: null, label: null };
  const trimmed = raw.trim();

  // Match "CODE - Label" pattern
  const match = trimmed.match(/^([A-Z][A-Z0-9]{1,4})\s*[-–]\s*(.+)$/);
  if (match) {
    return { code: match[1].toUpperCase(), label: match[2].trim() };
  }

  // Fallback: take the first token as code if it's all uppercase letters
  const firstToken = trimmed.split(/\s/)[0];
  if (/^[A-Z][A-Z0-9]{1,4}$/.test(firstToken)) {
    return { code: firstToken.toUpperCase(), label: trimmed };
  }

  return { code: null, label: trimmed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge defaults with DB overrides
// Returns a single mapping object that the sync tool uses
// ─────────────────────────────────────────────────────────────────────────────
export function buildEffectiveMapping(dbOverrides = []) {
  const effective = {};

  // Start with defaults
  for (const [code, def] of Object.entries(DEFAULT_CBRE_MAPPING)) {
    effective[code] = { ...def, code, source: 'default' };
  }

  // Apply overrides (only if active)
  for (const override of dbOverrides) {
    if (!override.is_active) continue;
    const code = override.cbre_code?.toUpperCase();
    if (!code) continue;
    effective[code] = {
      label: override.cbre_label || effective[code]?.label || code,
      target_type: override.target_type,
      target_status: override.target_status,
      set_cmp_date: override.set_cmp_date || false,
      notes: override.notes || effective[code]?.notes || '',
      code,
      source: 'override',
    };
  }

  return effective;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compute payout date for an invoice
// - If cmp_date exists → cmp_date + 75 days (CONFIRMED)
// - Otherwise → invoice_date + configured days (ESTIMATE, default 90)
// Returns { date, source } where source is 'confirmed' or 'estimate'
// ─────────────────────────────────────────────────────────────────────────────
export function computePayoutDate(invoice, defaultDays = DEFAULT_PAYOUT_DAYS) {
  if (invoice?.cmp_date) {
    const d = new Date(invoice.cmp_date);
    d.setDate(d.getDate() + CMP_TO_PAYOUT_DAYS);
    return { date: d, source: 'confirmed', daysFromBase: CMP_TO_PAYOUT_DAYS };
  }
  if (invoice?.invoice_date) {
    const d = new Date(invoice.invoice_date);
    d.setDate(d.getDate() + defaultDays);
    return { date: d, source: 'estimate', daysFromBase: defaultDays };
  }
  return { date: null, source: 'none', daysFromBase: 0 };
}
