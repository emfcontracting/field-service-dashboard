'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStatusColor } from '../utils/styleHelpers';

const SEL = ({ label, className = '', children, ...props }) => (
  <select className={`bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500/60 transition ${className}`} {...props}>{children}</select>
);

export default function MissingHoursView({ workOrders, users, supabase, onSelectWorkOrder, refreshWorkOrders }) {
  const [missingWOs,          setMissingWOs]          = useState([]);
  const [loading,             setLoading]             = useState(true);
  const [dateRange,           setDateRange]           = useState('30');
  const [selectedTechs,       setSelectedTechs]       = useState([]);
  const [selectedStatuses,    setSelectedStatuses]    = useState([]);
  const [showTechDrop,        setShowTechDrop]        = useState(false);
  const [showStatusDrop,      setShowStatusDrop]      = useState(false);

  const techs = (users || []).filter(u => ['lead_tech','tech','helper'].includes(u.role) && u.is_active)
    .sort((a,b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

  const statusOptions = [
    { value: 'assigned',    label: 'Assigned' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed',   label: 'Completed' },
  ];

  const chunk = (arr, n) => { const r=[]; for(let i=0;i<arr.length;i+=n) r.push(arr.slice(i,i+n)); return r; };
  const toggleTech   = id  => setSelectedTechs(p   => p.includes(id)  ? p.filter(x=>x!==id)  : [...p,id]);
  const toggleStatus = s   => setSelectedStatuses(p => p.includes(s)   ? p.filter(x=>x!==s)   : [...p,s]);
  const toggleAllTechs    = () => setSelectedTechs(p   => p.length===techs.length ? [] : techs.map(t=>t.user_id));
  const toggleAllStatuses = () => setSelectedStatuses(p => p.length===statusOptions.length ? [] : statusOptions.map(s=>s.value));
  const clearFilters = () => { setSelectedTechs([]); setSelectedStatuses([]); };

  useEffect(() => {
    const fn = e => {
      if (!e.target.closest('.td') && !e.target.closest('.tdb')) setShowTechDrop(false);
      if (!e.target.closest('.sd') && !e.target.closest('.sdb')) setShowStatusDrop(false);
    };
    document.addEventListener('click', fn);
    return () => document.removeEventListener('click', fn);
  }, []);

  const fetchMissing = useCallback(async () => {
    if (!workOrders?.length || !supabase) { setMissingWOs([]); setLoading(false); return; }
    setLoading(true);
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(dateRange));
      const eligible = workOrders.filter(wo =>
        wo.lead_tech_id &&
        ['assigned','in_progress','completed'].includes(wo.status) &&
        new Date(wo.date_entered || wo.created_at) >= cutoff
      );
      if (!eligible.length) { setMissingWOs([]); setLoading(false); return; }

      const woIds   = eligible.map(wo => wo.wo_id);
      const chunks  = chunk(woIds, 10);
      let hoursData = [], assignments = [];
      for (const c of chunks) {
        const { data: h } = await supabase.from('daily_hours_log').select('wo_id,user_id,hours_regular,hours_overtime').in('wo_id',c);
        const { data: a } = await supabase.from('work_order_assignments').select('wo_id,user_id,user:users(first_name,last_name)').in('wo_id',c);
        if (h) hoursData = [...hoursData, ...h];
        if (a) assignments = [...assignments, ...a];
      }
      const hoursPerWO = {}, techHours = {};
      hoursData.forEach(e => {
        const t = (parseFloat(e.hours_regular)||0)+(parseFloat(e.hours_overtime)||0);
        hoursPerWO[e.wo_id] = (hoursPerWO[e.wo_id]||0)+t;
        if (t>0) { if (!techHours[e.wo_id]) techHours[e.wo_id]=new Set(); techHours[e.wo_id].add(e.user_id); }
      });
      const asgnPerWO = {};
      assignments.forEach(a => { if (!asgnPerWO[a.wo_id]) asgnPerWO[a.wo_id]=[]; asgnPerWO[a.wo_id].push(a); });

      const missing = eligible.map(wo => {
        const total = hoursPerWO[wo.wo_id]||0;
        const techsWithHours = techHours[wo.wo_id]||new Set();
        const woAsgns = asgnPerWO[wo.wo_id]||[];
        const days = Math.floor((Date.now() - new Date(wo.date_entered||wo.created_at))/(86400000));
        const techIds = new Set();
        if (wo.lead_tech_id) techIds.add(wo.lead_tech_id);
        woAsgns.forEach(a => techIds.add(a.user_id));
        const missing = [];
        techIds.forEach(id => { if (!techsWithHours.has(id)) { const t=users.find(u=>u.user_id===id); if(t) missing.push(t); } });
        return { ...wo, totalHoursLogged:total, daysSinceStart:days, assignedTechIds:Array.from(techIds), techsMissingHours:missing, teamAssignments:woAsgns, hasMissingHours:total===0 };
      }).filter(wo=>wo.hasMissingHours).sort((a,b)=>b.daysSinceStart-a.daysSinceStart);
      setMissingWOs(missing);
    } catch(e) { console.error(e); setMissingWOs([]); }
    finally { setLoading(false); }
  }, [workOrders, users, supabase, dateRange]);

  useEffect(() => { fetchMissing(); }, [fetchMissing]);

  const filtered = missingWOs.filter(wo => {
    if (selectedTechs.length > 0) {
      const ok = selectedTechs.some(id => wo.lead_tech_id===id || wo.assignedTechIds.includes(id) || wo.techsMissingHours.some(t=>t.user_id===id));
      if (!ok) return false;
    }
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(wo.status)) return false;
    return true;
  });

  const exportCSV = () => {
    const rows = filtered.map(wo => [
      wo.wo_number, new Date(wo.date_entered||wo.created_at).toLocaleDateString(),
      wo.building, wo.status,
      wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : 'Unassigned',
      wo.daysSinceStart, wo.totalHoursLogged.toFixed(1),
      wo.techsMissingHours.map(t=>`${t.first_name} ${t.last_name}`).join('; ')
    ]);
    const csv = [['WO#','Date','Building','Status','Lead Tech','Days Open','Hours Logged','Techs Missing Hours'],...rows].map(r=>r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv'}));
    a.download = `missing-hours-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getTechName = id => { const t=techs.find(t=>t.user_id===id); return t?`${t.first_name} ${t.last_name.charAt(0)}.`:''; };

  const dayBadge = d => d>7 ? 'bg-red-500/20 text-red-400 border-red-500/30' : d>3 ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-[#1e1e2e] text-slate-400 border-[#2d2d44]';

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Missing Hours
          </h2>
          <p className="text-slate-500 text-xs mt-1">Work orders with assigned techs but no hours logged</p>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black font-mono text-red-400">{filtered.length}</p>
          <p className="text-slate-600 text-xs">work orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4">
        <div className="flex flex-wrap gap-2">

          {/* Tech filter */}
          <div className="relative">
            <button onClick={() => setShowTechDrop(p=>!p)}
              className={`tdb px-3 py-2 rounded-lg text-sm flex items-center gap-2 border transition ${selectedTechs.length ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-[#0a0a0f] border-[#2d2d44] text-slate-300 hover:border-blue-500/40'}`}>
              👷 {selectedTechs.length === 0 ? 'All Techs' : selectedTechs.length === 1 ? getTechName(selectedTechs[0]) : `${selectedTechs.length} Techs`}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showTechDrop && (
              <div className="td absolute top-full left-0 mt-1 bg-[#0d0d14] border border-[#2d2d44] rounded-xl shadow-2xl z-50 min-w-[200px] max-h-60 overflow-y-auto">
                <div className="px-3 py-2.5 hover:bg-[#1e1e2e] cursor-pointer border-b border-[#1e1e2e] flex items-center gap-2" onClick={toggleAllTechs}>
                  <input type="checkbox" readOnly checked={selectedTechs.length===techs.length} className="w-3.5 h-3.5 accent-blue-500"/>
                  <span className="text-xs font-semibold text-slate-200">Select All</span>
                </div>
                {techs.map(t => (
                  <div key={t.user_id} className="px-3 py-2.5 hover:bg-[#1e1e2e] cursor-pointer flex items-center gap-2" onClick={() => toggleTech(t.user_id)}>
                    <input type="checkbox" readOnly checked={selectedTechs.includes(t.user_id)} className="w-3.5 h-3.5 accent-blue-500"/>
                    <span className="text-xs text-slate-300">{t.first_name} {t.last_name}</span>
                    {t.role === 'lead_tech' && <span className="text-yellow-400 text-[10px] ml-auto">★</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status filter */}
          <div className="relative">
            <button onClick={() => setShowStatusDrop(p=>!p)}
              className={`sdb px-3 py-2 rounded-lg text-sm flex items-center gap-2 border transition ${selectedStatuses.length ? 'bg-blue-500/15 border-blue-500/30 text-blue-400' : 'bg-[#0a0a0f] border-[#2d2d44] text-slate-300 hover:border-blue-500/40'}`}>
              📋 {selectedStatuses.length === 0 ? 'All Status' : selectedStatuses.length === 1 ? statusOptions.find(s=>s.value===selectedStatuses[0])?.label : `${selectedStatuses.length} Status`}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showStatusDrop && (
              <div className="sd absolute top-full left-0 mt-1 bg-[#0d0d14] border border-[#2d2d44] rounded-xl shadow-2xl z-50 min-w-[160px]">
                <div className="px-3 py-2.5 hover:bg-[#1e1e2e] cursor-pointer border-b border-[#1e1e2e] flex items-center gap-2" onClick={toggleAllStatuses}>
                  <input type="checkbox" readOnly checked={selectedStatuses.length===statusOptions.length} className="w-3.5 h-3.5 accent-blue-500"/>
                  <span className="text-xs font-semibold text-slate-200">Select All</span>
                </div>
                {statusOptions.map(s => (
                  <div key={s.value} className="px-3 py-2.5 hover:bg-[#1e1e2e] cursor-pointer flex items-center gap-2" onClick={() => toggleStatus(s.value)}>
                    <input type="checkbox" readOnly checked={selectedStatuses.includes(s.value)} className="w-3.5 h-3.5 accent-blue-500"/>
                    <span className="text-xs text-slate-300">{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Date range */}
          <SEL value={dateRange} onChange={e => setDateRange(e.target.value)}>
            <option value="7">7 Days</option>
            <option value="14">14 Days</option>
            <option value="30">30 Days</option>
            <option value="60">60 Days</option>
            <option value="90">90 Days</option>
          </SEL>

          {/* Actions */}
          <button onClick={fetchMissing} className="bg-[#0a0a0f] border border-[#2d2d44] hover:border-blue-500/40 text-slate-400 hover:text-slate-200 px-3 py-2 rounded-lg text-sm transition">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
          {(selectedTechs.length > 0 || selectedStatuses.length > 0) && (
            <button onClick={clearFilters} className="bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 px-3 py-2 rounded-lg text-sm transition">Clear</button>
          )}
          <button onClick={exportCSV} disabled={!filtered.length} className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/30 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 rounded-lg text-sm transition hidden md:block">
            CSV Export
          </button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-10 text-center">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin mx-auto mb-3"/>
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#0d0d14] border border-emerald-500/20 rounded-xl p-10 text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p className="text-emerald-400 font-bold">All Caught Up!</p>
          <p className="text-slate-600 text-sm mt-1">No missing hours found</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map(wo => (
              <div key={wo.wo_id} onClick={() => onSelectWorkOrder(wo)}
                className={`bg-[#0d0d14] border rounded-xl p-4 cursor-pointer transition active:bg-[#1e1e2e] ${wo.daysSinceStart>7?'border-red-500/40':'border-[#1e1e2e]'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-slate-200 text-sm">{wo.wo_number}</p>
                    <p className="text-slate-500 text-xs">{wo.building}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${dayBadge(wo.daysSinceStart)}`}>{wo.daysSinceStart}d</span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">{wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name.charAt(0)}.` : 'Unassigned'}</span>
                  <span className="text-red-400 font-bold">0 hrs</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1e1e2e]">
                  {['WO#','Date','Building','Status','Lead Tech','Days','Hours',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-slate-500 uppercase tracking-wider font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1e2e]">
                {filtered.map(wo => (
                  <tr key={wo.wo_id} onClick={() => onSelectWorkOrder(wo)}
                    className="hover:bg-[#1e1e2e]/50 cursor-pointer transition">
                    <td className="px-4 py-3 font-bold text-slate-200">{wo.wo_number}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{new Date(wo.date_entered||wo.created_at).toLocaleDateString('en-US',{month:'2-digit',day:'2-digit'})}</td>
                    <td className="px-4 py-3 text-slate-300">{wo.building}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        wo.status==='completed'?'bg-emerald-500/15 text-emerald-400 border-emerald-500/30':
                        wo.status==='in_progress'?'bg-purple-500/15 text-purple-400 border-purple-500/30':
                        'bg-blue-500/15 text-blue-400 border-blue-500/30'}`}>
                        {wo.status.replace('_',' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name.charAt(0)}.` : <span className="text-slate-600">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${dayBadge(wo.daysSinceStart)}`}>{wo.daysSinceStart}</span>
                    </td>
                    <td className="px-4 py-3 text-red-400 font-bold font-mono">0.0</td>
                    <td className="px-4 py-3">
                      <button className="bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-400 px-3 py-1 rounded-lg text-xs font-semibold transition">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Summary stats */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total',            val: filtered.length,                                                       color: 'text-slate-200',  bg: 'border-[#1e1e2e]' },
            { label: 'Critical (>7d)',   val: filtered.filter(w=>w.daysSinceStart>7).length,                        color: 'text-red-400',    bg: 'border-red-500/25' },
            { label: 'Warning (3-7d)',   val: filtered.filter(w=>w.daysSinceStart>3&&w.daysSinceStart<=7).length,   color: 'text-orange-400', bg: 'border-orange-500/25' },
            { label: 'Zero Hours',       val: filtered.filter(w=>w.totalHoursLogged===0).length,                    color: 'text-yellow-400', bg: 'border-yellow-500/25' },
          ].map(s => (
            <div key={s.label} className={`bg-[#0d0d14] border ${s.bg} rounded-xl p-4`}>
              <p className="text-slate-600 text-xs">{s.label}</p>
              <p className={`text-2xl font-black font-mono mt-1 ${s.color}`}>{s.val}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
