// lib/invoiceReadiness.js
// -----------------------------------------------------------------------------
// "May this invoice go out yet?" — one answer for the Invoices page, the
// QuickBooks push and the health digest.
//
// A draft can be complete and correct and still be unbillable, because CBRE is
// not ready for it. Two blockers, both found on the work order:
//
//   nte_pending  An NTE increase request is still pending/submitted at CBRE, or
//                the invoice exceeds the approved NTE. CBRE pays up to the NTE;
//                sending now means the difference is lost. This is what the
//                15 sub work orders of 2026-09-08 are waiting on — they were
//                issued with NTE $350 and carry requests up to $13,843.
//   wo_dead      The work order is cancelled/posted at CBRE or sits in an open
//                dispute, so there is nothing there to invoice against. The
//                office is chasing a sub work order (or UPS) first.
//
// An invoice that already has a QuickBooks number is never blocked — it is out.
// Pure; the caller passes the invoice with its work order (see INVOICE_WO_SELECT).
// -----------------------------------------------------------------------------
import { calcTotal } from './billing';

// The work_orders columns the check needs, for the page's invoice query.
export const INVOICE_WO_SELECT = `wo_id, wo_number, status, nte, cbre_nte, cbre_status,
  dispute_status, dispute_sub_wo, client_type, include_admin_hours,
  hours_regular, hours_overtime, miles, material_cost, emf_equipment_cost, rental_cost, trailer_cost,
  work_order_assignments(hours_regular, hours_overtime, miles),
  daily_hours_log(hours_regular, hours_overtime, miles, tech_material_cost),
  work_order_quotes(quote_id, nte_status, new_nte_amount)`;

export const OPEN_QUOTE_STATES = ['pending', 'submitted'];
// Nothing left to invoice against at CBRE.
export const DEAD_CBRE_STATUSES = ['cancelled', 'CMP', 'CA1', 'CA2', 'CIR', 'CIS'];

export const BLOCKER_LABEL = {
  nte_pending: 'Waiting for CBRE to approve the NTE',
  over_nte:    'Invoice exceeds the approved NTE',
  wo_dead:     'Work order is closed at CBRE',
  dispute:     'Open dispute — sub work order pending',
};

const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const hasQbNumber = (inv) => !!(inv?.qb_invoice_number || inv?.qb_invoice_id || inv?.quickbooks_invoice_id);

/**
 * → { blocked, reason, label, detail } — reason null when it may go out.
 * `wo` defaults to invoice.work_order.
 */
export function invoiceBlocker(invoice, wo = invoice?.work_order) {
  const ok = { blocked: false, reason: null, label: '', detail: '' };
  if (!invoice || hasQbNumber(invoice)) return ok;      // already in QuickBooks
  if (!wo) return ok;

  const openQuote = (wo.work_order_quotes || []).find((q) => OPEN_QUOTE_STATES.includes(q.nte_status));
  if (openQuote) {
    return {
      blocked: true, reason: 'nte_pending', label: BLOCKER_LABEL.nte_pending,
      detail: `NTE request ${money(openQuote.new_nte_amount)} is ${openQuote.nte_status} at CBRE (work order NTE ${money(wo.nte)})`,
    };
  }

  // Approved ceiling: cbre_nte is what CBRE has, nte may include a verbal
  // approval that never reached the portal.
  const ceiling = wo.cbre_nte != null ? parseFloat(wo.cbre_nte) : parseFloat(wo.nte);
  const total = parseFloat(invoice.total) || 0;
  if (Number.isFinite(ceiling) && total > ceiling + 0.01) {
    return {
      blocked: true, reason: 'over_nte', label: BLOCKER_LABEL.over_nte,
      detail: `${money(total)} invoiced against an NTE of ${money(ceiling)} — request an increase first`,
    };
  }

  if (DEAD_CBRE_STATUSES.includes(wo.cbre_status)) {
    return {
      blocked: true, reason: 'wo_dead', label: BLOCKER_LABEL.wo_dead,
      detail: `CBRE status ${wo.cbre_status}${wo.dispute_sub_wo ? ` — bill sub work order ${wo.dispute_sub_wo} instead` : ''}`,
    };
  }

  if (wo.dispute_status && !['resolved', 'written_off'].includes(wo.dispute_status)) {
    return {
      blocked: true, reason: 'dispute', label: BLOCKER_LABEL.dispute,
      detail: `Dispute ${wo.dispute_status}${wo.dispute_sub_wo ? ` — sub work order ${wo.dispute_sub_wo}` : ''}`,
    };
  }

  return ok;
}

/** Accrued cost from the nested rows — for the page's "cost vs invoice" hint. */
export function invoiceAccruedCost(wo) {
  if (!wo) return 0;
  return calcTotal(wo, { assignments: wo.work_order_assignments || [], dailyLogs: wo.daily_hours_log || [] });
}
