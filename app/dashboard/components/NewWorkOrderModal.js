// app/dashboard/components/NewWorkOrderModal.js
'use client';

import { useState } from 'react';

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
    comments: ''
  });

  const [saving, setSaving] = useState(false);

  const handleCreateWorkOrder = async () => {
    if (!newWO.wo_number || !newWO.building || !newWO.work_order_description) {
      alert('Please fill in WO#, Building, and Description');
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('work_orders')
        .insert([{
          ...newWO,
          date_entered: new Date().toISOString()
        }])
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold">+ New Work Order</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* WO Number and Building */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Work Order # *</label>
              <input
                type="text"
                value={newWO.wo_number}
                onChange={(e) => setNewWO({ ...newWO, wo_number: e.target.value })}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                placeholder="WO-2025-001"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Building *</label>
              <input
                type="text"
                value={newWO.building}
                onChange={(e) => setNewWO({ ...newWO, building: e.target.value })}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                placeholder="Building A"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description *</label>
            <textarea
              value={newWO.work_order_description}
              onChange={(e) => setNewWO({ ...newWO, work_order_description: e.target.value })}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              rows="3"
              placeholder="Describe the work to be done..."
            />
          </div>

          {/* Requestor */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Requestor</label>
            <input
              type="text"
              value={newWO.requestor}
              onChange={(e) => setNewWO({ ...newWO, requestor: e.target.value })}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              placeholder="John Manager"
            />
          </div>

          {/* Priority, Status, NTE */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Priority</label>
              <select
                value={newWO.priority}
                onChange={(e) => setNewWO({ ...newWO, priority: e.target.value })}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Status</label>
              <select
                value={newWO.status}
                onChange={(e) => setNewWO({ ...newWO, status: e.target.value })}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              >
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">NTE Budget ($)</label>
              <input
                type="number"
                step="0.01"
                value={newWO.nte || ''}
                onChange={(e) => setNewWO({ ...newWO, nte: parseFloat(e.target.value) || 0 })}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                placeholder="5000.00"
              />
            </div>
          </div>

          {/* Lead Tech Assignment */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Assign to Lead Tech</label>
            <select
              value={newWO.lead_tech_id}
              onChange={(e) => setNewWO({ ...newWO, lead_tech_id: e.target.value })}
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

          {/* Comments */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Comments / Notes</label>
            <textarea
              value={newWO.comments}
              onChange={(e) => setNewWO({ ...newWO, comments: e.target.value })}
              className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
              rows="3"
              placeholder="Add any initial notes..."
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-900 rounded-lg p-4 text-blue-200">
            <div className="font-semibold mb-1">ℹ️ Quick Tips:</div>
            <ul className="text-sm space-y-1">
              <li>• WO# format suggestion: WO-YYYY-###</li>
              <li>• Set priority to Emergency for urgent requests</li>
              <li>• NTE helps track budget vs actual costs</li>
              <li>• Assign a lead tech to make it visible in mobile app</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={handleCreateWorkOrder}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-bold transition"
            >
              {saving ? 'Creating...' : 'Create Work Order'}
            </button>
            <button
              onClick={onClose}
              disabled={saving}
              className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}