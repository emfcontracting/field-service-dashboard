// app/dashboard/components/calendar/CalendarDayCell.js
'use client';

import { useState } from 'react';
import CalendarWorkOrderCard from './CalendarWorkOrderCard';

export default function CalendarDayCell({
  date,
  workOrders,
  isToday,
  isCurrentMonth,
  isSelected,
  isWeekend,
  capacity,
  onDragStart,
  onDragEnd,
  onDrop,
  onDragOver,
  onSelectWorkOrder,
  onSelectDate,
  onUnschedule,
  leadTechs
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Get capacity color based on percentage
  const getCapacityColor = () => {
    if (capacity.percentage === 0) return 'bg-gray-700';
    if (capacity.percentage < 50) return 'bg-green-600';
    if (capacity.percentage < 80) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    onDrop(e, date);
  };

  // Maximum visible work orders - fewer on mobile
  const maxVisible = 1;
  const visibleWorkOrders = isExpanded ? workOrders : workOrders.slice(0, maxVisible);
  const hiddenCount = workOrders.length - maxVisible;

  return (
    <div
      className={`
        min-h-[50px] md:min-h-[100px] lg:min-h-[120px] 
        border-t border-l border-gray-700 
        p-0.5 md:p-1 
        transition-all
        ${!isCurrentMonth ? 'bg-gray-900/50 text-gray-600' : 'bg-gray-800'}
        ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}
        ${isSelected ? 'bg-blue-900/30' : ''}
        ${isWeekend && isCurrentMonth ? 'bg-gray-800/80' : ''}
        ${isDragOver ? 'bg-blue-900/50 ring-2 ring-blue-400 ring-dashed' : ''}
      `}
      onDragOver={onDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => onSelectDate(date)}
    >
      {/* Day header */}
      <div className="flex items-center justify-between mb-0.5 md:mb-1">
        <span className={`
          text-[10px] md:text-sm font-semibold px-1 md:px-1.5 py-0.5 rounded
          ${isToday ? 'bg-blue-600 text-white' : ''}
          ${!isCurrentMonth ? 'text-gray-600' : ''}
        `}>
          {date.getDate()}
        </span>
        
        {/* Capacity indicator */}
        {workOrders.length > 0 && (
          <div className="flex items-center gap-0.5 md:gap-1">
            <div 
              className={`w-1.5 md:w-2 h-1.5 md:h-2 rounded-full ${getCapacityColor()}`}
              title={`${capacity.count} work orders`}
            />
            <span className="text-[9px] md:text-xs text-gray-400">{workOrders.length}</span>
          </div>
        )}
      </div>

      {/* Work orders */}
      <div className="space-y-0.5 md:space-y-1">
        {visibleWorkOrders.map(wo => (
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
        ))}
      </div>

      {/* Show more/less button */}
      {hiddenCount > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="w-full mt-0.5 md:mt-1 text-[9px] md:text-xs text-blue-400 hover:text-blue-300 flex items-center justify-center"
        >
          {isExpanded ? '▲' : `+${hiddenCount}`}
        </button>
      )}
    </div>
  );
}
