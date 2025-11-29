# 🚀 STEP-BY-STEP IMPLEMENTATION GUIDE

## Overview
This guide will help you replace your monolithic 2112-line mobile app with a clean, modular structure while keeping **EVERYTHING EXACTLY THE SAME** in functionality and appearance.

---

## 📋 Pre-Implementation Checklist

Before starting, make sure you have:
- [ ] Backup of your current `page.js` file
- [ ] Git commit of current working state
- [ ] Access to your Next.js project
- [ ] Supabase credentials configured

---

## 🗂️ Step 1: Create Directory Structure

In your Next.js project, navigate to your mobile app directory and create this structure:

```bash
cd your-project/app/mobile/

# Create directories
mkdir -p components hooks utils
```

---

## 📁 Step 2: Copy Utility Files (Foundation)

Copy these files first as they contain no dependencies:

### 2.1 Copy constants.js
```bash
cp /path/to/refactored/utils/constants.js ./utils/constants.js
```

### 2.2 Copy helpers.js
```bash
cp /path/to/refactored/utils/helpers.js ./utils/helpers.js
```

### 2.3 Copy costCalculations.js
```bash
cp /path/to/refactored/utils/costCalculations.js ./utils/costCalculations.js
```

**✅ Test**: These files should have no errors when you save them.

---

## 🎣 Step 3: Copy Custom Hooks (Business Logic)

Copy the hooks in this order:

### 3.1 Copy useAuth.js
```bash
cp /path/to/refactored/hooks/useAuth.js ./hooks/useAuth.js
```

### 3.2 Copy useAvailability.js
```bash
cp /path/to/refactored/hooks/useAvailability.js ./hooks/useAvailability.js
```

### 3.3 Copy useWorkOrders.js
```bash
cp /path/to/refactored/hooks/useWorkOrders.js ./hooks/useWorkOrders.js
```

### 3.4 Copy useTeamMembers.js
```bash
cp /path/to/refactored/hooks/useTeamMembers.js ./hooks/useTeamMembers.js
```

**✅ Test**: Check that hooks import utilities correctly with no errors.

---

## 🎨 Step 4: Copy UI Components (Presentation Layer)

### 4.1 Copy Modal Components
```bash
cp /path/to/refactored/components/AvailabilityModal.js ./components/
cp /path/to/refactored/components/ChangePinModal.js ./components/
cp /path/to/refactored/components/TeamModal.js ./components/
```

### 4.2 Copy Screen Components
```bash
cp /path/to/refactored/components/LoginScreen.js ./components/
```

### 4.3 Copy Section Components
```bash
cp /path/to/refactored/components/TeamMembersSection.js ./components/
cp /path/to/refactored/components/CostSummarySection.js ./components/
cp /path/to/refactored/components/PrimaryTechFieldData.js ./components/
cp /path/to/refactored/components/EmailPhotosSection.js ./components/
```

**✅ Test**: All components should be syntax-error free.

---

## 📄 Step 5: Create the Main Page Component

Now you need to create the main `page.js` that orchestrates everything. Here's the structure:

### Create `page.js` with this content:

