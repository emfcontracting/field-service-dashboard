'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function BulkOperationsTab() {
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(false);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    building: '',
    assigned_to: '',
    date_from: '',
    date_to: ''
  });

  // Bulk action states
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  
  const [newStatus, setNewStatus] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [newAssignedTo, setNewAssignedTo] = useState('');
  const [bulkComment, setBulkComment] = useState('');

  useEffect(() => {
    fetchUsers();
    fetchWorkOrders();
  }, []);

  async function fetchUsers() {
    const { data } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, role')
      .eq('is_active', true)
      .order('first_name');
    
    if (data) setUsers(data);
  }

  async function fetchWorkOrders() {
    setLoading(true);
    try {
      let query = supabase
        .from('work_orders')
        .select('*')
        .order('date_entered', { ascending: false });

      // Apply filters
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.priority) query = query.eq('priority', filters.priority);
      if (filters.building) query = query.ilike('building', `%${filters.building}%`);
      if (filters.assigned_to) query = query.eq('assigned_to', filters.assigned_to);
      if (filters.date_from) query = query.gte('date_entered', filters.date_from);
      if (filters.date_to) query = query.lte('date_entered', filters.date_to);

      const { data, error } = await query;
      
      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Failed to fetch work orders:', error);
      alert('Failed to load work orders');
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(woId) {
    setSelectedIds(prev => 
      prev.includes(woId) 
        ? prev.filter(id => id !== woId)
        : [...prev, woId]
    );
  }

  function selectAll() {
    setSelectedIds(workOrders.map(wo => wo.wo_id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function executeBulkOperation(action, updates) {
    if (selectedIds.length === 0) {
      alert('Please select at least one work order');
      return;
    }

    if (!confirm(`Are you sure you want to ${action} ${selectedIds.length} work order(s)?`)) {
      return;
    }

    try {
      const response = await fetch('/api/backend/bulk-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          workOrderIds: selectedIds,
          updates
        })
      });

      const data = await response.json();

      if (data.success) {
        alert(`✓ ${data.message}\n\nUpdated work orders:\n${data.workOrders.slice(0, 10).join(', ')}${data.workOrders.length > 10 ? '...' : ''}`);
        
        // Refresh and clear selection
        await fetchWorkOrders();
        clearSelection();
        
        // Close modals
        setShowStatusModal(false);
        setShowReassignModal(false);
        setShowPriorityModal(false);
        setShowCommentModal(false);
      } else {
        alert(`✗ Operation failed: ${data.message || data.error}`);
      }
    } catch (error) {
      console.error('Bulk operation error:', error);
      alert(`✗ Failed to execute operation: ${error.message}`);
    }
  }

  const selectedCount = selectedIds.length;
  const selectedOrders = workOrders.filter(wo => selectedIds.includes(wo.wo_id));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-900 mb-2">⚙️ Bulk Operations</h2>
        <p className="text-sm text-blue-700">
          Select work orders using filters below, then apply bulk actions to save time on repetitive tasks.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">🔍 Filter Work Orders</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="on_hold">On Hold</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <select
            value={filters.priority}
            onChange={(e) => setFilters({...filters, priority: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          >
            <option value="">All Priorities</option>
            <option value="emergency">Emergency</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <input
            type="text"
            placeholder="Building name..."
            value={filters.building}
            onChange={(e) => setFilters({...filters, building: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          />

          <select
            value={filters.assigned_to}
            onChange={(e) => setFilters({...filters, assigned_to: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          >
            <option value="">All Technicians</option>
            {users.filter(u => ['lead_tech', 'tech', 'helper'].includes(u.role)).map(user => (
              <option key={user.user_id} value={user.user_id}>
                {user.first_name} {user.last_name}
              </option>
            ))}
          </select>

          <input
            type="date"
            placeholder="From date"
            value={filters.date_from}
            onChange={(e) => setFilters({...filters, date_from: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          />

          <input
            type="date"
            placeholder="To date"
            value={filters.date_to}
            onChange={(e) => setFilters({...filters, date_to: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {workOrders.length} work order(s)
          </div>
          <button
            onClick={fetchWorkOrders}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : '🔍 Search'}
          </button>
        </div>
      </div>

      {/* Selection Actions */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">
              {selectedCount} work order(s) selected
            </span>
            <button
              onClick={selectAll}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Select All ({workOrders.length})
            </button>
            <button
              onClick={clearSelection}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Clear Selection
            </button>
          </div>

          {selectedCount > 0 && (
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowStatusModal(true)}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                📝 Change Status
              </button>
              <button
                onClick={() => setShowReassignModal(true)}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                👤 Reassign
              </button>
              <button
                onClick={() => setShowPriorityModal(true)}
                className="px-3 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
              >
                🎯 Change Priority
              </button>
              <button
                onClick={() => setShowCommentModal(true)}
                className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
              >
                💬 Add Comment
              </button>
              <button
                onClick={() => executeBulkOperation('delete', {})}
                className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                🗑️ Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Work Orders Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedCount === workOrders.length && workOrders.length > 0}
                    onChange={(e) => e.target.checked ? selectAll() : clearSelection()}
                    className="rounded"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">WO #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Building</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Entered</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {workOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    {loading ? 'Loading work orders...' : 'No work orders found. Adjust filters and search again.'}
                  </td>
                </tr>
              ) : (
                workOrders.map(wo => {
                  const assignedUser = users.find(u => u.user_id === wo.assigned_to);
                  const assignedName = assignedUser 
                    ? `${assignedUser.first_name} ${assignedUser.last_name}`
                    : 'Unassigned';

                  return (
                    <tr key={wo.wo_id} className={`hover:bg-gray-50 ${selectedIds.includes(wo.wo_id) ? 'bg-blue-50' : ''}`}>
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(wo.wo_id)}
                          onChange={() => toggleSelect(wo.wo_id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {wo.wo_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {wo.building || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(wo.status)}`}>
                          {wo.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityColor(wo.priority)}`}>
                          {wo.priority || 'medium'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {assignedName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(wo.date_entered).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Modal */}
      {showStatusModal && (
        <Modal title="Change Status" onClose={() => setShowStatusModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Change status for {selectedCount} selected work order(s)
            </p>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            >
              <option value="">Select new status...</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="on_hold">On Hold</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => executeBulkOperation('update_status', { status: newStatus })}
                disabled={!newStatus}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Update Status
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reassign Modal */}
      {showReassignModal && (
        <Modal title="Reassign Work Orders" onClose={() => setShowReassignModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Reassign {selectedCount} selected work order(s) to:
            </p>
            <select
              value={newAssignedTo}
              onChange={(e) => setNewAssignedTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            >
              <option value="">Select technician...</option>
              {users.filter(u => ['lead_tech', 'tech', 'helper'].includes(u.role)).map(user => (
                <option key={user.user_id} value={user.user_id}>
                  {user.first_name} {user.last_name} ({user.role.replace('_', ' ')})
                </option>
              ))}
            </select>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowReassignModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const user = users.find(u => u.user_id === newAssignedTo);
                  executeBulkOperation('reassign', {
                    assigned_to: newAssignedTo,
                    assigned_name: `${user.first_name} ${user.last_name}`
                  });
                }}
                disabled={!newAssignedTo}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Reassign
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Priority Modal */}
      {showPriorityModal && (
        <Modal title="Change Priority" onClose={() => setShowPriorityModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Change priority for {selectedCount} selected work order(s)
            </p>
            <select
              value={newPriority}
              onChange={(e) => setNewPriority(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            >
              <option value="">Select new priority...</option>
              <option value="emergency">Emergency</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowPriorityModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => executeBulkOperation('update_priority', { priority: newPriority })}
                disabled={!newPriority}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
              >
                Update Priority
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Comment Modal */}
      {showCommentModal && (
        <Modal title="Add Comment" onClose={() => setShowCommentModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Add the same comment to {selectedCount} selected work order(s)
            </p>
            <textarea
              value={bulkComment}
              onChange={(e) => setBulkComment(e.target.value)}
              placeholder="Enter comment..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowCommentModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => executeBulkOperation('add_comment', { comment: bulkComment })}
                disabled={!bulkComment.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Add Comment
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Modal Component
function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function getStatusColor(status) {
  const colors = {
    pending: 'bg-yellow-100 text-yellow-800',
    assigned: 'bg-blue-100 text-blue-800',
    in_progress: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
    on_hold: 'bg-red-100 text-red-800',
    cancelled: 'bg-gray-100 text-gray-800'
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function getPriorityColor(priority) {
  const colors = {
    emergency: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-green-100 text-green-800'
  };
  return colors[priority] || 'bg-gray-100 text-gray-800';
}
