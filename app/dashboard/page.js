// app/dashboard/page.js
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import DashboardHeader from './components/DashboardHeader';
import WorkOrdersView from './components/WorkOrdersView';
import AvailabilityView from './components/AvailabilityView';
import WorkOrderDetailModal from './components/WorkOrderDetailModal';
import NewWorkOrderModal from './components/NewWorkOrderModal';
import ImportModal from '../components/ImportModal';
import { CalendarView } from './components/calendar';
import { AgingView } from './components/aging';
import { fetchWorkOrders, fetchUsers } from './utils/dataFetchers';
import { calculateStats } from './utils/calculations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  // State Management
  const [workOrders, setWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [showNewWOModal, setShowNewWOModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('workorders'); // 'workorders' | 'calendar' | 'aging' | 'availability'
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
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    const workOrdersData = await fetchWorkOrders(supabase);
    const usersData = await fetchUsers(supabase);
    
    setWorkOrders(workOrdersData);
    setUsers(usersData);
    setStats(calculateStats(workOrdersData));
    setLoading(false);
  };

  const refreshWorkOrders = async () => {
    const workOrdersData = await fetchWorkOrders(supabase);
    setWorkOrders(workOrdersData);
    setStats(calculateStats(workOrdersData));
  };

  // Import Handler
  const handleImportClick = () => {
    setShowImportModal(true);
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
            onImport={handleImportClick}
            refreshWorkOrders={refreshWorkOrders}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader 
          activeView={activeView}
          setActiveView={setActiveView}
        />

        {renderActiveView()}

        {/* Modals - Available in all views */}
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

        {showImportModal && (
          <ImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            onImportComplete={refreshWorkOrders}
          />
        )}
      </div>
    </div>
  );
}
