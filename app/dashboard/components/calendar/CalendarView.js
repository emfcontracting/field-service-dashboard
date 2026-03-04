'use client';

import { useState, useEffect, useCallback } from 'react';
import CalendarGrid from './CalendarGrid';
import CalendarWeekView from './CalendarWeekView';
import CapacityPanel from './CapacityPanel';

export default function CalendarView({ workOrders, users, supabase, refreshWorkOrders, onSelectWorkOrder }) {
  const [currentDate,       setCurrentDate]       = useState(new Date());
  const [viewMode,          setViewMode]          = useState('month');
  const [draggedWO,         setDraggedWO]         = useState(null);
  const [showCapacity,      setShowCapacity]      = useState(false);
  const [selectedDate,      setSelectedDate]      = useState(null);
  const [isUpdating,        setIsUpdating]        = useState(false);
  const [leadTechFilter,    setLeadTechFilter]    = useState('all');

  useEffect(() => {
    const check = () => setShowCapacity(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const leadTechs = users.filter(u => u.role === 'lead_tech' || u.role === 'admin');
  const filtered  = leadTechFilter === 'all' ? workOrders : workOrders.filter(wo => wo.lead_tech_id === leadTechFilter);

  const byDate = useCallback(() => {
    const g = {};
    filtered.forEach(wo => {
      if (!wo.scheduled_date) return;
      const k = new Date(wo.scheduled_date).toISOString().split('T')[0];
      if (!g[k]) g[k] = [];
      g[k].push(wo);
    });
    return g;
  }, [filtered]);

  const unscheduled = filtered.filter(wo => !wo.scheduled_date && !['completed','needs_return'].includes(wo.status));

  const handleDragStart = (e, wo) => {
    setDraggedWO(wo);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', wo.wo_id);
    setTimeout(() => { e.target.style.opacity = '0.5'; }, 0);
  };
  const handleDragEnd   = (e) => { e.target.style.opacity = '1'; setDraggedWO(null); };
  const handleDragOver  = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const handleDrop = async (e, date) => {
    e.preventDefault();
    if (!draggedWO) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('work_orders').update({ scheduled_date: date.toISOString().split('T')[0] }).eq('wo_id', draggedWO.wo_id);
      if (error) throw error;
      await refreshWorkOrders();
    } catch (err) { alert('Failed to reschedule: ' + err.message); }
    finally { setIsUpdating(false); setDraggedWO(null); }
  };

  const handleUnschedule = async (wo) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('work_orders').update({ scheduled_date: null }).eq('wo_id', wo.wo_id);
      if (error) throw error;
      await refreshWorkOrders();
    } catch (err) { alert('Failed to unschedule: ' + err.message); }
    finally { setIsUpdating(false); }
  };

  const navigate = (d) => {
    const n = new Date(currentDate);
    viewMode === 'month' ? n.setMonth(n.getMonth() + d) : n.setDate(n.getDate() + d * 7);
    setCurrentDate(n);
  };

  const calcCapacity = (date) => {
    const k  = date.toISOString().split('T')[0];
    const wos = byDate()[k] || [];
    const max = leadTechs.length * 3;
    return { count: wos.length, maxCapacity: max, percentage: max > 0 ? (wos.length / max) * 100 : 0 };
  };

  const Btn = ({ active, onClick, children, className='' }) => (
    <button onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${active ? 'bg-blue-600 text-white' : 'bg-[#0a0a0f] border border-[#2d2d44] text-slate-400 hover:text-slate-200 hover:border-[#3d3d5e]'} ${className}`}>
      {children}
    </button>
  );

  return (
    <div className="space-y-4">

      {/* Controls */}
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl px-5 py-4 space-y-3">
        {/* Nav */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="bg-[#0a0a0f] border border-[#2d2d44] hover:border-[#3d3d5e] text-slate-400 px-3 py-2 rounded-lg text-sm transition">←</button>
            <h2 className="text-sm font-bold text-slate-200 min-w-[160px] text-center">
              {currentDate.toLocaleDateString('en-US', { month:'long', year:'numeric' })}
            </h2>
            <button onClick={() => navigate(1)} className="bg-[#0a0a0f] border border-[#2d2d44] hover:border-[#3d3d5e] text-slate-400 px-3 py-2 rounded-lg text-sm transition">→</button>
          </div>
          <Btn active={false} onClick={() => setCurrentDate(new Date())} className="text-xs !px-3 !py-1.5">Today</Btn>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <div className="flex bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-0.5 flex-shrink-0">
            {['month','week'].map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 rounded text-xs font-semibold transition capitalize ${viewMode===v ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                {v}
              </button>
            ))}
          </div>

          <select value={leadTechFilter} onChange={e => setLeadTechFilter(e.target.value)}
            className="bg-[#0a0a0f] border border-[#2d2d44] text-slate-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500/60 transition flex-shrink-0">
            <option value="all">All Techs</option>
            {leadTechs.map(t => <option key={t.user_id} value={t.user_id}>{t.first_name} {t.last_name}</option>)}
          </select>

          <button onClick={() => setShowCapacity(p => !p)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition flex-shrink-0 ${showCapacity ? 'bg-purple-500/20 border border-purple-500/30 text-purple-400' : 'bg-[#0a0a0f] border border-[#2d2d44] text-slate-500 hover:text-slate-300'}`}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Capacity
          </button>

          {isUpdating && (
            <div className="flex items-center gap-2 text-yellow-400 text-xs flex-shrink-0">
              <div className="w-3 h-3 rounded-full border-2 border-yellow-500/30 border-t-yellow-500 animate-spin"/>
              Updating...
            </div>
          )}
        </div>
      </div>

      {/* Calendar + Sidebar */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1 overflow-x-auto">
          {viewMode === 'month'
            ? <CalendarGrid currentDate={currentDate} workOrdersByDate={byDate()}
                onDragStart={handleDragStart} onDragEnd={handleDragEnd}
                onDrop={handleDrop} onDragOver={handleDragOver}
                onSelectWorkOrder={onSelectWorkOrder} onSelectDate={setSelectedDate}
                selectedDate={selectedDate} calculateDayCapacity={calcCapacity}
                onUnschedule={handleUnschedule} leadTechs={leadTechs} />
            : <CalendarWeekView currentDate={currentDate} workOrdersByDate={byDate()}
                onDragStart={handleDragStart} onDragEnd={handleDragEnd}
                onDrop={handleDrop} onDragOver={handleDragOver}
                onSelectWorkOrder={onSelectWorkOrder} calculateDayCapacity={calcCapacity}
                onUnschedule={handleUnschedule} leadTechs={leadTechs} />}
        </div>

        {showCapacity && (
          <div className="w-full lg:w-72 flex-shrink-0">
            <CapacityPanel currentDate={currentDate} viewMode={viewMode}
              workOrdersByDate={byDate()} unscheduledWorkOrders={unscheduled}
              leadTechs={leadTechs} onDragStart={handleDragStart} onDragEnd={handleDragEnd}
              onSelectWorkOrder={onSelectWorkOrder} calculateDayCapacity={calcCapacity} />
          </div>
        )}
      </div>
    </div>
  );
}
