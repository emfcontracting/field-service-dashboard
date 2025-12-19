// app/dashboard/components/calendar/CapacityPanel.js
'use client';

import { useMemo } from 'react';
import CalendarWorkOrderCard from './CalendarWorkOrderCard';

export default function CapacityPanel({
  currentDate,
  viewMode,
  workOrdersByDate,
  unscheduledWorkOrders,
  leadTechs,
  onDragStart,
  onDragEnd,
  onSelectWorkOrder,
  calculateDayCapacity
}) {
  // Calculate tech workload for the visible period
  const techWorkloads = useMemo(() => {
    const workloads = {};
    
    leadTechs.forEach(tech => {
      workloads[tech.user_id] = {
        tech,
        scheduled: 0,
        unscheduled: 0,
        dates: {}
      };
    });

    workloads['unassigned'] = {
      tech: { first_name: 'Unassigned', last_name: '', user_id: 'unassigned' },
      scheduled: 0,
      unscheduled: 0,
      dates: {}
    };

    Object.entries(workOrdersByDate).forEach(([dateKey, wos]) => {
      wos.forEach(wo => {
        const techId = wo.lead_tech_id || 'unassigned';
        if (workloads[techId]) {
          workloads[techId].scheduled++;
          if (!workloads[techId].dates[dateKey]) {
            workloads[techId].dates[dateKey] = 0;
          }
          workloads[techId].dates[dateKey]++;
        }
      });
    });

    unscheduledWorkOrders.forEach(wo => {
      const techId = wo.lead_tech_id || 'unassigned';
      if (workloads[techId]) {
        workloads[techId].unscheduled++;
      }
    });

    return workloads;
  }, [workOrdersByDate, unscheduledWorkOrders, leadTechs]);

  const weekDates = useMemo(() => {
    const dates = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(day.getDate() + i);
      dates.push(day);
    }
    
    return dates;
  }, [currentDate]);

  const getCapacityColor = (percentage) => {
    if (percentage < 50) return 'bg-green-500';
    if (percentage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const sortedUnscheduled = useMemo(() => {
    const priorityOrder = { emergency: 0, high: 1, medium: 2, low: 3 };
    return [...unscheduledWorkOrders].sort((a, b) => 
      (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4)
    );
  }, [unscheduledWorkOrders]);

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Weekly Capacity Overview */}
      <div className="bg-gray-800 rounded-lg p-3 md:p-4">
        <h3 className="text-xs md:text-sm font-semibold text-gray-300 mb-2 md:mb-3 flex items-center gap-2">
          📈 This Week's Capacity
        </h3>
        
        <div className="space-y-1.5 md:space-y-2">
          {weekDates.map((date, idx) => {
            const capacity = calculateDayCapacity(date);
            const isToday = date.toDateString() === new Date().toDateString();
            
            return (
              <div key={idx} className="flex items-center gap-2">
                <span className={`text-[10px] md:text-xs w-8 md:w-10 text-gray-400 ${isToday ? 'text-blue-400 font-bold' : ''}`}>
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <div className="flex-1 h-3 md:h-4 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all ${getCapacityColor(capacity.percentage)}`}
                    style={{ width: `${Math.min(capacity.percentage, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] md:text-xs text-gray-500 w-6 md:w-8 text-right">
                  {capacity.count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tech Workload Summary */}
      <div className="bg-gray-800 rounded-lg p-3 md:p-4">
        <h3 className="text-xs md:text-sm font-semibold text-gray-300 mb-2 md:mb-3 flex items-center gap-2">
          👥 Tech Workloads
        </h3>
        
        <div className="space-y-1.5 max-h-[150px] md:max-h-[200px] overflow-y-auto">
          {Object.values(techWorkloads)
            .filter(w => w.scheduled > 0 || w.unscheduled > 0)
            .sort((a, b) => (b.scheduled + b.unscheduled) - (a.scheduled + a.unscheduled))
            .map(({ tech, scheduled, unscheduled }) => (
              <div 
                key={tech.user_id} 
                className="flex items-center justify-between py-1 border-b border-gray-700 last:border-0"
              >
                <span className={`text-xs md:text-sm truncate max-w-[120px] ${tech.user_id === 'unassigned' ? 'text-gray-500 italic' : 'text-white'}`}>
                  {tech.first_name} {tech.last_name}
                </span>
                <div className="flex items-center gap-1 md:gap-2">
                  <span className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 bg-blue-600 rounded" title="Scheduled">
                    {scheduled}
                  </span>
                  {unscheduled > 0 && (
                    <span className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 bg-orange-600 rounded" title="Unscheduled">
                      {unscheduled}
                    </span>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Unscheduled Work Orders */}
      <div className="bg-gray-800 rounded-lg p-3 md:p-4">
        <h3 className="text-xs md:text-sm font-semibold text-gray-300 mb-2 md:mb-3 flex items-center gap-2">
          📅 Unscheduled
          {sortedUnscheduled.length > 0 && (
            <span className="ml-auto bg-orange-600 text-white text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full">
              {sortedUnscheduled.length}
            </span>
          )}
        </h3>

        {sortedUnscheduled.length === 0 ? (
          <div className="text-center py-3 text-gray-500 text-xs md:text-sm">
            All scheduled! 🎉
          </div>
        ) : (
          <div className="space-y-1.5 md:space-y-2 max-h-[250px] md:max-h-[400px] overflow-y-auto">
            {sortedUnscheduled.some(wo => wo.priority === 'emergency' || wo.priority === 'high') && (
              <div className="flex items-center gap-1 text-[10px] md:text-xs text-orange-400 mb-2 p-1.5 md:p-2 bg-orange-900/30 rounded">
                ⚠️ High priority items
              </div>
            )}

            {sortedUnscheduled.map(wo => (
              <CalendarWorkOrderCard
                key={wo.wo_id}
                workOrder={wo}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onClick={onSelectWorkOrder}
                compact={true}
                leadTechs={leadTechs}
              />
            ))}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-gray-700 text-[10px] md:text-xs text-gray-500 text-center hidden md:block">
          Drag to calendar to schedule
        </div>
      </div>
    </div>
  );
}
