// app/dashboard/components/ProfitabilityView.js
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-ONLY: Profitability report overview across all work orders
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const fmt  = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct  = (profit, revenue) => revenue > 0 ? ((profit / revenue) * 100).toFixed(1) + '%' : '—';
const BILLING_RT  = 64;
const BILLING_OT  = 96;
const MARKUP      = 1.25;
const ADMIN_HOURS = 2;

// ── Time range presets ────────────────────────────────────────────────────────
const RANGES = [
  { label: '30 Days',  days: 30  },
  { label: '60 Days',  days: 60  },
  { label: '90 Days',  days: 90  },
  { label: 'This Year',days: 365 },
];

function calcProfit(wo, wages, hoursMap) {
  const hours = hoursMap[wo.wo_id] || { rt: 0, ot: 0, miles: 0, techMaterial: 0, byUser: {} };

  // Legacy hours
  const legacyRT    = parseFloat(wo.hours_regular) || 0;
  const legacyOT    = parseFloat(wo.hours_overtime) || 0;
  const legacyMiles = parseFloat(wo.miles) || 0;
  let legacyTeamRT = 0, legacyTeamOT = 0;
  (wo.teamMembers || []).forEach(m => {
    legacyTeamRT += parseFloat(m.hours_regular) || 0;
    legacyTeamOT += parseFloat(m.hours_overtime) || 0;
  });

  const totalRT    = legacyRT + legacyTeamRT + hours.rt;
  const totalOT    = legacyOT + legacyTeamOT + hours.ot;
  const totalMiles = legacyMiles + hours.miles;

  // Sell Price
  const laborRevenue    = (totalRT * BILLING_RT) + (totalOT * BILLING_OT) + (ADMIN_HOURS * BILLING_RT);
  const materialBase    = (parseFloat(wo.material_cost) || 0) + hours.techMaterial;
  const materialRevenue = materialBase * MARKUP;
  const equipmentRevenue = (parseFloat(wo.emf_equipment_cost) || 0) * MARKUP;
  const trailerRevenue   = (parseFloat(wo.trailer_cost) || 0) * MARKUP;
  const rentalRevenue    = (parseFloat(wo.rental_cost) || 0) * MARKUP;
  const mileageRevenue   = totalMiles * 1.0;
  const totalRevenue     = laborRevenue + materialRevenue + equipmentRevenue + trailerRevenue + rentalRevenue + mileageRevenue;

  // Cost Price
  let totalLaborCost   = 0;
  let totalMileageCost = 0;
  Object.entries(hours.byUser).forEach(([userId, h]) => {
    const wage = wages[userId] || { rt: 0, ot: 0, mi: 0.55 };
    totalLaborCost   += (h.rt * wage.rt) + (h.ot * wage.ot);
    totalMileageCost += (h.miles || 0) * (wage.mi || 0.55);
  });
  const totalCost   = totalLaborCost + totalMileageCost + materialBase + (parseFloat(wo.emf_equipment_cost) || 0) + (parseFloat(wo.trailer_cost) || 0) + (parseFloat(wo.rental_cost) || 0);
  const totalProfit = totalRevenue - totalCost;

  return { totalRevenue, totalCost, totalProfit, totalRT, totalOT };
}

