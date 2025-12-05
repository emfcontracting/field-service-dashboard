// app/dashboard/components/calendar/CalendarView.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import CalendarGrid from './CalendarGrid';
import CalendarWeekView from './CalendarWeekView';
import CapacityPanel from './CapacityPanel';

export default function CalendarView({ 
  workOrders, 
  users, 
  supabase, 
  refreshWorkOrders,
  onSelectWorkOrder 
}) {
  // Current date navigation
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [draggedWorkOrder, setDraggedWorkOrder] = useState(null);
  const [showCapacityPanel, setShowCapacityPanel] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [leadTechFilter, setLeadTechFilter] = useState('all');

  // Get lead techs for filter
  const leadTechs = users.filter(u => u.role === 'lead_tech' || u.role === 'admin');

  // Filter work orders based on lead tech selection
  const filteredWorkOrders = leadTechFilter === 'all' 
    ? workOrders 
    : workOrders.filter(wo => wo.lead_tech_id === leadTechFilter);

  // Group work orders by scheduled date
  const getWorkOrdersByDate = useCallback(() => {
    const grouped = {};
    
    filteredWorkOrders.forEach(wo => {
      // Use scheduled_date if available
      const dateKey = wo.scheduled_date 
        ? new Date(wo.scheduled_date).toISOString().split('T')[0]
        : null;
      
      if (dateKey) {
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(wo);
      }
    });
    
    return grouped;
  }, [filteredWorkOrders]);

  // Get unscheduled work orders (exclude completed and needs_return statuses)
  const unscheduledWorkOrders = filteredWorkOrders.filter(wo => 
    !wo.scheduled_date && 
    wo.status !== 'completed' && 
    wo.status !== 'needs_return'
  );

  // Handle drag start
  const handleDragStart = (e, workOrder) => {
    setDraggedWorkOrder(workOrder);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', workOrder.wo_id);
    
    // Add visual feedback
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  // Handle drag end
  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedWorkOrder(null);
  };

  // Handle drop on a date
  const handleDrop = async (e, targetDate) => {
    e.preventDefault();
    
    if (!draggedWorkOrder) return;
    
    setIsUpdating(true);
    
    try {
      // Format date as YYYY-MM-DD for database
      const formattedDate = targetDate.toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('work_orders')
        .update({ scheduled_date: formattedDate })
        .eq('wo_id', draggedWorkOrder.wo_id);

      if (error) throw error;

      // Refresh work orders to show updated schedule
      await refreshWorkOrders();
      
    } catch (err) {
      console.error('Error updating scheduled date:', err);
      alert('Failed to reschedule work order: ' + err.message);
    } finally {
      setIsUpdating(false);
      setDraggedWorkOrder(null);
    }
  };

  // Handle drag over (allow drop)
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Navigate months
  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setDate(newDate.getDate() + (direction * 7));
    }
    setCurrentDate(newDate);
  };

  // Go to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calculate capacity for a given date
  const calculateDayCapacity = (date) => {
    const dateKey = date.toISOString().split('T')[0];
    const workOrdersOnDate = getWorkOrdersByDate()[dateKey] || [];
    
    // Count work orders per tech
    const techWorkload = {};
    workOrdersOnDate.forEach(wo => {
      if (wo.lead_tech_id) {
        techWorkload[wo.lead_tech_id] = (techWorkload[wo.lead_tech_id] || 0) + 1;
      }
    });

    const totalWOs = workOrdersOnDate.length;
    const activeTechs = leadTechs.length;
    const maxCapacity = activeTechs * 3; // Assume 3 WOs per tech per day max

    return {
      count: totalWOs,
      maxCapacity,
      percentage: maxCapacity > 0 ? (totalWOs / maxCapacity) * 100 : 0,
      techWorkload
    };
  };

  // Unschedule a work order (remove scheduled_date)
  const handleUnschedule = async (workOrder) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ scheduled_date: null })
        .eq('wo_id', workOrder.wo_id);

      if (error) throw error;
      await refreshWorkOrders();
    } catch (err) {
      console.error('Error unscheduling:', err);
      alert('Failed to unschedule: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Calendar Controls */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-700 rounded-lg transition text-xl"
            >
              ◀
            </button>
            
            <h2 className="text-xl font-bold min-w-[200px] text-center">
              {currentDate.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric',
                ...(viewMode === 'week' && { day: 'numeric' })
              })}
            </h2>
            
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-700 rounded-lg transition text-xl"
            >
              ▶
            </button>

            <button
              onClick={goToToday}
              className="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm font-semibold transition"
            >
              Today
            </button>
          </div>

          {/* Center: View Toggle */}
          <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-semibold transition ${
                viewMode === 'month' ? 'bg-blue-600' : 'hover:bg-gray-600'
              }`}
            >
              📅 Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1 px-3 py-1 rounded text-sm font-semibold transition ${
                viewMode === 'week' ? 'bg-blue-600' : 'hover:bg-gray-600'
              }`}
            >
              📋 Week
            </button>
          </div>

          {/* Right: Filters & Options */}
          <div className="flex items-center gap-3">
            {/* Lead Tech Filter */}
            <select
              value={leadTechFilter}
              onChange={(e) => setLeadTechFilter(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
            >
              <option value="all">All Techs</option>
              {leadTechs.map(tech => (
                <option key={tech.user_id} value={tech.user_id}>
                  {tech.first_name} {tech.last_name}
                </option>
              ))}
            </select>

            {/* Capacity Panel Toggle */}
            <button
              onClick={() => setShowCapacityPanel(!showCapacityPanel)}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition ${
                showCapacityPanel ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              👥 Capacity
            </button>
          </div>
        </div>

        {/* Loading indicator */}
        {isUpdating && (
          <div className="mt-2 text-center text-yellow-400 text-sm">
            ⏳ Updating schedule...
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex gap-4">
        {/* Calendar Grid */}
        <div className="flex-1">
          {viewMode === 'month' ? (
            <CalendarGrid
              currentDate={currentDate}
              workOrdersByDate={getWorkOrdersByDate()}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onSelectWorkOrder={onSelectWorkOrder}
              onSelectDate={setSelectedDate}
              selectedDate={selectedDate}
              calculateDayCapacity={calculateDayCapacity}
              onUnschedule={handleUnschedule}
              leadTechs={leadTechs}
            />
          ) : (
            <CalendarWeekView
              currentDate={currentDate}
              workOrdersByDate={getWorkOrdersByDate()}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onSelectWorkOrder={onSelectWorkOrder}
              calculateDayCapacity={calculateDayCapacity}
              onUnschedule={handleUnschedule}
              leadTechs={leadTechs}
            />
          )}
        </div>

        {/* Capacity Panel (Sidebar) */}
        {showCapacityPanel && (
          <CapacityPanel
            currentDate={currentDate}
            viewMode={viewMode}
            workOrdersByDate={getWorkOrdersByDate()}
            unscheduledWorkOrders={unscheduledWorkOrders}
            leadTechs={leadTechs}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onSelectWorkOrder={onSelectWorkOrder}
            calculateDayCapacity={calculateDayCapacity}
          />
        )}
      </div>
    </div>
  );
}
