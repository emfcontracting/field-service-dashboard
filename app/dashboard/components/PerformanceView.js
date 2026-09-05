// app/dashboard/components/PerformanceView.js
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN: Performance / KPIs — how CBRE sees EMF, before CBRE sees it.
//
// Every time metric exists in two views (lib/kpi.js):
//   CBRE-Sicht — raw against the latest target (what CBRE measures)
//   Bereinigt  — stop-the-clock pauses subtracted (the fair view; the pause
//                rows are the compliance defense trail)
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  toDate, pausesByWo, onTimeRate, onTimeRateBy, weeklyOnTime, responseHours,
  timeToTarget, median, facilityOf, PAUSE_REASON_LABELS,
} from '@/lib/kpi';
import SendAlertModal from './aging/SendAlertModal';

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MS_D = 86400000;
const fmtPct = (r) => (r === null ? '—' : `${Math.round(r * 100)}%`);
const fmtH = (h) => (h === null ? '—' : h >= 48 ? `${(h / 24).toFixed(1)}d` : `${h.toFixed(1)}h`);
const fmtD = (d) => (d === null ? '—' : `${d.toFixed(1)} Tage`);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

const PERIODS = [
  { key: 30, label: '30 days' },
  { key: 90, label: '90 days' },
  { key: 365, label: '12 months' },
];

