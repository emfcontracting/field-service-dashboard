//Mobile App - Refactored & Modular with Bilingual Support (WITH DAILY HOURS, NTE INCREASES & OFFLINE MODE)
'use client';
import { useState, useEffect } from 'react';

// Language Provider
import { LanguageProvider } from './contexts/LanguageContext';

// Custom Hooks
import { useAuth } from './hooks/useAuth';
import { useWorkOrders } from './hooks/useWorkOrders';
import { useTeam } from './hooks/useTeam';
import { useAvailability } from './hooks/useAvailability';
import { useQuotes } from './hooks/useQuotes';
import { useOffline } from './hooks/useOffline';

// Page Components
import LoginScreen from './components/LoginScreen';
import WorkOrdersList from './components/WorkOrdersList';
import WorkOrderDetail from './components/WorkOrderDetail';
import CompletedWorkOrders from './components/CompletedWorkOrders';
import NTEIncreasePage from './components/quotes/NTEIncreasePage';

// Modal Components
import AvailabilityModal from './components/modals/AvailabilityModal';
import ChangePinModal from './components/modals/ChangePinModal';
import TeamModal from './components/modals/TeamModal';
import CarrierSetupModal from './components/modals/CarrierSetupModal';

// Offline Components
import { SyncNotification } from './components/ConnectionStatus';

// Push Notifications
import PushNotificationPrompt from './components/PushNotificationPrompt';

