//Mobile App - Refactored & Modular with Bilingual Support
'use client';
import { useState } from 'react';

// Language Context
import { LanguageProvider } from './contexts/LanguageContext';

// Custom Hooks
import { useAuth } from './hooks/useAuth';
import { useWorkOrders } from './hooks/useWorkOrders';
import { useTeam } from './hooks/useTeam';
import { useAvailability } from './hooks/useAvailability';

// Page Components
import LoginScreen from './components/LoginScreen';
import WorkOrdersList from './components/WorkOrdersList';
import WorkOrderDetail from './components/WorkOrderDetail';
import CompletedWorkOrders from './components/CompletedWorkOrders';

// Modal Components
import AvailabilityModal from './components/modals/AvailabilityModal';
import ChangePinModal from './components/modals/ChangePinModal';
import TeamModal from './components/modals/TeamModal';

function MobilePageContent() {
  // Authentication
  const { currentUser, loading, error, setError, login, logout, changePin } = useAuth();
  
  // Work Orders
  const {
    workOrders,
    completedWorkOrders,
    selectedWO,
    setSelectedWO,
    saving,
    newComment,
    setNewComment,
    checkIn,
    checkOut,
    completeWorkOrder,
    updateField,
    addComment,
    saveSignature,
    handleFieldChange,
    getFieldValue,
    loadWorkOrders
  } = useWorkOrders(currentUser);

  // Team Management
  const {
    teamMembers,
    currentTeamList,
    showTeamModal,
    setShowTeamModal,
    saving: teamSaving,
    loadAllTeamMembers,
    addTeamMember,
    updateTeamMemberField,
    handleTeamFieldChange,
    getTeamFieldValue
  } = useTeam(selectedWO);

  // Availability
  const {
    showAvailabilityModal,
    availabilityBlocked,
    scheduledWork,
    emergencyWork,
    notAvailable,
    hasSubmittedToday,
    saving: availabilitySaving,
    submitAvailability,
    handleAvailabilityChange
  } = useAvailability(currentUser);

  // UI State
  const [showCompletedPage, setShowCompletedPage] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);

  // Handlers
  async function handleLogin(email, pin) {
    await login(email, pin);
  }

  function handleLogout() {
    logout();
    setSelectedWO(null);
  }

  async function handleTeamMemberAdd(memberId) {
    await addTeamMember(memberId, selectedWO.wo_id, loadWorkOrders);
  }

  async function handleSaveSignature(signatureData) {
    try {
      await saveSignature(signatureData);
    } catch (err) {
      throw err;
    }
  }

  // Loading Screen
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
      <LoginScreen 
        onLogin={handleLogin}
        error={error}
        setError={setError}
      />
    );
  }

  // Show Availability Modal if required
  if (showAvailabilityModal && (availabilityBlocked || !hasSubmittedToday)) {
    return (
      <AvailabilityModal
        showAvailabilityModal={showAvailabilityModal}
        availabilityBlocked={availabilityBlocked}
        scheduledWork={scheduledWork}
        emergencyWork={emergencyWork}
        notAvailable={notAvailable}
        saving={availabilitySaving}
        handleAvailabilityChange={handleAvailabilityChange}
        submitAvailability={submitAvailability}
      />
    );
  }

  // Work Order Detail View
  if (selectedWO) {
    return (
      <>
        <WorkOrderDetail
          workOrder={selectedWO}
          currentUser={currentUser}
          currentTeamList={currentTeamList}
          saving={saving || teamSaving}
          newComment={newComment}
          setNewComment={setNewComment}
          onBack={() => {
            setSelectedWO(null);
            if (selectedWO.status === 'completed') {
              setShowCompletedPage(true);
            }
          }}
          onCheckIn={checkIn}
          onCheckOut={checkOut}
          onCompleteWorkOrder={completeWorkOrder}
          onUpdateField={updateField}
          onAddComment={addComment}
          onLoadTeamMembers={loadAllTeamMembers}
          onShowChangePin={() => setShowChangePinModal(true)}
          onLogout={handleLogout}
          onSaveSignature={handleSaveSignature}
          getFieldValue={getFieldValue}
          handleFieldChange={handleFieldChange}
          getTeamFieldValue={getTeamFieldValue}
          handleTeamFieldChange={handleTeamFieldChange}
          handleUpdateTeamMemberField={updateTeamMemberField}
        />
        
        {/* Modals */}
        <TeamModal
          show={showTeamModal}
          onClose={() => setShowTeamModal(false)}
          teamMembers={teamMembers}
          onAddMember={handleTeamMemberAdd}
          saving={teamSaving}
        />
        
        <ChangePinModal
          show={showChangePinModal}
          onClose={() => setShowChangePinModal(false)}
          onChangePin={changePin}
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
          currentUser={currentUser}
          completedWorkOrders={completedWorkOrders}
          onBack={() => setShowCompletedPage(false)}
          onSelectWO={setSelectedWO}
          onShowChangePin={() => setShowChangePinModal(true)}
          onLogout={handleLogout}
        />
        
        <ChangePinModal
          show={showChangePinModal}
          onClose={() => setShowChangePinModal(false)}
          onChangePin={changePin}
          saving={saving}
        />
      </>
    );
  }

  // Main Work Orders List
  return (
    <>
      <WorkOrdersList
        currentUser={currentUser}
        workOrders={workOrders}
        onSelectWO={setSelectedWO}
        onShowCompleted={() => setShowCompletedPage(true)}
        onShowChangePin={() => setShowChangePinModal(true)}
        onLogout={handleLogout}
      />
      
      <ChangePinModal
        show={showChangePinModal}
        onClose={() => setShowChangePinModal(false)}
        onChangePin={changePin}
        saving={saving}
      />
    </>
  );
}

// Main export with LanguageProvider wrapper
export default function MobilePage() {
  return (
    <LanguageProvider>
      <MobilePageContent />
    </LanguageProvider>
  );
}
