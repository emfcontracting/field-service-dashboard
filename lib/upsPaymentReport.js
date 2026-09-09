// lib/upsPaymentReport.js
// ─────────────────────────────────────────────────────────────────────────────
// Parse the UPS/Corpay payment report ("Payment Search.xlsx") that UPS BaSE
// sends out of the procurement tool, and reconcile it against our invoices.
//
// The report has no work order column. The number is inside Invoice Description:
//
//   CBR1-C3127491_144015_144015 - UPS - CONVEYOR/SORTING EQUIPMENT-...
//   C3117828_144014_144014 - UPS - ...
//   CBR1-P3082574_311022_CONTRACTED CONVEYOR SERVICES-QUARTERLY ...
//
// so the CBR1- prefix and the trailing cost centres have to be stepped over.
// Note the underscore: it is a word character, so a trailing \b never fires
// after the digits — the number has to be closed with (?!\d) instead. That one
// detail silently reduced a 340-row file to 3 matches on the first attempt.
// ─────────────────────────────────────────────────────────────────────────────

export const WO_IN_DESCRIPTION = /(?<![A-Z0-9])(B|C|P|PJ|ST|COU)(\d{6,8})(?!\d)/i;

// Header → field. Matched case-insensitively on the trimmed header text; UPS
// truncates some headers in the export ("Invoice Pay Group Lookup Cod").
const COLUMNS = {
  'invoice number':        'ups_invoice_ref',
  'invoice description':   'description',
  'invoice amount':        'invoice_amount',
  'invoice date':          'invoice_date',
  'amount paid':           'amount',
  'check number':          'check_number',
  'check date':            'check_date',
  'check status':          'check_status',
  'payment status code':   'payment_status',
  'vendor name':           'vendor',
};

export const REQUIRED_COLUMNS = ['invoice description', 'amount paid', 'check number', 'check date'];

const asText = (v) => (v == null ? '' : String(v).trim());

