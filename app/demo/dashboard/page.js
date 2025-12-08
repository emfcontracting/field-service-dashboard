// app/demo/dashboard/page.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import DashboardHeader from '../../dashboard/components/DashboardHeader';
import WorkOrdersView from '../../dashboard/components/WorkOrdersView';
import AvailabilityView from '../../dashboard/components/AvailabilityView';
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
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 mb-4 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <span className="font-bold">Demo Mode</span>
            <span className="text-amber-100 text-sm ml-2 hidden sm:inline">
              - Exploring with sample data. Changes are temporary.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/demo"
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm transition"
          >
            ← Back to Demo Home
          </Link>
          <button
            onClick={onReset}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm transition"
          >
            🔄 Reset Data
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="hover:bg-white/20 p-1 rounded transition ml-2"
          >
            ✕
          </button>
        </div>
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

  const handleReset = () => {
    resetMockSupabase();
    loadInitialData();
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
            onImport={() => {}} // Disabled in demo
            refreshWorkOrders={refreshWorkOrders}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <DemoBanner onReset={handleReset} />
        
        <DashboardHeader 
          activeView={activeView}
          setActiveView={setActiveView}
        />

        {renderActiveView()}

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
