// app/dashboard/components/calendar/CalendarWeekView.js
'use client';

import { useMemo, useState } from 'react';
import CalendarWorkOrderCard from './CalendarWorkOrderCard';

export default function CalendarWeekView({
  currentDate,
  workOrdersByDate,
  onDragStart,
  onDragEnd,
  onDrop,
  onDragOver,
  onSelectWorkOrder,
  calculateDayCapacity,
  onUnschedule,
  leadTechs
}) {
  const [dragOverDate, setDragOverDate] = useState(null);

  // Generate week days
  const weekDays = useMemo(() => {
    const days = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      days.push(day);
    }
    
    return days;
  }, [currentDate]);

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const getCapacityBarColor = (percentage) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleDragEnter = (date) => {
    setDragOverDate(date.toISOString().split('T')[0]);
  };

  const handleDragLeave = () => {
    setDragOverDate(null);
  };

  const handleDrop = (e, date) => {
    setDragOverDate(null);
    onDrop(e, date);
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden min-w-[320px]">
      {/* Week header - Compact on mobile */}
      <div className="grid grid-cols-7 bg-gray-700">
        {weekDays.map((date, index) => {
          const dateKey = date.toISOString().split('T')[0];
          const dayWorkOrders = workOrdersByDate[dateKey] || [];
          const capacity = calculateDayCapacity(date);
          
          return (
            <div 
              key={index} 
              className={`
                p-1 md:p-3 text-center border-l border-gray-600 first:border-l-0
                ${isToday(date) ? 'bg-blue-900/30' : ''}
              `}
            >
              <div className="text-[9px] md:text-xs text-gray-400 uppercase">
                {date.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}
                <span className="hidden md:inline">
                  {date.toLocaleDateString('en-US', { weekday: 'short' }).slice(1)}
                </span>
              </div>
              <div className={`
                text-sm md:text-2xl font-bold mt-0.5 md:mt-1
                ${isToday(date) ? 'text-blue-400' : 'text-white'}
              `}>
                {date.getDate()}
              </div>
              
              {/* Capacity bar */}
              <div className="mt-1 md:mt-2 h-1 md:h-1.5 bg-gray-600 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${getCapacityBarColor(capacity.percentage)}`}
                  style={{ width: `${Math.min(capacity.percentage, 100)}%` }}
                />
              </div>
              <div className="text-[8px] md:text-[10px] text-gray-500 mt-0.5">
                {dayWorkOrders.length}
              </div>
            </div>
          );
        })}
      </div>

      {/* Week content - Scrollable on mobile */}
      <div className="grid grid-cols-7 min-h-[300px] md:min-h-[500px]">
        {weekDays.map((date, index) => {
          const dateKey = date.toISOString().split('T')[0];
          const dayWorkOrders = workOrdersByDate[dateKey] || [];
          const isDragOver = dragOverDate === dateKey;
          
          return (
            <div 
              key={index}
              className={`
                border-l border-gray-700 first:border-l-0 p-1 md:p-2 space-y-1 md:space-y-2
                transition-colors overflow-y-auto
                ${isToday(date) ? 'bg-blue-900/10' : ''}
                ${isDragOver ? 'bg-blue-900/30 ring-2 ring-inset ring-blue-400 ring-dashed' : ''}
              `}
              onDragOver={onDragOver}
              onDragEnter={() => handleDragEnter(date)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, date)}
            >
              {dayWorkOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-600 text-[10px] md:text-sm">
                  {isDragOver ? '↓' : '—'}
                </div>
              ) : (
                dayWorkOrders.map(wo => (
                  <CalendarWorkOrderCard
                    key={wo.wo_id}
                    workOrder={wo}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onClick={onSelectWorkOrder}
                    onUnschedule={onUnschedule}
                    compact={true}
                    leadTechs={leadTechs}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
