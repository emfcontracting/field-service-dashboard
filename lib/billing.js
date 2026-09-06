// lib/billing.js
// -----------------------------------------------------------------------------
// THE billing arithmetic. One place for the rates and for "what does this work
// order cost", used by the invoice preview/generator, the work-order table,
// the detail modal, CBRE data entry, cash flow, profitability and exports.
// Before this file the same numbers lived in twelve copies that had drifted:
// some always billed 2 admin hours, some none, some ignored technician
// material or daily-log hours.
//
// Rules (decided 2026-09-06):
//   • Labor: RT $64/h, OT $96/h.
//   • Admin hours: lib/clientType.getEffectiveAdminHours — UPS and
//     unclassified WOs 2 h, CBRE 0 h, per-WO override work_orders.include_admin_hours.
//   • Mileage $1.00/mile, no markup.
//   • Materials (EMF material_cost + technician tech_material_cost from the
//     daily log), equipment, trailer, rental: +25 %.
//   • Hours/miles = work_orders.hours_* (legacy primary) + work_order_assignments
//     (legacy team) + daily_hours_log (where hours live today).
//   • A quote with billing_mode 'fixed' replaces the actual lines — see
//     quoteService.getFixedQuoteForInvoice / buildFixedQuoteLineItems.
//
// Everything here is pure: pass the rows in, get numbers out. Rounding to
// cents happens once, in round2(), at the edges that display or store.
// -----------------------------------------------------------------------------
import { getEffectiveAdminHours } from './clientType';

export const RATES = Object.freeze({
  RT: 64,
  OT: 96,
  MILEAGE: 1.0,
  MARKUP: 1.25,        // 25 % on materials / equipment / trailer / rental
  ADMIN_HOURS: 2,      // default admin hours where the client policy grants them
});

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => parseFloat(v) || 0;

/**
 * Hours, miles and technician material for a work order from all three
 * sources. `assignments` = work_order_assignments rows, `dailyLogs` =
 * daily_hours_log rows (both optional, both may be partial selects).
 */
export function sumHours(workOrder = {}, assignments = [], dailyLogs = []) {
  const primary = { rt: num(workOrder.hours_regular), ot: num(workOrder.hours_overtime), miles: num(workOrder.miles) };
  const team = { rt: 0, ot: 0, miles: 0 };
  for (const m of assignments || []) { team.rt += num(m.hours_regular); team.ot += num(m.hours_overtime); team.miles += num(m.miles); }
  const daily = { rt: 0, ot: 0, miles: 0, techMaterial: 0 };
  for (const l of dailyLogs || []) { daily.rt += num(l.hours_regular); daily.ot += num(l.hours_overtime); daily.miles += num(l.miles); daily.techMaterial += num(l.tech_material_cost); }
  return {
    rt: primary.rt + team.rt + daily.rt,
    ot: primary.ot + team.ot + daily.ot,
    miles: primary.miles + team.miles + daily.miles,
    techMaterial: daily.techMaterial,
    primary, team, daily,
  };
}

/**
 * Full cost breakdown for a work order (T&M / "actual" billing).
 *
 *   const c = calcBillable(wo, { assignments, dailyLogs });
 *   c.total            // grand total before tax
 *   c.labor.admin      // admin fee actually applied (0 for CBRE by default)
 *
 * Pass `hours` (from sumHours or the table's total_hours_* columns) instead of
 * rows when the sums are already known.
 */
