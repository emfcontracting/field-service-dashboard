// lib/taxEstimate.js
// -----------------------------------------------------------------------------
// Rough self-employment figures for the portal's year overview — an
// estimate for planning, NOT tax advice. Sources (checked 2026-11-26):
//   Social Security wage base: SSA "Contribution and benefit bases"
//     2025 $176,100 · 2026 $184,500; SE rates 12.4% OASDI + 2.9% HI
//   Net earnings from SE = 92.35% of net profit (Schedule SE)
//   1099-NEC threshold: $600 for payments through 2025, $2,000 from 2026
//     (OBBBA §70433; indexed for inflation from 2027)
//   1040-ES due dates 2026: Apr 15, Jun 15, Sep 15 2026, Jan 15 2027 (irs.gov)
// Not included: income tax (depends on filing status, deductions, other
// income), the 0.9% additional Medicare tax over $200k, state tax.
// -----------------------------------------------------------------------------
export const SS_WAGE_BASE = { 2024: 168600, 2025: 176100, 2026: 184500 };
export const NEC_THRESHOLD = (year) => (Number(year) >= 2026 ? 2000 : 600);
export const ESTIMATED_TAX_DUE = {
  2026: ['2026-04-15', '2026-06-15', '2026-09-15', '2027-01-15'],
};

export function selfEmploymentTax(netProfit, year) {
  const profit = Math.max(0, Number(netProfit) || 0);
  const base = SS_WAGE_BASE[year] ?? SS_WAGE_BASE[Math.max(...Object.keys(SS_WAGE_BASE).map(Number))];
  const netEarnings = profit * 0.9235;
  if (netEarnings < 400) return { netEarnings, ss: 0, medicare: 0, total: 0, deductibleHalf: 0, base };
  const ss = Math.min(netEarnings, base) * 0.124;
  const medicare = netEarnings * 0.029;
  const total = ss + medicare;
  return { netEarnings, ss, medicare, total, deductibleHalf: total / 2, base };
}
