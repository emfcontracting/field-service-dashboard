// app/dashboard/page.js
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import DashboardHeader from './components/DashboardHeader';
import WorkOrdersView from './components/WorkOrdersView';
import AvailabilityView from './components/AvailabilityView';
import MissingHoursView from './components/MissingHoursView';
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

// Superuser email - only this user can bulk delete
const SUPERUSER_EMAIL = 'jones.emfcontracting@gmail.com';

export default function Dashboard() {
  // State Management
  const [workOrders, setWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedWO, setSelectedWO] = useState(null);
  const [showNewWOModal, setShowNewWOModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('workorders'); // 'workorders' | 'calendar' | 'aging' | 'missing-hours' | 'availability'
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

  // Check if current user is superuser
  const isSuperuser = currentUser?.email === SUPERUSER_EMAIL;

  // Helper function to batch array into chunks
  const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  // Load initial data
  useEffect(() => {
    loadInitialData();
    fetchCurrentUser();
  }, []);

  // Calculate missing hours count when work orders change
  useEffect(() => {
    if (workOrders.length > 0) {
      calculateMissingHoursCount();
    }
  }, [workOrders]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('auth_id', user.id)
          .single();
        setCurrentUser(userData);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

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

  // Calculate missing hours count for stats card - with batched queries
  const calculateMissingHoursCount = async () => {
    try {
      // Get work orders that should have hours (last 30 days, assigned/in_progress/completed)
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

      // Batch the queries to avoid URL length issues
      const woIds = eligibleWOs.map(wo => wo.wo_id);
      const woIdChunks = chunkArray(woIds, 10);
      
      let allHoursData = [];
      for (const chunk of woIdChunks) {
        const { data: hoursData, error } = await supabase
          .from('daily_hours_log')
          .select('wo_id, regular_hours, overtime_hours')
          .in('wo_id', chunk);
        
        if (!error && hoursData) {
          allHoursData = [...allHoursData, ...hoursData];
        }
      }

      // Sum hours per WO
      const hoursPerWO = {};
      allHoursData.forEach(entry => {
        const woId = entry.wo_id;
        const totalHours = (entry.regular_hours || 0) + (entry.overtime_hours || 0);
        hoursPerWO[woId] = (hoursPerWO[woId] || 0) + totalHours;
      });

      // Count WOs with zero hours
      const missingCount = eligibleWOs.filter(wo => !hoursPerWO[wo.wo_id] || hoursPerWO[wo.wo_id] === 0).length;
      setMissingHoursCount(missingCount);
    } catch (error) {
      console.error('Error calculating missing hours:', error);
      setMissingHoursCount(0);
    }
  };

  // Import Handler
  const handleImportClick = () => {
    setShowImportModal(true);
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
            onImport={handleImportClick}
            refreshWorkOrders={refreshWorkOrders}
            isSuperuser={isSuperuser}
            missingHoursCount={missingHoursCount}
            onMissingHoursClick={handleMissingHoursClick}
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
          missingHoursCount={missingHoursCount}
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
