// app/dashboard/page.js
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import WorkOrdersView from './components/WorkOrdersView';
import AvailabilityView from './components/AvailabilityView';
import MissingHoursView from './components/MissingHoursView';
import WorkOrderDetailModal from './components/WorkOrderDetailModal';
import NewWorkOrderModal from './components/NewWorkOrderModal';
import ImportModal from '../components/ImportModal';
import GlobalWOSearch from '../components/GlobalWOSearch';
import { CalendarView } from './components/calendar';
import { AgingView } from './components/aging';
import ProfitabilityView from './components/ProfitabilityView';
import { fetchWorkOrders, fetchUsers } from './utils/dataFetchers';
import { calculateStats } from './utils/calculations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const SUPERUSER_EMAIL = 'jones.emfcontracting@gmail.com';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeView = searchParams.get('view') || 'workorders';

  const [workOrders, setWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedWO, setSelectedWO] = useState(null);
  const [showNewWOModal, setShowNewWOModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missingHoursCount, setMissingHoursCount] = useState(0);
  const [showMobileWarning, setShowMobileWarning] = useState(false);
  const [stats, setStats] = useState({
    total: 0, pending: 0, assigned: 0, in_progress: 0,
    completed: 0, tech_review: 0, return_trip: 0,
    pending_cbre_quote: 0, quoted: 0, quote_approved: 0
  });

  const isSuperuser = currentUser?.email === SUPERUSER_EMAIL;

  const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
    return chunks;
  };

  useEffect(() => {
    loadInitialData();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    const check = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile && !sessionStorage.getItem('mobileDashboardWarningShown')) {
        setShowMobileWarning(true);
        sessionStorage.setItem('mobileDashboardWarningShown', 'true');
      }
    };
    check();
  }, []);

  useEffect(() => {
    if (workOrders.length > 0) calculateMissingHoursCount();
  }, [workOrders]);

  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userData } = await supabase.from('users').select('*').eq('auth_id', user.id).single();
        setCurrentUser(userData);
      }
    } catch {}
  };

  const loadInitialData = async () => {
    setLoading(true);
    const [workOrdersData, usersData] = await Promise.all([
      fetchWorkOrders(supabase),
      fetchUsers(supabase)
    ]);
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

  const calculateMissingHoursCount = async () => {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const eligibleWOs = workOrders.filter(wo => {
        return wo.lead_tech_id &&
          ['assigned', 'in_progress', 'completed'].includes(wo.status) &&
          new Date(wo.date_entered || wo.created_at) >= cutoffDate;
      });
      if (eligibleWOs.length === 0) { setMissingHoursCount(0); return; }

      const woIdChunks = chunkArray(eligibleWOs.map(wo => wo.wo_id), 10);
      let allHoursData = [];
      for (const chunk of woIdChunks) {
        const { data } = await supabase.from('daily_hours_log')
          .select('wo_id, hours_regular, hours_overtime').in('wo_id', chunk);
        if (data) allHoursData = [...allHoursData, ...data];
      }
      const hoursPerWO = {};
      allHoursData.forEach(e => {
        hoursPerWO[e.wo_id] = (hoursPerWO[e.wo_id] || 0) + (parseFloat(e.hours_regular) || 0) + (parseFloat(e.hours_overtime) || 0);
      });
      setMissingHoursCount(eligibleWOs.filter(wo => !hoursPerWO[wo.wo_id]).length);
    } catch { setMissingHoursCount(0); }
  };

  const handleMissingHoursClick = () => router.push('/dashboard?view=missing-hours');

  const renderActiveView = () => {
    switch (activeView) {
      case 'calendar':
        return <CalendarView workOrders={workOrders} users={users} supabase={supabase} refreshWorkOrders={refreshWorkOrders} onSelectWorkOrder={setSelectedWO} />;
      case 'aging':
        return <AgingView workOrders={workOrders} users={users} supabase={supabase} refreshWorkOrders={refreshWorkOrders} onSelectWorkOrder={setSelectedWO} />;
      case 'missing-hours':
        return <MissingHoursView workOrders={workOrders} users={users} supabase={supabase} onSelectWorkOrder={setSelectedWO} refreshWorkOrders={refreshWorkOrders} />;
      case 'availability':
        return <AvailabilityView supabase={supabase} users={users} />;
      case 'profitability':
        return <ProfitabilityView currentUser={currentUser} />;
      case 'workorders':
      default:
        return (
          <WorkOrdersView
            workOrders={workOrders} stats={stats} loading={loading}
            users={users} supabase={supabase}
            onSelectWorkOrder={setSelectedWO}
            onNewWorkOrder={() => setShowNewWOModal(true)}
            onImport={() => setShowImportModal(true)}
            refreshWorkOrders={refreshWorkOrders}
            isSuperuser={isSuperuser}
            missingHoursCount={missingHoursCount}
            onMissingHoursClick={handleMissingHoursClick}
            onGlobalSearch={() => setShowGlobalSearch(true)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 p-4 md:p-6">
      {renderActiveView()}

      {/* Mobile Warning */}
      {showMobileWarning && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-5 max-w-sm w-full text-center">
            <div className="text-5xl mb-3">📱</div>
            <h2 className="text-lg font-bold mb-2 text-slate-200">Mobile Device Detected</h2>
            <p className="text-slate-400 mb-4 text-sm">The dashboard works best on larger screens. Try the Mobile App instead.</p>
            <div className="flex flex-col gap-2">
              <a href="/mobile" className="bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-lg font-semibold transition block text-white">📱 Go to Mobile App</a>
              <button onClick={() => setShowMobileWarning(false)} className="bg-[#1e1e2e] border border-[#2d2d44] px-4 py-3 rounded-lg font-semibold transition text-slate-300">Continue to Dashboard</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {selectedWO && (
        <WorkOrderDetailModal workOrder={selectedWO} users={users} supabase={supabase} currentUser={currentUser} onClose={() => setSelectedWO(null)} refreshWorkOrders={refreshWorkOrders} />
      )}
      {showNewWOModal && (
        <NewWorkOrderModal users={users} supabase={supabase} onClose={() => setShowNewWOModal(false)} refreshWorkOrders={refreshWorkOrders} />
      )}
      {showImportModal && (
        <ImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImportComplete={refreshWorkOrders} />
      )}
      {showGlobalSearch && (
        <GlobalWOSearch onClose={() => setShowGlobalSearch(false)} />
      )}
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center text-slate-500 text-sm">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
