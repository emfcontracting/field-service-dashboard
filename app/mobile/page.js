// mobile/page.js
'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

// Import utilities
import { loginWithCredentials, checkStoredAuth, logout, changePin } from './utils/authHelpers';
import { loadWorkOrders, loadCompletedWorkOrders } from './utils/workOrderHelpers';
import { checkAvailabilityStatus, submitAvailability } from './utils/availabilityHelpers';

// Import components
import LoginForm from './components/LoginForm';
import MobileHeader from './components/MobileHeader';
import WorkOrderCard from './components/WorkOrderCard';
import WorkOrderDetail from './components/WorkOrderDetail';
import CompletedWorkOrders from './components/CompletedWorkOrders';
import ChangePinModal from './components/ChangePinModal';
import AvailabilityModal from './components/AvailabilityModal';

export default function MobilePage() {
  const supabase = createClientComponentClient();

  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  // Work Order State
  const [workOrders, setWorkOrders] = useState([]);
  const [completedWorkOrders, setCompletedWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);

  // View State
  const [showCompletedPage, setShowCompletedPage] = useState(false);

  // Modal State
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);

  // UI State
  const [saving, setSaving] = useState(false);
  const [availabilityBlocked, setAvailabilityBlocked] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState(null);

  // Check authentication on mount
  useEffect(() => {
    checkAuthentication();
  }, []);

  // Load data when user is authenticated
  useEffect(() => {
    if (!currentUser) return;

    loadAllWorkOrders();
    checkAvailability();

    // Set up intervals
    const availabilityInterval = setInterval(checkAvailability, 60000);

    // Set up real-time subscription
    const channel = supabase
      .channel('work-orders-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_orders'
        },
        () => {
          loadAllWorkOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(availabilityInterval);
    };
  }, [currentUser]);

  // Authentication Functions
  async function checkAuthentication() {
    const result = await checkStoredAuth(supabase);
    if (result.success) {
      setCurrentUser(result.user);
    }
    setLoading(false);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');

    if (!email || !pin) {
      setError('Please enter both email and PIN');
      return;
    }

    const result = await loginWithCredentials(supabase, email, pin);
    
    if (result.success) {
      setCurrentUser(result.user);
      setError('');
    } else {
      setError(result.error);
    }
  }

  function handleLogout() {
    logout();
    setCurrentUser(null);
    setEmail('');
    setPin('');
    setSelectedWO(null);
  }

  async function handleChangePin(newPin, confirmPin) {
    const result = await changePin(supabase, currentUser.user_id, newPin, confirmPin);
    
    if (result.success) {
      setCurrentUser({ ...currentUser, pin: newPin });
      alert(result.message);
      setShowChangePinModal(false);
    } else {
      alert(result.error);
    }
  }

  // Work Order Functions
  async function loadAllWorkOrders() {
    const activeResult = await loadWorkOrders(supabase, currentUser.user_id, currentUser.role);
    if (activeResult.success) {
      setWorkOrders(activeResult.data);
    }

    const completedResult = await loadCompletedWorkOrders(supabase, currentUser.user_id, currentUser.role);
    if (completedResult.success) {
      setCompletedWorkOrders(completedResult.data);
    }
  }

  // Availability Functions
  async function checkAvailability() {
    const result = await checkAvailabilityStatus(supabase, currentUser.user_id, currentUser.role);
    setAvailabilityBlocked(result.isBlocked);
    setAvailabilityMessage(result.message);
    
    // Show modal if user can submit and hasn't submitted today
    if (result.canSubmit && !result.hasSubmitted) {
      // Could auto-show the modal here if desired
    }
  }

  async function handleSubmitAvailability({ scheduledWork, emergencyWork, notAvailable }) {
    setSaving(true);
    const result = await submitAvailability(supabase, currentUser.user_id, {
      scheduledWork,
      emergencyWork,
      notAvailable
    });

    if (result.success) {
      alert(result.message);
      setShowAvailabilityModal(false);
      await checkAvailability();
    } else {
      alert(result.error);
    }
    setSaving(false);
  }

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Login Screen
  if (!currentUser) {
    return (
      <LoginForm
        email={email}
        setEmail={setEmail}
        pin={pin}
        setPin={setPin}
        error={error}
        onSubmit={handleLogin}
      />
    );
  }

  // Availability Blocked Screen
  if (availabilityBlocked) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-900 border border-red-700 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold mb-4">Access Blocked</h1>
          <p className="mb-6">{availabilityMessage}</p>
          <button
            onClick={() => setShowAvailabilityModal(true)}
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold w-full"
          >
            Submit Availability Now
          </button>
          <button
            onClick={handleLogout}
            className="mt-4 text-gray-400 hover:text-white"
          >
            Logout
          </button>
        </div>
        <AvailabilityModal
          isOpen={showAvailabilityModal}
          onClose={() => setShowAvailabilityModal(false)}
          onSubmit={handleSubmitAvailability}
          saving={saving}
        />
      </div>
    );
  }

  // Work Order Detail View
  if (selectedWO) {
    return (
      <>
        <WorkOrderDetail
          workOrder={selectedWO}
          currentUser={currentUser}
          supabase={supabase}
          onBack={() => setSelectedWO(null)}
          onRefresh={async () => {
            await loadAllWorkOrders();
            // Refresh the selected work order
            const activeResult = await loadWorkOrders(supabase, currentUser.user_id, currentUser.role);
            if (activeResult.success) {
              const updatedWO = activeResult.data.find(wo => wo.wo_id === selectedWO.wo_id);
              if (updatedWO) {
                setSelectedWO(updatedWO);
              } else {
                // Work order might be completed, check completed list
                const completedResult = await loadCompletedWorkOrders(supabase, currentUser.user_id, currentUser.role);
                if (completedResult.success) {
                  const completedWO = completedResult.data.find(wo => wo.wo_id === selectedWO.wo_id);
                  if (completedWO) {
                    setSelectedWO(completedWO);
                  }
                }
              }
            }
          }}
        />
        <ChangePinModal
          isOpen={showChangePinModal}
          onClose={() => setShowChangePinModal(false)}
          onSubmit={handleChangePin}
          saving={saving}
        />
      </>
    );
  }

  // Completed Work Orders Page
  if (showCompletedPage) {
    return (
      <>
        <CompletedWorkOrders
          completedWorkOrders={completedWorkOrders}
          currentUser={currentUser}
          onBack={() => setShowCompletedPage(false)}
          onSelectWO={setSelectedWO}
          onChangePinClick={() => setShowChangePinModal(true)}
          onLogout={handleLogout}
        />
        <ChangePinModal
          isOpen={showChangePinModal}
          onClose={() => setShowChangePinModal(false)}
          onSubmit={handleChangePin}
          saving={saving}
        />
      </>
    );
  }

  // Main Work Orders List
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <MobileHeader
          currentUser={currentUser}
          onCompletedClick={() => setShowCompletedPage(true)}
          onChangePinClick={() => setShowChangePinModal(true)}
          onLogout={handleLogout}
          showDashboardButton={true}
        />

        {/* Availability Warning */}
        {availabilityMessage && !availabilityBlocked && (
          <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-3 mb-4">
            <p className="text-sm text-yellow-200">{availabilityMessage}</p>
            <button
              onClick={() => setShowAvailabilityModal(true)}
              className="mt-2 bg-yellow-700 hover:bg-yellow-600 px-4 py-2 rounded text-sm font-semibold w-full"
            >
              Submit Availability
            </button>
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">My Work Orders</h2>
          <p className="text-gray-400">
            {workOrders.length} active work {workOrders.length === 1 ? 'order' : 'orders'}
          </p>
        </div>

        <div className="space-y-4">
          {workOrders.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg">No active work orders</p>
              <p className="text-gray-500 text-sm mt-2">Check back later for new assignments</p>
            </div>
          ) : (
            workOrders.map(wo => (
              <WorkOrderCard
                key={wo.wo_id}
                workOrder={wo}
                onClick={() => setSelectedWO(wo)}
              />
            ))
          )}
        </div>

        {/* Modals */}
        <ChangePinModal
          isOpen={showChangePinModal}
          onClose={() => setShowChangePinModal(false)}
          onSubmit={handleChangePin}
          saving={saving}
        />
        
        <AvailabilityModal
          isOpen={showAvailabilityModal}
          onClose={() => setShowAvailabilityModal(false)}
          onSubmit={handleSubmitAvailability}
          saving={saving}
        />
      </div>
    </div>
  );
}