export default function ProfitabilityView({ currentUser }) {
  const [workOrders, setWorkOrders] = useState([]);
  const [wages, setWages]           = useState({});   // user_id → { rt, ot }
  const [hoursMap, setHoursMap]     = useState({});   // wo_id → hours data
  const [loading, setLoading]       = useState(true);
  const [rangeDays, setRangeDays]   = useState(30);
  const [sortBy, setSortBy]         = useState('profit');
  const [sortDir, setSortDir]       = useState('desc');
  const [filterStatus, setFilterStatus] = useState('all');
  const [search, setSearch]         = useState('');

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (isAdmin) loadData();
  }, [rangeDays, isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Load wages
      const wagesRes = await fetch('/api/admin/wages', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      const wagesJson = await wagesRes.json();
      const wagesLookup = {};
      (wagesJson.data || []).forEach(w => {
        wagesLookup[w.user_id] = {
          rt: parseFloat(w.hourly_rate_regular)  || 0,
          ot: parseFloat(w.hourly_rate_overtime)  || 0,
          mi: parseFloat(w.mileage_rate)          || 0.55,
        };
      });
      setWages(wagesLookup);

      // Load work orders
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - rangeDays);

      const { data: wos } = await supabaseClient
        .from('work_orders')
        .select(`
          wo_id, wo_number, building, status, nte,
          hours_regular, hours_overtime, miles,
          material_cost, emf_equipment_cost, trailer_cost, rental_cost,
          date_entered, date_completed,
          lead_tech_id,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .gte('date_entered', cutoff.toISOString())
        .order('date_entered', { ascending: false });

      setWorkOrders(wos || []);

      // Load daily hours for all WOs in batch
      const woIds = (wos || []).map(w => w.wo_id);
      if (woIds.length > 0) {
        const { data: allHours } = await supabaseClient
          .from('daily_hours_log')
          .select('wo_id, user_id, hours_regular, hours_overtime, miles, tech_material_cost')
          .in('wo_id', woIds);

        const map = {};
        (allHours || []).forEach(h => {
          if (!map[h.wo_id]) map[h.wo_id] = { rt: 0, ot: 0, miles: 0, techMaterial: 0, byUser: {} };
          map[h.wo_id].rt          += parseFloat(h.hours_regular) || 0;
          map[h.wo_id].ot          += parseFloat(h.hours_overtime) || 0;
          map[h.wo_id].miles       += parseFloat(h.miles) || 0;
          map[h.wo_id].techMaterial+= parseFloat(h.tech_material_cost) || 0;
          if (!map[h.wo_id].byUser[h.user_id]) map[h.wo_id].byUser[h.user_id] = { rt: 0, ot: 0, miles: 0 };
          map[h.wo_id].byUser[h.user_id].rt    += parseFloat(h.hours_regular) || 0;
          map[h.wo_id].byUser[h.user_id].ot    += parseFloat(h.hours_overtime) || 0;
          map[h.wo_id].byUser[h.user_id].miles += parseFloat(h.miles) || 0;
        });
        setHoursMap(map);
      }
    } catch (e) {
      console.error('ProfitabilityView error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Computed rows ─────────────────────────────────────────────────────────
  const rows = workOrders
    .filter(wo => {
      if (filterStatus !== 'all' && wo.status !== filterStatus) return false;
      if (search && !wo.wo_number?.toLowerCase().includes(search.toLowerCase()) &&
          !wo.building?.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .map(wo => ({ wo, ...calcProfit(wo, wages, hoursMap) }))
    .sort((a, b) => {
      const v = sortDir === 'desc' ? -1 : 1;
      if (sortBy === 'profit')  return (a.totalProfit  - b.totalProfit)  * v;
      if (sortBy === 'revenue') return (a.totalRevenue - b.totalRevenue) * v;
      if (sortBy === 'date')    return new Date(a.wo.date_entered) - new Date(b.wo.date_entered) !== 0
        ? (new Date(a.wo.date_entered) - new Date(b.wo.date_entered)) * v : 0;
      return 0;
    });

  // ── Summary totals ────────────────────────────────────────────────────────
  const totals = rows.reduce((acc, r) => ({
    revenue: acc.revenue + r.totalRevenue,
    cost:    acc.cost    + r.totalCost,
    profit:  acc.profit  + r.totalProfit,
  }), { revenue: 0, cost: 0, profit: 0 });

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => sortBy === col
    ? <span className="ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
    : <span className="ml-1 opacity-30">↕</span>;

  const marginColor = (profit, revenue) => {
    if (revenue <= 0) return 'text-slate-500';
    const m = (profit / revenue) * 100;
    if (m >= 40) return 'text-emerald-400';
    if (m >= 20) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (!isAdmin) return (
    <div className="flex items-center justify-center min-h-[60vh] text-red-400">
      🔒 Admin access required
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 p-4 md:p-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">💰 Profitability Report</h1>
          <p className="text-slate-500 text-sm mt-0.5">Cost vs Sell Price — Admin view only</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map(r => (
            <button key={r.days} onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition
                ${rangeDays === r.days
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#1e1e2e] border border-[#2d2d44] text-slate-400 hover:text-slate-200'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Sell Price', value: fmt(totals.revenue), color: 'text-blue-400',    bg: 'bg-blue-500/10 border-blue-500/20'    },
          { label: 'Total Cost Price',     value: fmt(totals.cost),    color: 'text-orange-400',  bg: 'bg-orange-500/10 border-orange-500/20'  },
          { label: 'Total Profit',        value: fmt(totals.profit),  color: totals.profit >= 0 ? 'text-emerald-400' : 'text-red-400',
            bg: totals.profit >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20' },
          { label: 'Avg Margin',          value: pct(totals.profit, totals.revenue),
            color: 'text-slate-200', bg: 'bg-[#1e1e2e] border-[#2d2d44]',
            sub: `${rows.length} work orders` },
        ].map((card, i) => (
          <div key={i} className={`border rounded-xl p-4 ${card.bg}`}>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">{card.label}</div>
            <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
            {card.sub && <div className="text-xs text-slate-600 mt-1">{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search WO# or Building..."
          className="bg-[#0d0d14] border border-[#2d2d44] text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/60 flex-1 min-w-[160px]"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#0d0d14] border border-[#2d2d44] text-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="in_progress">In Progress</option>
          <option value="assigned">Assigned</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
          <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Loading...
        </div>
      ) : (
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-7 gap-2 px-4 py-2.5 bg-[#1e1e2e] text-xs uppercase tracking-wider text-slate-500 font-semibold">
            <button onClick={() => toggleSort('date')} className="text-left hover:text-slate-300 flex items-center col-span-2">
              WO# / Building <SortIcon col="date" />
            </button>
            <span className="text-center">Status</span>
            <span className="text-center">Lead Tech</span>
            <button onClick={() => toggleSort('revenue')} className="text-right hover:text-slate-300 flex items-center justify-end">
              Revenue <SortIcon col="revenue" />
            </button>
            <span className="text-right">Cost Price</span>
            <button onClick={() => toggleSort('profit')} className="text-right hover:text-slate-300 flex items-center justify-end">
              Profit <SortIcon col="profit" />
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="text-center py-12 text-slate-600">No work orders found</div>
          ) : (
            <div className="divide-y divide-[#1e1e2e]">
              {rows.map(({ wo, totalRevenue, totalCost, totalProfit }) => (
                <div key={wo.wo_id} className="grid grid-cols-7 gap-2 px-4 py-3 hover:bg-[#1e1e2e]/50 transition items-center">
                  <div className="col-span-2">
                    <div className="text-blue-400 font-semibold text-sm">{wo.wo_number}</div>
                    <div className="text-slate-500 text-xs truncate">{wo.building}</div>
                  </div>
                  <div className="text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                      ${wo.status === 'completed'   ? 'bg-emerald-500/15 text-emerald-400' :
                        wo.status === 'in_progress' ? 'bg-blue-500/15 text-blue-400' :
                        wo.status === 'pending'     ? 'bg-slate-500/15 text-slate-400' :
                        'bg-orange-500/15 text-orange-400'}`}>
                      {wo.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-slate-400 text-xs text-center truncate">
                    {wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : '—'}
                  </div>
                  <div className="text-right text-blue-400 font-semibold text-sm">{fmt(totalRevenue)}</div>
                  <div className="text-right text-orange-400 text-sm">{fmt(totalCost)}</div>
                  <div className="text-right">
                    <div className={`font-bold text-sm ${totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {fmt(totalProfit)}
                    </div>
                    <div className={`text-xs ${marginColor(totalProfit, totalRevenue)}`}>
                      {pct(totalProfit, totalRevenue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals footer */}
          <div className="grid grid-cols-7 gap-2 px-4 py-3 border-t-2 border-[#2d2d44] bg-[#1e1e2e] font-bold text-sm">
            <span className="col-span-2 text-slate-300">TOTAL ({rows.length} WOs)</span>
            <span></span>
            <span></span>
            <span className="text-right text-blue-400">{fmt(totals.revenue)}</span>
            <span className="text-right text-orange-400">{fmt(totals.cost)}</span>
            <span className={`text-right ${totals.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {fmt(totals.profit)}
              <div className="text-xs font-normal">{pct(totals.profit, totals.revenue)}</div>
            </span>
          </div>
        </div>
      )}

      {/* ── Legend ── */}
      <div className="text-xs text-slate-600 px-1 space-y-0.5">
        <div>• <strong className="text-slate-500">Sell Price</strong> = CBRE billing: $64/h RT · $96/h OT · materials+25% · equipment+25%</div>
        <div>• <strong className="text-slate-500">Cost Price</strong> = Real wages (from Users page) + material purchase price</div>
        <div>• Labor cost shows $0 if wage not set for that tech — go to Users to set wages</div>
      </div>
    </div>
  );
}

