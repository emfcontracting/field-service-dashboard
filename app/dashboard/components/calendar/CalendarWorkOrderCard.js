// app/dashboard/components/calendar/CalendarWorkOrderCard.js
'use client';

import { useState } from 'react';

export default function CalendarWorkOrderCard({
  workOrder,
  onDragStart,
  onDragEnd,
  onClick,
  onUnschedule,
  compact = false,
  leadTechs
}) {
  const [showActions, setShowActions] = useState(false);

  const getStatusColor = () => {
    const colors = {
      pending: 'border-l-gray-500 bg-gray-700/50',
      assigned: 'border-l-blue-500 bg-blue-900/30',
      in_progress: 'border-l-yellow-500 bg-yellow-900/30',
      needs_return: 'border-l-purple-500 bg-purple-900/30',
      completed: 'border-l-green-500 bg-green-900/30'
    };
    return colors[workOrder.status] || 'border-l-gray-500 bg-gray-700/50';
  };

  const getPriorityIndicator = () => {
    const indicators = {
      emergency: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };
    return indicators[workOrder.priority] || '⚪';
  };

  const getLeadTechName = () => {
    if (!workOrder.lead_tech_id) return null;
    const tech = leadTechs?.find(t => t.user_id === workOrder.lead_tech_id);
    if (tech) return `${tech.first_name} ${tech.last_name.charAt(0)}.`;
    if (workOrder.lead_tech) return `${workOrder.lead_tech.first_name} ${workOrder.lead_tech.last_name.charAt(0)}.`;
    return null;
  };

  const techName = getLeadTechName();

  // Compact card for month view & mobile
  if (compact) {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, workOrder)}
        onDragEnd={onDragEnd}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onTouchStart={() => setShowActions(true)}
        onClick={(e) => {
          e.stopPropagation();
          onClick(workOrder);
        }}
        className={`
          relative group cursor-grab active:cursor-grabbing
          text-[9px] md:text-xs p-1 md:p-1.5 rounded border-l-2 md:border-l-4 transition-all
          hover:ring-1 hover:ring-blue-400 active:ring-1 active:ring-blue-400
          ${getStatusColor()}
        `}
      >
        <div className="flex items-start gap-0.5 md:gap-1">
          <div className="flex-1 min-w-0">
            {/* WO Number with priority */}
            <div className="flex items-center gap-0.5">
              <span className="text-[8px] md:text-[10px]">{getPriorityIndicator()}</span>
              <span className="font-semibold text-white truncate text-[9px] md:text-xs">
                {workOrder.wo_number}
              </span>
            </div>
            
            {/* Building - hidden on very small screens */}
            <div className="text-gray-400 truncate text-[8px] md:text-[10px] hidden sm:block">
              {workOrder.building}
            </div>
          </div>

          {/* Unschedule button - touch friendly */}
          {showActions && onUnschedule && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnschedule(workOrder);
              }}
              className="absolute top-0.5 right-0.5 p-0.5 bg-red-600 active:bg-red-500 rounded text-white text-[8px] md:text-[10px]"
              title="Remove"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  // Full card for week view or capacity panel
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, workOrder)}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={() => setShowActions(true)}
      onClick={(e) => {
        e.stopPropagation();
        onClick(workOrder);
      }}
      className={`
        relative group cursor-grab active:cursor-grabbing
        p-1.5 md:p-2 rounded-lg border-l-2 md:border-l-4 transition-all
        hover:ring-2 hover:ring-blue-400 active:ring-2 active:ring-blue-400
        ${getStatusColor()}
      `}
    >
      <div className="flex items-start gap-1 md:gap-2">
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between gap-1 md:gap-2">
            <div className="flex items-center gap-0.5 md:gap-1">
              <span className="text-xs md:text-sm">{getPriorityIndicator()}</span>
              <span className="font-bold text-white text-xs md:text-sm">
                {workOrder.wo_number}
              </span>
            </div>
            
            {/* Status badge */}
            <span className={`
              text-[8px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded font-semibold
              ${workOrder.status === 'pending' ? 'bg-gray-600' : ''}
              ${workOrder.status === 'assigned' ? 'bg-blue-600' : ''}
              ${workOrder.status === 'in_progress' ? 'bg-yellow-600' : ''}
              ${workOrder.status === 'needs_return' ? 'bg-purple-600' : ''}
              ${workOrder.status === 'completed' ? 'bg-green-600' : ''}
            `}>
              {workOrder.status.replace('_', ' ').toUpperCase().slice(0, 6)}
            </span>
          </div>

          {/* Building */}
          <div className="flex items-center gap-1 text-xs md:text-sm text-gray-300 mt-0.5 md:mt-1">
            📍 <span className="truncate">{workOrder.building}</span>
          </div>

          {/* Description - hidden on mobile */}
          <div className="text-[10px] md:text-xs text-gray-400 mt-1 line-clamp-2 hidden md:block">
            {workOrder.work_order_description}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-1 md:mt-2 pt-1 md:pt-2 border-t border-gray-600">
            {techName ? (
              <div className="flex items-center gap-0.5 text-[10px] md:text-xs text-blue-400 truncate">
                👤 {techName}
              </div>
            ) : (
              <span className="text-[10px] md:text-xs text-gray-500">—</span>
            )}

            {workOrder.nte > 0 && (
              <span className="text-[10px] md:text-xs font-semibold text-green-400">
                ${workOrder.nte.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Unschedule button */}
        {showActions && onUnschedule && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnschedule(workOrder);
            }}
            className="absolute top-1 right-1 p-0.5 md:p-1 bg-red-600 active:bg-red-500 rounded text-white text-[10px] md:text-xs"
            title="Remove"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
