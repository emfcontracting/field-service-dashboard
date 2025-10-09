'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function WorkOrderDetail({ params }) {
  const router = useRouter();
  const [workOrder, setWorkOrder] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    fetchWorkOrder();
    fetchUsers();
  }, [params.id]);

  async function fetchWorkOrder() {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('wo_id', params.id)
        .single();

      if (error) throw error;
      setWorkOrder(data);
    } catch (error) {
      console.error('Error fetching work order:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }

  async function updateWorkOrder(updates) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update(updates)
        .eq('wo_id', params.id);

      if (error) throw error;
      
      setWorkOrder({ ...workOrder, ...updates });
      alert('Work order updated successfully!');
    } catch (error) {
      console.error('Error updating work order:', error);
      alert('Error updating work order');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;

    const updatedComments = workOrder.comments 
      ? `${workOrder.comments}\n\n[${new Date().toLocaleString()}]\n${newComment}`
      : `[${new Date().toLocaleString()}]\n${newComment}`;

    await updateWorkOrder({ comments: updatedComments });
    setNewComment('');
  }

  function getPriorityColor(priority) {
    switch (priority) {
      case 'emergency': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-300';
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'assigned': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading work order...</p>
        </div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-xl text-gray-600">Work order not found</p>
          <button 
            onClick={() => router.push('/')}
            className="mt-4 text-blue-600 hover:text-blue-800"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => router.push('/')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Work Order #{workOrder.wo_number}</h1>
                <p className="text-sm text-gray-500 mt-1">Created on {new Date(workOrder.date_entered).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className={`px-4 py-2 rounded-lg border-2 font-medium ${getPriorityColor(workOrder.priority)}`}>
                {workOrder.priority?.toUpperCase()}
              </span>
              <span className={`px-4 py-2 rounded-lg border-2 font-medium ${getStatusColor(workOrder.status)}`}>
                {workOrder.status?.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Basic Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Work Order Details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
                  <p className="text-gray-900">{workOrder.building || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Requestor</label>
                  <p className="text-gray-900">{workOrder.requestor || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <p className="text-gray-900 whitespace-pre-wrap">{workOrder.work_order_description}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">NTE (Not To Exceed)</label>
                  <p className="text-gray-900 text-lg font-semibold">${workOrder.nte ? workOrder.nte.toLocaleString() : 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
                  <p className="text-gray-900">{workOrder.age_of_wo || 0} days</p>
                </div>
              </div>
            </div>

            {/* Assignment Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Assignment</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Lead Technician</label>
                <select
                  value={workOrder.lead_tech_id || ''}
                  onChange={(e) => updateWorkOrder({ 
                    lead_tech_id: e.target.value || null,
                    status: e.target.value ? 'assigned' : 'pending'
                  })}
                  disabled={saving}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Unassigned</option>
                  {users.filter(u => u.role === 'lead_tech').map(user => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Status Update */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Update Status</h2>
              <select
                value={workOrder.status}
                onChange={(e) => updateWorkOrder({ status: e.target.value })}
                disabled={saving}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="needs_return">Needs Return Visit</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Field Data */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Field Data</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hours Worked</label>
                  <input
                    type="number"
                    step="0.5"
                    value={workOrder.hours || ''}
                    onChange={(e) => updateWorkOrder({ hours: parseFloat(e.target.value) || null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Miles</label>
                  <input
                    type="number"
                    step="0.1"
                    value={workOrder.miles || ''}
                    onChange={(e) => updateWorkOrder({ miles: parseFloat(e.target.value) || null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Material Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.material_cost || ''}
                    onChange={(e) => updateWorkOrder({ material_cost: parseFloat(e.target.value) || null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Equipment Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.emf_equipment_cost || ''}
                    onChange={(e) => updateWorkOrder({ emf_equipment_cost: parseFloat(e.target.value) || null })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Comments */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Comments & Notes</h2>
              {workOrder.comments && (
                <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{workOrder.comments}</p>
                </div>
              )}
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a new comment..."
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-3"
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim() || saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                Add Comment
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
              <div className="space-y-3">
                <button className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                  Generate Invoice
                </button>
                <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                  Send to Tech
                </button>
                <button className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
                  Print WO
                </button>
              </div>
            </div>

            {/* Cost Summary */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Cost Summary</h2>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Materials:</span>
                  <span className="font-medium">${workOrder.material_cost?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Equipment:</span>
                  <span className="font-medium">${workOrder.emf_equipment_cost?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Trailer:</span>
                  <span className="font-medium">${workOrder.trailer_cost?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Rental:</span>
                  <span className="font-medium">${workOrder.rental_cost?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="border-t pt-3 flex justify-between font-bold">
                  <span>Total Cost:</span>
                  <span className="text-lg">
                    ${(
                      (workOrder.material_cost || 0) + 
                      (workOrder.emf_equipment_cost || 0) + 
                      (workOrder.trailer_cost || 0) + 
                      (workOrder.rental_cost || 0)
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between text-sm">
                  <span className="text-gray-600">NTE:</span>
                  <span className="font-medium">${workOrder.nte?.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Remaining:</span>
                  <span className={`font-medium ${
                    (workOrder.nte || 0) - (
                      (workOrder.material_cost || 0) + 
                      (workOrder.emf_equipment_cost || 0) + 
                      (workOrder.trailer_cost || 0) + 
                      (workOrder.rental_cost || 0)
                    ) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${(
                      (workOrder.nte || 0) - (
                        (workOrder.material_cost || 0) + 
                        (workOrder.emf_equipment_cost || 0) + 
                        (workOrder.trailer_cost || 0) + 
                        (workOrder.rental_cost || 0)
                      )
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Time Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Time Tracking</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-600">Hours Worked:</span>
                  <p className="font-medium text-lg">{workOrder.hours || 0} hrs</p>
                </div>
                <div>
                  <span className="text-gray-600">Miles Traveled:</span>
                  <p className="font-medium text-lg">{workOrder.miles || 0} mi</p>
                </div>
                {workOrder.date_completed && (
                  <div>
                    <span className="text-gray-600">Completed:</span>
                    <p className="font-medium">{new Date(workOrder.date_completed).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}