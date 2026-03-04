'use client';

import { useMemo } from 'react';
import CalendarWorkOrderCard from './CalendarWorkOrderCard';

export default function CapacityPanel({
  currentDate, viewMode, workOrdersByDate, unscheduledWorkOrders,
  leadTechs, onDragStart, onDragEnd, onSelectWorkOrder, calculateDayCapacity
}) {
  const weekDates = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); return d;
    });
  }, [currentDate]);

  const techWorkloads = useMemo(() => {
    const w = {};
    leadTechs.forEach(t => { w[t.user_id] = { tech:t, scheduled:0, unscheduled:0 }; });
    w['unassigned'] = { tech:{ first_name:'Unassigned', last_name:'', user_id:'unassigned' }, scheduled:0, unscheduled:0 };
    Object.values(workOrdersByDate).flat().forEach(wo => {
      const id = wo.lead_tech_id || 'unassigned';
      if (w[id]) w[id].scheduled++;
    });
    unscheduledWorkOrders.forEach(wo => {
      const id = wo.lead_tech_id || 'unassigned';
      if (w[id]) w[id].unscheduled++;
    });
    return w;
  }, [workOrdersByDate, unscheduledWorkOrders, leadTechs]);

  const capColor = p => p < 50 ? 'bg-emerald-500' : p < 80 ? 'bg-yellow-500' : 'bg-red-500';

  const sorted = useMemo(() => {
    const o = { emergency:0, high:1, medium:2, low:3 };
    return [...unscheduledWorkOrders].sort((a,b) => (o[a.priority]||4)-(o[b.priority]||4));
  }, [unscheduledWorkOrders]);

  const Section = ({ title, children }) => (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e1e2e]">
        <h3 className="text-xs font-semibold text-slate-400">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Weekly capacity */}
      <Section title="This Week's Capacity">
        <div className="space-y-2">
          {weekDates.map((date, i) => {
            const cap = calculateDayCapacity(date);
            const tod = date.toDateString() === new Date().toDateString();
            return (
              <div key={i} className="flex items-center gap-2">
                <span className={`text-[10px] w-8 flex-shrink-0 ${tod ? 'text-blue-400 font-bold' : 'text-slate-600'}`}>
                  {date.toLocaleDateString('en-US',{weekday:'short'})}
                </span>
                <div className="flex-1 h-2 bg-[#1e1e2e] rounded-full overflow-hidden">
                  <div className={`h-full transition-all ${capColor(cap.percentage)}`} style={{width:`${Math.min(cap.percentage,100)}%`}}/>
                </div>
                <span className="text-[10px] text-slate-600 w-4 text-right font-mono">{cap.count}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Tech workloads */}
      <Section title="Tech Workloads">
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {Object.values(techWorkloads)
            .filter(w => w.scheduled > 0 || w.unscheduled > 0)
            .sort((a,b) => (b.scheduled+b.unscheduled)-(a.scheduled+a.unscheduled))
            .map(({ tech, scheduled, unscheduled }) => (
              <div key={tech.user_id} className="flex items-center justify-between py-1.5 border-b border-[#1e1e2e] last:border-0">
                <span className={`text-xs truncate max-w-[130px] ${tech.user_id==='unassigned' ? 'text-slate-600 italic' : 'text-slate-300'}`}>
                  {tech.first_name} {tech.last_name}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 rounded-full font-bold">{scheduled}</span>
                  {unscheduled > 0 && (
                    <span className="text-[10px] px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 rounded-full font-bold">{unscheduled}</span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </Section>

      {/* Unscheduled */}
      <Section title={`Unscheduled${sorted.length > 0 ? ` (${sorted.length})` : ''}`}>
        {sorted.length === 0 ? (
          <p className="text-center text-slate-600 text-xs py-2">All scheduled! 🎉</p>
        ) : (
          <>
            {sorted.some(wo => ['emergency','high'].includes(wo.priority)) && (
              <div className="flex items-center gap-1.5 text-[10px] text-orange-400 mb-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
                High priority items
              </div>
            )}
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {sorted.map(wo => (
                <CalendarWorkOrderCard key={wo.wo_id} workOrder={wo} compact
                  onDragStart={onDragStart} onDragEnd={onDragEnd}
                  onClick={onSelectWorkOrder} leadTechs={leadTechs} />
              ))}
            </div>
            <p className="text-center text-slate-700 text-[10px] mt-3 pt-3 border-t border-[#1e1e2e] hidden md:block">
              Drag to calendar to schedule
            </p>
          </>
        )}
      </Section>
    </div>
  );
}
