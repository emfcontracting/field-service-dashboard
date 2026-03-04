'use client';

import { useMemo } from 'react';
import CalendarDayCell from './CalendarDayCell';

const DAY_NAMES = [
  { short:'Sun', abbr:'S' },{ short:'Mon', abbr:'M' },{ short:'Tue', abbr:'T' },
  { short:'Wed', abbr:'W' },{ short:'Thu', abbr:'T' },{ short:'Fri', abbr:'F' },
  { short:'Sat', abbr:'S' },
];

export default function CalendarGrid({
  currentDate, workOrdersByDate, onDragStart, onDragEnd, onDrop, onDragOver,
  onSelectWorkOrder, onSelectDate, selectedDate, calculateDayCapacity, onUnschedule, leadTechs
}) {
  const days = useMemo(() => {
    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    const start = new Date(first); start.setDate(start.getDate() - start.getDay());
    const end   = new Date(last);
    if (end.getDay() !== 6) end.setDate(end.getDate() + (6 - end.getDay()));
    const arr = []; const cur = new Date(start);
    while (cur <= end) { arr.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
    return arr;
  }, [currentDate]);

  const today    = d => d.toDateString() === new Date().toDateString();
  const curMonth = d => d.getMonth() === currentDate.getMonth();
  const isSel    = d => selectedDate && d.toDateString() === selectedDate.toDateString();
  const weekend  = d => d.getDay() === 0 || d.getDay() === 6;

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden min-w-[280px]">
      {/* Header */}
      <div className="grid grid-cols-7 bg-[#0a0a0f] border-b border-[#1e1e2e]">
        {DAY_NAMES.map((d, i) => (
          <div key={i} className="py-2 md:py-3 text-center text-[10px] md:text-xs font-semibold text-slate-600 uppercase tracking-wide">
            <span className="sm:hidden">{d.abbr}</span>
            <span className="hidden sm:inline">{d.short}</span>
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7">
        {days.map((date, i) => {
          const key = date.toISOString().split('T')[0];
          return (
            <CalendarDayCell key={i} date={date}
              workOrders={workOrdersByDate[key] || []}
              isToday={today(date)} isCurrentMonth={curMonth(date)}
              isSelected={isSel(date)} isWeekend={weekend(date)}
              capacity={calculateDayCapacity(date)}
              onDragStart={onDragStart} onDragEnd={onDragEnd}
              onDrop={onDrop} onDragOver={onDragOver}
              onSelectWorkOrder={onSelectWorkOrder} onSelectDate={onSelectDate}
              onUnschedule={onUnschedule} leadTechs={leadTechs} />
          );
        })}
      </div>
    </div>
  );
}
