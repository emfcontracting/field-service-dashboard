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
  const [newComment, setNewComment] = useState('');
  const [showAddTeamMember, setShowAddTeamMember] = useState(false);
  const [newTeamMember, setNewTeamMember] = useState({ user_id: '', role: 'helper' });
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);

  useEffect(() => {
  if (id) {
    fetchWorkOrder();
    fetchTeamMembers();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [id]);

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
            email,
            role,
            hourly_rate_regular,
            hourly_rate_overtime
          )
        `)
        .eq('wo_id', params.id);

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  }

  async function addTeamMember() {
    if (!newTeamMember.user_id) {
      alert('Please select a team member');
      return;
    }

    // Check if already assigned
    const existing = teamMembers.find(tm => tm.user_id === newTeamMember.user_id);
    if (existing) {
      alert('This person is already on the team');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_order_assignments')
        .insert({
          wo_id: params.id,
          user_id: newTeamMember.user_id,
          role: newTeamMember.role,
          hours_regular: 0,
          hours_overtime: 0,
          miles: 0
        });

      if (error) throw error;

      await fetchTeamMembers();
      setShowAddTeamMember(false);
      setNewTeamMember({ user_id: '', role: 'helper' });
      alert('Team member added successfully!');
    } catch (error) {
      console.error('Error adding team member:', error);
      alert('Error adding team member');
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
    // Silent save - no alert needed
  } catch (error) {
    console.error('Error updating team member:', error);
    alert('Error updating team member');
  } finally {
    setSaving(false);
  }
}

  async function removeTeamMember(assignmentId) {
    if (!confirm('Remove this team member from the work order?')) {
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_order_assignments')
        .delete()
        .eq('assignment_id', assignmentId);

      if (error) throw error;

      await fetchTeamMembers();
      alert('Team member removed');
    } catch (error) {
      console.error('Error removing team member:', error);
      alert('Error removing team member');
    } finally {
      setSaving(false);
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
      await fetchWorkOrder();
    } catch (error) {
      console.error('Error updating work order:', error);
      alert('Error updating work order');
    } finally {
      setSaving(false);
    }
  }

  async function saveFieldData() {
    await updateWorkOrder({
      hours_regular: workOrder.hours_regular,
      hours_overtime: workOrder.hours_overtime,
      miles: workOrder.miles,
      material_cost: workOrder.material_cost,
      emf_equipment_cost: workOrder.emf_equipment_cost,
      trailer_cost: workOrder.trailer_cost
    });
    alert('Field data saved successfully!');
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;

    const updatedComments = workOrder.comments 
      ? `${workOrder.comments}\n\n[${new Date().toLocaleString()}]\n${newComment}`
      : `[${new Date().toLocaleString()}]\n${newComment}`;

    await updateWorkOrder({ comments: updatedComments });
    setNewComment('');
    alert('Comment added successfully!');
  }

async function handleCheckIn() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const timestamp = new Date().toLocaleString();
        const gpsInfo = `${position.coords.latitude}, ${position.coords.longitude}`;
        
        setIsCheckedIn(true);
        setCheckInTime(timestamp);
        
        const checkInComment = `[${timestamp}] CHECK IN\nGPS: ${gpsInfo}`;
        const updatedComments = workOrder.comments 
          ? `${workOrder.comments}\n\n${checkInComment}`
          : checkInComment;

        try {
          const { error } = await supabase
            .from('work_orders')
            .update({ comments: updatedComments })
            .eq('wo_id', params.id);

          if (error) throw error;
          setWorkOrder({ ...workOrder, comments: updatedComments });
          alert(`✅ Checked in at ${timestamp}`);
        } catch (error) {
          console.error('Error checking in:', error);
          alert('❌ Error checking in');
        }
      },
      (error) => {
        const timestamp = new Date().toLocaleString();
        setIsCheckedIn(true);
        setCheckInTime(timestamp);
        alert('⚠️ Could not get GPS location, but checked in anyway');
      }
    );
  } else {
    const timestamp = new Date().toLocaleString();
    setIsCheckedIn(true);
    setCheckInTime(timestamp);
    alert('⚠️ GPS not available on this device');
  }
}

async function handleCheckOut() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const timestamp = new Date().toLocaleString();
        const gpsInfo = `${position.coords.latitude}, ${position.coords.longitude}`;
        
        const checkOutComment = `[${timestamp}] CHECK OUT\nGPS: ${gpsInfo}\nDuration: ${checkInTime ? `from ${checkInTime}` : 'N/A'}`;
        const updatedComments = workOrder.comments 
          ? `${workOrder.comments}\n\n${checkOutComment}`
          : checkOutComment;

        try {
          const { error } = await supabase
            .from('work_orders')
            .update({ comments: updatedComments })
            .eq('wo_id', params.id);

          if (error) throw error;
          
          setWorkOrder({ ...workOrder, comments: updatedComments });
          setIsCheckedIn(false);
          setCheckInTime(null);
          alert(`✅ Checked out at ${timestamp}`);
        } catch (error) {
          console.error('Error checking out:', error);
          alert('❌ Error checking out');
        }
      },
      (error) => {
        setIsCheckedIn(false);
        setCheckInTime(null);
        alert('⚠️ Could not get GPS location, but checked out anyway');
      }
    );
  } else {
    setIsCheckedIn(false);
    setCheckInTime(null);
    alert('⚠️ GPS not available on this device');
  }
}

  function calculateTeamTotals() {
    const leadTechRate = users.find(u => u.user_id === workOrder.lead_tech_id);
    const leadLabor = 
      ((workOrder.hours_regular || 0) * (leadTechRate?.hourly_rate_regular || 64)) +
      ((workOrder.hours_overtime || 0) * (leadTechRate?.hourly_rate_overtime || 96));

    const teamLabor = teamMembers.reduce((sum, member) => {
      const rate = member.users;
      return sum + 
        ((member.hours_regular || 0) * (rate?.hourly_rate_regular || 64)) +
        ((member.hours_overtime || 0) * (rate?.hourly_rate_overtime || 96));
    }, 0);

    const totalHoursRegular = (workOrder.hours_regular || 0) + 
      teamMembers.reduce((sum, m) => sum + (m.hours_regular || 0), 0);
    
    const totalHoursOvertime = (workOrder.hours_overtime || 0) + 
      teamMembers.reduce((sum, m) => sum + (m.hours_overtime || 0), 0);

    const totalMiles = (workOrder.miles || 0) + 
      teamMembers.reduce((sum, m) => sum + (m.miles || 0), 0);

    return {
      totalLabor: leadLabor + teamLabor,
      totalHoursRegular,
      totalHoursOvertime,
      totalMiles,
      leadLabor,
      teamLabor
    };
  }

  function getPriorityColor(priority) {
    switch (priority) {
      case 'emergency': return 'bg-red-100 text-red-800 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
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

  const totals = calculateTeamTotals();

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
              <h2 className="text-xl font-bold text-gray-900 mb-4">Primary Assignment</h2>
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

            {/* Team Members Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Team Members</h2>
                <button
                  onClick={() => setShowAddTeamMember(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
                >
                  + Add Helper/Tech
                </button>
              </div>

              {teamMembers.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No additional team members assigned</p>
              ) : (
                <div className="space-y-4">
                  {teamMembers.map((member) => (
                    <div key={member.assignment_id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {member.users?.first_name} {member.users?.last_name}
                          </h3>
                          <p className="text-sm text-gray-600 capitalize">{member.role?.replace('_', ' ')}</p>
                        </div>
                        <button
                          onClick={() => removeTeamMember(member.assignment_id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">RT Hours</label>
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
                            className="w-full px-2 py-1 text-sm border rounded"
                            placeholder="0.0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">OT Hours</label>
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
                            className="w-full px-2 py-1 text-sm border rounded"
                            placeholder="0.0"
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
                            className="w-full px-2 py-1 text-sm border rounded"
                            placeholder="0.0"
                          />
                        </div>
                      </div>

                      <div className="text-xs text-gray-600">
                        Labor: ${(
                          ((member.hours_regular || 0) * (member.users?.hourly_rate_regular || 64)) +
                          ((member.hours_overtime || 0) * (member.users?.hourly_rate_overtime || 96))
                        ).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Team Member Modal */}
            {showAddTeamMember && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                  <h3 className="text-xl font-bold mb-4">Add Team Member</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Person</label>
                      <select
                        value={newTeamMember.user_id}
                        onChange={(e) => setNewTeamMember({...newTeamMember, user_id: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg"
                      >
                        <option value="">Choose...</option>
                        {users.map(user => (
                          <option key={user.user_id} value={user.user_id}>
                            {user.first_name} {user.last_name} ({user.role?.replace('_', ' ')})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Role on this Job</label>
                      <select
                        value={newTeamMember.role}
                        onChange={(e) => setNewTeamMember({...newTeamMember, role: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg"
                      >
                        <option value="helper">Helper</option>
                        <option value="lead_tech">Lead Tech (Co-Lead)</option>
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowAddTeamMember(false);
                          setNewTeamMember({ user_id: '', role: 'helper' });
                        }}
                        className="flex-1 bg-gray-200 px-4 py-2 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addTeamMember}
                        disabled={saving}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        {saving ? 'Adding...' : 'Add'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

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

            {/* Primary Tech Field Data */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">Primary Tech Field Data</h2>
                <button
                  onClick={saveFieldData}
                  disabled={saving}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                >
                  {saving ? 'Saving...' : '💾 Save Changes'}
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Regular Hours (RT)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={workOrder.hours_regular || ''}
                      onChange={(e) => setWorkOrder({...workOrder, hours_regular: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0.0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Up to 8 hrs @ $64/hr</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Overtime Hours (OT)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={workOrder.hours_overtime || ''}
                      onChange={(e) => setWorkOrder({...workOrder, hours_overtime: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0.0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Over 8 hrs @ $96/hr</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Miles</label>
                    <input
                      type="number"
                      step="0.1"
                      value={workOrder.miles || ''}
                      onChange={(e) => setWorkOrder({...workOrder, miles: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0.0"
                    />
                    <p className="text-xs text-gray-500 mt-1">@ $1.00 per mile</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Material Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workOrder.material_cost || ''}
                      onChange={(e) => setWorkOrder({...workOrder, material_cost: parseFloat(e.target.value) || 0})}
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
                      onChange={(e) => setWorkOrder({...workOrder, emf_equipment_cost: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trailer Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={workOrder.trailer_cost || ''}
                      onChange={(e) => setWorkOrder({...workOrder, trailer_cost: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="0.00"
                    />
                  </div>
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
                <button className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700">
                  Print WO
                </button>
              </div>
            </div>

            {/* Check In/Out */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">📍 Check In/Out</h2>
              {!isCheckedIn ? (
                <button
                  onClick={handleCheckIn}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-green-700 transition"
                >
                  ✅ CHECK IN
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-gray-600">Checked in at:</p>
                    <p className="font-bold text-gray-900">{checkInTime}</p>
                  </div>
                  <button
                    onClick={handleCheckOut}
                    className="w-full bg-red-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-red-700 transition"
                  >
                    🛑 CHECK OUT
                  </button>
                </div>
              )}
            </div>



            {/* Cost Summary - INCLUDING TEAM TOTALS */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Cost Summary</h2>
              <div className="space-y-3">
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm font-semibold text-blue-900 mb-2">TEAM LABOR</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total RT ({totals.totalHoursRegular} hrs):</span>
                    <span className="font-medium">${(totals.totalHoursRegular * 64).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total OT ({totals.totalHoursOvertime} hrs):</span>
                    <span className="font-medium">${(totals.totalHoursOvertime * 96).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t border-blue-200 pt-2 mt-2">
                    <span className="text-blue-900">Total Labor:</span>
                    <span className="text-blue-900">${totals.totalLabor.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Mileage ({totals.totalMiles} mi × $1.00):</span>
                  <span className="font-medium">${(totals.totalMiles * 1.00).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Materials:</span>
                  <span className="font-medium">${(workOrder.material_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Equipment:</span>
                  <span className="font-medium">${(workOrder.emf_equipment_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Trailer:</span>
                  <span className="font-medium">${(workOrder.trailer_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Rental:</span>
                  <span className="font-medium">${(workOrder.rental_cost || 0).toFixed(2)}</span>
                </div>
                <div className="border-t-2 border-gray-300 pt-3 flex justify-between font-bold text-lg">
                  <span>Grand Total:</span>
                  <span className="text-green-600">
                    ${(
                      totals.totalLabor +
                      (totals.totalMiles * 1.00) +
                      (workOrder.material_cost || 0) + 
                      (workOrder.emf_equipment_cost || 0) + 
                      (workOrder.trailer_cost || 0) + 
                      (workOrder.rental_cost || 0)
                    ).toFixed(2)}
                  </span>
                </div>
                <div className="border-t pt-3 flex justify-between text-sm">
                  <span className="text-gray-600">NTE Budget:</span>
                  <span className="font-medium">${(workOrder.nte || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Remaining:</span>
                  <span className={`font-bold text-base ${
                    (workOrder.nte || 0) - (
                      totals.totalLabor +
                      (totals.totalMiles * 1.00) +
                      (workOrder.material_cost || 0) + 
                      (workOrder.emf_equipment_cost || 0) + 
                      (workOrder.trailer_cost || 0) + 
                      (workOrder.rental_cost || 0)
                    ) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${(
                      (workOrder.nte || 0) - (
                        totals.totalLabor +
                        (totals.totalMiles * 1.00) +
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
                <div className="bg-blue-50 p-2 rounded">
                  <span className="text-gray-600 font-semibold">TEAM TOTALS</span>
                  <p className="font-medium text-lg text-blue-900 mt-1">
                    {totals.totalHoursRegular} RT + {totals.totalHoursOvertime} OT
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    = {(totals.totalHoursRegular + totals.totalHoursOvertime).toFixed(1)} total hours
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Total Miles Traveled:</span>
                  <p className="font-medium text-lg">{totals.totalMiles} mi</p>
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