function asDate(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);   // 8/21/2026
  if (us) return `${us[3]}-${String(us[1]).padStart(2, '0')}-${String(us[2]).padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

const asAmount = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
};

export function extractWoNumber(description) {
  const m = WO_IN_DESCRIPTION.exec(String(description || ''));
  return m ? (m[1] + m[2]).toUpperCase() : null;
}

/**
 * rows: array-of-arrays, first row the header (XLSX.utils.sheet_to_json(..., {header:1})).
 * Returns { payments, problems, checks } — payments carry a wo_number or a
 * reason why they have none.
 */
export function parsePaymentReport(rows) {
  const problems = [];
  if (!rows?.length) return { payments: [], problems: ['The file is empty'], checks: [] };

  const header = (rows[0] || []).map((h) => asText(h).toLowerCase());
  const idx = {};
  header.forEach((h, i) => { if (COLUMNS[h] !== undefined) idx[COLUMNS[h]] = i; });

  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    return { payments: [], checks: [], problems: [`This does not look like a UPS payment report — missing column(s): ${missing.join(', ')}`] };
  }

  const payments = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const ref = asText(row[idx.ups_invoice_ref]);
    const description = asText(row[idx.description]);
    if (!ref && !description) continue;                    // trailing blank row

    const amount = asAmount(row[idx.amount]);
    const wo_number = extractWoNumber(description);
    payments.push({
      row: r + 1,
      wo_number,
      ups_invoice_ref: ref,
      description,
      amount,
      invoice_amount: asAmount(row[idx.invoice_amount]),
      invoice_date: asDate(row[idx.invoice_date]),
      check_number: asText(row[idx.check_number]),
      check_date: asDate(row[idx.check_date]),
      check_status: asText(row[idx.check_status]),
      payment_status: asText(row[idx.payment_status]),
      vendor: asText(row[idx.vendor]),
      problem: !wo_number ? 'no work order number in the description'
             : !Number.isFinite(amount) ? 'no amount paid'
             : null,
    });
  }

  const byCheck = new Map();
  for (const p of payments) {
    const key = `${p.check_number}|${p.check_date}`;
    const c = byCheck.get(key) || { check_number: p.check_number, check_date: p.check_date, rows: 0, total: 0 };
    c.rows += 1; c.total += p.amount || 0;
    byCheck.set(key, c);
  }

  return {
    payments,
    problems,
    checks: [...byCheck.values()].sort((a, b) => String(a.check_date).localeCompare(String(b.check_date))),
  };
}

export const PAYMENT_OUTCOME = {
  to_mark:    { label: 'To mark as paid',   tone: 'emerald', hint: 'invoice found, not marked paid yet' },
  short_pay:  { label: 'Short pay',         tone: 'amber',   hint: 'less arrived than we billed' },
  over_pay:   { label: 'Paid over',         tone: 'amber',   hint: 'more arrived than we billed' },
  already:    { label: 'Already recorded',  tone: 'slate',   hint: 'nothing to change' },
  backfill:   { label: 'Cheque missing',    tone: 'sky',     hint: 'already paid, but we never recorded which cheque' },
  no_invoice: { label: 'No invoice in FSM', tone: 'red',     hint: 'paid, but we have no invoice for it' },
  no_wo:      { label: 'Work order unknown', tone: 'red',    hint: 'the number is not in FSM' },
  unreadable: { label: 'Could not read',    tone: 'red',     hint: 'no work order number or no amount in the row' },
};

/**
 * Match parsed payments against what FSM has.
 * invoiceByWo: { [wo_number]: { invoice_id, invoice_number, total, status, paid_at, paid_amount } | null }
 * A work order present in FSM without an invoice maps to null; one missing
 * entirely is simply absent from the map.
 */
export function reconcilePayments(payments, invoiceByWo) {
  return payments.map((p) => {
    if (p.problem) return { ...p, outcome: 'unreadable', detail: p.problem };
    if (!(p.wo_number in invoiceByWo)) return { ...p, outcome: 'no_wo', detail: `${p.wo_number} is not in FSM` };

    const inv = invoiceByWo[p.wo_number];
    if (!inv) return { ...p, outcome: 'no_invoice', detail: `${p.wo_number} has no invoice in FSM` };

    const billed = parseFloat(inv.total) || 0;
    const diff = (p.amount || 0) - billed;
    const already = inv.status === 'paid' || !!inv.paid_at;

    if (already && inv.paid_amount != null) {
      return { ...p, invoice: inv, billed, diff, outcome: 'already', detail: `${inv.invoice_number} already recorded` };
    }
    // Paid, but from a source that never carried a cheque number (the Coupa
    // flag, a manual tick). Filling that in later is the only way to answer
    // "which cheque paid this" — status and paid_at are left alone.
    if (already) {
      return { ...p, invoice: inv, billed, diff, outcome: 'backfill',
               detail: `${inv.invoice_number} paid ${inv.paid_at || '?'} — adding cheque ${p.check_number}` };
    }
    if (Math.abs(diff) > 0.01) {
      return { ...p, invoice: inv, billed, diff,
               outcome: diff < 0 ? 'short_pay' : 'over_pay',
               detail: `billed ${billed.toFixed(2)}, paid ${(p.amount || 0).toFixed(2)}` };
    }
    return { ...p, invoice: inv, billed, diff,
             outcome: already ? 'already' : 'to_mark',
             detail: already ? `${inv.invoice_number} already paid` : inv.invoice_number };
  });
}

// Short and over pays are applied too — the amount is what actually arrived,
// and hiding the difference is how a short pay goes unnoticed. Only rows we
// could not resolve at all are left out.
export const APPLICABLE_OUTCOMES = ['to_mark', 'short_pay', 'over_pay', 'backfill'];

// A backfill must not move an invoice's status or payment date — only add the
// cheque detail that was never recorded.
export const isBackfillOnly = (outcome) => outcome === 'backfill';

export function paymentSummary(reconciled) {
  const by = {};
  for (const r of reconciled) {
    const b = by[r.outcome] || (by[r.outcome] = { count: 0, total: 0 });
    b.count += 1; b.total += r.amount || 0;
  }
  return by;
}
