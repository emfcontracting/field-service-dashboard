// app/dashboard/components/aging/AgingWorkOrdersList.js
'use client';

import { useState } from 'react';

export default function AgingWorkOrdersList({ 
  workOrders, 
  onSelectWorkOrder,
  leadTechs 
}) {
  const [expandedWO, setExpandedWO] = useState(null);

  // Get severity badge
  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'critical':
        return { icon: '🔴', text: 'CRITICAL', bgColor: 'bg-red-600' };
      case 'warning':
        return { icon: '🟠', text: 'WARNING', bgColor: 'bg-orange-600' };
      case 'stale':
        return { icon: '🟡', text: 'STALE', bgColor: 'bg-yellow-600' };
      default:
        return { icon: '⚪', text: 'OK', bgColor: 'bg-gray-600' };
    }
  };

  // Get priority badge
  const getPriorityBadge = (priority) => {
    const badges = {
      emergency: { icon: '🔴', text: 'P1 EMERGENCY', color: 'text-red-400' },
      high: { icon: '🟠', text: 'P2 HIGH', color: 'text-orange-400' },
      medium: { icon: '🟡', text: 'P3 MEDIUM', color: 'text-yellow-400' },
      low: { icon: '🟢', text: 'P4 LOW', color: 'text-green-400' }
    };
    return badges[priority] || badges.medium;
  };

  // Format age display
  const formatAge = (aging) => {
    if (aging.days === 0) {
      return `${aging.hours}h`;
    } else if (aging.days === 1) {
      return `1 day ${aging.hours}h`;
    } else {
      return `${aging.days} days`;
    }
  };

  if (workOrders.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">🎉</div>
        <div className="text-xl font-bold text-green-400">All Clear!</div>
        <div className="text-gray-400 mt-2">
          No work orders are aging beyond 2 days.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h3 className="font-semibold flex items-center gap-2">
          📋 Aging Work Orders
          <span className="text-sm text-gray-400">({workOrders.length})</span>
        </h3>
      </div>

      <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
        {workOrders.map(wo => {
          const severity = getSeverityBadge(wo.aging.severity);
          const priority = getPriorityBadge(wo.priority);
          const isExpanded = expandedWO === wo.wo_id;

          return (
            <div 
              key={wo.wo_id}
              className={`
                p-4 hover:bg-gray-700/50 transition cursor-pointer
                ${wo.aging.severity === 'critical' ? 'bg-red-900/20' : ''}
                ${wo.aging.severity === 'warning' ? 'bg-orange-900/10' : ''}
              `}
              onClick={() => setExpandedWO(isExpanded ? null : wo.wo_id)}
            >
              {/* Main Row */}
              <div className="flex items-center justify-between gap-4">
                {/* Left: WO Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Severity Badge */}
                    <span className={`${severity.bgColor} text-white text-xs px-2 py-0.5 rounded font-bold`}>
                      {severity.icon} {severity.text}
                    </span>
                    
                    {/* WO Number */}
                    <span className="font-bold text-white">{wo.wo_number}</span>
                    
                    {/* Priority */}
                    <span className={`text-xs ${priority.color}`}>
                      {priority.icon} {priority.text}
                    </span>
                  </div>

                  <div className="text-sm text-gray-300 mt-1">
                    📍 {wo.building}
                  </div>

                  <div className="text-xs text-gray-500 mt-1 truncate">
                    {wo.work_order_description}
                  </div>
                </div>

                {/* Right: Age & Tech */}
                <div className="text-right flex-shrink-0">
                  <div className={`text-2xl font-bold ${
                    wo.aging.severity === 'critical' ? 'text-red-400' :
                    wo.aging.severity === 'warning' ? 'text-orange-400' :
                    'text-yellow-400'
                  }`}>
                    {formatAge(wo.aging)}
                  </div>
                  
                  {wo.lead_tech && (
                    <div className="text-xs text-blue-400 mt-1">
                      👤 {wo.lead_tech.first_name} {wo.lead_tech.last_name}
                    </div>
                  )}
                  
                  <div className="text-xs text-gray-500 mt-1">
                    Status: {wo.status.replace('_', ' ')}
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-gray-600 space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Assigned:</span>
                      <span className="text-white ml-2">
                        {wo.aging.assignedDate.toLocaleDateString()} at{' '}
                        {wo.aging.assignedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">NTE:</span>
                      <span className="text-green-400 ml-2">
                        ${(wo.nte || 0).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Requestor:</span>
                      <span className="text-white ml-2">{wo.requestor || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Date Entered:</span>
                      <span className="text-white ml-2">
                        {wo.date_entered ? new Date(wo.date_entered).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="text-sm">
                    <span className="text-gray-500">Description:</span>
                    <p className="text-white mt-1">{wo.work_order_description}</p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWorkOrder(wo);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm font-semibold transition"
                    >
                      📝 View Details
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
