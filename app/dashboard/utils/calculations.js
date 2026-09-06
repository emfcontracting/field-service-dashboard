// app/dashboard/utils/calculations.js

import { calcBillable, sumHours, RATES } from '@/lib/billing';

export function calculateStats(orders) {
  return {
    total: orders.length,
    pending: orders.filter(wo => wo.status === 'pending').length,
    assigned: orders.filter(wo => wo.status === 'assigned').length,
    in_progress: orders.filter(wo => wo.status === 'in_progress').length,
    completed: orders.filter(wo => wo.status === 'completed').length,
    return_trip: orders.filter(wo => wo.status === 'return_trip').length,
    needs_return: orders.filter(wo => wo.status === 'needs_return').length,
    rejected: orders.filter(wo => wo.status === 'rejected').length,
    // CBRE status counts (from Gmail labels)
    // escalation is now a separate overlay flag (wo.escalation), not a cbre_status value
    escalation: orders.filter(wo => wo.escalation === true).length,
    quote_approved: orders.filter(wo => wo.cbre_status === 'quote_approved').length,
    quote_rejected: orders.filter(wo => wo.cbre_status === 'quote_rejected').length,
    quote_submitted: orders.filter(wo => wo.cbre_status === 'quote_submitted').length,
    pending_quote: orders.filter(wo => wo.cbre_status === 'pending_quote').length,
    reassigned: orders.filter(wo => wo.cbre_status === 'reassigned').length
  };
}

// Grand total for the work-order table. Uses the combined totals the table
// fetches (total_hours_* / total_miles / total_tech_material) when present,
// legacy WO fields otherwise. Formula: lib/billing.js.
export function calculateTotalCost(wo) {
  const has = (k) => wo[k] !== undefined && wo[k] !== null;
  const hours = {
    rt: has('total_hours_regular') ? Number(wo.total_hours_regular) : (parseFloat(wo.hours_regular) || 0),
    ot: has('total_hours_overtime') ? Number(wo.total_hours_overtime) : (parseFloat(wo.hours_overtime) || 0),
    miles: has('total_miles') ? Number(wo.total_miles) : (parseFloat(wo.miles) || 0),
    techMaterial: has('total_tech_material') ? Number(wo.total_tech_material) : 0,
  };
  return calcBillable(wo, { hours }).total;
}

// Breakdown for the detail modal (legacy shape kept for its callers).
// `teamMembers` = work_order_assignments rows, `dailyLogs` = daily_hours_log rows.
export function calculateInvoiceTotal(wo, teamMembers = [], dailyLogs = []) {
  const c = calcBillable(wo, { assignments: teamMembers, dailyLogs });
  const h = sumHours(wo, teamMembers, dailyLogs);
  const leadRegular = h.primary.rt * RATES.RT;
  const leadOvertime = h.primary.ot * RATES.OT;
  const teamLabor = (h.team.rt + h.daily.rt) * RATES.RT + (h.team.ot + h.daily.ot) * RATES.OT;
  return {
    leadRegular,
    leadOvertime,
    teamLabor,
    adminHours: c.labor.admin,
    totalLabor: c.labor.total,
    materialsBase: c.materials.base,
    materialsWithMarkup: c.materials.total,
    equipmentBase: c.equipment.base,
    equipmentWithMarkup: c.equipment.total,
    trailerBase: c.trailer.base,
    trailerWithMarkup: c.trailer.total,
    rentalBase: c.rental.base,
    rentalWithMarkup: c.rental.total,
    totalMiles: c.hours.miles,
    mileageCost: c.mileage,
    grandTotal: c.total,
    remaining: (wo.nte || 0) - c.total,
    isOverBudget: c.total > (wo.nte || 0) && (wo.nte || 0) > 0
  };
}

export function calculateAge(dateEntered) {
  if (!dateEntered) return 0;
  const entered = new Date(dateEntered);
  const now = new Date();
  const diffTime = Math.abs(now - entered);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