export default function PerformanceView({ currentUser, onSelectWorkOrder }) {
  const [loading, setLoading] = useState(true);
  const [wos, setWos] = useState([]);
  const [pauseRows, setPauseRows] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [periodDays, setPeriodDays] = useState(30);
  const [facility, setFacility] = useState('all');
  const [adjusted, setAdjusted] = useState(true);
  const [breakdownMode, setBreakdownMode] = useState('priority'); // priority | facility | tech
  const [users, setUsers] = useState([]);
  const [showAlertModal, setShowAlertModal] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 400 * MS_D).toISOString();
      const [woRes, pauseRes, invRes] = await Promise.all([
        supabaseClient.from('work_orders').select(`
          wo_id, wo_number, building, priority, status, date_entered, date_completed,
          target_response_at, target_completion_at, time_in, waiting_reason,
          escalation, escalation_updated_at, missing_data_flagged_at, cbre_status,
          lead_tech_id, work_order_description,
          kpi_excluded, kpi_excluded_reason, kpi_excluded_at, kpi_excluded_by,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `).gte('date_entered', since).limit(5000),
        supabaseClient.from('work_order_clock_pauses')
          .select('wo_id, reason, started_at, ended_at').gte('started_at', since).limit(5000),
        supabaseClient.from('invoices')
          .select('wo_id, generated_at, cmp_date, paid_at, rejected_at, status')
          .gte('created_at', since).limit(5000),
      ]);
      const { data: userRows } = await supabaseClient
        .from('users')
        .select('user_id, first_name, last_name, email, role')
        .eq('is_active', true);
      setUsers(userRows || []);
      setWos(woRes.data || []);
      setPauseRows(pauseRes.data || []);
      setInvoices(invRes.data || []);
    } catch (e) {
      console.error('PerformanceView load:', e);
    } finally {
      setLoading(false);
    }
  };

  const pauseMap = useMemo(() => pausesByWo(pauseRows), [pauseRows]);

  const facilities = useMemo(() => {
    const set = new Set(wos.map(facilityOf).filter((f) => f && f !== '—'));
    return [...set].sort();
  }, [wos]);

  const excluded = useMemo(() => wos.filter((w) => w.kpi_excluded), [wos]);

  const inFacility = useMemo(
    () => (facility === 'all' ? wos : wos.filter((w) => facilityOf(w) === facility))
      .filter((w) => !w.kpi_excluded),
    [wos, facility]
  );

  const [showExcluded, setShowExcluded] = useState(false);

  // Open the same overlapping WO detail modal as the Work Orders dashboard.
  const openWo = async (woId) => {
    if (!onSelectWorkOrder) return;
    try {
      const { data: full } = await supabaseClient
        .from('work_orders')
        .select('*, lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name, email, phone)')
        .eq('wo_id', woId)
        .single();
      if (!full) return;
      const { data: teamMembers } = await supabaseClient
        .from('work_order_assignments')
        .select('*, user:users(first_name, last_name, email, role)')
        .eq('wo_id', woId);
      onSelectWorkOrder({ ...full, teamMembers: teamMembers || [] });
    } catch (e) {
      console.error('openWo:', e);
    }
  };

  const excludeWo = async (wo) => {
    const reason = prompt(`Exclude ${wo.wo_number} from all KPIs?\n\nReason (required — audit trail):`);
    if (!reason || !reason.trim()) return;
    const who = currentUser ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() : 'admin';
    const { error } = await supabaseClient.from('work_orders').update({
      kpi_excluded: true,
      kpi_excluded_reason: reason.trim(),
      kpi_excluded_at: new Date().toISOString(),
      kpi_excluded_by: who,
    }).eq('wo_id', wo.wo_id);
    if (error) { alert('Failed: ' + error.message); return; }
    setWos((prev) => prev.map((w) => (w.wo_id === wo.wo_id
      ? { ...w, kpi_excluded: true, kpi_excluded_reason: reason.trim(), kpi_excluded_by: who, kpi_excluded_at: new Date().toISOString() }
      : w)));
  };

  const includeWo = async (wo) => {
    const { error } = await supabaseClient.from('work_orders').update({
      kpi_excluded: false, kpi_excluded_reason: null, kpi_excluded_at: null, kpi_excluded_by: null,
    }).eq('wo_id', wo.wo_id);
    if (error) { alert('Failed: ' + error.message); return; }
    setWos((prev) => prev.map((w) => (w.wo_id === wo.wo_id
      ? { ...w, kpi_excluded: false, kpi_excluded_reason: null, kpi_excluded_at: null, kpi_excluded_by: null }
      : w)));
  };

  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * MS_D);
  const prevStart = new Date(now.getTime() - 2 * periodDays * MS_D);

  const completedInPeriod = useMemo(
    () => inFacility.filter((w) => { const d = toDate(w.date_completed); return d && d >= periodStart; }),
    [inFacility, periodDays] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const completedPrev = useMemo(
    () => inFacility.filter((w) => { const d = toDate(w.date_completed); return d && d >= prevStart && d < periodStart; }),
    [inFacility, periodDays] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Headline KPIs ──────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const cur = onTimeRate(completedInPeriod, pauseMap, { adjusted, now });
    const prev = onTimeRate(completedPrev, pauseMap, { adjusted, now });
    const deltaPt = cur.rate !== null && prev.rate !== null ? Math.round((cur.rate - prev.rate) * 100) : null;

    const respAll = completedInPeriod.map(responseHours).filter((h) => h !== null);
    const respP1 = completedInPeriod.filter((w) => `${w.priority}`.toUpperCase().startsWith('P1'))
      .map(responseHours).filter((h) => h !== null);

    const escal = inFacility.filter((w) => { const d = toDate(w.escalation_updated_at); return w.escalation !== undefined && d && d >= periodStart; }).length;
    const escalPrev = inFacility.filter((w) => { const d = toDate(w.escalation_updated_at); return d && d >= prevStart && d < periodStart; }).length;

    const open = inFacility.filter((w) => !w.date_completed && w.status !== 'completed');
    const overdue = open.filter((w) => {
      const t = timeToTarget(w, pauseMap.get(w.wo_id) || [], now);
      return t && !t.paused && t.msLeft < 0;
    });

    return { cur, deltaPt, respMed: median(respAll), respP1Med: median(respP1), escal, escalPrev, openN: open.length, overdue };
  }, [completedInPeriod, completedPrev, inFacility, pauseMap, adjusted, periodDays]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Weekly trend (fixed 12 weeks) ──────────────────────────────────────────
  const weekly = useMemo(
    () => weeklyOnTime(inFacility, pauseMap, { weeks: 12, adjusted, now }),
    [inFacility, pauseMap, adjusted] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Open WOs vs target (countdown, most urgent first) ─────────────────────
  const countdown = useMemo(() => {
    return inFacility
      .filter((w) => !w.date_completed && w.status !== 'completed' && w.target_completion_at)
      .map((w) => ({ wo: w, t: timeToTarget(w, pauseMap.get(w.wo_id) || [], now) }))
      .filter((x) => x.t)
      .sort((a, b) => (a.t.paused === b.t.paused ? a.t.msLeft - b.t.msLeft : a.t.paused ? 1 : -1));
  }, [inFacility, pauseMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Breakdown ─────────────────────────────────────────────────────────────
  const breakdown = useMemo(() => {
    const keyFn = breakdownMode === 'priority'
      ? (w) => `${w.priority || '—'}`.toUpperCase()
      : breakdownMode === 'facility'
        ? facilityOf
        : (w) => (w.lead_tech ? `${w.lead_tech.first_name} ${w.lead_tech.last_name}` : '—');
    return onTimeRateBy(completedInPeriod, pauseMap, keyFn, { adjusted, now })
      .filter((g) => g.n > 0).slice(0, 10);
  }, [completedInPeriod, pauseMap, breakdownMode, adjusted]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Process lags ──────────────────────────────────────────────────────────
  const lags = useMemo(() => {
    const approverWaits = pauseRows
      .filter((p) => p.reason === 'cbre_approval' && p.ended_at && toDate(p.ended_at) >= periodStart)
      .map((p) => (toDate(p.ended_at) - toDate(p.started_at)) / MS_D);

    const woById = new Map(inFacility.map((w) => [w.wo_id, w]));
    const invoicingLags = [];
    const paymentLags = [];
    for (const inv of invoices) {
      const wo = woById.get(inv.wo_id);
      if (wo && wo.date_completed && inv.generated_at) {
        const lag = (toDate(inv.generated_at) - toDate(wo.date_completed)) / MS_D;
        if (lag >= 0 && lag < 120 && toDate(inv.generated_at) >= periodStart) invoicingLags.push(lag);
      }
      if (inv.cmp_date && inv.paid_at) {
        const lag = (toDate(inv.paid_at) - toDate(inv.cmp_date)) / MS_D;
        if (lag >= 0 && toDate(inv.paid_at) >= periodStart) paymentLags.push(lag);
      }
    }
    return {
      approverWait: median(approverWaits),
      invoicing: median(invoicingLags),
      payment: median(paymentLags),
    };
  }, [pauseRows, invoices, inFacility, periodDays]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Signals ───────────────────────────────────────────────────────────────
  const signals = useMemo(() => {
    const inP = (d) => { const x = toDate(d); return x && x >= periodStart; };
    return {
      escalations: inFacility.filter((w) => inP(w.escalation_updated_at)).length,
      missingData: inFacility.filter((w) => inP(w.missing_data_flagged_at)).length,
      quoteRejected: inFacility.filter((w) => w.cbre_status === 'quote_rejected').length,
      invoiceRejected: invoices.filter((i) => inP(i.rejected_at)).length,
      reassigned: inFacility.filter((w) => w.cbre_status === 'reassigned').length,
    };
  }, [inFacility, invoices, periodDays]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Merged from the old Aging tab: remind techs about urgent open WOs ─────
  // (due within 3 days or already overdue vs. the ADJUSTED target — paused
  // WOs are excluded, so nobody gets nagged about CBRE's approver time.)
  const alertRows = useMemo(() => {
    return countdown
      .filter(({ wo, t }) => wo.lead_tech_id && !t.paused && t.daysLeft < 3)
      .map(({ wo, t }) => ({
        ...wo,
        aging: {
          severity: t.daysLeft < 0 ? 'critical' : t.daysLeft < 1 ? 'warning' : 'stale',
          days: t.daysLeft < 0 ? Math.ceil(Math.abs(t.daysLeft)) : 0,
        },
      }));
  }, [countdown]);

  const alertStats = useMemo(() => {
    const byTech = {};
    for (const wo of alertRows) {
      const id = wo.lead_tech_id;
      if (!byTech[id]) {
        byTech[id] = {
          name: wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : 'Unknown',
          total: 0, critical: 0, warning: 0, stale: 0,
        };
      }
      byTech[id].total++;
      byTech[id][wo.aging.severity]++;
    }
    return { byTech };
  }, [alertRows]);

  const chipFor = (t) => {
    if (t.paused) {
      return <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border text-slate-300 border-slate-500/40 bg-slate-500/10"
        title={PAUSE_REASON_LABELS[t.pauseReason] || 'Pausiert'}>
        {PAUSE_REASON_LABELS[t.pauseReason] || '⏸ Pausiert'}
      </span>;
    }
    const d = t.daysLeft;
    if (d < 0) return <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border text-red-400 border-red-500/40 bg-red-500/10">⚫ {Math.abs(d).toFixed(0)}d drüber</span>;
    if (d < 1) return <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border text-orange-400 border-orange-500/40 bg-orange-500/10">🔴 heute</span>;
    if (d < 3) return <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border text-yellow-400 border-yellow-500/40 bg-yellow-500/10">🟡 {d.toFixed(0)}d</span>;
    return <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold border text-emerald-400 border-emerald-500/40 bg-emerald-500/10">🟢 {d.toFixed(0)}d</span>;
  };

  if (loading) {
    return <div className="text-center py-20 text-slate-500">Loading performance data…</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header + filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">📊 Performance</h1>
          <p className="text-xs text-slate-500 mt-0.5">CBRE effectiveness — targets, pauses, process speed</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-1">
            {PERIODS.map((p) => (
              <button key={p.key} onClick={() => setPeriodDays(p.key)}
                className={`px-3 py-1 rounded-md text-xs ${periodDays === p.key ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`}>
                {p.label}
              </button>
            ))}
          </div>
          <select value={facility} onChange={(e) => setFacility(e.target.value)}
            className="bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-1.5 text-xs text-slate-300">
            <option value="all">All facilities</option>
            {facilities.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="flex gap-1 bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-1"
            title="CBRE view = raw against the current target. Adjusted = stop-the-clock pauses (approver wait, EBO …) subtracted.">
            <button onClick={() => setAdjusted(false)}
              className={`px-3 py-1 rounded-md text-xs ${!adjusted ? 'bg-amber-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`}>
              CBRE view
            </button>
            <button onClick={() => setAdjusted(true)}
              className={`px-3 py-1 rounded-md text-xs ${adjusted ? 'bg-emerald-600 text-white font-semibold' : 'text-slate-400 hover:text-slate-200'}`}>
              Adjusted
            </button>
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4" title="Share of completed WOs finished before the (adjusted) target completion">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">On-Time Completion</div>
          <div className={`text-3xl font-extrabold mt-1 ${kpi.cur.rate !== null && kpi.cur.rate >= 0.9 ? 'text-emerald-400' : kpi.cur.rate >= 0.75 ? 'text-yellow-400' : 'text-red-400'}`}>
            {fmtPct(kpi.cur.rate)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {kpi.deltaPt !== null && (
              <span className={kpi.deltaPt >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                {kpi.deltaPt >= 0 ? '▲' : '▼'} {Math.abs(kpi.deltaPt)} pt{' '}
              </span>
            )}
            {kpi.cur.ok}/{kpi.cur.n} WOs · {adjusted ? 'adjusted' : 'CBRE raw'}
          </div>
        </div>
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4" title="Median: dispatch → first tech check-in">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Median Response Time</div>
          <div className="text-3xl font-extrabold mt-1 text-slate-100">{fmtH(kpi.respMed)}</div>
          <div className="text-xs text-slate-500 mt-1">P1: <strong className="text-slate-300">{fmtH(kpi.respP1Med)}</strong></div>
        </div>
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4" title="CBRE escalation mails (target surpassed) in the period">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Escalations</div>
          <div className={`text-3xl font-extrabold mt-1 ${kpi.escal === 0 ? 'text-emerald-400' : 'text-yellow-400'}`}>{kpi.escal}</div>
          <div className="text-xs text-slate-500 mt-1">
            {kpi.escalPrev - kpi.escal !== 0 && (
              <span className={kpi.escal <= kpi.escalPrev ? 'text-emerald-400' : 'text-red-400'}>
                {kpi.escal <= kpi.escalPrev ? '▼' : '▲'} {Math.abs(kpi.escal - kpi.escalPrev)}{' '}
              </span>
            )}
            vs. previous period
          </div>
        </div>
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4" title="Open WOs past the (adjusted) target — paused WOs excluded">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Overdue (open)</div>
          <div className={`text-3xl font-extrabold mt-1 ${kpi.overdue.length === 0 ? 'text-emerald-400' : 'text-red-400'}`}>{kpi.overdue.length}</div>
          <div className="text-xs text-slate-500 mt-1">of {kpi.openN} open WOs</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-3">
        {/* Weekly trend */}
        <div className="lg:col-span-7 bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">
            On-time rate per week <span className="text-[11px] text-slate-600 font-normal">— goal line 90% · {adjusted ? 'adjusted' : 'CBRE raw'}</span>
          </h2>
          <div className="relative">
            <div className="absolute left-0 right-0 border-t-2 border-dashed border-slate-600" style={{ top: '10%' }} />
            <span className="absolute right-0 -top-1 text-[10px] text-slate-500">90%</span>
            <div className="flex items-end gap-1.5 h-36 border-b border-[#2d2d44] pt-2">
              {weekly.map((w, i) => (
                <div key={w.week} className="flex-1 min-w-[10px] relative group"
                  title={`Week of ${fmtDate(w.week)} · ${fmtPct(w.rate)} (${w.ok}/${w.n})`}>
                  <div className={`w-full rounded-t ${i === weekly.length - 1 ? 'bg-sky-400' : 'bg-blue-700'} group-hover:bg-sky-300 transition`}
                    style={{ height: `${Math.max(4, (w.rate || 0) * 136)}px` }} />
                  {i === weekly.length - 1 && w.rate !== null && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-300 font-semibold">{fmtPct(w.rate)}</span>
                  )}
                </div>
              ))}
              {weekly.length === 0 && <div className="text-slate-600 text-xs py-12 mx-auto">No completions with a target in the last 12 weeks yet</div>}
            </div>
            <div className="flex gap-1.5 mt-1">
              {weekly.map((w) => (
                <div key={w.week} className="flex-1 min-w-[10px] text-center text-[9px] text-slate-600">{fmtDate(w.week)}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Countdown table */}
        <div className="lg:col-span-5 bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-slate-300">
              Open WOs vs. Target <span className="text-[11px] text-slate-600 font-normal">— most urgent first</span>
            </h2>
            {alertRows.length > 0 && (
              <button onClick={() => setShowAlertModal(true)}
                title="Email each lead tech their urgent/overdue WOs (paused WOs excluded)"
                className="text-[11px] px-2.5 py-1 rounded-lg bg-orange-600/80 hover:bg-orange-600 text-white font-semibold">
                📧 Remind techs ({alertRows.length})
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-72">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-slate-600 border-b border-[#2d2d44]">
                  <th className="text-left py-1.5 pr-2">WO#</th>
                  <th className="text-left py-1.5 pr-2">Facility</th>
                  <th className="text-left py-1.5 pr-2">Prio</th>
                  <th className="text-left py-1.5 pr-2">Target</th>
                  <th className="text-right py-1.5">Left</th>
                  <th className="w-6"></th>
                </tr>
              </thead>
              <tbody>
                {countdown.slice(0, 20).map(({ wo, t }) => (
                  <tr key={wo.wo_id} className="border-b border-[#1e1e2e] hover:bg-[#1e1e2e]/50">
                    <td className="py-2 pr-2">
                      <button onClick={() => openWo(wo.wo_id)}
                        className="font-mono font-semibold text-blue-400 hover:text-blue-300 hover:underline">
                        {wo.wo_number}
                      </button>
                    </td>
                    <td className="py-2 pr-2 text-slate-400">{facilityOf(wo)}</td>
                    <td className="py-2 pr-2 font-bold text-slate-300">{`${wo.priority || '—'}`.toUpperCase().slice(0, 3)}</td>
                    <td className="py-2 pr-2 text-slate-500">{fmtDateTime(t.target)}</td>
                    <td className="py-2 text-right">{chipFor(t)}</td>
                    <td className="py-2 pl-1 text-right w-6">
                      <button onClick={() => excludeWo(wo)}
                        title="Exclude this WO from all KPIs (reason required)"
                        className="text-slate-700 hover:text-red-400 text-sm leading-none">✕</button>
                    </td>
                  </tr>
                ))}
                {countdown.length === 0 && (
                  <tr><td colSpan="6" className="py-8 text-center text-slate-600">No open WOs with a target yet — waiting for the import/backfill.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {countdown.length > 20 && <div className="text-[11px] text-slate-600 mt-2">+ {countdown.length - 20} more</div>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        {/* Breakdown */}
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-300">On-time by…</h2>
            <div className="flex gap-1 bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-0.5">
              {[['priority', 'Prio'], ['facility', 'Facility'], ['tech', 'Tech']].map(([m, l]) => (
                <button key={m} onClick={() => setBreakdownMode(m)}
                  className={`px-2 py-0.5 rounded text-[11px] ${breakdownMode === m ? 'bg-blue-600 text-white font-semibold' : 'text-slate-500 hover:text-slate-300'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {breakdown.map((g) => (
            <div key={g.key} className="grid grid-cols-[70px_1fr_60px] gap-2 items-center mb-2" title={`${g.ok}/${g.n} on-time`}>
              <div className="text-xs font-semibold text-slate-400 truncate">{g.key}</div>
              <div className="h-3.5 bg-[#11131d] rounded overflow-hidden">
                <div className="h-full bg-sky-500 rounded-r" style={{ width: `${(g.rate || 0) * 100}%` }} />
              </div>
              <div className="text-xs text-right font-semibold text-slate-200">{fmtPct(g.rate)} <span className="text-slate-600">({g.n})</span></div>
            </div>
          ))}
          {breakdown.length === 0 && <div className="text-slate-600 text-xs py-6 text-center">No rateable completions in this period</div>}
        </div>

        {/* Process lags */}
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Process Speed <span className="text-[11px] text-slate-600 font-normal">— median</span></h2>
          <div className="space-y-2">
            <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3" title="Duration of cbre_approval pauses (quote submitted → approver answer)">
              <div className="text-[11px] text-slate-500 font-semibold">💬 Approver Wait (Quote)</div>
              <div className="text-xl font-extrabold text-slate-100">{fmtD(lags.approverWait)}</div>
              <div className="text-[11px] text-slate-600">does NOT count against you (pause)</div>
            </div>
            <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3" title="date_completed → FSM invoice generated">
              <div className="text-[11px] text-slate-500 font-semibold">🧾 Invoicing Lag <em>(your lever)</em></div>
              <div className={`text-xl font-extrabold ${lags.invoicing !== null && lags.invoicing > 5 ? 'text-yellow-400' : 'text-slate-100'}`}>{fmtD(lags.invoicing)}</div>
              <div className="text-[11px] text-slate-600">completed → invoice generated</div>
            </div>
            <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3" title="first CIR/CMP → marked paid">
              <div className="text-[11px] text-slate-500 font-semibold">💰 Payment Lag (CBRE)</div>
              <div className="text-xl font-extrabold text-slate-100">{fmtD(lags.payment)}</div>
              <div className="text-[11px] text-slate-600">CIR/CMP → paid · clock: 75d</div>
            </div>
          </div>
        </div>

        {/* Signals */}
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Disruption Signals <span className="text-[11px] text-slate-600 font-normal">— in period</span></h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-[#1e1e2e]"><td className="py-2 text-slate-300">🚨 Escalations</td><td className="py-2 text-right font-bold text-slate-100">{signals.escalations}</td></tr>
              <tr className="border-b border-[#1e1e2e]"><td className="py-2 text-slate-300">🚩 Missing-data flags</td><td className="py-2 text-right font-bold text-slate-100">{signals.missingData}</td></tr>
              <tr className="border-b border-[#1e1e2e]"><td className="py-2 text-slate-300">❌ Quote rejected (current)</td><td className="py-2 text-right font-bold text-slate-100">{signals.quoteRejected}</td></tr>
              <tr className="border-b border-[#1e1e2e]"><td className="py-2 text-slate-300">❌ Invoice rejected</td><td className="py-2 text-right font-bold text-slate-100">{signals.invoiceRejected}</td></tr>
              <tr><td className="py-2 text-slate-500">🔄 Reassignments <span className="text-[10px]">(info only, not a fault metric)</span></td><td className="py-2 text-right font-bold text-slate-500">{signals.reassigned}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {excluded.length > 0 && (
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4">
          <button onClick={() => setShowExcluded((v) => !v)} className="text-sm font-semibold text-slate-400 hover:text-slate-200">
            {showExcluded ? '▾' : '▸'} Excluded from KPIs ({excluded.length})
          </button>
          {showExcluded && (
            <table className="w-full text-xs mt-3">
              <tbody>
                {excluded.map((wo) => (
                  <tr key={wo.wo_id} className="border-b border-[#1e1e2e]">
                    <td className="py-2 pr-2">
                      <button onClick={() => openWo(wo.wo_id)}
                        className="font-mono font-semibold text-blue-400 hover:text-blue-300 hover:underline">
                        {wo.wo_number}
                      </button>
                    </td>
                    <td className="py-2 pr-2 text-slate-400">{facilityOf(wo)}</td>
                    <td className="py-2 pr-2 text-slate-500 italic">"{wo.kpi_excluded_reason}"</td>
                    <td className="py-2 pr-2 text-slate-600">{wo.kpi_excluded_by} · {wo.kpi_excluded_at ? new Date(wo.kpi_excluded_at).toLocaleDateString() : ''}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => includeWo(wo)}
                        className="text-[11px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200">re-include</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showAlertModal && (
        <SendAlertModal
          stats={alertStats}
          agingWorkOrders={alertRows}
          leadTechs={users.filter((u) => u.role === 'lead_tech' || u.role === 'admin')}
          users={users}
          preselectedTechId={null}
          onClose={() => setShowAlertModal(false)}
          onAlertSent={() => {}}
        />
      )}

      <div className="text-[11px] text-slate-600 leading-relaxed px-1">
        • <strong className="text-amber-500">CBRE view</strong> = raw against the current target (re-dispatch/grid changes included) — this is how CBRE measures.{' '}
        • <strong className="text-emerald-500">Adjusted</strong> = stop-the-clock pauses subtracted (approver wait, equipment backorder …) — every pause is documented with reason and window (compliance defense).{' '}
        • Targets come structured from the dispatch mails; older WOs without a target don't count toward the on-time rate.
      </div>
    </div>
  );
}
