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

  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Get capacity color
  const getCapacityBarColor = (percentage) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Handle drag events for each day column
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
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Week header */}
      <div className="grid grid-cols-7 bg-gray-700">
        {weekDays.map((date, index) => {
          const dateKey = date.toISOString().split('T')[0];
          const dayWorkOrders = workOrdersByDate[dateKey] || [];
          const capacity = calculateDayCapacity(date);
          
          return (
            <div 
              key={index} 
              className={`
                p-3 text-center border-l border-gray-600 first:border-l-0
                ${isToday(date) ? 'bg-blue-900/30' : ''}
              `}
            >
              <div className="text-xs text-gray-400 uppercase">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`
                text-2xl font-bold mt-1
                ${isToday(date) ? 'text-blue-400' : 'text-white'}
              `}>
                {date.getDate()}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {date.toLocaleDateString('en-US', { month: 'short' })}
              </div>
              
              {/* Capacity bar */}
              <div className="mt-2 h-1.5 bg-gray-600 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${getCapacityBarColor(capacity.percentage)}`}
                  style={{ width: `${Math.min(capacity.percentage, 100)}%` }}
                />
              </div>
              <div className="text-[10px] text-gray-500 mt-1">
                {dayWorkOrders.length} WO{dayWorkOrders.length !== 1 ? 's' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Week content */}
      <div className="grid grid-cols-7 min-h-[500px]">
        {weekDays.map((date, index) => {
          const dateKey = date.toISOString().split('T')[0];
          const dayWorkOrders = workOrdersByDate[dateKey] || [];
          const isDragOver = dragOverDate === dateKey;
          
          return (
            <div 
              key={index}
              className={`
                border-l border-gray-700 first:border-l-0 p-2 space-y-2
                transition-colors
                ${isToday(date) ? 'bg-blue-900/10' : ''}
                ${isDragOver ? 'bg-blue-900/30 ring-2 ring-inset ring-blue-400 ring-dashed' : ''}
              `}
              onDragOver={onDragOver}
              onDragEnter={() => handleDragEnter(date)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, date)}
            >
              {dayWorkOrders.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-600 text-sm">
                  {isDragOver ? 'Drop here' : 'No work orders'}
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
                    compact={false}
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
