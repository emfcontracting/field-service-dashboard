// app/dashboard/components/aging/AgingWorkOrdersList.js
'use client';

import { useState } from 'react';

export default function AgingWorkOrdersList({ 
  workOrders, 
  onSelectWorkOrder,
  leadTechs 
}) {
  const [expandedWO, setExpandedWO] = useState(null);

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'critical': return { icon: '🔴', text: 'CRIT', bgColor: 'bg-red-600' };
      case 'warning': return { icon: '🟠', text: 'WARN', bgColor: 'bg-orange-600' };
      case 'stale': return { icon: '🟡', text: 'STALE', bgColor: 'bg-yellow-600' };
      default: return { icon: '⚪', text: 'OK', bgColor: 'bg-gray-600' };
    }
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      emergency: { icon: '🔴', text: 'P1', color: 'text-red-400' },
      high: { icon: '🟠', text: 'P2', color: 'text-orange-400' },
      medium: { icon: '🟡', text: 'P3', color: 'text-yellow-400' },
      low: { icon: '🟢', text: 'P4', color: 'text-green-400' }
    };
    return badges[priority] || badges.medium;
  };

  const formatAge = (aging) => {
    if (aging.days === 0) return `${aging.hours}h`;
    return `${aging.days}d`;
  };

  if (workOrders.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <div className="text-3xl mb-2">🎉</div>
        <div className="text-lg font-bold text-green-400">All Clear!</div>
        <div className="text-gray-400 text-sm mt-1">No aging work orders</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="p-2 md:p-4 border-b border-gray-700">
        <h3 className="font-semibold text-sm md:text-base flex items-center gap-2">
          📋 Aging Work Orders
          <span className="text-xs md:text-sm text-gray-400">({workOrders.length})</span>
        </h3>
      </div>

      <div className="divide-y divide-gray-700 max-h-[400px] md:max-h-[600px] overflow-y-auto">
        {workOrders.map(wo => {
          const severity = getSeverityBadge(wo.aging.severity);
          const priority = getPriorityBadge(wo.priority);
          const isExpanded = expandedWO === wo.wo_id;

          return (
            <div 
              key={wo.wo_id}
              className={`
                p-2 md:p-4 active:bg-gray-700/50 md:hover:bg-gray-700/50 transition cursor-pointer
                ${wo.aging.severity === 'critical' ? 'bg-red-900/20' : ''}
                ${wo.aging.severity === 'warning' ? 'bg-orange-900/10' : ''}
              `}
              onClick={() => setExpandedWO(isExpanded ? null : wo.wo_id)}
            >
              {/* Main Row - Compact on mobile */}
              <div className="flex items-center justify-between gap-2 md:gap-4">
                {/* Left: WO Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 md:gap-2 flex-wrap">
                    <span className={`${severity.bgColor} text-white text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded font-bold`}>
                      {severity.icon} {severity.text}
                    </span>
                    <span className="font-bold text-white text-xs md:text-sm">{wo.wo_number}</span>
                    <span className={`text-[10px] md:text-xs ${priority.color} hidden sm:inline`}>
                      {priority.icon} {priority.text}
                    </span>
                  </div>

                  <div className="text-xs md:text-sm text-gray-300 mt-0.5 md:mt-1 truncate">
                    📍 {wo.building}
                  </div>

                  {wo.lead_tech && (
                    <div className="text-[10px] md:text-xs text-blue-400 mt-0.5">
                      👤 {wo.lead_tech.first_name} {wo.lead_tech.last_name.charAt(0)}.
                    </div>
                  )}
                </div>

                {/* Right: Age */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-xl md:text-2xl font-bold ${
                    wo.aging.severity === 'critical' ? 'text-red-400' :
                    wo.aging.severity === 'warning' ? 'text-orange-400' : 'text-yellow-400'
                  }`}>
                    {formatAge(wo.aging)}
                  </div>
                  <div className="text-[10px] md:text-xs text-gray-500">days</div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-600 space-y-2 text-xs md:text-sm">
                  <div className="grid grid-cols-2 gap-2 md:gap-4">
                    <div>
                      <span className="text-gray-500">Assigned:</span>
                      <span className="text-white ml-1 md:ml-2">
                        {wo.aging.assignedDate.toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">NTE:</span>
                      <span className="text-green-400 ml-1 md:ml-2">
                        ${(wo.nte || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="text-gray-400 line-clamp-2">
                    {wo.work_order_description}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectWorkOrder(wo);
                    }}
                    className="w-full md:w-auto bg-blue-600 active:bg-blue-700 md:hover:bg-blue-700 px-4 py-2 rounded text-xs md:text-sm font-semibold transition"
                  >
                    📝 View Details
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
