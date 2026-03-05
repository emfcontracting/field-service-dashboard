// app/dashboard/components/ProfitabilityTab.js
// -----------------------------------------------------------------------------
// ADMIN-ONLY: Shows real profit breakdown for a single work order
// Revenue (Sell Price) = CBRE billing rates ($64/$96 + markups)
// Cost    (Cost Price) = actual tech wages + material purchase price
// Profit               = Sell Price - Cost Price
// -----------------------------------------------------------------------------
'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

const fmt = (n) => `$${(n || 0).toFixed(2)}`;
const pct = (profit, revenue) => revenue > 0 ? ((profit / revenue) * 100).toFixed(1) + '%' : '-';

const Row = ({ label, costPrice, sellPrice, profit, highlight }) => (
  <div className={`grid grid-cols-4 gap-2 py-2 px-3 rounded-lg text-sm ${highlight ? 'bg-[#1e1e2e]' : ''}`}>
    <span className="text-slate-400 col-span-1">{label}</span>
    <span className="text-right text-slate-300">{fmt(costPrice)}</span>
    <span className="text-right text-slate-300">{fmt(sellPrice)}</span>
    <span className={`text-right font-semibold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(profit)}</span>
  </div>
);

const StatCard = ({ label, value, sub, color = 'blue' }) => {
  const colors = {
    blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    red:     'bg-red-500/10 border-red-500/20 text-red-400',
    orange:  'bg-orange-500/10 border-orange-500/20 text-orange-400',
  };
  return (
    <div className={`border rounded-xl p-4 ${colors[color]}`}>
      <div className="text-xs uppercase tracking-wider opacity-70 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-60 mt-1">{sub}</div>}
    </div>
  );
};

export default function ProfitabilityTab({ workOrder, dailyHoursLog, dailyTotals }) {
  const [wages, setWages] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadWages();
  }, []);

  const loadWages = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/wages', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!res.ok) throw new Error('Failed to load wages');
      const json = await res.json();

      const lookup = {};
      (json.data || []).forEach(w => {
        lookup[w.user_id] = {
          rt: parseFloat(w.hourly_rate_regular) || 0,
          ot: parseFloat(w.hourly_rate_overtime) || 0,
          name: `${w.user?.first_name || ''} ${w.user?.last_name || ''}`.trim(),
        };
      });
      setWages(lookup);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Billing rates (what CBRE pays us)
  const BILLING_RT  = 64;
  const BILLING_OT  = 96;
  const MARKUP      = 1.25;
  const MILES_RATE  = 1.00;
  const ADMIN_HOURS = 2;

  // Aggregate hours
  const legacyRT    = parseFloat(workOrder.hours_regular) || 0;
  const legacyOT    = parseFloat(workOrder.hours_overtime) || 0;
  const legacyMiles = parseFloat(workOrder.miles) || 0;
  let legacyTeamRT = 0, legacyTeamOT = 0, legacyTeamMiles = 0;
  (workOrder.teamMembers || []).forEach(m => {
    legacyTeamRT    += parseFloat(m.hours_regular) || 0;
    legacyTeamOT    += parseFloat(m.hours_overtime) || 0;
    legacyTeamMiles += parseFloat(m.miles) || 0;
  });

  const totalRT    = legacyRT + legacyTeamRT + (dailyTotals?.totalRT || 0);
  const totalOT    = legacyOT + legacyTeamOT + (dailyTotals?.totalOT || 0);
  const totalMiles = legacyMiles + legacyTeamMiles + (dailyTotals?.totalMiles || 0);
  const techMaterialBase = dailyTotals?.totalTechMaterial || 0;

  // Sell Price (revenue) calculations
  const laborSellPrice     = (totalRT * BILLING_RT) + (totalOT * BILLING_OT) + (ADMIN_HOURS * BILLING_RT);
  const materialBase       = (parseFloat(workOrder.material_cost) || 0) + techMaterialBase;
  const materialSellPrice  = materialBase * MARKUP;
  const equipmentBase      = parseFloat(workOrder.emf_equipment_cost) || 0;
  const equipmentSellPrice = equipmentBase * MARKUP;
  const trailerBase        = parseFloat(workOrder.trailer_cost) || 0;
  const trailerSellPrice   = trailerBase * MARKUP;
  const rentalBase         = parseFloat(workOrder.rental_cost) || 0;
  const rentalSellPrice    = rentalBase * MARKUP;
  const mileageSellPrice   = totalMiles * MILES_RATE;
  const totalSellPrice     = laborSellPrice + materialSellPrice + equipmentSellPrice + trailerSellPrice + rentalSellPrice + mileageSellPrice;

  // Cost Price (what EMF actually pays) calculations
  const hoursByUser = {};
  (dailyHoursLog || []).forEach(entry => {
    if (!hoursByUser[entry.user_id]) {
      hoursByUser[entry.user_id] = {
        rt: 0, ot: 0,
        name: `${entry.user?.first_name || ''} ${entry.user?.last_name || ''}`.trim()
      };
    }
    hoursByUser[entry.user_id].rt += parseFloat(entry.hours_regular) || 0;
    hoursByUser[entry.user_id].ot += parseFloat(entry.hours_overtime) || 0;
  });

  let totalLaborCost = 0;
  let laborCostDetailed = [];

  Object.entries(hoursByUser).forEach(([userId, hours]) => {
    const wage = wages[userId] || { rt: 0, ot: 0, name: hours.name };
    const cost = (hours.rt * wage.rt) + (hours.ot * wage.ot);
    const sell = (hours.rt * BILLING_RT) + (hours.ot * BILLING_OT);
    totalLaborCost += cost;
    laborCostDetailed.push({
      name: wage.name || hours.name || 'Unknown',
      rt: hours.rt,
      ot: hours.ot,
      wageRT: wage.rt,
      wageOT: wage.ot,
      cost,
      sell,
      profit: sell - cost,
      hasWage: wage.rt > 0 || wage.ot > 0,
    });
  });

  const hasDetailedData = laborCostDetailed.length > 0;
  const missingWages    = laborCostDetailed.filter(t => !t.hasWage);

  const totalCostPrice = totalLaborCost + materialBase + equipmentBase + trailerBase + rentalBase;
  const totalProfit    = totalSellPrice - totalCostPrice;
  const margin         = pct(totalProfit, totalSellPrice);

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
      <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      Loading profitability data...
    </div>
  );

  if (error) return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm">
      Warning: {error} - Make sure you have admin access.
    </div>
  );

  return (
    <div className="space-y-5">

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Sell Price"  value={fmt(totalSellPrice)}  sub="Billed to CBRE"   color="blue" />
        <StatCard label="Cost Price"  value={fmt(totalCostPrice)}  sub="What EMF pays"    color="orange" />
        <StatCard
          label="Profit"
          value={fmt(totalProfit)}
          sub={`Margin: ${margin}`}
          color={totalProfit >= 0 ? 'emerald' : 'red'}
        />
        <StatCard
          label="NTE Budget"
          value={fmt(workOrder.nte)}
          sub={totalSellPrice > (workOrder.nte || 0)
            ? 'Exceeds NTE'
            : `${fmt((workOrder.nte || 0) - totalSellPrice)} remaining`}
          color="blue"
        />
      </div>

      {/* Missing wages warning */}
      {missingWages.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 text-yellow-400 text-sm flex items-start gap-2">
          <span>Warning</span>
          <div>
            <strong>Missing wage data for:</strong>{' '}
            {missingWages.map(t => t.name).join(', ')}
            <div className="text-xs mt-1 opacity-70">
              Go to Users and set hourly wages for these techs. Labor cost shown as $0 for them.
            </div>
          </div>
        </div>
      )}

      {/* Cost vs Sell Price Table */}
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">

        {/* Table Header */}
        <div className="grid grid-cols-4 gap-2 py-2 px-3 bg-[#1e1e2e] text-xs uppercase tracking-wider text-slate-500 font-semibold">
          <span>Category</span>
          <span className="text-right">Cost Price</span>
          <span className="text-right">Sell Price</span>
          <span className="text-right">Profit</span>
        </div>

        {/* Labor row */}
        <Row
          label={`Labor (${totalRT.toFixed(1)}h RT + ${totalOT.toFixed(1)}h OT + 2h Admin)`}
          costPrice={totalLaborCost}
          sellPrice={laborSellPrice}
          profit={laborSellPrice - totalLaborCost}
          highlight
        />

        {/* Per-tech breakdown */}
        {hasDetailedData && laborCostDetailed.map((tech, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 py-1.5 px-3 pl-6 text-xs border-t border-[#1e1e2e]/50">
            <span className="text-slate-500">
              &rarr; {tech.name}
              {tech.hasWage
                ? <span className="ml-1 text-slate-600">(${tech.wageRT}/h RT &middot; ${tech.wageOT}/h OT)</span>
                : <span className="ml-1 text-yellow-500"> no wage set</span>
              }
            </span>
            <span className="text-right text-slate-500">{fmt(tech.cost)}</span>
            <span className="text-right text-slate-500">{fmt(tech.sell)}</span>
            <span className={`text-right font-medium ${tech.profit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{fmt(tech.profit)}</span>
          </div>
        ))}

        <div className="border-t border-[#1e1e2e]" />

        <Row
          label={`Materials (cost: ${fmt(materialBase)} / sell: +25%)`}
          costPrice={materialBase}
          sellPrice={materialSellPrice}
          profit={materialSellPrice - materialBase}
        />
        {equipmentBase > 0 && (
          <Row
            label={`Equipment (cost: ${fmt(equipmentBase)} / sell: +25%)`}
            costPrice={equipmentBase}
            sellPrice={equipmentSellPrice}
            profit={equipmentSellPrice - equipmentBase}
            highlight
          />
        )}
        {trailerBase > 0 && (
          <Row
            label={`Trailer (cost: ${fmt(trailerBase)} / sell: +25%)`}
            costPrice={trailerBase}
            sellPrice={trailerSellPrice}
            profit={trailerSellPrice - trailerBase}
          />
        )}
        {rentalBase > 0 && (
          <Row
            label={`Rental (cost: ${fmt(rentalBase)} / sell: +25%)`}
            costPrice={rentalBase}
            sellPrice={rentalSellPrice}
            profit={rentalSellPrice - rentalBase}
            highlight
          />
        )}
        {totalMiles > 0 && (
          <Row
            label={`Mileage (${totalMiles.toFixed(1)} mi x $1.00)`}
            costPrice={0}
            sellPrice={mileageSellPrice}
            profit={mileageSellPrice}
          />
        )}

        {/* Total row */}
        <div className="grid grid-cols-4 gap-2 py-3 px-3 border-t-2 border-[#2d2d44] bg-[#1e1e2e] font-bold text-sm">
          <span className="text-slate-200">TOTAL</span>
          <span className="text-right text-orange-400">{fmt(totalCostPrice)}</span>
          <span className="text-right text-blue-400">{fmt(totalSellPrice)}</span>
          <span className={`text-right text-lg ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(totalProfit)}</span>
        </div>

        {/* Margin bar */}
        <div className="px-3 py-3 border-t border-[#1e1e2e]">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>Profit Margin</span>
            <span className={`font-bold ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{margin}</span>
          </div>
          <div className="w-full bg-[#1e1e2e] rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${totalProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(Math.max(totalSellPrice > 0 ? (totalProfit / totalSellPrice) * 100 : 0, 0), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="text-xs text-slate-600 space-y-0.5 px-1">
        <div><strong className="text-slate-500">Cost Price</strong> = What EMF pays: actual tech wages + purchase price of materials/equipment</div>
        <div><strong className="text-slate-500">Sell Price</strong> = What CBRE pays: $64/h RT, $96/h OT, materials/equipment + 25% markup</div>
        <div><strong className="text-slate-500">Profit</strong> = Sell Price minus Cost Price per category</div>
      </div>
    </div>
  );
}
