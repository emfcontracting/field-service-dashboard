// app/dashboard/components/calendar/CalendarGrid.js
'use client';

import { useMemo } from 'react';
import CalendarDayCell from './CalendarDayCell';

export default function CalendarGrid({
  currentDate,
  workOrdersByDate,
  onDragStart,
  onDragEnd,
  onDrop,
  onDragOver,
  onSelectWorkOrder,
  onSelectDate,
  selectedDate,
  calculateDayCapacity,
  onUnschedule,
  leadTechs
}) {
  // Generate calendar days for the current month
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    const endDate = new Date(lastDay);
    if (endDate.getDay() !== 6) {
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    }
    
    const days = [];
    const current = new Date(startDate);
    
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }, [currentDate]);

  // Day names - full and abbreviated
  const dayNames = [
    { full: 'Sunday', short: 'Sun', abbr: 'S' },
    { full: 'Monday', short: 'Mon', abbr: 'M' },
    { full: 'Tuesday', short: 'Tue', abbr: 'T' },
    { full: 'Wednesday', short: 'Wed', abbr: 'W' },
    { full: 'Thursday', short: 'Thu', abbr: 'T' },
    { full: 'Friday', short: 'Fri', abbr: 'F' },
    { full: 'Saturday', short: 'Sat', abbr: 'S' }
  ];

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const isSelected = (date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };

  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden min-w-[280px]">
      {/* Day names header */}
      <div className="grid grid-cols-7 bg-gray-700">
        {dayNames.map((day, index) => (
          <div 
            key={index} 
            className="py-1.5 md:py-3 text-center text-[10px] md:text-sm font-semibold text-gray-300"
          >
            {/* Show abbreviated on mobile, short on tablet, full on desktop */}
            <span className="sm:hidden">{day.abbr}</span>
            <span className="hidden sm:inline lg:hidden">{day.short}</span>
            <span className="hidden lg:inline">{day.short}</span>
          </div>
        ))}
      </div>

      {/* Calendar days grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((date, index) => {
          const dateKey = date.toISOString().split('T')[0];
          const dayWorkOrders = workOrdersByDate[dateKey] || [];
          const capacity = calculateDayCapacity(date);
          
          return (
            <CalendarDayCell
              key={index}
              date={date}
              workOrders={dayWorkOrders}
              isToday={isToday(date)}
              isCurrentMonth={isCurrentMonth(date)}
              isSelected={isSelected(date)}
              isWeekend={isWeekend(date)}
              capacity={capacity}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onSelectWorkOrder={onSelectWorkOrder}
              onSelectDate={onSelectDate}
              onUnschedule={onUnschedule}
              leadTechs={leadTechs}
            />
          );
        })}
      </div>
    </div>
  );
}
