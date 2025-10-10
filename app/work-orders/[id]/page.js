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
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Extract id from params
  const workOrderId = params?.id;

  useEffect(() => {
    if (workOrderId) {
      fetchUsers();
      fetchWorkOrder();
      fetchTeamMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

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

  async function fetchWorkOrder() {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:lead_tech_id (
            user_id,
            first_name,
            last_name
          )
        `)
        .eq('wo_id', workOrderId)
        .single();

      if (error) throw error;
      setWorkOrder(data);
    } catch (error) {
      console.error('Error fetching work order:', error);
      alert('Error loading work order');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTeamMembers() {
    try {
      const { data, error } = await supabase
        .from('work_order_assignments')
        .select(`
          *,
          users:user_id (
            user_id,
            first_name,
            last_name,
            hourly_rate_regular,
            hourly_rate_overtime
          )
        `)
        .eq('wo_id', workOrderId);

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  }

  async function updateWorkOrder(updates) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update(updates)
        .eq('wo_id', workOrderId);

      if (error) throw error;

      setWorkOrder({ ...workOrder, ...updates });
      alert('✅ Work order updated!');
    } catch (error) {
      console.error('Error updating work order:', error);
      alert('❌ Error updating work order');
    } finally {
      setSaving(false);
    }
  }

  async function addTeamMember(userId, role) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_order_assignments')
        .insert({
          wo_id: workOrderId,
          user_id: userId,
          role: role,
          hours_regular: 0,
          hours_overtime: 0,
          miles: 0
        });

      if (error) throw error;

      await fetchTeamMembers();
      alert('✅ Team member added!');
    } catch (error) {
      console.error('Error adding team member:', error);
      alert('❌ Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateTeamMember(assignmentId, updates) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_order_assignments')
        .update(updates)
        .eq('assignment_id', assignmentId);

      if (error) throw error;

      await fetchTeamMembers();
    } catch (error) {
      console.error('Error updating team member:', error);
      alert('❌ Error updating');
    } finally {
      setSaving(false);
    }
  }

  async function removeTeamMember(assignmentId) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_order_assignments')
        .delete()
        .eq('assignment_id', assignmentId);

      if (error) throw error;

      await fetchTeamMembers();
      alert('✅ Team member removed');
    } catch (error) {
      console.error('Error removing team member:', error);
      alert('❌ Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  function calculateTotals() {
    if (!workOrder) return { totalLabor: 0, totalHours: 0, totalMiles: 0, totalCosts: 0 };

    const leadTech = users.find(u => u.user_id === workOrder.lead_tech_id);
    const leadLabor = 
      ((workOrder.hours_regular || 0) * (leadTech?.hourly_rate_regular || 64)) +
      ((workOrder.hours_overtime || 0) * (leadTech?.hourly_rate_overtime || 96));

    const teamLabor = teamMembers.reduce((sum, member) => {
      return sum + 
        ((member.hours_regular || 0) * (member.users?.hourly_rate_regular || 64)) +
        ((member.hours_overtime || 0) * (member.users?.hourly_rate_overtime || 96));
    }, 0);

    const totalHours = 
      (workOrder.hours_regular || 0) + 
      (workOrder.hours_overtime || 0) +
      teamMembers.reduce((sum, m) => sum + (m.hours_regular || 0) + (m.hours_overtime || 0), 0);

    const totalMiles = 
      (workOrder.miles || 0) + 
      teamMembers.reduce((sum, m) => sum + (m.miles || 0), 0);

    const totalCosts = 
      (workOrder.material_cost || 0) +
      (workOrder.emf_equipment_cost || 0) +
      (workOrder.trailer_cost || 0) +
      (workOrder.rental_cost || 0);

    return {
      totalLabor: leadLabor + teamLabor,
      totalHours: totalHours,
      totalMiles: totalMiles,
      totalCosts: totalCosts
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
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
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const totals = calculateTotals();
  const grandTotal = totals.totalLabor + (totals.totalMiles * 1.00) + totals.totalCosts;
  const remaining = (workOrder.nte || 0) - grandTotal;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <button
                onClick={() => router.push('/')}
                className="text-blue-600 hover:text-blue-800 mb-2"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Work Order #{workOrder.wo_number}</h1>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Status</p>
              <p className="text-lg font-semibold text-gray-900 capitalize">
                {workOrder.status?.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Work Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Work Order Details</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={workOrder.status}
                    onChange={(e) => updateWorkOrder({ status: e.target.value })}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="needs_return">Needs Return</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={workOrder.priority}
                    onChange={(e) => updateWorkOrder({ priority: e.target.value })}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Building</label>
                  <input
                    type="text"
                    value={workOrder.building || ''}
                    onChange={(e) => setWorkOrder({...workOrder, building: e.target.value})}
                    onBlur={() => updateWorkOrder({ building: workOrder.building })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={workOrder.work_order_description || ''}
                    onChange={(e) => setWorkOrder({...workOrder, work_order_description: e.target.value})}
                    onBlur={() => updateWorkOrder({ work_order_description: workOrder.work_order_description })}
                    rows="4"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Requestor</label>
                  <input
                    type="text"
                    value={workOrder.requestor || ''}
                    onChange={(e) => setWorkOrder({...workOrder, requestor: e.target.value})}
                    onBlur={() => updateWorkOrder({ requestor: workOrder.requestor })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lead Technician</label>
                  <select
                    value={workOrder.lead_tech_id || ''}
                    onChange={(e) => updateWorkOrder({ lead_tech_id: e.target.value || null })}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Unassigned</option>
                    {users
                      .filter(u => u.role === 'lead_tech')
                      .map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.first_name} {user.last_name}
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">NTE Budget</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.nte || ''}
                    onChange={(e) => setWorkOrder({...workOrder, nte: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ nte: workOrder.nte })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Lead Tech Hours & Costs */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Lead Tech Hours & Costs</h2>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Regular Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={workOrder.hours_regular || ''}
                    onChange={(e) => setWorkOrder({...workOrder, hours_regular: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ hours_regular: workOrder.hours_regular })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Overtime Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={workOrder.hours_overtime || ''}
                    onChange={(e) => setWorkOrder({...workOrder, hours_overtime: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ hours_overtime: workOrder.hours_overtime })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Miles</label>
                  <input
                    type="number"
                    step="0.1"
                    value={workOrder.miles || ''}
                    onChange={(e) => setWorkOrder({...workOrder, miles: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ miles: workOrder.miles })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Material Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.material_cost || ''}
                    onChange={(e) => setWorkOrder({...workOrder, material_cost: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ material_cost: workOrder.material_cost })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Equipment Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.emf_equipment_cost || ''}
                    onChange={(e) => setWorkOrder({...workOrder, emf_equipment_cost: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ emf_equipment_cost: workOrder.emf_equipment_cost })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Trailer Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.trailer_cost || ''}
                    onChange={(e) => setWorkOrder({...workOrder, trailer_cost: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ trailer_cost: workOrder.trailer_cost })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rental Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.rental_cost || ''}
                    onChange={(e) => setWorkOrder({...workOrder, rental_cost: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ rental_cost: workOrder.rental_cost })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Team Members</h2>
                <div className="flex gap-2">
                  <select
                    id="add-user"
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                    defaultValue=""
                  >
                    <option value="">Select person...</option>
                    {users
                      .filter(u => 
                        u.user_id !== workOrder.lead_tech_id && 
                        !teamMembers.find(tm => tm.user_id === u.user_id)
                      )
                      .map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.first_name} {user.last_name}
                        </option>
                      ))
                    }
                  </select>
                  <select
                    id="add-role"
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                    defaultValue="helper"
                  >
                    <option value="helper">Helper</option>
                    <option value="lead_tech">Co-Lead</option>
                  </select>
                  <button
                    onClick={() => {
                      const userId = document.getElementById('add-user').value;
                      const role = document.getElementById('add-role').value;
                      if (userId) {
                        addTeamMember(userId, role);
                        document.getElementById('add-user').value = '';
                      }
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    + Add
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {teamMembers.map(member => (
                  <div key={member.assignment_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-900">
                          {member.users?.first_name} {member.users?.last_name}
                        </p>
                        <p className="text-sm text-gray-500 capitalize">{member.role?.replace('_', ' ')}</p>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Remove ${member.users?.first_name} from this work order?`)) {
                            removeTeamMember(member.assignment_id);
                          }
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Regular Hours</label>
                        <input
                          type="number"
                          step="0.5"
                          value={member.hours_regular || ''}
                          onChange={(e) => {
                            const updated = teamMembers.map(tm => 
                              tm.assignment_id === member.assignment_id 
                                ? {...tm, hours_regular: parseFloat(e.target.value) || 0}
                                : tm
                            );
                            setTeamMembers(updated);
                          }}
                          onBlur={() => updateTeamMember(member.assignment_id, { 
                            hours_regular: member.hours_regular 
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Overtime Hours</label>
                        <input
                          type="number"
                          step="0.5"
                          value={member.hours_overtime || ''}
                          onChange={(e) => {
                            const updated = teamMembers.map(tm => 
                              tm.assignment_id === member.assignment_id 
                                ? {...tm, hours_overtime: parseFloat(e.target.value) || 0}
                                : tm
                            );
                            setTeamMembers(updated);
                          }}
                          onBlur={() => updateTeamMember(member.assignment_id, { 
                            hours_overtime: member.hours_overtime 
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Miles</label>
                        <input
                          type="number"
                          step="0.1"
                          value={member.miles || ''}
                          onChange={(e) => {
                            const updated = teamMembers.map(tm => 
                              tm.assignment_id === member.assignment_id 
                                ? {...tm, miles: parseFloat(e.target.value) || 0}
                                : tm
                            );
                            setTeamMembers(updated);
                          }}
                          onBlur={() => updateTeamMember(member.assignment_id, { 
                            miles: member.miles 
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {teamMembers.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No team members assigned yet</p>
                )}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Comments & Notes</h2>
              <textarea
                value={workOrder.comments || ''}
                onChange={(e) => setWorkOrder({...workOrder, comments: e.target.value})}
                onBlur={() => updateWorkOrder({ comments: workOrder.comments })}
                rows="6"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Add notes, updates, or comments..."
              />
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Cost Summary</h2>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between pb-2 border-b border-blue-200">
                  <span className="text-gray-700">Labor ({totals.totalHours.toFixed(1)} hrs):</span>
                  <span className="font-bold text-gray-900">${totals.totalLabor.toFixed(2)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-blue-200">
                  <span className="text-gray-700">Mileage ({totals.totalMiles.toFixed(1)} mi):</span>
                  <span className="font-bold text-gray-900">${(totals.totalMiles * 1.00).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-blue-200">
                  <span className="text-gray-700">Materials:</span>
                  <span className="font-bold text-gray-900">${(workOrder.material_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-blue-200">
                  <span className="text-gray-700">Equipment:</span>
                  <span className="font-bold text-gray-900">${(workOrder.emf_equipment_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-blue-200">
                  <span className="text-gray-700">Trailer:</span>
                  <span className="font-bold text-gray-900">${(workOrder.trailer_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pb-3 border-b-2 border-blue-300">
                  <span className="text-gray-700">Rental:</span>
                  <span className="font-bold text-gray-900">${(workOrder.rental_cost || 0).toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-lg font-bold pt-2">
                  <span className="text-gray-900">TOTAL:</span>
                  <span className="text-blue-600">${grandTotal.toFixed(2)}</span>
                </div>

                <div className="mt-4 pt-4 border-t-2 border-blue-300">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">NTE Budget:</span>
                    <span className="font-bold text-gray-900">${(workOrder.nte || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Remaining:</span>
                    <span className={`font-bold text-lg ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${remaining.toFixed(2)}
                    </span>
                  </div>
                </div>

                {remaining < 0 && (
                  <div className="mt-4 bg-red-100 border border-red-300 rounded p-3">
                    <p className="text-red-800 text-xs font-medium">⚠️ Over budget by ${Math.abs(remaining).toFixed(2)}</p>
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