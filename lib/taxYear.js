// lib/taxYear.js
// -----------------------------------------------------------------------------
// The year figures behind the portal's tax overview, shared by the Taxes page
// (YearOverview) and the 1040-ES reminder cron so both show the same amount.
// Planning numbers only — not tax advice (see lib/taxEstimate).
//   invoices: the sub's invoices · records: tax records of that year
//   trips: { trips: own trips, emf: [{ work_date, miles }] }
// -----------------------------------------------------------------------------
import { parseDate, daysBetweenET } from './dates';
import { scheduleCLine, NOT_SCHEDULE_C } from './taxRecordCategories';
import { irsRateOn } from './irsMileage';
import { selfEmploymentTax } from './taxEstimate';

export const yearOfET = (ts) => {
  const d = parseDate(ts);
  return d ? Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' }).format(d)) : null;
};
const isVehicleActual = (cat) => scheduleCLine(cat).startsWith('Line 9') && !/standard mileage/.test(scheduleCLine(cat));

export function yearFigures({ invoices = [], records = [], trips = { trips: [], emf: [] }, year, vehicle = 'standard', setAsidePct = 0 }) {
  // Cash basis. With recorded payments (part payments, "Mark as paid"):
  // each payment counts on the day received. Without (older data): the full
  // total on the day it was marked paid, else EMF's payment date, else the
  // end of the billed period.
  const paidDate = (i) => i.paid_at || i.emf_paid_at || i.period_end;
  const clientOf = (i) => (i.client_type === 'other' ? (i.client_name || 'Other client') : 'EMF Contracting LLC');
  const byClient = {};
  const add = (i, v) => { byClient[clientOf(i)] = (byClient[clientOf(i)] || 0) + v; };
  for (const i of invoices) {
    const pays = i.payments || [];
    if (pays.length) {
      for (const pmt of pays) if (yearOfET(pmt.paid_on + 'T12:00:00') === year) add(i, parseFloat(pmt.amount) || 0);
    } else if (i.status === 'paid' && yearOfET(paidDate(i)) === year) {
      add(i, parseFloat(i.grand_total) || 0);
    }
  }
  const income = Object.values(byClient).reduce((s, v) => s + v, 0);
  const open = invoices.filter(i => i.status === 'sent');
  const openTotal = open.reduce((s, i) => s + (parseFloat(i.grand_total) || 0) - (parseFloat(i.amount_paid) || 0), 0);
  const waits = invoices.filter(i => i.status === 'paid' && i.sent_at && i.paid_at)
    .map(i => daysBetweenET(parseDate(i.sent_at), parseDate(i.paid_at))).filter(d => d != null && d >= 0);
  const avgDays = waits.length ? Math.round(waits.reduce((s, d) => s + d, 0) / waits.length) : null;
  const emf1099 = invoices.filter(i => i.client_type !== 'other' && yearOfET(i.emf_paid_at) === year)
    .reduce((s, i) => s + (parseFloat(i.grand_total) || 0), 0);

  let business = 0, personal = 0, vehicleActual = 0;
  for (const r of records) {
    const amt = parseFloat(r.amount) || 0;
    if (scheduleCLine(r.category_name) === NOT_SCHEDULE_C) personal += amt;
    else if (isVehicleActual(r.category_name)) vehicleActual += amt;
    else if (r.category_name !== 'Mileage') business += amt;
  }
  const miles = [...(trips.emf || []).map(r => ({ d: r.work_date, m: parseFloat(r.miles) || 0 })),
    ...(trips.trips || []).map(trip => ({ d: trip.trip_date, m: parseFloat(trip.miles) || 0 }))];
  const mileageValue = miles.reduce((s, x) => s + x.m * (irsRateOn(x.d) || 0), 0);
  const totalMiles = miles.reduce((s, x) => s + x.m, 0);
  const vehicleDeduction = vehicle === 'standard' ? mileageValue : vehicleActual;
  const profit = income - business - vehicleDeduction;
  const se = selfEmploymentTax(profit, year);
  const pct = Math.min(60, Math.max(0, parseFloat(setAsidePct) || 0));
  const incomeSetAside = Math.max(0, profit - se.deductibleHalf) * pct / 100;
  const quarterly = (se.total + incomeSetAside) / 4;
  return { byClient, income, openTotal, openCount: open.length, avgDays, emf1099, business, personal, vehicleActual, mileageValue, totalMiles, vehicleDeduction, profit, se, pct, incomeSetAside, quarterly };
}
