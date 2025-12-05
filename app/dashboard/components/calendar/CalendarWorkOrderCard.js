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

  // Get status color
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

  // Get priority indicator
  const getPriorityIndicator = () => {
    const indicators = {
      emergency: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };
    return indicators[workOrder.priority] || '⚪';
  };

  // Get lead tech name
  const getLeadTechName = () => {
    if (!workOrder.lead_tech_id) return null;
    const tech = leadTechs?.find(t => t.user_id === workOrder.lead_tech_id);
    if (tech) {
      return `${tech.first_name} ${tech.last_name.charAt(0)}.`;
    }
    if (workOrder.lead_tech) {
      return `${workOrder.lead_tech.first_name} ${workOrder.lead_tech.last_name.charAt(0)}.`;
    }
    return null;
  };

  const techName = getLeadTechName();

  // Compact card for month view
  if (compact) {
    return (
      <div
        draggable
        onDragStart={(e) => onDragStart(e, workOrder)}
        onDragEnd={onDragEnd}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onClick={(e) => {
          e.stopPropagation();
          onClick(workOrder);
        }}
        className={`
          relative group cursor-grab active:cursor-grabbing
          text-xs p-1.5 rounded border-l-4 transition-all
          hover:ring-1 hover:ring-blue-400
          ${getStatusColor()}
        `}
      >
        <div className="flex items-start gap-1">
          {/* Drag handle */}
          <span className="text-gray-500 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition">
            ⋮⋮
          </span>
          
          <div className="flex-1 min-w-0">
            {/* WO Number with priority */}
            <div className="flex items-center gap-1">
              <span className="text-[10px]">{getPriorityIndicator()}</span>
              <span className="font-semibold text-white truncate">
                {workOrder.wo_number}
              </span>
            </div>
            
            {/* Building */}
            <div className="text-gray-400 truncate text-[10px]">
              {workOrder.building}
            </div>

            {/* Tech name if assigned */}
            {techName && (
              <div className="flex items-center gap-0.5 text-[10px] text-blue-400 mt-0.5">
                👤 {techName}
              </div>
            )}
          </div>

          {/* Unschedule button */}
          {showActions && onUnschedule && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUnschedule(workOrder);
              }}
              className="absolute top-1 right-1 p-0.5 bg-red-600 hover:bg-red-500 rounded text-white text-[10px]"
              title="Remove from schedule"
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
      onClick={(e) => {
        e.stopPropagation();
        onClick(workOrder);
      }}
      className={`
        relative group cursor-grab active:cursor-grabbing
        p-2 rounded-lg border-l-4 transition-all
        hover:ring-2 hover:ring-blue-400
        ${getStatusColor()}
      `}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <span className="text-gray-500 flex-shrink-0 mt-1 opacity-50 group-hover:opacity-100 transition">
          ⋮⋮
        </span>
        
        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <span className="text-sm">{getPriorityIndicator()}</span>
              <span className="font-bold text-white">
                {workOrder.wo_number}
              </span>
            </div>
            
            {/* Status badge */}
            <span className={`
              text-[10px] px-1.5 py-0.5 rounded font-semibold
              ${workOrder.status === 'pending' ? 'bg-gray-600' : ''}
              ${workOrder.status === 'assigned' ? 'bg-blue-600' : ''}
              ${workOrder.status === 'in_progress' ? 'bg-yellow-600' : ''}
              ${workOrder.status === 'needs_return' ? 'bg-purple-600' : ''}
              ${workOrder.status === 'completed' ? 'bg-green-600' : ''}
            `}>
              {workOrder.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>

          {/* Building */}
          <div className="flex items-center gap-1 text-sm text-gray-300 mt-1">
            📍 {workOrder.building}
          </div>

          {/* Description */}
          <div className="text-xs text-gray-400 mt-1 line-clamp-2">
            {workOrder.work_order_description}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-600">
            {/* Lead tech */}
            {techName ? (
              <div className="flex items-center gap-1 text-xs text-blue-400">
                👤 {techName}
              </div>
            ) : (
              <span className="text-xs text-gray-500">Unassigned</span>
            )}

            {/* NTE */}
            {workOrder.nte > 0 && (
              <span className="text-xs font-semibold text-green-400">
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
            className="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-500 rounded text-white text-xs"
            title="Remove from schedule"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