export default function MobilePage() {
  // Authentication
  const { currentUser, loading, error, setError, login, logout, changePin } = useAuth();
  
  // Offline Mode
  const {
    isOnline,
    isOfflineReady,
    pendingSyncCount,
    lastSyncTime,
    syncStatus,
    syncError,
    cachedCount,
    isDownloading,
    forceSync,
    downloadForOffline,
    offlineCheckIn,
    offlineCheckOut,
    offlineAddComment,
    offlineUpdateStatus,
    offlineAddDailyHours,
    offlineCompleteWorkOrder,
    getWorkOrders: getOfflineWorkOrders,
    getCompletedWorkOrders: getOfflineCompletedWorkOrders
  } = useOffline(currentUser);
  
  // Work Orders - INCLUDING DAILY HOURS
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
    loadCompletedWorkOrders,
    saveSignature,
    // DAILY HOURS EXPORTS
    dailyLogs,
    loadingLogs,
    addDailyHours,
    downloadLogs
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

  // NTE Increases / Quotes
  const {
    quotes,
    selectedQuote,
    materials,
    loading: quotesLoading,
    saving: quotesSaving,
    showQuotePage,
    editMode,
    loadQuotesForWO,
    loadQuoteDetails,
    startNewQuote,
    saveQuote,
    deleteQuote,
    closeQuotePage,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    calculateTotals
  } = useQuotes(selectedWO, currentUser);

  // UI State
  const [showCompletedPage, setShowCompletedPage] = useState(false);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [showSyncNotification, setShowSyncNotification] = useState(false);
  const [syncNotificationMessage, setSyncNotificationMessage] = useState('');
  const [syncNotificationType, setSyncNotificationType] = useState('success');

  // Show sync notification when sync/download completes
  useEffect(() => {
    if (syncStatus === 'success') {
      setSyncNotificationMessage(cachedCount > 0 
        ? `✅ ${cachedCount} work orders ready for offline!` 
        : 'All changes synced successfully!');
      setSyncNotificationType('success');
      setShowSyncNotification(true);
      setTimeout(() => setShowSyncNotification(false), 3000);
    } else if (syncStatus === 'error') {
      setSyncNotificationMessage(syncError || 'Sync failed. Will retry automatically.');
      setSyncNotificationType('error');
      setShowSyncNotification(true);
    }
  }, [syncStatus, cachedCount, syncError]);

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

  // Download for offline handler
  async function handleDownloadOffline() {
    const result = await downloadForOffline();
    if (result.success) {
      // Also refresh the regular work orders list
      await loadWorkOrders();
    }
    return result;
  }

  // Force sync handler
  async function handleForceSync() {
    const result = await forceSync();
    if (result.success) {
      await loadWorkOrders();
      await loadCompletedWorkOrders();
    }
    return result;
  }

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-2">Loading...</div>
          {isOfflineReady && (
            <div className="text-gray-400 text-sm">
              {isOnline ? '🌐 Online' : '📴 Offline mode ready'}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Wrap entire app with LanguageProvider
  return (
    <LanguageProvider>
      {/* Sync Notification Toast */}
      <SyncNotification
        show={showSyncNotification}
        message={syncNotificationMessage}
        type={syncNotificationType}
        onDismiss={() => setShowSyncNotification(false)}
      />
      
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
        saveSignature={saveSignature}
        // DAILY HOURS PROPS
        dailyLogs={dailyLogs}
        addDailyHours={addDailyHours}
        downloadLogs={downloadLogs}
        // NTE INCREASE PROPS
        quotes={quotes}
        selectedQuote={selectedQuote}
        materials={materials}
        quotesLoading={quotesLoading}
        quotesSaving={quotesSaving}
        showQuotePage={showQuotePage}
        editMode={editMode}
        loadQuoteDetails={loadQuoteDetails}
        startNewQuote={startNewQuote}
        saveQuote={saveQuote}
        deleteQuote={deleteQuote}
        closeQuotePage={closeQuotePage}
        addMaterial={addMaterial}
        updateMaterial={updateMaterial}
        deleteMaterial={deleteMaterial}
        calculateTotals={calculateTotals}
        // OFFLINE MODE PROPS
        isOnline={isOnline}
        isOfflineReady={isOfflineReady}
        pendingSyncCount={pendingSyncCount}
        syncStatus={syncStatus}
        lastSyncTime={lastSyncTime}
        cachedCount={cachedCount}
        isDownloading={isDownloading}
        onForceSync={handleForceSync}
        onDownloadOffline={handleDownloadOffline}
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
  saveSignature,
  // DAILY HOURS PROPS
  dailyLogs,
  addDailyHours,
  downloadLogs,
  // NTE INCREASE PROPS
  quotes,
  selectedQuote,
  materials,
  quotesLoading,
  quotesSaving,
  showQuotePage,
  editMode,
  loadQuoteDetails,
  startNewQuote,
  saveQuote,
  deleteQuote,
  closeQuotePage,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  calculateTotals,
  // OFFLINE MODE PROPS
  isOnline,
  isOfflineReady,
  pendingSyncCount,
  syncStatus,
  lastSyncTime,
  cachedCount,
  isDownloading,
  onForceSync,
  onDownloadOffline,
  // CARRIER SETUP
  onUpdateUser
}) {
  // State for carrier setup modal
  const [showCarrierModal, setShowCarrierModal] = useState(false);
  const [carrierSkipped, setCarrierSkipped] = useState(false);
  const [localUser, setLocalUser] = useState(currentUser);

  // Check if we need to show carrier setup modal
  useEffect(() => {
    if (localUser && !localUser.sms_carrier && !carrierSkipped) {
      // Check if they've skipped before (stored in localStorage)
      const skippedBefore = localStorage.getItem(`carrier_skipped_${localUser.user_id}`);
      const skipTime = skippedBefore ? parseInt(skippedBefore) : 0;
      const hoursSinceSkip = (Date.now() - skipTime) / (1000 * 60 * 60);
      
      // Show modal if never skipped OR if it's been more than 24 hours since skip
      if (!skippedBefore || hoursSinceSkip > 24) {
        setShowCarrierModal(true);
      }
    }
  }, [localUser, carrierSkipped]);

  // Handle carrier setup complete
  const handleCarrierComplete = (updatedUser) => {
    setLocalUser(updatedUser);
    setShowCarrierModal(false);
    if (onUpdateUser) onUpdateUser(updatedUser);
  };

  // Handle carrier skip
  const handleCarrierSkip = () => {
    localStorage.setItem(`carrier_skipped_${localUser.user_id}`, Date.now().toString());
    setCarrierSkipped(true);
    setShowCarrierModal(false);
  };

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

  // Show Carrier Setup Modal if needed (before availability)
  if (showCarrierModal) {
    return (
      <CarrierSetupModal
        user={localUser}
        onComplete={handleCarrierComplete}
        onSkip={handleCarrierSkip}
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

  // NTE Increase Page (Full Screen)
  if (showQuotePage && selectedWO) {
    return (
      <NTEIncreasePage
        workOrder={selectedWO}
        currentUser={currentUser}
        currentTeamList={currentTeamList}
        selectedQuote={selectedQuote}
        materials={materials}
        saving={quotesSaving}
        editMode={editMode}
        onSave={async (data) => {
          try {
            await saveQuote(data);
            closeQuotePage();
          } catch (err) {
            alert('Error saving NTE Increase: ' + err.message);
          }
        }}
        onClose={closeQuotePage}
        onAddMaterial={addMaterial}
        onUpdateMaterial={updateMaterial}
        onDeleteMaterial={deleteMaterial}
        calculateTotals={calculateTotals}
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
          onSaveSignature={saveSignature}
          getFieldValue={getFieldValue}
          handleFieldChange={handleFieldChange}
          getTeamFieldValue={getTeamFieldValue}
          handleTeamFieldChange={handleTeamFieldChange}
          handleUpdateTeamMemberField={updateTeamMemberField}
          // DAILY HOURS PROPS
          dailyLogs={dailyLogs}
          onAddDailyHours={addDailyHours}
          onDownloadLogs={downloadLogs}
          // NTE INCREASE PROPS
          quotes={quotes}
          quotesLoading={quotesLoading}
          onNewQuote={startNewQuote}
          onViewQuote={loadQuoteDetails}
          onDeleteQuote={deleteQuote}
          // OFFLINE MODE PROPS
          isOnline={isOnline}
          pendingSyncCount={pendingSyncCount}
          syncStatus={syncStatus}
          onForceSync={onForceSync}
          lastSyncTime={lastSyncTime}
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
          // OFFLINE MODE PROPS
          isOnline={isOnline}
          pendingSyncCount={pendingSyncCount}
          syncStatus={syncStatus}
          onForceSync={onForceSync}
          lastSyncTime={lastSyncTime}
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
      {/* Push Notification Permission Prompt */}
      <PushNotificationPrompt userId={currentUser?.user_id} />
      
      <WorkOrdersList
        currentUser={currentUser}
        workOrders={workOrders}
        onSelectWO={setSelectedWO}
        onShowCompleted={() => setShowCompletedPage(true)}
        onShowChangePin={() => setShowChangePinModal(true)}
        onLogout={handleLogout}
        // OFFLINE MODE PROPS
        isOnline={isOnline}
        pendingSyncCount={pendingSyncCount}
        syncStatus={syncStatus}
        onForceSync={onForceSync}
        onDownloadOffline={onDownloadOffline}
        cachedCount={cachedCount}
        isDownloading={isDownloading}
        lastSyncTime={lastSyncTime}
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
