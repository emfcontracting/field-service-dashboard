// lib/irsMileage.js
// -----------------------------------------------------------------------------
// IRS standard mileage rate for BUSINESS use, by date range (cents → dollars).
// 2026 changed mid-year: 72.5¢ Jan 1–Jun 30 (Notice 2026-10), 76¢ from Jul 1
// (Announcement 2026-11 / IR-2026-29). Source: irs.gov "Standard mileage
// rates" (checked 2026-11-26). Add a row when the IRS announces a new rate.
// -----------------------------------------------------------------------------
export const IRS_BUSINESS_RATES = [
  { from: '2026-07-01', to: '2026-12-31', rate: 0.76,  source: 'IR-2026-29' },
  { from: '2026-01-01', to: '2026-06-30', rate: 0.725, source: 'IR-2025-128' },
  { from: '2025-01-01', to: '2025-12-31', rate: 0.70,  source: 'IR-2024-312' },
  { from: '2024-01-01', to: '2024-12-31', rate: 0.67,  source: 'IRS 2024' },
  { from: '2023-01-01', to: '2023-12-31', rate: 0.655, source: 'IRS 2023' },
];

/** Rate for a YYYY-MM-DD date; null when no rate is on file (e.g. a new year). */
export function irsRateOn(day) {
  const d = String(day || '').slice(0, 10);
  const row = IRS_BUSINESS_RATES.find((r) => d >= r.from && d <= r.to);
  return row ? row.rate : null;
}

/** Rates that apply within a year, for display ("72.5¢ Jan–Jun, 76¢ Jul–Dec"). */
export function irsRatesForYear(year) {
  return IRS_BUSINESS_RATES.filter((r) => r.from.startsWith(String(year))).sort((a, b) => (a.from < b.from ? -1 : 1));
}
