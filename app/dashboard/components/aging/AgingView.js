'use client';

import { useState, useMemo } from 'react';
import AgingStatsCards from './AgingStatsCards';
import AgingWorkOrdersList from './AgingWorkOrdersList';
import AgingByTechChart from './AgingByTechChart';
import SendAlertModal from './SendAlertModal';

export default function AgingView({ workOrders, users, supabase, refreshWorkOrders, onSelectWorkOrder }) {
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterTech,     setFilterTech]     = useState('all');
  const [sortBy,         setSortBy]         = useState('age');
  const [lastAlert,      setLastAlert]      = useState(null);
  const [showModal,      setShowModal]      = useState(false);

  const leadTechs = users.filter(u => u.role === 'lead_tech' || u.role === 'admin');

  const calcAging = (wo) => {
    if (!wo.lead_tech_id) return null;
    if (['completed','needs_return'].includes(wo.status)) return null;
    const assigned = wo.lead_tech_assigned_at ? new Date(wo.lead_tech_assigned_at) : wo.date_entered ? new Date(wo.date_entered) : null;
    if (!assigned || isNaN(assigned)) return null;
    const diff   = Date.now() - assigned;
    const days   = Math.floor(diff / 86400000);
    const hours  = Math.floor((diff % 86400000) / 3600000);
    const total  = Math.floor(diff / 3600000);
    const sev    = days >= 5 ? 'critical' : days >= 3 ? 'warning' : days >= 2 ? 'stale' : 'ok';
    return { days, hours, totalHours: total, severity: sev, assignedDate: assigned };
  };

  const agingWOs = useMemo(() => {
    return workOrders
      .map(wo => ({ ...wo, aging: calcAging(wo) }))
      .filter(wo => wo.aging && wo.aging.days >= 2)
      .sort((a, b) => {
        if (sortBy === 'age')      return b.aging.totalHours - a.aging.totalHours;
        if (sortBy === 'priority') { const o={emergency:0,high:1,medium:2,low:3}; return (o[a.priority]||4)-(o[b.priority]||4); }
        if (sortBy === 'tech')     { const n=t=>t.lead_tech?`${t.lead_tech.first_name} ${t.lead_tech.last_name}`:'ZZZ'; return n(a).localeCompare(n(b)); }
        return 0;
      });
  }, [workOrders, sortBy]);

  const filtered = useMemo(() => agingWOs.filter(wo => {
    if (filterSeverity !== 'all' && wo.aging.severity !== filterSeverity) return false;
    if (filterTech !== 'all' && wo.lead_tech_id !== filterTech) return false;
    return true;
  }), [agingWOs, filterSeverity, filterTech]);

  const stats = useMemo(() => {
    const critical = agingWOs.filter(w=>w.aging.severity==='critical').length;
    const warning  = agingWOs.filter(w=>w.aging.severity==='warning').length;
    const stale    = agingWOs.filter(w=>w.aging.severity==='stale').length;
    const byTech   = {};
    agingWOs.forEach(wo => {
      const id   = wo.lead_tech_id || 'unassigned';
      const name = wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : 'Unassigned';
      if (!byTech[id]) byTech[id] = { name, critical:0, warning:0, stale:0, total:0, workOrders:[] };
      byTech[id][wo.aging.severity]++;
      byTech[id].total++;
      byTech[id].workOrders.push(wo);
    });
    return { critical, warning, stale, total: agingWOs.length, byTech, oldest: agingWOs[0] || null };
  }, [agingWOs]);

  const Sel = ({ children, ...props }) => (
    <select className="bg-[#0a0a0f] border border-[#2d2d44] text-slate-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500/60 transition flex-shrink-0" {...props}>
      {children}
    </select>
  );

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl px-5 py-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Aging Report & Priority Alerts
              </h2>
              <p className="text-slate-600 text-xs mt-1">Work orders open 2+ days since tech assignment</p>
            </div>
            {lastAlert && <p className="text-slate-600 text-xs">Last alert: {lastAlert.toLocaleString()}</p>}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <Sel value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)}>
              <option value="all">All Severities</option>
              <option value="critical">Critical (5+d)</option>
              <option value="warning">Warning (3-4d)</option>
              <option value="stale">Stale (2-3d)</option>
            </Sel>
            <Sel value={filterTech} onChange={e => setFilterTech(e.target.value)}>
              <option value="all">All Techs</option>
              {leadTechs.map(t => <option key={t.user_id} value={t.user_id}>{t.first_name} {t.last_name}</option>)}
            </Sel>
            <Sel value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="age">Sort: Age</option>
              <option value="priority">Sort: Priority</option>
              <option value="tech">Sort: Tech</option>
            </Sel>
            <button onClick={() => setShowModal(true)} disabled={stats.total === 0}
              className="bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-semibold transition flex-shrink-0 flex items-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              <span className="hidden sm:inline">Send Alert Emails</span>
              <span className="sm:hidden">Alerts</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <AgingStatsCards stats={stats} onFilterClick={setFilterSeverity} />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <AgingWorkOrdersList workOrders={filtered} onSelectWorkOrder={onSelectWorkOrder} leadTechs={leadTechs} />
        </div>
        <div className="hidden md:block">
          <AgingByTechChart stats={stats} onTechClick={setFilterTech} selectedTech={filterTech} onSendToTech={tid => setShowModal({ techId: tid })} />
        </div>
      </div>

      {showModal && (
        <SendAlertModal
          stats={stats} agingWorkOrders={agingWOs} leadTechs={leadTechs} users={users}
          preselectedTechId={showModal.techId || null}
          onClose={() => setShowModal(false)}
          onAlertSent={() => setLastAlert(new Date())}
        />
      )}
    </div>
  );
}
