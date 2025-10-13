'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useParams } from 'next/navigation';

export default function MobileWorkOrder() {
  const params = useParams();
  const woId = params.wo_id;
  const [user, setUser] = useState(null);
  const [workOrder, setWorkOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Check if user is logged in
    const userData = localStorage.getItem('mobile_user');
    if (!userData) {
      window.location.href = '/mobile/login';
      return;
    }
    setUser(JSON.parse(userData));
    fetchWorkOrder(woId, JSON.parse(userData).user_id);
  }, [woId]);

  const fetchWorkOrder = async (woId, userId) => {
    setLoading(true);
    try {
      // Get work order details
      const { data: wo, error: woError } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!lead_tech_id(first_name, last_name)
        `)
        .eq('wo_id', woId)
        .single();

      if (woError) {
        console.error('Error fetching work order:', woError);
        alert('Work order not found');
        window.location.href = '/mobile/dashboard';
        return;
      }

      // Check if user has access (lead tech or team member)
      const { data: assignment } = await supabase
        .from('work_order_assignments')
        .select('*')
        .eq('wo_id', woId)
        .eq('user_id', userId)
        .single();

      // Verify user has access and work order is assigned to field
      if (!wo.assigned_to_field) {
        alert('This work order is not assigned to field workers yet');
        window.location.href = '/mobile/dashboard';
        return;
      }

      if (wo.lead_tech_id !== userId && !assignment) {
        alert('You do not have access to this work order');
        window.location.href = '/mobile/dashboard';
        return;
      }

      setWorkOrder({ ...wo, userAssignment: assignment });
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to load work order');
      window.location.href = '/mobile/dashboard';
    } finally {
      setLoading(false);
    }
  };

  const updateWorkOrder = async (updates) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update(updates)
        .eq('wo_id', woId);

      if (error) {
        alert('Failed to update: ' + error.message);
        console.error(error);
      } else {
        setWorkOrder({ ...workOrder, ...updates });
      }
    } catch (err) {
      console.error('Update error:', err);
      alert('Failed to update work order');
    } finally {
      setSaving(false);
    }
  };

  const updateAssignment = async (updates) => {
    if (!workOrder.userAssignment) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_order_assignments')
        .update(updates)
        .eq('assignment_id', workOrder.userAssignment.assignment_id);

      if (error) {
        alert('Failed to update: ' + error.message);
      } else {
        setWorkOrder({
          ...workOrder,
          userAssignment: { ...workOrder.userAssignment, ...updates }
        });
      }
    } catch (err) {
      console.error('Update error:', err);
      alert('Failed to update hours');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-gray-600',
      assigned: 'bg-blue-600',
      in_progress: 'bg-yellow-600',
      needs_return: 'bg-purple-600',
      completed: 'bg-green-600'
    };
    return colors[status] || 'bg-gray-600';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-gray-600">Loading work order...</p>
        </div>
      </div>
    );
  }

  if (!workOrder) {
    return null;
  }

  const isLeadTech = workOrder.lead_tech_id === user.user_id;

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 shadow-lg sticky top-0 z-10">
        <button
          onClick={() => window.location.href = '/mobile/dashboard'}
          className="text-blue-100 hover:text-white mb-2"
        >
          ← Back to Dashboard
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">WO #{workOrder.wo_number}</h1>
            <p className="text-blue-100 text-sm">{workOrder.building}</p>
          </div>
          <div className="text-right">
            {isLeadTech && (
              <span className="bg-blue-700 px-2 py-1 rounded text-xs font-bold">
                LEAD
              </span>
            )}
            {!isLeadTech && (
              <span className="bg-blue-700 px-2 py-1 rounded text-xs font-bold">
                HELPER
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <h2 className="text-lg font-bold mb-3">Status</h2>
          <select
            value={workOrder.status}
            onChange={(e) => updateWorkOrder({ status: e.target.value })}
            disabled={!isLeadTech || saving}
            className={`w-full px-4 py-3 rounded-xl text-white font-bold text-lg ${getStatusColor(workOrder.status)} ${
              !isLeadTech ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <option value="pending">Pending</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="needs_return">Needs Return</option>
            <option value="completed">Completed</option>
          </select>
          {!isLeadTech && (
            <p className="text-xs text-gray-500 mt-2">
              Only lead tech can change status
            </p>
          )}
        </div>

        {/* Work Order Details */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <h2 className="text-lg font-bold mb-3">Work Details</h2>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-600 font-semibold">Description:</span>
              <p className="text-gray-900 mt-1">{workOrder.work_order_description}</p>
            </div>
            {workOrder.requestor && (
              <div>
                <span className="text-gray-600 font-semibold">Requestor:</span>
                <p className="text-gray-900">{workOrder.requestor}</p>
              </div>
            )}
            <div>
              <span className="text-gray-600 font-semibold">Lead Tech:</span>
              <p className="text-gray-900">
                {workOrder.lead_tech?.first_name} {workOrder.lead_tech?.last_name}
              </p>
            </div>
            <div>
              <span className="text-gray-600 font-semibold">Priority:</span>
              <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${
                workOrder.priority === 'emergency' ? 'bg-red-100 text-red-700' :
                workOrder.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                workOrder.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-green-100 text-green-700'
              }`}>
                {workOrder.priority.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-gray-600 font-semibold">Date Entered:</span>
              <p className="text-gray-900">{new Date(workOrder.date_entered).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Time & Mileage Tracking */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <h2 className="text-lg font-bold mb-3">⏱️ My Time & Mileage</h2>
          
          <div className="space-y-4">
            {/* Regular Hours */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Regular Time (RT)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  value={isLeadTech ? (workOrder.hours_regular || 0) : (workOrder.userAssignment?.hours_regular || 0)}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    if (isLeadTech) {
                      updateWorkOrder({ hours_regular: value });
                    } else {
                      updateAssignment({ hours_regular: value });
                    }
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500"
                />
                <span className="text-gray-600 font-semibold">hrs</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Up to 8 hours @ $64/hr</p>
            </div>

            {/* Overtime Hours */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Overtime (OT)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  value={isLeadTech ? (workOrder.hours_overtime || 0) : (workOrder.userAssignment?.hours_overtime || 0)}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    if (isLeadTech) {
                      updateWorkOrder({ hours_overtime: value });
                    } else {
                      updateAssignment({ hours_overtime: value });
                    }
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500"
                />
                <span className="text-gray-600 font-semibold">hrs</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Over 8 hours @ $96/hr</p>
            </div>

            {/* Mileage */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mileage
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={isLeadTech ? (workOrder.miles || 0) : (workOrder.userAssignment?.miles || 0)}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    if (isLeadTech) {
                      updateWorkOrder({ miles: value });
                    } else {
                      updateAssignment({ miles: value });
                    }
                  }}
                  disabled={saving}
                  className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500"
                />
                <span className="text-gray-600 font-semibold">mi</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">@ $1.00/mile</p>
            </div>

            {/* Labor Cost Summary */}
            <div className="bg-blue-50 rounded-lg p-3 mt-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">My Labor Cost:</div>
              <div className="text-2xl font-bold text-blue-600">
                ${(
                  ((isLeadTech ? (workOrder.hours_regular || 0) : (workOrder.userAssignment?.hours_regular || 0)) * 64) +
                  ((isLeadTech ? (workOrder.hours_overtime || 0) : (workOrder.userAssignment?.hours_overtime || 0)) * 96)
                ).toFixed(2)}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Mileage: ${((isLeadTech ? (workOrder.miles || 0) : (workOrder.userAssignment?.miles || 0)) * 1.00).toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Materials & Costs (Lead Tech Only) */}
        {isLeadTech && (
          <div className="bg-white rounded-xl shadow-md p-4">
            <h2 className="text-lg font-bold mb-3">💰 Materials & Costs</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Material Cost
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-semibold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.material_cost || 0}
                    onChange={(e) => updateWorkOrder({ material_cost: parseFloat(e.target.value) || 0 })}
                    disabled={saving}
                    className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Equipment Cost
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-semibold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.emf_equipment_cost || 0}
                    onChange={(e) => updateWorkOrder({ emf_equipment_cost: parseFloat(e.target.value) || 0 })}
                    disabled={saving}
                    className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Trailer Cost
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-semibold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.trailer_cost || 0}
                    onChange={(e) => updateWorkOrder({ trailer_cost: parseFloat(e.target.value) || 0 })}
                    disabled={saving}
                    className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Rental Cost
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-semibold">$</span>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.rental_cost || 0}
                    onChange={(e) => updateWorkOrder({ rental_cost: parseFloat(e.target.value) || 0 })}
                    disabled={saving}
                    className="flex-1 px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Comments */}
        <div className="bg-white rounded-xl shadow-md p-4">
          <h2 className="text-lg font-bold mb-3">💬 Comments</h2>
          <textarea
            value={workOrder.comments || ''}
            onChange={(e) => setWorkOrder({ ...workOrder, comments: e.target.value })}
            onBlur={(e) => updateWorkOrder({ comments: e.target.value })}
            disabled={saving}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500"
            rows="4"
            placeholder="Add notes about this work order..."
          />
        </div>

        {/* Budget Info (Lead Tech Only) */}
        {isLeadTech && workOrder.nte > 0 && (
          <div className="bg-white rounded-xl shadow-md p-4">
            <h2 className="text-lg font-bold mb-3">📊 Budget</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">NTE Budget:</span>
                <span className="font-bold">${workOrder.nte.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Current Total:</span>
                <span className="font-bold">
                  ${(
                    ((workOrder.hours_regular || 0) * 64) +
                    ((workOrder.hours_overtime || 0) * 96) +
                    ((workOrder.miles || 0) * 1.00) +
                    (workOrder.material_cost || 0) +
                    (workOrder.emf_equipment_cost || 0) +
                    (workOrder.trailer_cost || 0) +
                    (workOrder.rental_cost || 0)
                  ).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-600">Remaining:</span>
                <span className={`font-bold ${
                  ((workOrder.hours_regular || 0) * 64) +
                  ((workOrder.hours_overtime || 0) * 96) +
                  ((workOrder.miles || 0) * 1.00) +
                  (workOrder.material_cost || 0) +
                  (workOrder.emf_equipment_cost || 0) +
                  (workOrder.trailer_cost || 0) +
                  (workOrder.rental_cost || 0) > workOrder.nte
                    ? 'text-red-600'
                    : 'text-green-600'
                }`}>
                  ${(workOrder.nte - (
                    ((workOrder.hours_regular || 0) * 64) +
                    ((workOrder.hours_overtime || 0) * 96) +
                    ((workOrder.miles || 0) * 1.00) +
                    (workOrder.material_cost || 0) +
                    (workOrder.emf_equipment_cost || 0) +
                    (workOrder.trailer_cost || 0) +
                    (workOrder.rental_cost || 0)
                  )).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Saving Indicator */}
        {saving && (
          <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg z-20">
            ⏳ Saving...
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-10">
        <button
          onClick={() => window.location.href = '/mobile/dashboard'}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold text-lg active:bg-blue-800 transition"
        >
          ✓ Done
        </button>
      </div>
    </div>
  );
}