'use client';

import { useMemo, useState } from 'react';
import CalendarWorkOrderCard from './CalendarWorkOrderCard';

export default function CalendarWeekView({
  currentDate, workOrdersByDate, onDragStart, onDragEnd, onDrop, onDragOver,
  onSelectWorkOrder, calculateDayCapacity, onUnschedule, leadTechs
}) {
  const [dragOver, setDragOver] = useState(null);

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(d.getDate() + i); return d;
    });
  }, [currentDate]);

  const isToday  = d => d.toDateString() === new Date().toDateString();
  const capColor = p => p < 50 ? 'bg-emerald-500' : p < 80 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden min-w-[320px]">
      {/* Week header */}
      <div className="grid grid-cols-7 border-b border-[#1e1e2e]">
        {weekDays.map((date, i) => {
          const key = date.toISOString().split('T')[0];
          const wos = workOrdersByDate[key] || [];
          const cap = calculateDayCapacity(date);
          return (
            <div key={i} className={`p-2 md:p-3 text-center border-l border-[#1e1e2e] first:border-l-0 ${isToday(date) ? 'bg-blue-500/10' : 'bg-[#0a0a0f]'}`}>
              <p className="text-[9px] md:text-xs text-slate-600 uppercase">{date.toLocaleDateString('en-US',{weekday:'short'}).slice(0,3)}</p>
              <p className={`text-sm md:text-2xl font-black mt-0.5 ${isToday(date) ? 'text-blue-400' : 'text-slate-300'}`}>{date.getDate()}</p>
              <div className="mt-1.5 h-1 bg-[#1e1e2e] rounded-full overflow-hidden">
                <div className={`h-full transition-all ${capColor(cap.percentage)}`} style={{width:`${Math.min(cap.percentage,100)}%`}}/>
              </div>
              <p className="text-[8px] text-slate-600 mt-0.5">{wos.length}</p>
            </div>
          );
        })}
      </div>

      {/* Week body */}
      <div className="grid grid-cols-7 min-h-[300px] md:min-h-[500px]">
        {weekDays.map((date, i) => {
          const key = date.toISOString().split('T')[0];
          const wos = workOrdersByDate[key] || [];
          const over = dragOver === key;
          return (
            <div key={i}
              className={`border-l border-[#1e1e2e] first:border-l-0 p-1 md:p-2 space-y-1 transition overflow-y-auto
                ${isToday(date) ? 'bg-blue-500/5' : ''}
                ${over ? 'bg-blue-500/15 ring-2 ring-inset ring-dashed ring-blue-400' : ''}`}
              onDragOver={onDragOver}
              onDragEnter={() => setDragOver(key)}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => { setDragOver(null); onDrop(e, date); }}>
              {wos.length === 0
                ? <div className="h-full flex items-center justify-center text-slate-700 text-sm">{over ? '↓' : '—'}</div>
                : wos.map(wo => (
                    <CalendarWorkOrderCard key={wo.wo_id} workOrder={wo} compact
                      onDragStart={onDragStart} onDragEnd={onDragEnd}
                      onClick={onSelectWorkOrder} onUnschedule={onUnschedule} leadTechs={leadTechs} />
                  ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
