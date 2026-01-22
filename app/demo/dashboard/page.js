// app/demo/dashboard/page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import DemoDashboardHeader from '../components/DemoDashboardHeader';
import WorkOrdersView from '../../dashboard/components/WorkOrdersView';
import AvailabilityView from '../../dashboard/components/AvailabilityView';
import MissingHoursView from '../../dashboard/components/MissingHoursView';
import WorkOrderDetailModal from '../../dashboard/components/WorkOrderDetailModal';
import NewWorkOrderModal from '../../dashboard/components/NewWorkOrderModal';
import { CalendarView } from '../../dashboard/components/calendar';
import { AgingView } from '../../dashboard/components/aging';
import { calculateStats } from '../../dashboard/utils/calculations';
import { getMockSupabase, resetMockSupabase } from '../mockSupabase';
import { DEMO_USERS } from '../mockData';

// Demo Banner Component
function DemoBanner({ onReset }) {
  const [isVisible, setIsVisible] = useState(true);
  
  if (!isVisible) return null;
  
  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 sm:px-4 py-2 sm:py-3 mb-3 sm:mb-4 rounded-lg">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl">🎯</span>
          <div>
            <span className="font-bold text-sm sm:text-base">Demo Mode</span>
            <span className="text-amber-100 text-xs sm:text-sm ml-2 hidden sm:inline">
              - Exploring with sample data. Changes are temporary.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <Link
            href="/demo"
            className="bg-white/20 hover:bg-white/30 px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition"
          >
            ← Home
          </Link>
          <Link
            href="/demo/mobile"
            className="bg-white/20 hover:bg-white/30 px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition hidden xs:block"
          >
            📱 Mobile
          </Link>
          <button
            onClick={onReset}
            className="bg-white/20 hover:bg-white/30 px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition"
          >
            🔄 Reset
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="hover:bg-white/20 p-1 rounded transition"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

// Mobile Notice Component
function MobileNotice() {
  const [dismissed, setDismissed] = useState(false);
  
  if (dismissed) return null;
  
  return (
    <div className="lg:hidden bg-blue-900/50 border border-blue-500/30 rounded-lg p-3 mb-4">
      <div className="flex items-start gap-2">
        <span className="text-lg">💡</span>
        <div className="flex-1">
          <p className="text-blue-200 text-sm font-medium">Dashboard works best on larger screens</p>
          <p className="text-blue-300/70 text-xs mt-1">
            For the best mobile experience, try our{' '}
            <Link href="/demo/mobile" className="text-cyan-400 underline">Mobile App Demo</Link>
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-blue-400 hover:text-blue-300"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Custom fetch functions for demo mode
async function fetchDemoWorkOrders(supabase) {
  const { data, error } = await supabase
    .from('work_orders')
    .select('*')
    .order('date_entered', { ascending: true });

  if (error) {
    console.error('Error fetching demo work orders:', error);
    return [];
  }

  return data || [];
}

async function fetchDemoUsers(supabase) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_active', true)
    .in('role', ['admin', 'lead_tech', 'tech', 'helper', 'office'])
    .order('first_name');

  if (error) {
    console.error('Error fetching demo users:', error);
    return [];
  }

  return data || [];
}

export default function DemoDashboard() {
  // Get mock Supabase instance
  const supabase = getMockSupabase();
  
  // State Management
  const [workOrders, setWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [showNewWOModal, setShowNewWOModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('workorders');
  const [missingHoursCount, setMissingHoursCount] = useState(0);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
    needs_return: 0,
    pending_cbre_quote: 0,
    quoted: 0,
    quote_approved: 0
  });

  // Load initial data
  useEffect(() => {
    loadInitialData();
    
    // Subscribe to mock data changes
    const unsubscribe = supabase.onDataChange(() => {
      refreshWorkOrders();
    });
    
    return () => unsubscribe();
  }, []);

  // Calculate missing hours when work orders change
  useEffect(() => {
    if (workOrders.length > 0) {
      calculateMissingHoursCount();
    }
  }, [workOrders]);

  const loadInitialData = async () => {
    setLoading(true);
    const workOrdersData = await fetchDemoWorkOrders(supabase);
    const usersData = await fetchDemoUsers(supabase);
    
    setWorkOrders(workOrdersData);
    setUsers(usersData);
    setStats(calculateStats(workOrdersData));
    setLoading(false);
  };

  const refreshWorkOrders = async () => {
    const workOrdersData = await fetchDemoWorkOrders(supabase);
    setWorkOrders(workOrdersData);
    setStats(calculateStats(workOrdersData));
  };

  // Calculate missing hours count
  const calculateMissingHoursCount = useCallback(async () => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      
      const eligibleWOs = workOrders.filter(wo => {
        const hasAssignment = wo.lead_tech_id;
        const relevantStatus = ['assigned', 'in_progress', 'completed'].includes(wo.status);
        const withinDateRange = new Date(wo.date_entered || wo.created_at) >= cutoffDate;
        return hasAssignment && relevantStatus && withinDateRange;
      });

      if (eligibleWOs.length === 0) {
        setMissingHoursCount(0);
        return;
      }

      // Get hours logged for these work orders
      let totalHoursPerWO = {};
      
      for (const wo of eligibleWOs) {
        const { data: hoursData } = await supabase
          .from('daily_hours_log')
          .select('wo_id, hours_regular, hours_overtime')
          .eq('wo_id', wo.wo_id);

        if (hoursData && hoursData.length > 0) {
          const total = hoursData.reduce((sum, entry) => {
            return sum + (parseFloat(entry.hours_regular) || 0) + (parseFloat(entry.hours_overtime) || 0);
          }, 0);
          totalHoursPerWO[wo.wo_id] = total;
        } else {
          totalHoursPerWO[wo.wo_id] = 0;
        }
      }

      // Count WOs with zero hours
      const missingCount = eligibleWOs.filter(wo => !totalHoursPerWO[wo.wo_id] || totalHoursPerWO[wo.wo_id] === 0).length;
      setMissingHoursCount(missingCount);
    } catch (error) {
      console.error('Error calculating missing hours:', error);
      setMissingHoursCount(0);
    }
  }, [workOrders, supabase]);

  const handleReset = () => {
    resetMockSupabase();
    loadInitialData();
  };

  // Handle Missing Hours card click
  const handleMissingHoursClick = () => {
    setActiveView('missing-hours');
  };

  // Render the active view
  const renderActiveView = () => {
    switch (activeView) {
      case 'calendar':
        return (
          <CalendarView
            workOrders={workOrders}
            users={users}
            supabase={supabase}
            refreshWorkOrders={refreshWorkOrders}
            onSelectWorkOrder={setSelectedWO}
          />
        );
      
      case 'aging':
        return (
          <AgingView
            workOrders={workOrders}
            users={users}
            supabase={supabase}
            refreshWorkOrders={refreshWorkOrders}
            onSelectWorkOrder={setSelectedWO}
          />
        );
      
      case 'missing-hours':
        return (
          <MissingHoursView
            workOrders={workOrders}
            users={users}
            supabase={supabase}
            onSelectWorkOrder={setSelectedWO}
            refreshWorkOrders={refreshWorkOrders}
          />
        );
      
      case 'availability':
        return (
          <AvailabilityView 
            supabase={supabase}
            users={users}
          />
        );
      
      case 'workorders':
      default:
        return (
          <WorkOrdersView
            workOrders={workOrders}
            stats={stats}
            loading={loading}
            users={users}
            supabase={supabase}
            onSelectWorkOrder={setSelectedWO}
            onNewWorkOrder={() => setShowNewWOModal(true)}
            onImport={() => alert('Import feature available in full version')}
            refreshWorkOrders={refreshWorkOrders}
            isSuperuser={false}
            missingHoursCount={missingHoursCount}
            onMissingHoursClick={handleMissingHoursClick}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <DemoBanner onReset={handleReset} />
        
        <MobileNotice />
        
        <DemoDashboardHeader 
          activeView={activeView}
          setActiveView={setActiveView}
          missingHoursCount={missingHoursCount}
        />

        {/* Scrollable container for the view content on mobile */}
        <div className="overflow-x-auto">
          {renderActiveView()}
        </div>

        {/* Modals */}
        {selectedWO && (
          <WorkOrderDetailModal
            workOrder={selectedWO}
            users={users}
            supabase={supabase}
            onClose={() => setSelectedWO(null)}
            refreshWorkOrders={refreshWorkOrders}
          />
        )}

        {showNewWOModal && (
          <NewWorkOrderModal
            users={users}
            supabase={supabase}
            onClose={() => setShowNewWOModal(false)}
            refreshWorkOrders={refreshWorkOrders}
          />
        )}
      </div>
    </div>
  );
}
