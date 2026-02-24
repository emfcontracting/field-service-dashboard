// app/dashboard/components/NewWorkOrderModal.js
'use client';

import { useState } from 'react';
import { getNowEST, getTodayEST } from '../../mobile/utils/dateUtils';

export default function NewWorkOrderModal({ users, supabase, onClose, refreshWorkOrders }) {
  const [newWO, setNewWO] = useState({
    wo_number: '',
    building: '',
    work_order_description: '',
    requestor: '',
    priority: 'medium',
    status: 'pending',
    lead_tech_id: '',
    nte: 0,
    comments: '',
    scheduled_date: ''
  });

  const [saving, setSaving] = useState(false);

  const handleCreateWorkOrder = async () => {
    if (!newWO.wo_number || !newWO.building || !newWO.work_order_description) {
      alert('Please fill in WO#, Building, and Description');
      return;
    }

    setSaving(true);

    try {
      const insertData = {
        ...newWO,
        date_entered: getNowEST(),
        scheduled_date: newWO.scheduled_date || null,
        lead_tech_id: newWO.lead_tech_id || null
      };

      const { data, error } = await supabase
        .from('work_orders')
        .insert([insertData])
        .select();

      if (error) {
        console.error('Error creating work order:', error);
        alert('Error creating work order: ' + error.message);
      } else {
        alert('✅ Work order created successfully!');
        onClose();
        refreshWorkOrders();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to create work order');
    } finally {
      setSaving(false);
    }
  };

  const today = getTodayEST();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-3 md:p-6 flex justify-between items-center z-10">
          <h2 className="text-lg md:text-2xl font-bold">+ New Work Order</h2>
          <button
            onClick={onClose}
            className="text-gray-400 active:text-white md:hover:text-white text-2xl md:text-3xl leading-none p-1"
          >
            ×
          </button>
        </div>

        <div className="p-3 md:p-6 space-y-3 md:space-y-4">
          {/* WO Number and Building - Stack on mobile */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm text-gray-400 mb-1">Work Order # *</label>
              <input
                type="text"
                value={newWO.wo_number}
                onChange={(e) => setNewWO({ ...newWO, wo_number: e.target.value })}
                className="w-full bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg text-sm md:text-base"
                placeholder="WO-2025-001"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs md:text-sm text-gray-400 mb-1">Building *</label>
              <input
                type="text"
                value={newWO.building}
                onChange={(e) => setNewWO({ ...newWO, building: e.target.value })}
                className="w-full bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg text-sm md:text-base"
                placeholder="Building A"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs md:text-sm text-gray-400 mb-1">Description *</label>
            <textarea
              value={newWO.work_order_description}
              onChange={(e) => setNewWO({ ...newWO, work_order_description: e.target.value })}
              className="w-full bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg text-sm md:text-base"
              rows="3"
              placeholder="Describe the work..."
            />
          </div>

          {/* Requestor */}
          <div>
            <label className="block text-xs md:text-sm text-gray-400 mb-1">Requestor</label>
            <input
              type="text"
              value={newWO.requestor}
              onChange={(e) => setNewWO({ ...newWO, requestor: e.target.value })}
              className="w-full bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg text-sm md:text-base"
              placeholder="Contact name"
            />
          </div>

          {/* Priority, Status, Scheduled Date - 2 cols on mobile, 3 on desktop */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm text-gray-400 mb-1">Priority</label>
              <select
                value={newWO.priority}
                onChange={(e) => setNewWO({ ...newWO, priority: e.target.value })}
                className="w-full bg-gray-700 text-white px-2 md:px-4 py-2 rounded-lg text-sm md:text-base"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div>
              <label className="block text-xs md:text-sm text-gray-400 mb-1">Status</label>
              <select
                value={newWO.status}
                onChange={(e) => setNewWO({ ...newWO, status: e.target.value })}
                className="w-full bg-gray-700 text-white px-2 md:px-4 py-2 rounded-lg text-sm md:text-base"
              >
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>

            <div className="col-span-2 md:col-span-1">
              <label className="block text-xs md:text-sm text-gray-400 mb-1">📅 Scheduled</label>
              <input
                type="date"
                value={newWO.scheduled_date}
                min={today}
                onChange={(e) => setNewWO({ ...newWO, scheduled_date: e.target.value })}
                className="w-full bg-gray-700 text-white px-2 md:px-4 py-2 rounded-lg text-sm md:text-base"
              />
            </div>
          </div>

          {/* NTE and Lead Tech */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm text-gray-400 mb-1">NTE Budget ($)</label>
              <input
                type="number"
                step="0.01"
                value={newWO.nte || ''}
                onChange={(e) => setNewWO({ ...newWO, nte: parseFloat(e.target.value) || 0 })}
                className="w-full bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg text-sm md:text-base"
                placeholder="5000.00"
              />
            </div>

            <div>
              <label className="block text-xs md:text-sm text-gray-400 mb-1">Lead Tech</label>
              <select
                value={newWO.lead_tech_id}
                onChange={(e) => setNewWO({ ...newWO, lead_tech_id: e.target.value })}
                className="w-full bg-gray-700 text-white px-2 md:px-4 py-2 rounded-lg text-sm md:text-base"
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

          {/* Comments */}
          <div>
            <label className="block text-xs md:text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={newWO.comments}
              onChange={(e) => setNewWO({ ...newWO, comments: e.target.value })}
              className="w-full bg-gray-700 text-white px-3 md:px-4 py-2 rounded-lg text-sm md:text-base"
              rows="2"
              placeholder="Add notes..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 md:gap-3 pt-2 md:pt-4">
            <button
              onClick={handleCreateWorkOrder}
              disabled={saving}
              className="flex-1 bg-green-600 active:bg-green-700 md:hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 md:px-6 py-2.5 md:py-3 rounded-lg font-bold transition text-sm md:text-base"
            >
              {saving ? 'Creating...' : 'Create WO'}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="bg-gray-600 active:bg-gray-700 md:hover:bg-gray-700 disabled:opacity-50 px-4 md:px-6 py-2.5 md:py-3 rounded-lg font-semibold transition text-sm md:text-base"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
