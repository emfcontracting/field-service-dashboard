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
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from the Sunday before the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    // End on the Saturday after the last day
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

  // Day names header
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Check if date is today
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Check if date is in current month
  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  // Check if date is selected
  const isSelected = (date) => {
    return selectedDate && date.toDateString() === selectedDate.toDateString();
  };

  // Check if date is a weekend
  const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      {/* Day names header */}
      <div className="grid grid-cols-7 bg-gray-700">
        {dayNames.map(day => (
          <div 
            key={day} 
            className="py-3 text-center text-sm font-semibold text-gray-300"
          >
            {day}
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
