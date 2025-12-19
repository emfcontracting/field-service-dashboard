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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [draggedWorkOrder, setDraggedWorkOrder] = useState(null);
  const [showCapacityPanel, setShowCapacityPanel] = useState(false); // Hidden by default on mobile
  const [selectedDate, setSelectedDate] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [leadTechFilter, setLeadTechFilter] = useState('all');

  // Check if mobile on mount
  useEffect(() => {
    const checkMobile = () => {
      setShowCapacityPanel(window.innerWidth >= 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const leadTechs = users.filter(u => u.role === 'lead_tech' || u.role === 'admin');

  const filteredWorkOrders = leadTechFilter === 'all' 
    ? workOrders 
    : workOrders.filter(wo => wo.lead_tech_id === leadTechFilter);

  const getWorkOrdersByDate = useCallback(() => {
    const grouped = {};
    
    filteredWorkOrders.forEach(wo => {
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

  const unscheduledWorkOrders = filteredWorkOrders.filter(wo => 
    !wo.scheduled_date && 
    wo.status !== 'completed' && 
    wo.status !== 'needs_return'
  );

  const handleDragStart = (e, workOrder) => {
    setDraggedWorkOrder(workOrder);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', workOrder.wo_id);
    
    setTimeout(() => {
      e.target.style.opacity = '0.5';
    }, 0);
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedWorkOrder(null);
  };

  const handleDrop = async (e, targetDate) => {
    e.preventDefault();
    
    if (!draggedWorkOrder) return;
    
    setIsUpdating(true);
    
    try {
      const formattedDate = targetDate.toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('work_orders')
        .update({ scheduled_date: formattedDate })
        .eq('wo_id', draggedWorkOrder.wo_id);

      if (error) throw error;

      await refreshWorkOrders();
      
    } catch (err) {
      console.error('Error updating scheduled date:', err);
      alert('Failed to reschedule work order: ' + err.message);
    } finally {
      setIsUpdating(false);
      setDraggedWorkOrder(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setDate(newDate.getDate() + (direction * 7));
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const calculateDayCapacity = (date) => {
    const dateKey = date.toISOString().split('T')[0];
    const workOrdersOnDate = getWorkOrdersByDate()[dateKey] || [];
    
    const techWorkload = {};
    workOrdersOnDate.forEach(wo => {
      if (wo.lead_tech_id) {
        techWorkload[wo.lead_tech_id] = (techWorkload[wo.lead_tech_id] || 0) + 1;
      }
    });

    const totalWOs = workOrdersOnDate.length;
    const activeTechs = leadTechs.length;
    const maxCapacity = activeTechs * 3;

    return {
      count: totalWOs,
      maxCapacity,
      percentage: maxCapacity > 0 ? (totalWOs / maxCapacity) * 100 : 0,
      techWorkload
    };
  };

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
    <div className="space-y-3 md:space-y-4">
      {/* Calendar Controls */}
      <div className="bg-gray-800 rounded-lg p-3 md:p-4">
        {/* Row 1: Navigation */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1.5 md:p-2 hover:bg-gray-700 rounded-lg transition text-base md:text-xl"
            >
              ◀
            </button>
            
            <h2 className="text-sm md:text-xl font-bold min-w-[120px] md:min-w-[200px] text-center">
              {currentDate.toLocaleDateString('en-US', { 
                month: 'long', 
                year: 'numeric'
              })}
            </h2>
            
            <button
              onClick={() => navigateMonth(1)}
              className="p-1.5 md:p-2 hover:bg-gray-700 rounded-lg transition text-base md:text-xl"
            >
              ▶
            </button>
          </div>

          <button
            onClick={goToToday}
            className="px-2 md:px-3 py-1 md:py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs md:text-sm font-semibold transition"
          >
            Today
          </button>
        </div>

        {/* Row 2: View toggle & filters - scrollable */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {/* View Toggle */}
          <div className="flex items-center bg-gray-700 rounded-lg p-0.5 flex-shrink-0">
            <button
              onClick={() => setViewMode('month')}
              className={`flex items-center gap-1 px-2 md:px-3 py-1 rounded text-xs md:text-sm font-semibold transition ${
                viewMode === 'month' ? 'bg-blue-600' : 'hover:bg-gray-600'
              }`}
            >
              <span className="hidden sm:inline">📅</span> Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex items-center gap-1 px-2 md:px-3 py-1 rounded text-xs md:text-sm font-semibold transition ${
                viewMode === 'week' ? 'bg-blue-600' : 'hover:bg-gray-600'
              }`}
            >
              <span className="hidden sm:inline">📋</span> Week
            </button>
          </div>

          {/* Lead Tech Filter */}
          <select
            value={leadTechFilter}
            onChange={(e) => setLeadTechFilter(e.target.value)}
            className="bg-gray-700 text-white px-2 md:px-3 py-1.5 rounded-lg text-xs md:text-sm flex-shrink-0"
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
            className={`flex items-center gap-1 px-2 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition flex-shrink-0 ${
              showCapacityPanel ? 'bg-purple-600' : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            👥 <span className="hidden sm:inline">Capacity</span>
          </button>
        </div>

        {/* Loading indicator */}
        {isUpdating && (
          <div className="mt-2 text-center text-yellow-400 text-xs md:text-sm">
            ⏳ Updating schedule...
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-3 md:gap-4">
        {/* Calendar Grid */}
        <div className="flex-1 overflow-x-auto">
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
          <div className="w-full lg:w-80 flex-shrink-0">
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
          </div>
        )}
      </div>
    </div>
  );
}
