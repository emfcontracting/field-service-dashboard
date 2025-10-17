// app/dashboard/components/WorkOrderDetailModal.js
'use client';

import { useState, useEffect } from 'react';
import TeamMemberModal from './TeamMemberModal';
import { 
  updateWorkOrder, 
  deleteWorkOrder, 
  acknowledgeWorkOrder,
  assignToField,
  unassignFromField,
  removeTeamMember,
  updateTeamMember
} from '../utils/dataFetchers';
import { calculateInvoiceTotal } from '../utils/calculations';
import { getStatusColor, getPriorityColor, formatDate } from '../utils/styleHelpers';

export default function WorkOrderDetailModal({ 
  workOrder, 
  users, 
  supabase, 
  onClose, 
  refreshWorkOrders 
}) {
  const [selectedWO, setSelectedWO] = useState(workOrder);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showInvoiceButton, setShowInvoiceButton] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const adminPassword = 'admin123'; // Should be in environment variable

  useEffect(() => {
    checkCanGenerateInvoice();
  }, [selectedWO]);

  const checkCanGenerateInvoice = async () => {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('invoice_id, status')
      .eq('wo_id', selectedWO.wo_id)
      .single();

    setShowInvoiceButton(selectedWO?.acknowledged && !invoice && !selectedWO?.is_locked);
  };

  const handleUpdateField = async (field, value) => {
    try {
      await updateWorkOrder(supabase, selectedWO.wo_id, { [field]: value });
      setSelectedWO({ ...selectedWO, [field]: value });
      refreshWorkOrders();
    } catch (error) {
      alert('Failed to update field: ' + error.message);
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    await handleUpdateField('status', newStatus);
    if (newStatus === 'completed' && !selectedWO.is_locked) {
      alert('✅ Work Order marked as Completed! Please acknowledge to lock it.');
    }
  };

  const handleDeleteWorkOrder = async () => {
    const password = prompt('Enter admin password to delete:');
    if (password !== adminPassword) {
      alert('❌ Incorrect password');
      return;
    }

    const confirmText = prompt('Type DELETE to confirm deletion:');
    if (confirmText !== 'DELETE') {
      alert('Deletion cancelled');
      return;
    }

    try {
      await deleteWorkOrder(supabase, selectedWO.wo_id);
      alert('✅ Work order deleted');
      onClose();
      refreshWorkOrders();
    } catch (error) {
      alert('Failed to delete work order: ' + error.message);
    }
  };

  const handleAcknowledge = async () => {
    if (!confirm('Acknowledge this completed work order?\n\nThis will prepare it for invoicing.')) {
      return;
    }

    try {
      await acknowledgeWorkOrder(supabase, selectedWO.wo_id);
      alert('✅ Work order acknowledged and ready for invoicing!');
      setSelectedWO({ ...selectedWO, acknowledged: true, acknowledged_at: new Date().toISOString() });
      refreshWorkOrders();
    } catch (error) {
      alert('Failed to acknowledge work order: ' + error.message);
    }
  };

  const handleAssignToField = async () => {
    if (!confirm('Assign this work order to field workers?\n\nThis will make it visible in the mobile app.')) {
      return;
    }

    try {
      await assignToField(supabase, selectedWO.wo_id);
      alert('✅ Work order assigned to field workers!');
      onClose();
      refreshWorkOrders();
    } catch (error) {
      alert('❌ Error assigning to field: ' + error.message);
    }
  };

  const handleUnassignFromField = async () => {
    if (!confirm('Remove this work order from field workers?\n\nThis will hide it from the mobile app.')) {
      return;
    }

    try {
      await unassignFromField(supabase, selectedWO.wo_id);
      alert('✅ Work order removed from field workers!');
      onClose();
      refreshWorkOrders();
    } catch (error) {
      alert('❌ Error unassigning from field: ' + error.message);
    }
  };

  const handleRemoveTeamMember = async (assignmentId) => {
    if (!confirm('Remove this team member?')) return;
    
    try {
      await removeTeamMember(supabase, assignmentId);
      alert('✅ Team member removed');
      const updatedMembers = selectedWO.teamMembers.filter(m => m.assignment_id !== assignmentId);
      setSelectedWO({ ...selectedWO, teamMembers: updatedMembers });
    } catch (error) {
      alert('Failed to remove team member: ' + error.message);
    }
  };

  const handleUpdateTeamMemberField = async (assignmentId, field, value) => {
    try {
      await updateTeamMember(supabase, assignmentId, { [field]: value });
      const updatedMembers = selectedWO.teamMembers.map(m => 
        m.assignment_id === assignmentId ? { ...m, [field]: value } : m
      );
      setSelectedWO({ ...selectedWO, teamMembers: updatedMembers });
    } catch (error) {
      alert('Failed to update team member: ' + error.message);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!confirm('Generate invoice for this work order?\n\nThis will:\n- Create a draft invoice\n- Lock the work order\n- Send to invoicing for review\n\nContinue?')) {
      return;
    }

    setGeneratingInvoice(true);

    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wo_id: selectedWO.wo_id })
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Invoice generated successfully!\n\nThe work order is now locked and ready for review in the Invoicing section.');
        onClose();
        refreshWorkOrders();
      } else {
        alert('❌ Error generating invoice:\n' + result.error);
      }
    } catch (error) {
      alert('❌ Failed to generate invoice');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const costSummary = calculateInvoiceTotal(selectedWO, selectedWO.teamMembers);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg max-w-6xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-start z-10 rounded-t-lg">
          <div>
            <h2 className="text-2xl font-bold">{selectedWO.wo_number}</h2>
            <div className="flex gap-2 mt-2">
              {selectedWO.acknowledged && (
                <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm inline-block">
                  ✅ Acknowledged
                </div>
              )}
              {selectedWO.is_locked && (
                <div className="bg-red-900 text-red-200 px-3 py-1 rounded-lg text-sm inline-block">
                  🔒 Locked
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Work Order #</label>
              <input
                type="text"
                value={selectedWO.wo_number}
                onChange={(e) => setSelectedWO({ ...selectedWO, wo_number: e.target.value })}
                onBlur={() => handleUpdateField('wo_number', selectedWO.wo_number)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date & Time Entered</label>
              <input
                type="datetime-local"
                value={(() => {
                  if (!selectedWO.date_entered) return '';
                  const date = new Date(selectedWO.date_entered);
                  if (isNaN(date.getTime())) return '';
                  return date.toISOString().slice(0, 16);
                })()}
                onChange={(e) => setSelectedWO({ ...selectedWO, date_entered: new Date(e.target.value).toISOString() })}
                onBlur={() => handleUpdateField('date_entered', selectedWO.date_entered)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Building</label>
            <input
              type="text"
              value={selectedWO.building}
              onChange={(e) => setSelectedWO({ ...selectedWO, building: e.target.value })}
              onBlur={() => handleUpdateField('building', selectedWO.building)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={selectedWO.work_order_description}
              onChange={(e) => setSelectedWO({ ...selectedWO, work_order_description: e.target.value })}
              onBlur={() => handleUpdateField('work_order_description', selectedWO.work_order_description)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              rows="3"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Requestor</label>
            <input
              type="text"
              value={selectedWO.requestor || ''}
              onChange={(e) => setSelectedWO({ ...selectedWO, requestor: e.target.value })}
              onBlur={() => handleUpdateField('requestor', selectedWO.requestor)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
            />
          </div>

          {/* Status, Priority, Lead Tech */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Status</label>
              <select
                value={selectedWO.status}
                onChange={(e) => handleUpdateStatus(e.target.value)}
                disabled={selectedWO.is_locked || selectedWO.acknowledged}
                className={`w-full px-4 py-2 rounded-lg font-semibold ${getStatusColor(selectedWO.status)} ${
                  (selectedWO.is_locked || selectedWO.acknowledged) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="needs_return">Needs Return</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Priority</label>
              <select
                value={selectedWO.priority}
                onChange={(e) => handleUpdateField('priority', e.target.value)}
                className={`w-full px-4 py-2 rounded-lg font-semibold ${getPriorityColor(selectedWO.priority)}`}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Lead Tech</label>
              <select
                value={selectedWO.lead_tech_id || ''}
                onChange={(e) => handleUpdateField('lead_tech_id', e.target.value || null)}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              >
                <option value="">Unassigned</option>
                {users.filter(u => u.role === 'lead_tech' || u.role === 'admin').map(user => (
                  <option key={user.user_id} value={user.user_id}>
                    {user.first_name} {user.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-lg">Team Members</h3>
              <button
                onClick={() => setShowTeamModal(true)}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm font-semibold"
              >
                + Add Team Member
              </button>
            </div>

            <div className="space-y-3">
              {(!selectedWO.teamMembers || selectedWO.teamMembers.length === 0) ? (
                <div className="text-center text-gray-400 py-4 text-sm">
                  No additional team members yet
                </div>
              ) : (
                selectedWO.teamMembers.map(member => (
                  <div key={member.assignment_id} className="bg-gray-600 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold">
                          {member.user?.first_name} {member.user?.last_name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {member.user?.email} • {member.user?.role?.replace('_', ' ').toUpperCase()}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveTeamMember(member.assignment_id)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <label className="text-xs text-gray-400">RT Hours</label>
                        <input
                          type="number"
                          step="0.5"
                          value={member.hours_regular || 0}
                          onChange={(e) => handleUpdateTeamMemberField(
                            member.assignment_id, 
                            'hours_regular', 
                            parseFloat(e.target.value) || 0
                          )}
                          className="w-full bg-gray-700 text-white px-2 py-1 rounded mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">OT Hours</label>
                        <input
                          type="number"
                          step="0.5"
                          value={member.hours_overtime || 0}
                          onChange={(e) => handleUpdateTeamMemberField(
                            member.assignment_id, 
                            'hours_overtime', 
                            parseFloat(e.target.value) || 0
                          )}
                          className="w-full bg-gray-700 text-white px-2 py-1 rounded mt-1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-400">Miles</label>
                        <input
                          type="number"
                          value={member.miles || 0}
                          onChange={(e) => handleUpdateTeamMemberField(
                            member.assignment_id, 
                            'miles', 
                            parseFloat(e.target.value) || 0
                          )}
                          className="w-full bg-gray-700 text-white px-2 py-1 rounded mt-1"
                        />
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-400 mt-2">
                      Labor: ${(((member.hours_regular || 0) * 64) + ((member.hours_overtime || 0) * 96)).toFixed(2)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Primary Tech Field Data */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="font-bold mb-3 text-lg">Primary Tech Field Data</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Regular Hours (RT)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedWO.hours_regular || 0}
                  onChange={(e) => setSelectedWO({ ...selectedWO, hours_regular: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('hours_regular', selectedWO.hours_regular)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
                <div className="text-xs text-gray-500 mt-1">Up to 8 hrs @ $64/hr</div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Overtime Hours (OT)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedWO.hours_overtime || 0}
                  onChange={(e) => setSelectedWO({ ...selectedWO, hours_overtime: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('hours_overtime', selectedWO.hours_overtime)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
                <div className="text-xs text-gray-500 mt-1">Over 8 hrs @ $96/hr</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Miles</label>
                <input
                  type="number"
                  value={selectedWO.miles || 0}
                  onChange={(e) => setSelectedWO({ ...selectedWO, miles: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('miles', selectedWO.miles)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
                <div className="text-xs text-gray-500 mt-1">@ $1.00/mile</div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Material Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.material_cost || 0}
                  onChange={(e) => setSelectedWO({ ...selectedWO, material_cost: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('material_cost', selectedWO.material_cost)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Equipment Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.emf_equipment_cost || 0}
                  onChange={(e) => setSelectedWO({ ...selectedWO, emf_equipment_cost: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('emf_equipment_cost', selectedWO.emf_equipment_cost)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Trailer Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.trailer_cost || 0}
                  onChange={(e) => setSelectedWO({ ...selectedWO, trailer_cost: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('trailer_cost', selectedWO.trailer_cost)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Rental Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.rental_cost || 0}
                  onChange={(e) => setSelectedWO({ ...selectedWO, rental_cost: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('rental_cost', selectedWO.rental_cost)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Budget & Cost Summary */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h3 className="font-bold mb-3 text-lg">💰 Budget & Cost Summary</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">NTE (Not To Exceed)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.nte || ''}
                  onChange={(e) => setSelectedWO({ ...selectedWO, nte: parseFloat(e.target.value) || 0 })}
                  onBlur={() => handleUpdateField('nte', selectedWO.nte)}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Estimated Invoice Total</label>
                <div className="bg-gray-600 px-4 py-2 rounded-lg font-bold text-2xl text-green-400">
                  ${costSummary.grandTotal.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Includes all markups & admin hours
                </div>
              </div>
            </div>

            <div className="bg-blue-900 text-blue-100 rounded-lg p-3 mb-3">
              <div className="font-bold mb-2">LABOR (with 2 Admin Hours)</div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Lead Tech Labor</span>
                  <span>${(costSummary.leadRegular + costSummary.leadOvertime).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Team Labor</span>
                  <span>${costSummary.teamLabor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-yellow-300">
                  <span>+ Admin Hours</span>
                  <span>2 hrs × $64 = $128.00</span>
                </div>
                <div className="border-t border-blue-700 pt-1 mt-1 flex justify-between font-bold">
                  <span>Total Labor:</span>
                  <span>${costSummary.totalLabor.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Materials:</span>
                <span>${costSummary.materialsBase.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-yellow-300">
                <span className="text-gray-400">+ 25% Markup:</span>
                <span>= ${costSummary.materialsWithMarkup.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Equipment:</span>
                <span>${costSummary.equipmentBase.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-yellow-300">
                <span className="text-gray-400">+ 25% Markup:</span>
                <span>= ${costSummary.equipmentWithMarkup.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Trailer:</span>
                <span>${costSummary.trailerBase.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-yellow-300">
                <span className="text-gray-400">+ 25% Markup:</span>
                <span>= ${costSummary.trailerWithMarkup.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between">
                <span className="text-gray-400">Rental:</span>
                <span>${costSummary.rentalBase.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-yellow-300">
                <span className="text-gray-400">+ 25% Markup:</span>
                <span>= ${costSummary.rentalWithMarkup.toFixed(2)}</span>
              </div>
              
              <div className="flex justify-between col-span-2">
                <span className="text-gray-400">Total Mileage:</span>
                <span>{costSummary.totalMiles} mi × $1.00 = ${costSummary.mileageCost.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-gray-600 pt-3 mt-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">NTE Budget:</span>
                <span>${(selectedWO.nte || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Remaining:</span>
                <span className={costSummary.isOverBudget ? 'text-red-400 font-bold' : 'text-green-400'}>
                  ${costSummary.remaining.toFixed(2)}
                </span>
              </div>
            </div>

            {costSummary.isOverBudget && (
              <div className="bg-red-900 text-red-200 p-3 rounded-lg mt-3 text-sm">
                ⚠️ Over budget by ${Math.abs(costSummary.remaining).toFixed(2)}
              </div>
            )}
          </div>

          {/* Comments */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Comments / Notes</label>
            <textarea
              value={selectedWO.comments || ''}
              onChange={(e) => setSelectedWO({ ...selectedWO, comments: e.target.value })}
              onBlur={() => handleUpdateField('comments', selectedWO.comments)}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              rows="4"
              placeholder="Add any notes or comments..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-4 border-t border-gray-700">
            {selectedWO.status === 'completed' && !selectedWO.acknowledged && !selectedWO.is_locked && (
              <button
                onClick={handleAcknowledge}
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold text-lg transition"
              >
                ✅ Acknowledge Completion & Lock
              </button>
            )}

            {selectedWO.acknowledged && !selectedWO.is_locked && (
              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg text-center">
                <div className="font-bold">✅ Acknowledged - Ready for Invoice</div>
                <div className="text-sm mt-1">
                  Acknowledged on {new Date(selectedWO.acknowledged_at).toLocaleString()}
                </div>
              </div>
            )}

            {selectedWO.lead_tech_id && !selectedWO.assigned_to_field && (
              <button
                onClick={handleAssignToField}
                className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold text-lg transition"
              >
                📱 Assign to Field Workers
              </button>
            )}

            {selectedWO.assigned_to_field && (
              <div className="space-y-2">
                <div className="bg-blue-900 text-blue-200 p-4 rounded-lg text-center">
                  <div className="font-bold">📱 Assigned to Field Workers</div>
                  <div className="text-sm mt-1">
                    {selectedWO.assigned_to_field_at && (
                      <>Assigned on {new Date(selectedWO.assigned_to_field_at).toLocaleString()}</>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleUnassignFromField}
                  className="w-full bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition"
                >
                  ❌ Remove from Field Workers
                </button>
              </div>
            )}

            {selectedWO.acknowledged && !selectedWO.is_locked && showInvoiceButton && (
              <button
                onClick={handleGenerateInvoice}
                disabled={generatingInvoice}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-bold text-lg transition"
              >
                {generatingInvoice ? '⏳ Generating...' : '📄 Generate Invoice'}
              </button>
            )}

            {selectedWO.is_locked && selectedWO.acknowledged && (
              <div className="bg-purple-900 text-purple-200 p-4 rounded-lg text-center">
                <div className="font-bold">🔒 Invoice Generated</div>
                <div className="text-sm mt-1">
                  <button 
                    onClick={() => window.location.href = '/invoices'}
                    className="underline hover:text-purple-100"
                  >
                    View in Invoicing →
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleDeleteWorkOrder}
              className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition"
            >
              🗑️ Delete
            </button>
          </div>
        </div>
      </div>

      {/* Team Member Modal */}
      {showTeamModal && (
        <TeamMemberModal
          workOrder={selectedWO}
          users={users}
          supabase={supabase}
          onClose={() => setShowTeamModal(false)}
          onTeamMemberAdded={(updatedWO) => {
            setSelectedWO(updatedWO);
            setShowTeamModal(false);
          }}
        />
      )}
    </div>
  );
}