export function calcBillable(workOrder = {}, { assignments = [], dailyLogs = [], hours = null, techMaterial = null } = {}) {
  const h = hours || sumHours(workOrder, assignments, dailyLogs);
  const techMat = techMaterial != null ? num(techMaterial) : num(h.techMaterial);
  const adminHours = getEffectiveAdminHours(workOrder, RATES.ADMIN_HOURS);

  const labor = {
    rt: h.rt * RATES.RT,
    ot: h.ot * RATES.OT,
    admin: adminHours * RATES.RT,
  };
  labor.total = labor.rt + labor.ot + labor.admin;

  const mileage = h.miles * RATES.MILEAGE;
  const materials = { emf: num(workOrder.material_cost), tech: techMat };
  materials.base = materials.emf + materials.tech;
  materials.total = materials.base * RATES.MARKUP;
  const equipment = { base: num(workOrder.emf_equipment_cost) }; equipment.total = equipment.base * RATES.MARKUP;
  const trailer = { base: num(workOrder.trailer_cost) };       trailer.total = trailer.base * RATES.MARKUP;
  const rental = { base: num(workOrder.rental_cost) };         rental.total = rental.base * RATES.MARKUP;

  const subtotal = labor.total + mileage + materials.total + equipment.total + trailer.total + rental.total;
  return {
    hours: { rt: h.rt, ot: h.ot, miles: h.miles },
    adminHours,
    labor, mileage, materials, equipment, trailer, rental,
    subtotal,
    total: subtotal,          // tax is 0 today; kept separate so it can change in one place
    tax: 0,
  };
}

/** Grand total only — for tables and lists. */
export function calcTotal(workOrder, opts) {
  return calcBillable(workOrder, opts).total;
}

/**
 * Invoice line items for actual (T&M) billing — the exact wording the
 * invoice preview, generator and PDF have always used.
 */
export function buildActualLineItems(calc) {
  const items = [];
  const { hours, adminHours, labor, mileage, materials, equipment, trailer, rental } = calc;
  if (hours.rt > 0) items.push({ description: `Labor – Regular Time (${hours.rt} hrs @ $${RATES.RT}/hr)`, quantity: hours.rt, unit_price: RATES.RT, amount: labor.rt, line_type: 'labor' });
  if (hours.ot > 0) items.push({ description: `Labor – Overtime (${hours.ot} hrs @ $${RATES.OT}/hr)`, quantity: hours.ot, unit_price: RATES.OT, amount: labor.ot, line_type: 'labor' });
  if (adminHours > 0) items.push({ description: `Administrative Hours (${adminHours} hrs @ $${RATES.RT}/hr)`, quantity: adminHours, unit_price: RATES.RT, amount: labor.admin, line_type: 'labor' });
  if (hours.miles > 0) items.push({ description: `Mileage (${hours.miles} miles @ $${RATES.MILEAGE.toFixed(2)}/mile)`, quantity: hours.miles, unit_price: RATES.MILEAGE, amount: mileage, line_type: 'mileage' });
  if (materials.base > 0) items.push({ description: 'Materials', quantity: 1, unit_price: materials.total, amount: materials.total, line_type: 'material' });
  if (equipment.base > 0) items.push({ description: 'Equipment', quantity: 1, unit_price: equipment.total, amount: equipment.total, line_type: 'equipment' });
  if (trailer.base > 0) items.push({ description: 'Trailer', quantity: 1, unit_price: trailer.total, amount: trailer.total, line_type: 'equipment' });
  if (rental.base > 0) items.push({ description: 'Rental', quantity: 1, unit_price: rental.total, amount: rental.total, line_type: 'rental' });
  return items;
}

/**
 * Estimate for a written quote: N techs × hours, plus costs with markup, plus
 * the client's admin hours. Mirrors calcBillable so an estimate and the
 * eventual invoice agree line by line.
 */
export function calcEstimate(workOrder = {}, { techs = 1, rtHours = 0, otHours = 0, miles = 0, materials = 0, equipment = 0, rental = 0, trailer = 0 } = {}) {
  const t = Math.max(1, parseInt(techs, 10) || 1);
  const hours = { rt: num(rtHours) * t, ot: num(otHours) * t, miles: num(miles) };
  const base = { ...workOrder, material_cost: num(materials), emf_equipment_cost: num(equipment), rental_cost: num(rental), trailer_cost: num(trailer) };
  return calcBillable(base, { hours: { ...hours, techMaterial: 0 } });
}
