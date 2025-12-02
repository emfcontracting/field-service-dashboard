//Mobile App - Refactored & Modular with Bilingual Support
'use client';
import { useState } from 'react';

// Language Provider
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

export default function MobilePage() {
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
    handleFieldChange,
    getFieldValue,
    loadWorkOrders,
    saveSignature  // ADD THIS
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
    getTeamFieldValue,
    removeTeamMember
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

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Wrap entire app with LanguageProvider
  return (
    <LanguageProvider>
      <MobileAppContent
        currentUser={currentUser}
        error={error}
        setError={setError}
        handleLogin={handleLogin}
        handleLogout={handleLogout}
        workOrders={workOrders}
        completedWorkOrders={completedWorkOrders}
        selectedWO={selectedWO}
        setSelectedWO={setSelectedWO}
        saving={saving}
        teamSaving={teamSaving}
        newComment={newComment}
        setNewComment={setNewComment}
        checkIn={checkIn}
        checkOut={checkOut}
        completeWorkOrder={completeWorkOrder}
        updateField={updateField}
        addComment={addComment}
        handleFieldChange={handleFieldChange}
        getFieldValue={getFieldValue}
        teamMembers={teamMembers}
        currentTeamList={currentTeamList}
        showTeamModal={showTeamModal}
        setShowTeamModal={setShowTeamModal}
        loadAllTeamMembers={loadAllTeamMembers}
        handleTeamMemberAdd={handleTeamMemberAdd}
        removeTeamMember={removeTeamMember}
        updateTeamMemberField={updateTeamMemberField}
        handleTeamFieldChange={handleTeamFieldChange}
        getTeamFieldValue={getTeamFieldValue}
        showAvailabilityModal={showAvailabilityModal}
        availabilityBlocked={availabilityBlocked}
        scheduledWork={scheduledWork}
        emergencyWork={emergencyWork}
        notAvailable={notAvailable}
        hasSubmittedToday={hasSubmittedToday}
        availabilitySaving={availabilitySaving}
        submitAvailability={submitAvailability}
        handleAvailabilityChange={handleAvailabilityChange}
        showCompletedPage={showCompletedPage}
        setShowCompletedPage={setShowCompletedPage}
        showChangePinModal={showChangePinModal}
        setShowChangePinModal={setShowChangePinModal}
        changePin={changePin}
        loadWorkOrders={loadWorkOrders}
        saveSignature={saveSignature}  // ADD THIS
      />
    </LanguageProvider>
  );
}

// Separate component to use language context
function MobileAppContent({
  currentUser,
  error,
  setError,
  handleLogin,
  handleLogout,
  workOrders,
  completedWorkOrders,
  selectedWO,
  setSelectedWO,
  saving,
  teamSaving,
  newComment,
  setNewComment,
  checkIn,
  checkOut,
  completeWorkOrder,
  updateField,
  addComment,
  handleFieldChange,
  getFieldValue,
  teamMembers,
  currentTeamList,
  showTeamModal,
  setShowTeamModal,
  loadAllTeamMembers,
  handleTeamMemberAdd,
  removeTeamMember,
  updateTeamMemberField,
  handleTeamFieldChange,
  getTeamFieldValue,
  showAvailabilityModal,
  availabilityBlocked,
  scheduledWork,
  emergencyWork,
  notAvailable,
  hasSubmittedToday,
  availabilitySaving,
  submitAvailability,
  handleAvailabilityChange,
  showCompletedPage,
  setShowCompletedPage,
  showChangePinModal,
  setShowChangePinModal,
  changePin,
  loadWorkOrders,
  saveSignature  // ADD THIS
}) {
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
          onRemoveTeamMember={removeTeamMember}
          onShowChangePin={() => setShowChangePinModal(true)}
          onLogout={handleLogout}
          onSaveSignature={saveSignature}  // ADD THIS
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
