'use client';

import { useState } from 'react';
import CalendarWorkOrderCard from './CalendarWorkOrderCard';

export default function CalendarDayCell({
  date, workOrders, isToday, isCurrentMonth, isSelected, isWeekend,
  capacity, onDragStart, onDragEnd, onDrop, onDragOver,
  onSelectWorkOrder, onSelectDate, onUnschedule, leadTechs
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const capColor = () => {
    if (capacity.percentage === 0) return 'bg-[#2d2d44]';
    if (capacity.percentage < 50)  return 'bg-emerald-500';
    if (capacity.percentage < 80)  return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleDrop = (e) => { e.preventDefault(); setIsDragOver(false); onDrop(e, date); };

  const maxVis = 1;
  const visible = isExpanded ? workOrders : workOrders.slice(0, maxVis);
  const hidden  = workOrders.length - maxVis;

  return (
    <div
      className={`
        min-h-[50px] md:min-h-[100px] border-t border-l border-[#1e1e2e]
        p-0.5 md:p-1 transition-all cursor-pointer
        ${!isCurrentMonth ? 'bg-[#0a0a0f]/80 text-slate-700' : 'bg-[#0d0d14]'}
        ${isToday        ? 'ring-2 ring-inset ring-blue-500' : ''}
        ${isSelected     ? 'bg-blue-500/10' : ''}
        ${isWeekend && isCurrentMonth ? 'bg-[#0a0a0f]' : ''}
        ${isDragOver     ? 'bg-blue-500/20 ring-2 ring-inset ring-dashed ring-blue-400' : ''}
      `}
      onDragOver={onDragOver}
      onDragEnter={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={e => { e.preventDefault(); setIsDragOver(false); }}
      onDrop={handleDrop}
      onClick={() => onSelectDate(date)}
    >
      {/* Day number + capacity dot */}
      <div className="flex items-center justify-between mb-0.5 md:mb-1">
        <span className={`text-[10px] md:text-sm font-semibold px-1 py-0.5 rounded
          ${isToday ? 'bg-blue-600 text-white' : !isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
          {date.getDate()}
        </span>
        {workOrders.length > 0 && (
          <div className="flex items-center gap-0.5">
            <div className={`w-1.5 h-1.5 rounded-full ${capColor()}`} />
            <span className="text-[9px] text-slate-600">{workOrders.length}</span>
          </div>
        )}
      </div>

      {/* Work order cards */}
      <div className="space-y-0.5 md:space-y-1">
        {visible.map(wo => (
          <CalendarWorkOrderCard key={wo.wo_id} workOrder={wo} compact
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            onClick={onSelectWorkOrder} onUnschedule={onUnschedule} leadTechs={leadTechs} />
        ))}
      </div>

      {hidden > 0 && (
        <button onClick={e => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
          className="w-full mt-0.5 text-[9px] text-blue-400 hover:text-blue-300 flex items-center justify-center">
          {isExpanded ? '▲' : `+${hidden}`}
        </button>
      )}
    </div>
  );
}
