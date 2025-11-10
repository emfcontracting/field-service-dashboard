// app/mobile/components/WorkOrderDetail.js
'use client';

import { useState, useEffect } from 'react';
import CheckInOutCard from './CheckInOutCard';
import TeamMembersSection from './TeamMembersSection';
import PrimaryTechFieldData from './PrimaryTechFieldData';
import EmailPhotosSection from './EmailPhotosSection';
import CostSummarySection from './CostSummarySection';
import MaterialsSection from './MaterialsSection';
import EquipmentSection from './EquipmentSection';
import CommentsSection from './CommentsSection';
import TeamModal from './TeamModal';
import { 
  formatDate, 
  getPriorityBadge, 
  getPriorityColor,
  getStatusBadge,
  calculateAge 
} from '../utils/formatters';
import { 
  acknowledgeWorkOrder, 
  checkInWorkOrder, 
  checkOutWorkOrder, 
  completeWorkOrder,
  updateWorkOrder 
} from '../utils/workOrderHelpers';
import { getLocation, calculateElapsedTime } from '../utils/timeTracking';
import { calculateTotalHours } from '../utils/calculations';

export default function WorkOrderDetail({ 
  workOrder, 
  currentUser,
  supabase,
  onBack,
  onRefresh
}) {
  const [saving, setSaving] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [localWO, setLocalWO] = useState(workOrder);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => {
    setLocalWO(workOrder);
  }, [workOrder]);

  const handleAcknowledge = async () => {
    setSaving(true);
    const result = await acknowledgeWorkOrder(supabase, workOrder.wo_id);
    if (result.success) {
      await onRefresh();
    } else {
      alert('Error acknowledging work order: ' + result.error);
    }
    setSaving(false);
  };

  const handleCheckIn = async () => {
    setSaving(true);
    const { latitude, longitude } = await getLocation();
    const result = await checkInWorkOrder(supabase, workOrder.wo_id, latitude, longitude);
    
    if (result.success) {
      await onRefresh();
    } else {
      alert('Error checking in: ' + result.error);
    }
    setSaving(false);
  };

  const handleCheckOut = async () => {
    setSaving(true);
    const { latitude, longitude } = await getLocation();
    const result = await checkOutWorkOrder(supabase, workOrder.wo_id, latitude, longitude);
    
    if (result.success) {
      // Calculate hours
      const hours = calculateTotalHours(workOrder.time_in, new Date().toISOString());
      
      // Update hours in work order
      await updateWorkOrder(supabase, workOrder.wo_id, {
        hours_regular: hours.regular,
        hours_overtime: hours.overtime
      });
      
      await onRefresh();
    } else {
      alert('Error checking out: ' + result.error);
    }
    setSaving(false);
  };

  const handleCompleteWorkOrder = async () => {
    if (!workOrder.time_out) {
      alert('Please check out before completing the work order');
      return;
    }

    if (!confirm('Mark this work order as completed?')) return;

    setSaving(true);
    const result = await completeWorkOrder(supabase, workOrder.wo_id);
    
    if (result.success) {
      await onRefresh();
      onBack(); // Go back to list after completing
    } else {
      alert('Error completing work order: ' + result.error);
    }
    setSaving(false);
  };

  const handleUpdateField = async (field, value) => {
    setSaving(true);
    const result = await updateWorkOrder(supabase, workOrder.wo_id, { [field]: value });
    
    if (result.success) {
      await onRefresh();
    } else {
      alert('Error updating field: ' + result.error);
    }
    setSaving(false);
  };

  const handleStatusChange = async (newStatus) => {
    await handleUpdateField('status', newStatus);
  };

  const wo = localWO;
  const status = wo.status;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center">
            <button
              onClick={onBack}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            >
              ← Back
            </button>
            <button
              onClick={() => setShowTeamModal(true)}
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-semibold"
            >
              👥 Team
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="max-w-2xl mx-auto">
          {/* Work Order Header */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h1 className="text-2xl font-bold">{wo.wo_number}</h1>
                <span className={`text-sm ${getPriorityColor(wo.priority)}`}>
                  {getPriorityBadge(wo.priority)}
                </span>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                status === 'completed' ? 'bg-green-600' :
                status === 'in_progress' || status === 'in-progress' ? 'bg-orange-600' :
                status === 'assigned' ? 'bg-blue-600' :
                'bg-gray-600'
              }`}>
                {getStatusBadge(status)}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-400">Building:</span>
                <span className="ml-2 font-semibold">{wo.building}</span>
              </div>
              <div>
                <span className="text-gray-400">Description:</span>
                <p className="mt-1">{wo.work_order_description}</p>
              </div>
              <div>
                <span className="text-gray-400">Requestor:</span>
                <span className="ml-2">{wo.requestor || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <div>
                  <span className="text-gray-400">Entered:</span>
                  <span className="ml-2">{formatDate(wo.date_entered)}</span>
                  <span className="ml-2 text-orange-500 font-semibold">
                    ({calculateAge(wo.date_entered)} days old)
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">NTE:</span>
                  <span className="ml-2 text-green-500 font-bold">${(wo.nte || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Acknowledge Button */}
          {status === 'assigned' && (
            <button
              onClick={handleAcknowledge}
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-lg font-bold text-lg mb-4 transition active:scale-95 disabled:bg-gray-600"
            >
              👀 Acknowledge Work Order
            </button>
          )}

          {/* Check In/Out Card */}
          {status !== 'pending' && status !== 'assigned' && (
            <CheckInOutCard
              workOrder={wo}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
              saving={saving}
            />
          )}

          {/* Team Members Section */}
          <TeamMembersSection
            workOrder={wo}
            supabase={supabase}
            saving={saving}
            setSaving={setSaving}
          />

          {/* Primary Tech Field Data */}
          <PrimaryTechFieldData
            workOrder={wo}
            onUpdate={handleUpdateField}
            saving={saving}
          />

          {/* Update Status */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <h3 className="font-bold mb-3">Update Status</h3>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value)}
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

          {/* Email Photos Section */}
          <EmailPhotosSection
            workOrder={wo}
            currentUser={currentUser}
          />

          {/* Cost Summary */}
          <CostSummarySection
            workOrder={wo}
            teamMembers={teamMembers}
          />

          {/* Materials Section */}
          {(status === 'in_progress' || status === 'in-progress' || status === 'completed') && (
            <MaterialsSection 
              workOrder={wo}
              supabase={supabase}
              saving={saving}
              setSaving={setSaving}
            />
          )}

          {/* Equipment Section */}
          {(status === 'in_progress' || status === 'in-progress' || status === 'completed') && (
            <EquipmentSection 
              workOrder={wo}
              supabase={supabase}
              saving={saving}
              setSaving={setSaving}
            />
          )}

          {/* Comments Section */}
          <CommentsSection 
            workOrder={wo}
            currentUser={currentUser}
            supabase={supabase}
            saving={saving}
            setSaving={setSaving}
          />

          {/* Complete Work Order Button */}
          {wo.time_out && status !== 'completed' && (
            <button
              onClick={handleCompleteWorkOrder}
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition active:scale-95 disabled:bg-gray-600"
            >
              ✅ Complete Work Order
            </button>
          )}
        </div>
      </div>

      {/* Team Modal */}
      <TeamModal 
        isOpen={showTeamModal}
        onClose={() => setShowTeamModal(false)}
        workOrder={wo}
        currentUser={currentUser}
        supabase={supabase}
        saving={saving}
        setSaving={setSaving}
      />
    </div>
  );
}