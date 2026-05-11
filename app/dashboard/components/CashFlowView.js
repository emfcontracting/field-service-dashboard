// app/dashboard/components/CashFlowView.js
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-ONLY: Cash Flow forecast — when does which $ come in
//
// Tab 1: Expected Payouts   → invoices in flight (draft/approved/accepted/synced)
//                             grouped by estimated payout date (invoice_date + N days)
// Tab 2: Pending Invoicing  → WOs ready to invoice but not yet invoiced
//                             ("money on the table — clock not running yet")
// Tab 3: Open Tickets       → WOs still in progress (NTE ceiling + running total)
//
// Payout days configurable via localStorage (default 90 days)
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Constants ────────────────────────────────────────────────────────────────
const BILLING_RT  = 64;
const BILLING_OT  = 96;
const MARKUP      = 1.25;
const ADMIN_HOURS = 2;
const MILEAGE_RATE = 1.0;

const DEFAULT_PAYOUT_DAYS = 90;
const PAYOUT_STORAGE_KEY  = 'cashflow.payoutDays';

// Statuses that count as "in flight" — invoice exists, not yet paid/rejected
const INFLIGHT_STATUSES = ['draft', 'approved', 'accepted', 'synced'];

const INVOICE_STATUS_CONFIG = {
  draft:    { label: 'Draft',                color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Uploaded to CBRE',     color: 'bg-blue-500/15 text-blue-400 border-blue-500/30'       },
  accepted: { label: 'Submitted to AP',      color: 'bg-green-500/15 text-green-400 border-green-500/30'    },
  synced:   { label: 'Submitted to AP',      color: 'bg-green-500/15 text-green-400 border-green-500/30'    },
  paid:     { label: 'Paid',                 color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  rejected: { label: 'Rejected',             color: 'bg-red-500/15 text-red-400 border-red-500/30'          },
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const parseDateLocal = (str) => {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const formatDate = (date) => {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const daysBetween = (a, b) => {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

// ── Time grouping ────────────────────────────────────────────────────────────
const getWeekKey = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
};

const getWeekLabel = (key) => {
  const d = new Date(key + 'T00:00:00');
  const end = addDays(d, 6);
  const startStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endStr   = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startStr} – ${endStr}`;
};

const getMonthKey = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (key) => {
  const [y, m] = key.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

// ── Billable calculation (mirrors ProfitabilityView) ─────────────────────────
function calcBillable(wo, hoursMap) {
  const hours = hoursMap[wo.wo_id] || { rt: 0, ot: 0, miles: 0, techMaterial: 0 };

  const legacyRT    = parseFloat(wo.hours_regular)  || 0;
  const legacyOT    = parseFloat(wo.hours_overtime) || 0;
  const legacyMiles = parseFloat(wo.miles)          || 0;

  let teamRT = 0, teamOT = 0;
  (wo.teamMembers || []).forEach(m => {
    teamRT += parseFloat(m.hours_regular)  || 0;
    teamOT += parseFloat(m.hours_overtime) || 0;
  });

  const totalRT    = legacyRT + teamRT + hours.rt;
  const totalOT    = legacyOT + teamOT + hours.ot;
  const totalMiles = legacyMiles + hours.miles;

  const labor    = (totalRT * BILLING_RT) + (totalOT * BILLING_OT) + (ADMIN_HOURS * BILLING_RT);
  const material = ((parseFloat(wo.material_cost)       || 0) + hours.techMaterial) * MARKUP;
  const equip    =  (parseFloat(wo.emf_equipment_cost) || 0) * MARKUP;
  const trailer  =  (parseFloat(wo.trailer_cost)       || 0) * MARKUP;
  const rental   =  (parseFloat(wo.rental_cost)        || 0) * MARKUP;
  const mileage  =  totalMiles * MILEAGE_RATE;

  return labor + material + equip + trailer + rental + mileage;
}

// ════════════════════════════════════════════════════════════════════════════
export default function CashFlowView({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';

  // ── State ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('expected'); // expected | pending | open
  const [groupBy, setGroupBy]     = useState('week');     // week | month
  const [payoutDays, setPayoutDays] = useState(DEFAULT_PAYOUT_DAYS);
  const [showConfig, setShowConfig] = useState(false);
  const [tempPayoutDays, setTempPayoutDays] = useState(DEFAULT_PAYOUT_DAYS);
  const [search, setSearch] = useState('');

  const [invoices, setInvoices]       = useState([]);
  const [pendingWOs, setPendingWOs]   = useState([]);
  const [openWOs, setOpenWOs]         = useState([]);
  const [hoursMap, setHoursMap]       = useState({});
  const [loading, setLoading]         = useState(true);

  // ── Load config from localStorage ──────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PAYOUT_STORAGE_KEY);
      if (stored) {
        const n = parseInt(stored, 10);
        if (!isNaN(n) && n > 0) {
          setPayoutDays(n);
          setTempPayoutDays(n);
        }
      }
    } catch {}
  }, []);

  const savePayoutDays = () => {
    const n = parseInt(tempPayoutDays, 10);
    if (isNaN(n) || n <= 0 || n > 365) {
      alert('Please enter a value between 1 and 365');
      return;
    }
    setPayoutDays(n);
    try { localStorage.setItem(PAYOUT_STORAGE_KEY, String(n)); } catch {}
    setShowConfig(false);
  };

  // ── Load data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAdmin) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadInvoices(),
        loadPendingWOs(),
        loadOpenWOs(),
      ]);
    } catch (e) {
      console.error('CashFlowView load error:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoices = async () => {
    const { data } = await supabaseClient
      .from('invoices')
      .select(`
        invoice_id, invoice_number, wo_id, invoice_date, total, status, created_at,
        work_order:work_orders(wo_number, building,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name))
      `)
      .in('status', INFLIGHT_STATUSES)
      .order('invoice_date', { ascending: true });
    setInvoices(data || []);
  };

  const loadPendingWOs = async () => {
    // Acknowledged + not locked + completed = ready to invoice but not yet invoiced
    const { data: wos } = await supabaseClient
      .from('work_orders')
      .select(`
        wo_id, wo_number, building, status, nte, date_completed, date_entered,
        hours_regular, hours_overtime, miles,
        material_cost, emf_equipment_cost, trailer_cost, rental_cost,
        acknowledged, is_locked,
        lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
      `)
      .eq('acknowledged', true)
      .eq('is_locked', false)
      .eq('status', 'completed')
      .order('date_completed', { ascending: true });

    const woList = wos || [];
    setPendingWOs(woList);
    await loadHoursForWOs(woList.map(w => w.wo_id));
  };

  const loadOpenWOs = async () => {
    const { data: wos } = await supabaseClient
      .from('work_orders')
      .select(`
        wo_id, wo_number, building, status, nte, date_entered,
        hours_regular, hours_overtime, miles,
        material_cost, emf_equipment_cost, trailer_cost, rental_cost,
        lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
      `)
      .in('status', ['assigned', 'in_progress', 'pending', 'tech_review'])
      .order('date_entered', { ascending: false });
    setOpenWOs(wos || []);
  };

  const loadHoursForWOs = async (woIds) => {
    if (!woIds.length) return;
    const { data: allHours } = await supabaseClient
      .from('daily_hours_log')
      .select('wo_id, hours_regular, hours_overtime, miles, tech_material_cost')
      .in('wo_id', woIds);

    setHoursMap(prev => {
      const map = { ...prev };
      (allHours || []).forEach(h => {
        if (!map[h.wo_id]) map[h.wo_id] = { rt: 0, ot: 0, miles: 0, techMaterial: 0 };
        map[h.wo_id].rt           += parseFloat(h.hours_regular)     || 0;
        map[h.wo_id].ot           += parseFloat(h.hours_overtime)    || 0;
        map[h.wo_id].miles        += parseFloat(h.miles)             || 0;
        map[h.wo_id].techMaterial += parseFloat(h.tech_material_cost) || 0;
      });
      return map;
    });
  };

  // ── Open WO hours loading (separate so we have NTE-vs-running) ─────────
  useEffect(() => {
    if (openWOs.length) loadHoursForWOs(openWOs.map(w => w.wo_id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWOs]);

  // ── Derived: Tab 1 — Expected Payouts ──────────────────────────────────
  const expectedRows = useMemo(() => {
    return invoices
      .filter(inv => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          inv.invoice_number?.toLowerCase().includes(s) ||
          inv.work_order?.wo_number?.toLowerCase().includes(s) ||
          inv.work_order?.building?.toLowerCase().includes(s)
        );
      })
      .map(inv => {
        const invDate = parseDateLocal(inv.invoice_date);
        const payoutDate = invDate ? addDays(invDate, payoutDays) : null;
        const daysUntil = payoutDate ? daysBetween(new Date(), payoutDate) : null;
        return { ...inv, _invoiceDate: invDate, _payoutDate: payoutDate, _daysUntil: daysUntil };
      })
      .sort((a, b) => {
        if (!a._payoutDate) return 1;
        if (!b._payoutDate) return -1;
        return a._payoutDate - b._payoutDate;
      });
  }, [invoices, search, payoutDays]);

  // Group expected by week or month
  const expectedGrouped = useMemo(() => {
    const groups = {};
    expectedRows.forEach(row => {
      if (!row._payoutDate) return;
      const key = groupBy === 'week' ? getWeekKey(row._payoutDate) : getMonthKey(row._payoutDate);
      if (!groups[key]) groups[key] = { key, total: 0, count: 0, rows: [] };
      groups[key].total += parseFloat(row.total) || 0;
      groups[key].count += 1;
      groups[key].rows.push(row);
    });
    return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
  }, [expectedRows, groupBy]);

  // ── Derived: Tab 2 — Pending Invoicing ─────────────────────────────────
  const pendingRows = useMemo(() => {
    return pendingWOs
      .filter(wo => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          wo.wo_number?.toLowerCase().includes(s) ||
          wo.building?.toLowerCase().includes(s) ||
          (wo.lead_tech && `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`.toLowerCase().includes(s))
        );
      })
      .map(wo => {
        const completedDate = parseDateLocal(wo.date_completed);
        const daysSince = completedDate ? daysBetween(completedDate, new Date()) : null;
        const billable = calcBillable(wo, hoursMap);
        return { ...wo, _completedDate: completedDate, _daysSince: daysSince, _billable: billable };
      })
      .sort((a, b) => (b._daysSince || 0) - (a._daysSince || 0));
  }, [pendingWOs, search, hoursMap]);

  // ── Derived: Tab 3 — Open Tickets ──────────────────────────────────────
  const openRows = useMemo(() => {
    return openWOs
      .filter(wo => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (
          wo.wo_number?.toLowerCase().includes(s) ||
          wo.building?.toLowerCase().includes(s) ||
          (wo.lead_tech && `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`.toLowerCase().includes(s))
        );
      })
      .map(wo => {
        const nte = parseFloat(wo.nte) || 0;
        const running = calcBillable(wo, hoursMap);
        return { ...wo, _nte: nte, _running: running };
      })
      .sort((a, b) => b._running - a._running);
  }, [openWOs, search, hoursMap]);

  // ── KPI Cards (always visible regardless of active tab) ────────────────
  const kpis = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // This week = Monday to Sunday of current week
    const thisWeekStart = new Date(now);
    const day = thisWeekStart.getDay();
    const shift = day === 0 ? -6 : 1 - day;
    thisWeekStart.setDate(thisWeekStart.getDate() + shift);
    const thisWeekEnd = addDays(thisWeekStart, 6);

    // This month
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Next month
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthEnd   = new Date(now.getFullYear(), now.getMonth() + 2, 0);

    let week = 0, month = 0, nextMonth = 0, total = 0;
    expectedRows.forEach(row => {
      const amt = parseFloat(row.total) || 0;
      total += amt;
      if (!row._payoutDate) return;
      const d = row._payoutDate;
      if (d >= thisWeekStart && d <= thisWeekEnd)   week += amt;
      if (d >= thisMonthStart && d <= thisMonthEnd) month += amt;
      if (d >= nextMonthStart && d <= nextMonthEnd) nextMonth += amt;
    });

    const pendingTotal = pendingRows.reduce((s, r) => s + (r._billable || 0), 0);
    const openRunning  = openRows.reduce((s, r) => s + (r._running || 0), 0);
    const openCeiling  = openRows.reduce((s, r) => s + (r._nte || 0), 0);

    return { week, month, nextMonth, total, pendingTotal, openRunning, openCeiling };
  }, [expectedRows, pendingRows, openRows]);

  // ── UI helpers ─────────────────────────────────────────────────────────
  const statusBadge = (status) => {
    const cfg = INVOICE_STATUS_CONFIG[status] || { label: status?.toUpperCase(), color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>{cfg.label}</span>;
  };

  const payoutColorClass = (daysUntil) => {
    if (daysUntil === null) return 'text-slate-500';
    if (daysUntil < 0)  return 'text-red-400';     // overdue
    if (daysUntil <= 7) return 'text-emerald-400'; // this week
    if (daysUntil <= 30) return 'text-blue-400';   // this month
    return 'text-slate-400';
  };

  const agingColorClass = (days) => {
    if (days === null || days === undefined) return 'text-slate-500';
    if (days <= 7)  return 'text-emerald-400';
    if (days <= 14) return 'text-yellow-400';
    if (days <= 30) return 'text-orange-400';
    return 'text-red-400';
  };

  // ── Admin gate ─────────────────────────────────────────────────────────
  if (!isAdmin) return (
    <div className="flex items-center justify-center min-h-[60vh] text-red-400">
      🔒 Admin access required
    </div>
  );

  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 p-4 md:p-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">💸 Cash Flow</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            When does which $ come in — {payoutDays}-day payout estimate
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setTempPayoutDays(payoutDays); setShowConfig(true); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1e1e2e] border border-[#2d2d44] text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Payout Days
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border rounded-xl p-4 bg-emerald-500/10 border-emerald-500/20">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">📅 This Week</div>
          <div className="text-2xl font-bold text-emerald-400">{fmt(kpis.week)}</div>
          <div className="text-xs text-slate-600 mt-1">Expected this week</div>
        </div>
        <div className="border rounded-xl p-4 bg-blue-500/10 border-blue-500/20">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">📅 This Month</div>
          <div className="text-2xl font-bold text-blue-400">{fmt(kpis.month)}</div>
          <div className="text-xs text-slate-600 mt-1">Expected this month</div>
        </div>
        <div className="border rounded-xl p-4 bg-purple-500/10 border-purple-500/20">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">📅 Next Month</div>
          <div className="text-2xl font-bold text-purple-400">{fmt(kpis.nextMonth)}</div>
          <div className="text-xs text-slate-600 mt-1">Expected next month</div>
        </div>
        <div className="border rounded-xl p-4 bg-[#1e1e2e] border-[#2d2d44]">
          <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">💰 Total Pipeline</div>
          <div className="text-2xl font-bold text-slate-100">
            {fmt(kpis.total + kpis.pendingTotal + kpis.openRunning)}
          </div>
          <div className="text-xs text-slate-600 mt-1">
            In flight + ready + open
          </div>
        </div>
      </div>

      {/* ── Tab Switcher ── */}
      <div className="flex flex-wrap gap-2 border-b border-[#1e1e2e] pb-0">
        <TabButton
          active={activeTab === 'expected'}
          onClick={() => setActiveTab('expected')}
          label="Expected Payouts"
          count={expectedRows.length}
          total={kpis.total}
        />
        <TabButton
          active={activeTab === 'pending'}
          onClick={() => setActiveTab('pending')}
          label="Pending Invoicing"
          count={pendingRows.length}
          total={kpis.pendingTotal}
        />
        <TabButton
          active={activeTab === 'open'}
          onClick={() => setActiveTab('open')}
          label="Open Tickets"
          count={openRows.length}
          total={kpis.openRunning}
        />
      </div>

      {/* ── Filters Row ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search WO#, Invoice#, Building, Tech..."
          className="bg-[#0d0d14] border border-[#2d2d44] text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/60 flex-1 min-w-[200px]"
        />
        {activeTab === 'expected' && (
          <div className="flex gap-1 bg-[#0d0d14] border border-[#2d2d44] rounded-lg p-1">
            <button
              onClick={() => setGroupBy('week')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                groupBy === 'week' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}>By Week</button>
            <button
              onClick={() => setGroupBy('month')}
              className={`px-3 py-1.5 rounded text-xs font-semibold transition ${
                groupBy === 'month' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}>By Month</button>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
          <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Loading...
        </div>
      ) : (
        <>
          {activeTab === 'expected' && (
            <ExpectedPayoutsTab
              groups={expectedGrouped}
              groupBy={groupBy}
              statusBadge={statusBadge}
              payoutColorClass={payoutColorClass}
            />
          )}
          {activeTab === 'pending' && (
            <PendingInvoicingTab
              rows={pendingRows}
              agingColorClass={agingColorClass}
            />
          )}
          {activeTab === 'open' && (
            <OpenTicketsTab
              rows={openRows}
            />
          )}
        </>
      )}

      {/* ── Legend ── */}
      <div className="text-xs text-slate-600 px-1 space-y-0.5">
        <div>• <strong className="text-slate-500">Expected Payouts</strong> = Invoices in flight (draft/uploaded/submitted) — clock starts at invoice date + {payoutDays} days</div>
        <div>• <strong className="text-slate-500">Pending Invoicing</strong> = Completed WOs ready to invoice but not yet generated — clock isn't running yet</div>
        <div>• <strong className="text-slate-500">Open Tickets</strong> = WOs still in progress — NTE = ceiling, Running = current logged value</div>
      </div>

      {/* ── Config Modal ── */}
      {showConfig && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl max-w-md w-full shadow-2xl">
            <div className="px-6 py-5 border-b border-[#1e1e2e] flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Payout Settings</h2>
                <p className="text-slate-500 text-xs mt-0.5">Days from invoice date to estimated payout</p>
              </div>
              <button onClick={() => setShowConfig(false)} className="text-slate-500 hover:text-slate-300 text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">Days Until Payout</label>
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={tempPayoutDays}
                  onChange={e => setTempPayoutDays(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60"
                />
                <p className="text-slate-600 text-xs mt-2">
                  CBRE typically pays in <strong className="text-slate-400">90 days</strong> after invoice submission. Adjust if you notice different timing for specific clients.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[30, 60, 90, 120].map(d => (
                  <button
                    key={d}
                    onClick={() => setTempPayoutDays(d)}
                    className={`py-2 rounded-lg text-xs font-semibold transition ${
                      parseInt(tempPayoutDays) === d
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#1e1e2e] border border-[#2d2d44] text-slate-400 hover:text-slate-200'
                    }`}>{d} days</button>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#1e1e2e] flex justify-end gap-2">
              <button onClick={() => setShowConfig(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:bg-[#2d2d44] transition">Cancel</button>
              <button onClick={savePayoutDays}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TabButton({ active, onClick, label, count, total }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
        active
          ? 'text-slate-100 border-blue-500'
          : 'text-slate-500 border-transparent hover:text-slate-300'
      }`}>
      {label}
      <span className="ml-2 text-xs text-slate-600">({count})</span>
      <div className={`text-xs font-normal mt-0.5 ${active ? 'text-emerald-400' : 'text-slate-600'}`}>
        ${total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
      </div>
    </button>
  );
}

// ── Tab 1 — Expected Payouts ─────────────────────────────────────────────────
function ExpectedPayoutsTab({ groups, groupBy, statusBadge, payoutColorClass }) {
  if (!groups.length) {
    return (
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl py-20 text-center text-slate-600">
        No invoices currently in flight
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map(group => (
        <div key={group.key} className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
          {/* Group header */}
          <div className="px-4 py-3 bg-[#1e1e2e] flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-200">
                {groupBy === 'week' ? getWeekLabel(group.key) : getMonthLabel(group.key)}
              </div>
              <div className="text-xs text-slate-500">{group.count} invoice{group.count !== 1 ? 's' : ''}</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-emerald-400">{fmt(group.total)}</div>
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#1e1e2e]">
            {group.rows.map(row => (
              <div key={row.invoice_id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-[#1e1e2e]/50 transition items-center text-sm">
                <div className="col-span-3">
                  <div className="text-blue-400 font-semibold">{row.invoice_number}</div>
                  <div className="text-slate-500 text-xs">WO {row.work_order?.wo_number || '—'}</div>
                </div>
                <div className="col-span-3 text-slate-400 text-xs truncate">{row.work_order?.building || '—'}</div>
                <div className="col-span-2 text-slate-500 text-xs">
                  <div>Inv: {formatDate(row._invoiceDate)}</div>
                  <div className={`font-semibold ${payoutColorClass(row._daysUntil)}`}>
                    Pay: {formatDate(row._payoutDate)}
                  </div>
                </div>
                <div className="col-span-2 text-center">
                  {statusBadge(row.status)}
                  <div className={`text-xs mt-0.5 ${payoutColorClass(row._daysUntil)}`}>
                    {row._daysUntil === null ? '—' :
                     row._daysUntil < 0 ? `${Math.abs(row._daysUntil)}d overdue` :
                     row._daysUntil === 0 ? 'Today' :
                     `${row._daysUntil}d`}
                  </div>
                </div>
                <div className="col-span-2 text-right text-emerald-400 font-semibold">
                  {fmt(row.total)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab 2 — Pending Invoicing ────────────────────────────────────────────────
function PendingInvoicingTab({ rows, agingColorClass }) {
  if (!rows.length) {
    return (
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl py-20 text-center text-slate-600">
        Nothing pending invoicing — you're all caught up! 🎉
      </div>
    );
  }

  const total = rows.reduce((s, r) => s + (r._billable || 0), 0);

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-[#1e1e2e] text-xs uppercase tracking-wider text-slate-500 font-semibold">
        <div className="col-span-3">WO# / Building</div>
        <div className="col-span-3">Lead Tech</div>
        <div className="col-span-2">Completed</div>
        <div className="col-span-2 text-center">Aging</div>
        <div className="col-span-2 text-right">Est. Billable</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#1e1e2e]">
        {rows.map(wo => (
          <div key={wo.wo_id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-[#1e1e2e]/50 transition items-center text-sm">
            <div className="col-span-3">
              <div className="text-blue-400 font-semibold">{wo.wo_number}</div>
              <div className="text-slate-500 text-xs truncate">{wo.building}</div>
            </div>
            <div className="col-span-3 text-slate-400 text-xs">
              {wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : '—'}
            </div>
            <div className="col-span-2 text-slate-500 text-xs">{formatDate(wo._completedDate)}</div>
            <div className="col-span-2 text-center">
              <span className={`text-xs font-semibold ${agingColorClass(wo._daysSince)}`}>
                {wo._daysSince === null ? '—' : `${wo._daysSince}d`}
              </span>
            </div>
            <div className="col-span-2 text-right text-yellow-400 font-semibold">
              {fmt(wo._billable)}
            </div>
          </div>
        ))}
      </div>

      {/* Totals footer */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 border-t-2 border-[#2d2d44] bg-[#1e1e2e] font-bold text-sm">
        <div className="col-span-10 text-slate-300">TOTAL — money on the table ({rows.length} WOs)</div>
        <div className="col-span-2 text-right text-yellow-400">{fmt(total)}</div>
      </div>
    </div>
  );
}

// ── Tab 3 — Open Tickets ─────────────────────────────────────────────────────
function OpenTicketsTab({ rows }) {
  if (!rows.length) {
    return (
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl py-20 text-center text-slate-600">
        No open tickets
      </div>
    );
  }

  const totalRunning = rows.reduce((s, r) => s + (r._running || 0), 0);
  const totalNTE     = rows.reduce((s, r) => s + (r._nte || 0), 0);

  const statusColor = (status) => ({
    in_progress: 'bg-blue-500/15 text-blue-400',
    assigned:    'bg-orange-500/15 text-orange-400',
    pending:     'bg-slate-500/15 text-slate-400',
    tech_review: 'bg-purple-500/15 text-purple-400',
  }[status] || 'bg-slate-500/15 text-slate-400');

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-[#1e1e2e] text-xs uppercase tracking-wider text-slate-500 font-semibold">
        <div className="col-span-3">WO# / Building</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-3">Lead Tech</div>
        <div className="col-span-2 text-right">Running</div>
        <div className="col-span-2 text-right">NTE Ceiling</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#1e1e2e]">
        {rows.map(wo => {
          const utilization = wo._nte > 0 ? (wo._running / wo._nte) * 100 : 0;
          const overNTE = wo._nte > 0 && wo._running > wo._nte;
          return (
            <div key={wo.wo_id} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-[#1e1e2e]/50 transition items-center text-sm">
              <div className="col-span-3">
                <div className="text-blue-400 font-semibold">{wo.wo_number}</div>
                <div className="text-slate-500 text-xs truncate">{wo.building}</div>
              </div>
              <div className="col-span-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(wo.status)}`}>
                  {wo.status?.replace('_', ' ')}
                </span>
              </div>
              <div className="col-span-3 text-slate-400 text-xs">
                {wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : '—'}
              </div>
              <div className="col-span-2 text-right">
                <div className={`font-semibold ${overNTE ? 'text-red-400' : 'text-blue-400'}`}>
                  {fmt(wo._running)}
                </div>
                {wo._nte > 0 && (
                  <div className="text-xs text-slate-600">{utilization.toFixed(0)}% of NTE</div>
                )}
              </div>
              <div className="col-span-2 text-right text-slate-400 font-semibold">
                {wo._nte > 0 ? fmt(wo._nte) : <span className="text-slate-600">no NTE</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals footer */}
      <div className="grid grid-cols-12 gap-2 px-4 py-3 border-t-2 border-[#2d2d44] bg-[#1e1e2e] font-bold text-sm">
        <div className="col-span-8 text-slate-300">TOTAL — pipeline value ({rows.length} WOs)</div>
        <div className="col-span-2 text-right text-blue-400">{fmt(totalRunning)}</div>
        <div className="col-span-2 text-right text-slate-400">{fmt(totalNTE)}</div>
      </div>
    </div>
  );
}