```javascript
'use client';
import { useState } from 'react';

// Import custom hooks
import { useAuth } from './hooks/useAuth';
import { useWorkOrders } from './hooks/useWorkOrders';
import { useTeamMembers } from './hooks/useTeamMembers';
import { useAvailability } from './hooks/useAvailability';

// Import utility functions
import { formatDate, calculateAge, getPriorityColor, getPriorityBadge, getStatusBadge } from './utils/helpers';

// Import components
import LoginScreen from './components/LoginScreen';
import AvailabilityModal from './components/AvailabilityModal';
import ChangePinModal from './components/ChangePinModal';
import TeamModal from './components/TeamModal';
import TeamMembersSection from './components/TeamMembersSection';
import CostSummarySection from './components/CostSummarySection';
import PrimaryTechFieldData from './components/PrimaryTechFieldData';
import EmailPhotosSection from './components/EmailPhotosSection';

export default function MobilePage() {
  // Authentication state
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  
  // Page navigation state
  const [showCompletedPage, setShowCompletedPage] = useState(false);
  
  // Use custom hooks
  const { currentUser, loading, error, setError, login, logout, changePin } = useAuth();
  
  const {
    workOrders,
    completedWorkOrders,
    selectedWO,
    setSelectedWO,
    saving,
    newComment,
    setNewComment,
    handleCheckIn,
    handleCheckOut,
    handleCompleteWorkOrder,
    handleUpdateField,
    handleFieldChange,
    getFieldValue,
    handleAddComment
  } = useWorkOrders(currentUser);
  
  const {
    teamMembers,
    currentTeamList,
    showTeamModal,
    setShowTeamModal,
    saving: teamSaving,
    loadTeamMembers,
    handleAddTeamMember,
    handleTeamFieldChange,
    getTeamFieldValue,
    handleUpdateTeamMemberField
  } = useTeamMembers(selectedWO);
  
  const {
    showAvailabilityModal,
    setShowAvailabilityModal,
    availabilityBlocked,
    scheduledWork,
    emergencyWork,
    notAvailable,
    saving: availabilitySaving,
    handleAvailabilitySubmit,
    handleAvailabilityChange
  } = useAvailability(currentUser);

  // Handle login form submission
  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    await login(email, pin);
  }

  // Handle PIN change
  async function handleChangePinSubmit() {
    try {
      await changePin(newPin, confirmPin);
      alert('PIN changed successfully!');
      setShowChangePinModal(false);
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      alert('Error changing PIN: ' + err.message);
    }
  }

  // Print work order function
  function handlePrintWO() {
    if (!selectedWO) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Unable to open print window. Please check your popup settings.');
      return;
    }
    
    const age = calculateAge(selectedWO.date_entered);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Work Order ${selectedWO.wo_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1e40af; }
          .header { border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .label { font-weight: bold; color: #4b5563; }
          .value { margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-left; }
          th { background-color: #f3f4f6; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Work Order: ${selectedWO.wo_number || 'N/A'}</h1>
          <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="section">
          <h2>Work Order Details</h2>
          <div class="value"><span class="label">Building:</span> ${selectedWO.building || 'N/A'}</div>
          <div class="value"><span class="label">Priority:</span> ${selectedWO.priority || 'N/A'}</div>
          <div class="value"><span class="label">Status:</span> ${(selectedWO.status || '').replace('_', ' ').toUpperCase()}</div>
          <div class="value"><span class="label">Age:</span> ${age} days</div>
          <div class="value"><span class="label">Date Entered:</span> ${formatDate(selectedWO.date_entered)}</div>
          <div class="value"><span class="label">Requestor:</span> ${selectedWO.requestor || 'N/A'}</div>
          <div class="value"><span class="label">NTE:</span> $${(selectedWO.nte || 0).toFixed(2)}</div>
        </div>
        
        <div class="section">
          <h2>Description</h2>
          <p>${selectedWO.work_order_description || 'N/A'}</p>
        </div>
        
        <div class="section">
          <h2>Team</h2>
          <div class="value"><span class="label">Lead Tech:</span> ${selectedWO.lead_tech?.first_name || ''} ${selectedWO.lead_tech?.last_name || ''}</div>
          ${currentTeamList.map((member, idx) => 
            `<div class="value"><span class="label">Helper ${idx + 1}:</span> ${member.user?.first_name || ''} ${member.user?.last_name || ''}</div>`
          ).join('')}
        </div>
        
        ${selectedWO.comments ? `
          <div class="section">
            <h2>Comments</h2>
            <p style="white-space: pre-wrap;">${selectedWO.comments}</p>
          </div>
        ` : ''}
        
        <div class="section" style="margin-top: 40px;">
          <p><strong>Signature:</strong> ___________________________ <strong>Date:</strong> _______________</p>
        </div>
        
        <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #1e40af; color: white; border: none; cursor: pointer; border-radius: 5px;">
          Print
        </button>
      </body>
      </html>
    `);
    
    printWindow.document.close();
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
        email={email}
        setEmail={setEmail}
        pin={pin}
        setPin={setPin}
        error={error}
        handleLogin={handleLogin}
      />
    );
  }

  // Availability Modal (blocking)
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
        handleAvailabilitySubmit={handleAvailabilitySubmit}
      />
    );
  }

  // Work Order Detail View
  if (selectedWO) {
    const wo = selectedWO || {};
    const woNumber = wo.wo_number || 'Unknown';
    const building = wo.building || 'Unknown Location';
    const description = wo.work_order_description || 'No description';
    const status = wo.status || 'assigned';
    const nte = wo.nte || 0;
    const dateEntered = wo.date_entered;
    const requestor = wo.requestor || 'N/A';
    const leadTech = wo.lead_tech || {};

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => {
                setSelectedWO(null);
                if (status === 'completed') {
                  setShowCompletedPage(true);
                }
              }}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold">{woNumber}</h1>
            <div className="flex gap-2">
              {(currentUser.role === 'admin' || currentUser.role === 'office') && (
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm"
                  title="Dashboard"
                >
                  💻
                </button>
              )}
              <button
                onClick={() => setShowChangePinModal(true)}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm"
              >
                🔑
              </button>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Work Order Details */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3 text-blue-400">Work Order Details</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Building:</span>
                  <p className="font-semibold">{building}</p>
                </div>
                <div>
                  <span className="text-gray-400">Requestor:</span>
                  <p className="font-semibold">{requestor}</p>
                </div>
                <div>
                  <span className="text-gray-400">Description:</span>
                  <p className="text-gray-300">{description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
                  <div>
                    <span className="text-gray-400">Date Entered:</span>
                    <p className="font-semibold">{formatDate(dateEntered)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Age:</span>
                    <p className="font-semibold text-orange-500">{calculateAge(dateEntered)} days</p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                  <span className="text-gray-400">NTE (Not to Exceed):</span>
                  <span className="text-green-500 font-bold text-lg">${nte.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Quick Actions</h3>
              <button
                onClick={handlePrintWO}
                className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-semibold"
              >
                🖨️ Print WO
              </button>
            </div>

            {/* Check In/Out */}
            {status !== 'completed' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleCheckIn(wo.wo_id)}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition active:scale-95 disabled:bg-gray-600"
                  >
                    ✔ CHECK IN
                  </button>
                  <button
                    onClick={() => handleCheckOut(wo.wo_id)}
                    disabled={saving}
                    className="bg-orange-600 hover:bg-orange-700 py-4 rounded-lg font-bold text-lg transition active:scale-95 disabled:bg-gray-600"
                  >
                    ⏸ CHECK OUT
                  </button>
                </div>
                {wo.time_in && (
                  <div className="bg-gray-800 rounded-lg p-3 text-center text-sm">
                    <p className="text-gray-400">
                      First Check-In: {formatDate(wo.time_in)}
                      {wo.time_out && (
                        <> • First Check-Out: {formatDate(wo.time_out)}</>
                      )}
                    </p>
                    <p className="text-blue-400 text-xs mt-1">
                      See Comments below for full check-in/out history
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Primary Assignment */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Primary Assignment</h3>
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="font-semibold">
                  {leadTech.first_name || 'Unknown'} {leadTech.last_name || ''}
                </p>
              </div>
            </div>

            {/* Team Members Section */}
            <TeamMembersSection
              currentTeamList={currentTeamList}
              status={status}
              saving={teamSaving}
              loadTeamMembers={loadTeamMembers}
              getTeamFieldValue={getTeamFieldValue}
              handleTeamFieldChange={handleTeamFieldChange}
              handleUpdateTeamMemberField={handleUpdateTeamMemberField}
            />

            {/* Update Status */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Update Status</h3>
              <select
                value={status}
                onChange={(e) => handleUpdateField(wo.wo_id, 'status', e.target.value)}
                disabled={saving || status === 'completed'}
                className="w-full px-4 py-3 bg-blue-600 rounded-lg text-white font-semibold text-center"
              >
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="needs_return">Needs Return</option>
                <option value="return_trip">Return Trip</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Primary Tech Field Data */}
            <PrimaryTechFieldData
              wo={wo}
              status={status}
              saving={saving}
              getFieldValue={getFieldValue}
              handleFieldChange={handleFieldChange}
              handleUpdateField={handleUpdateField}
            />

            {/* Email Photos Section */}
            <EmailPhotosSection
              wo={wo}
              woNumber={woNumber}
              building={building}
              description={description}
              status={status}
              currentUser={currentUser}
            />

            {/* Cost Summary Section */}
            <CostSummarySection
              wo={wo}
              currentTeamList={currentTeamList}
            />

            {/* Comments */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Comments & Notes</h3>
              <div className="mb-3 max-h-40 overflow-y-auto bg-gray-700 rounded-lg p-3">
                {wo.comments ? (
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                    {wo.comments}
                  </pre>
                ) : (
                  <p className="text-gray-500 text-sm">No comments yet</p>
                )}
              </div>
              {status !== 'completed' && (
                <>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg mb-2 text-sm text-white"
                    rows="3"
                    disabled={saving}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={saving || !newComment.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-semibold disabled:bg-gray-600"
                  >
                    Add Comment
                  </button>
                </>
              )}
            </div>

            {/* Complete Work Order Button */}
            {wo.time_out && status !== 'completed' && (
              <button
                onClick={handleCompleteWorkOrder}
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition active:scale-95"
              >
                ✅ Complete Work Order
              </button>
            )}
          </div>

          {/* Modals */}
          <TeamModal
            showTeamModal={showTeamModal}
            setShowTeamModal={setShowTeamModal}
            teamMembers={teamMembers}
            handleAddTeamMember={handleAddTeamMember}
            saving={teamSaving}
          />
          <ChangePinModal
            showChangePinModal={showChangePinModal}
            setShowChangePinModal={setShowChangePinModal}
            newPin={newPin}
            setNewPin={setNewPin}
            confirmPin={confirmPin}
            setConfirmPin={setConfirmPin}
            handleChangePin={handleChangePinSubmit}
            saving={saving}
          />
        </div>
      </div>
    );
  }

  // Completed Work Orders Page
  if (showCompletedPage) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setShowCompletedPage(false)}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold">Completed Work Orders</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowChangePinModal(true)}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm"
              >
                🔐
              </button>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {completedWorkOrders.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center">
                <p className="text-gray-400">No completed work orders</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-900 rounded-lg p-3 mb-4 text-center">
                  <p className="text-sm text-blue-200">
                    👆 Tap any completed work order to view details
                  </p>
                </div>
                {completedWorkOrders.map(wo => (
                  <div
                    key={wo.wo_id}
                    onClick={() => setSelectedWO(wo)}
                    className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold text-lg">{wo.wo_number}</span>
                        <span className={`ml-2 text-sm ${getPriorityColor(wo.priority)}`}>
                          {getPriorityBadge(wo.priority)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 text-sm">✅ Completed</span>
                      </div>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <p className="font-semibold">{wo.building}</p>
                      <p className="text-gray-400">{wo.work_order_description}</p>
                      <p className="text-orange-500 text-xs">{calculateAge(wo.date_entered)} days old</p>
                      <p className="text-gray-500">Completed: {formatDate(wo.date_completed)}</p>
                      {wo.lead_tech && (
                        <p className="text-gray-500">Tech: {wo.lead_tech.first_name} {wo.lead_tech.last_name}</p>
                      )}
                    </div>

                    {wo.hours_regular || wo.hours_overtime ? (
                      <div className="mt-2 text-xs text-gray-400">
                        Hours: RT {wo.hours_regular || 0} / OT {wo.hours_overtime || 0} | Miles: {wo.miles || 0}
                      </div>
                    ) : null}
                  </div>
                ))}
              </>
            )}
          </div>

          <ChangePinModal
            showChangePinModal={showChangePinModal}
            setShowChangePinModal={setShowChangePinModal}
            newPin={newPin}
            setNewPin={setNewPin}
            confirmPin={confirmPin}
            setConfirmPin={setConfirmPin}
            handleChangePin={handleChangePinSubmit}
            saving={saving}
          />
        </div>
      </div>
    );
  }

  // Main Work Orders List
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <img 
              src="/emf-logo.png" 
              alt="EMF" 
              className="h-10 w-auto"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML += '<div class="h-10 w-10 bg-white rounded-lg flex items-center justify-center text-gray-900 font-bold">EMF</div>';
              }}
            />
            <div>
              <h1 className="text-lg font-bold">👋 {currentUser.first_name}</h1>
              <p className="text-xs text-gray-400">{currentUser.role.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(currentUser.role === 'admin' || currentUser.role === 'office') && (
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-semibold"
              >
                💻 Dashboard
              </button>
            )}
            <button
              onClick={() => setShowCompletedPage(true)}
              className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-semibold"
            >
              ✅ Completed
            </button>
            <button
              onClick={() => setShowChangePinModal(true)}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-semibold"
            >
              🔑 PIN
            </button>
            <button
              onClick={logout}
              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
            >
              Logout
            </button>
          </div>
        </div>

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
              <div
                key={wo.wo_id}
                onClick={() => setSelectedWO(wo)}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer active:scale-98"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold text-lg">{wo.wo_number}</span>
                    <span className={`ml-2 text-sm ${getPriorityColor(wo.priority)}`}>
                      {getPriorityBadge(wo.priority)}
                    </span>
                  </div>
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded-full">
                    {getStatusBadge(wo.status)}
                  </span>
                </div>
                
                <h3 className="font-semibold mb-1">{wo.building}</h3>
                <p className="text-sm text-gray-400 mb-2">{wo.work_order_description}</p>
                
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <div>
                    <span>Entered: {formatDate(wo.date_entered)}</span>
                    <span className="ml-2 text-orange-500 font-semibold">
                      {calculateAge(wo.date_entered)} days old
                    </span>
                  </div>
                  <span className="text-green-500 font-bold">NTE: ${(wo.nte || 0).toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        <ChangePinModal
          showChangePinModal={showChangePinModal}
          setShowChangePinModal={setShowChangePinModal}
          newPin={newPin}
          setNewPin={setNewPin}
          confirmPin={confirmPin}
          setConfirmPin={setConfirmPin}
          handleChangePin={handleChangePinSubmit}
          saving={saving}
        />
      </div>
    </div>
  );
}
```

**✅ Test**: Start your development server and test all functionality.

---

## ✅ Step 6: Final Testing Checklist

Go through each feature and verify it works:

### Authentication
- [ ] Can log in with email/PIN
- [ ] Incorrect credentials show error
- [ ] Auto-login on return works
- [ ] Logout clears session
- [ ] PIN can be changed

### Work Orders
- [ ] Work orders list displays
- [ ] Can select and view details
- [ ] Check-in adds timestamp and comment
- [ ] Check-out adds timestamp and comment  
- [ ] Status can be updated
- [ ] Fields can be edited and save

### Team Management
- [ ] Can add team members
- [ ] Team member hours/miles can be edited
- [ ] Cost calculations update in real-time

### Availability
- [ ] Modal appears at correct times
- [ ] Can submit availability
- [ ] App locks after 8 PM if not submitted

### Other Features
- [ ] Comments can be added
- [ ] Email photos button works
- [ ] Print work order opens print window
- [ ] Completed orders page displays
- [ ] Dashboard button shows for admin/office only

### Visual Verification
- [ ] All colors match original
- [ ] All spacing matches original
- [ ] All buttons look identical
- [ ] Mobile responsiveness maintained

---

## 🎉 Step 7: Clean Up

Once everything works:

1. **Remove old file**: Rename or delete the old monolithic `page.js`
2. **Commit changes**: 
   ```bash
   git add .
   git commit -m "Refactor mobile app into modular structure"
   ```
3. **Deploy**: Test on production

---

## 🐛 Troubleshooting

### Import Errors
- Check file paths are correct
- Ensure all files are in the right directories
- Verify `'use client'` directive at top of page.js

### Functionality Not Working
- Check browser console for errors
- Verify Supabase queries are working
- Check that all props are passed correctly

### Styling Issues
- Verify Tailwind CSS is configured
- Check that all className strings are copied exactly
- Ensure no CSS files are conflicting

---

## 📞 Need Help?

If you encounter issues:
1. Check the README.md for architecture overview
2. Verify all files are copied correctly
3. Check import statements
4. Test each section independently
5. Review browser console for specific errors

---

## 🎊 Success!

You now have a professional, maintainable, modular mobile app that:
- ✅ Works identically to the original
- ✅ Is easy to debug and enhance
- ✅ Has clear separation of concerns
- ✅ Follows React best practices
- ✅ Is ready for future growth

**Congratulations on completing the refactoring!** 🚀
