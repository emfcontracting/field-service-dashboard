'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function MobileApp() {
  const [workOrders, setWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedTech, setSelectedTech] = useState('');
  const [selectedWO, setSelectedWO] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedTech) {
      fetchWorkOrders();
    }
  }, [selectedTech]);

  useEffect(() => {
    if (selectedWO) {
      fetchTeamMembers();
    }
  }, [selectedWO]);

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .in('role', ['lead_tech', 'helper'])
        .order('first_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWorkOrders() {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('lead_tech_id', selectedTech)
        .in('status', ['assigned', 'in_progress', 'needs_return'])
        .order('priority', { ascending: false })
        .order('date_entered', { ascending: true });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    }
  }

  async function fetchTeamMembers() {
    if (!selectedWO) return;
    
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
        .eq('wo_id', selectedWO.wo_id);

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
        .eq('wo_id', selectedWO.wo_id);

      if (error) throw error;

      setSelectedWO({ ...selectedWO, ...updates });
      await fetchWorkOrders();
      alert('✅ Work order updated!');
    } catch (error) {
      console.error('Error updating work order:', error);
      alert('❌ Error updating work order');
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

  async function addTeamMemberMobile(userId) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_order_assignments')
        .insert({
          wo_id: selectedWO.wo_id,
          user_id: userId,
          role: 'helper',
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

  async function removeTeamMemberMobile(assignmentId) {
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

  function getPriorityColor(priority) {
    switch (priority) {
      case 'emergency': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  }

  function getPriorityEmoji(priority) {
    switch (priority) {
      case 'emergency': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '📋';
      case 'low': return '✅';
      default: return '📋';
    }
  }

  function calculateTotals() {
    if (!selectedWO) return { totalLabor: 0, totalHours: 0, totalMiles: 0 };

    const leadTech = users.find(u => u.user_id === selectedWO.lead_tech_id);
    const leadLabor = 
      ((selectedWO.hours_regular || 0) * (leadTech?.hourly_rate_regular || 64)) +
      ((selectedWO.hours_overtime || 0) * (leadTech?.hourly_rate_overtime || 96));

    const teamLabor = teamMembers.reduce((sum, member) => {
      return sum + 
        ((member.hours_regular || 0) * (member.users?.hourly_rate_regular || 64)) +
        ((member.hours_overtime || 0) * (member.users?.hourly_rate_overtime || 96));
    }, 0);

    const totalHours = 
      (selectedWO.hours_regular || 0) + 
      (selectedWO.hours_overtime || 0) +
      teamMembers.reduce((sum, m) => sum + (m.hours_regular || 0) + (m.hours_overtime || 0), 0);

    const totalMiles = 
      (selectedWO.miles || 0) + 
      teamMembers.reduce((sum, m) => sum + (m.miles || 0), 0);

    return {
      totalLabor: leadLabor + teamLabor,
      totalHours: totalHours,
      totalMiles: totalMiles
    };
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  // Tech Selection Screen
  if (!selectedTech) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-4">
        <div className="max-w-md mx-auto pt-12">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">🔧 Field Service</h1>
            <p className="text-blue-200">Select your name to view work orders</p>
          </div>

          <div className="space-y-3">
            {users.map(user => (
              <button
                key={user.user_id}
                onClick={() => setSelectedTech(user.user_id)}
                className="w-full bg-white rounded-lg p-4 text-left hover:bg-blue-50 transition shadow-lg"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900">{user.first_name} {user.last_name}</p>
                    <p className="text-sm text-gray-500 capitalize">{user.role?.replace('_', ' ')}</p>
                  </div>
                  <span className="text-2xl">👤</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Work Order List Screen
  if (!selectedWO) {
    const currentUser = users.find(u => u.user_id === selectedTech);

    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-blue-600 p-4 sticky top-0 z-10 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">My Work Orders</h1>
              <p className="text-sm text-blue-200">{currentUser?.first_name} {currentUser?.last_name}</p>
            </div>
            <button
              onClick={() => {
                setSelectedTech('');
                setWorkOrders([]);
              }}
              className="bg-blue-700 px-4 py-2 rounded-lg text-sm"
            >
              ← Switch User
            </button>
          </div>
        </header>

        <div className="p-4 space-y-4">
          {workOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-2xl mb-2">🎉</p>
              <p className="text-gray-400">No active work orders</p>
            </div>
          ) : (
            workOrders.map(wo => (
              <div
                key={wo.wo_id}
                onClick={() => setSelectedWO(wo)}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer shadow-lg"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-lg font-bold">WO #{wo.wo_number}</p>
                    <p className="text-sm text-gray-400">{wo.building}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`${getPriorityColor(wo.priority)} text-white px-3 py-1 rounded-full text-xs font-bold`}>
                      {getPriorityEmoji(wo.priority)} {wo.priority?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <p className="text-gray-300 text-sm mb-3 line-clamp-2">{wo.work_order_description}</p>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-gray-700 rounded p-2">
                    <p className="text-gray-400">Hours</p>
                    <p className="text-white font-bold">{((wo.hours_regular || 0) + (wo.hours_overtime || 0)).toFixed(1)}</p>
                  </div>
                  <div className="bg-gray-700 rounded p-2">
                    <p className="text-gray-400">NTE</p>
                    <p className="text-white font-bold">${wo.nte?.toLocaleString() || 'N/A'}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Work Order Detail Screen
  const currentUser = users.find(u => u.user_id === selectedTech);
  const isLeadTech = selectedWO.lead_tech_id === selectedTech;
  const myAssignment = teamMembers.find(tm => tm.user_id === selectedTech);
  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      <header className="bg-blue-600 p-4 sticky top-0 z-10 shadow-lg">
        <div className="flex justify-between items-center">
          <button
            onClick={() => {
              setSelectedWO(null);
              setTeamMembers([]);
            }}
            className="text-white text-lg"
          >
            ← Back
          </button>
          <div className="text-center">
            <p className="font-bold">WO #{selectedWO.wo_number}</p>
            <span className={`${getPriorityColor(selectedWO.priority)} text-white px-2 py-1 rounded-full text-xs`}>
              {getPriorityEmoji(selectedWO.priority)} {selectedWO.priority?.toUpperCase()}
            </span>
          </div>
          <div className="w-8"></div>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Work Order Info */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="font-bold mb-3 text-lg">📋 Job Details</h2>
          <div className="space-y-2 text-sm">
            <div>
              <p className="text-gray-400">Building</p>
              <p className="font-medium">{selectedWO.building}</p>
            </div>
            <div>
              <p className="text-gray-400">Description</p>
              <p className="font-medium">{selectedWO.work_order_description}</p>
            </div>
            <div>
              <p className="text-gray-400">Requestor</p>
              <p className="font-medium">{selectedWO.requestor || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* Status Update */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="font-bold mb-3 text-lg">📊 Status</h2>
          <select
            value={selectedWO.status}
            onChange={(e) => updateWorkOrder({ status: e.target.value })}
            disabled={saving}
            className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg text-lg font-medium"
          >
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="needs_return">Needs Return</option>
            <option value="completed">Completed ✅</option>
          </select>
        </div>

        {/* My Hours (Lead Tech or Team Member) */}
        {isLeadTech ? (
          <div className="bg-blue-900 rounded-lg p-4">
            <h2 className="font-bold mb-3 text-lg">⏱️ My Hours (Lead Tech)</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm text-blue-200 mb-1">Regular (RT)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedWO.hours_regular || ''}
                  onChange={(e) => setSelectedWO({...selectedWO, hours_regular: parseFloat(e.target.value) || 0})}
                  onBlur={() => updateWorkOrder({ hours_regular: selectedWO.hours_regular })}
                  className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg text-lg"
                  placeholder="0.0"
                />
                <p className="text-xs text-blue-300 mt-1">@ $64/hr</p>
              </div>
              <div>
                <label className="block text-sm text-blue-200 mb-1">Overtime (OT)</label>
                <input
                  type="number"
                  step="0.5"
                  value={selectedWO.hours_overtime || ''}
                  onChange={(e) => setSelectedWO({...selectedWO, hours_overtime: parseFloat(e.target.value) || 0})}
                  onBlur={() => updateWorkOrder({ hours_overtime: selectedWO.hours_overtime })}
                  className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg text-lg"
                  placeholder="0.0"
                />
                <p className="text-xs text-blue-300 mt-1">@ $96/hr</p>
              </div>
            </div>
            <div>
              <label className="block text-sm text-blue-200 mb-1">Miles</label>
              <input
                type="number"
                step="0.1"
                value={selectedWO.miles || ''}
                onChange={(e) => setSelectedWO({...selectedWO, miles: parseFloat(e.target.value) || 0})}
                onBlur={() => updateWorkOrder({ miles: selectedWO.miles })}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg text-lg"
                placeholder="0.0"
              />
              <p className="text-xs text-blue-300 mt-1">@ $1.00/mile</p>
            </div>
          </div>
        ) : myAssignment ? (
          <div className="bg-green-900 rounded-lg p-4">
            <h2 className="font-bold mb-3 text-lg">⏱️ My Hours (Team Member)</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm text-green-200 mb-1">Regular (RT)</label>
                <input
                  type="number"
                  step="0.5"
                  value={myAssignment.hours_regular || ''}
                  onChange={(e) => {
                    const updated = teamMembers.map(tm => 
                      tm.assignment_id === myAssignment.assignment_id 
                        ? {...tm, hours_regular: parseFloat(e.target.value) || 0}
                        : tm
                    );
                    setTeamMembers(updated);
                  }}
                  onBlur={() => updateTeamMember(myAssignment.assignment_id, { 
                    hours_regular: myAssignment.hours_regular 
                  })}
                  className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg text-lg"
                  placeholder="0.0"
                />
                <p className="text-xs text-green-300 mt-1">@ $64/hr</p>
              </div>
              <div>
                <label className="block text-sm text-green-200 mb-1">Overtime (OT)</label>
                <input
                  type="number"
                  step="0.5"
                  value={myAssignment.hours_overtime || ''}
                  onChange={(e) => {
                    const updated = teamMembers.map(tm => 
                      tm.assignment_id === myAssignment.assignment_id 
                        ? {...tm, hours_overtime: parseFloat(e.target.value) || 0}
                        : tm
                    );
                    setTeamMembers(updated);
                  }}
                  onBlur={() => updateTeamMember(myAssignment.assignment_id, { 
                    hours_overtime: myAssignment.hours_overtime 
                  })}
                  className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg text-lg"
                  placeholder="0.0"
                />
                <p className="text-xs text-green-300 mt-1">@ $96/hr</p>
              </div>
            </div>
            <div>
              <label className="block text-sm text-green-200 mb-1">Miles</label>
              <input
                type="number"
                step="0.1"
                value={myAssignment.miles || ''}
                onChange={(e) => {
                  const updated = teamMembers.map(tm => 
                    tm.assignment_id === myAssignment.assignment_id 
                      ? {...tm, miles: parseFloat(e.target.value) || 0}
                      : tm
                  );
                  setTeamMembers(updated);
                }}
                onBlur={() => updateTeamMember(myAssignment.assignment_id, { 
                  miles: myAssignment.miles 
                })}
                className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg text-lg"
                placeholder="0.0"
              />
              <p className="text-xs text-green-300 mt-1">@ $1.00/mile</p>
            </div>
          </div>
        ) : null}

        {/* Team Members - IMPROVED VISIBILITY & EDITING */}
<div className="bg-gray-800 rounded-lg p-4">
  <div className="flex justify-between items-center mb-3">
    <h2 className="font-bold text-lg text-white">👥 Team Members</h2>
    {isLeadTech && (
      <button
        onClick={() => {
          const availableUsers = users.filter(u => 
            u.user_id !== selectedTech && 
            !teamMembers.find(tm => tm.user_id === u.user_id)
          );
          
          if (availableUsers.length === 0) {
            alert('No more users available to add');
            return;
          }
          
          const userList = availableUsers.map((u, i) => `${i+1}. ${u.first_name} ${u.last_name}`).join('\n');
          const userName = prompt(`Enter number to add team member:\n\n${userList}`);
          
          if (!userName) return;
          
          const index = parseInt(userName) - 1;
          const selectedUser = availableUsers[index];
          
          if (!selectedUser) {
            alert('Invalid selection');
            return;
          }
          
          addTeamMemberMobile(selectedUser.user_id);
        }}
        className="bg-blue-600 text-white px-3 py-1 rounded text-sm font-medium"
      >
        + Add
      </button>
    )}
  </div>
  
  {teamMembers && teamMembers.length === 0 && (
    <div className="text-center py-4">
      <p className="text-gray-300">No team members yet</p>
      {isLeadTech && (
        <p className="text-xs text-gray-400 mt-2">Tap + Add to assign helpers</p>
      )}
    </div>
  )}
  
  {teamMembers && teamMembers.length > 0 && (
    <div className="space-y-3">
      {teamMembers.map(member => {
        const isMyself = member.user_id === selectedTech;
        return (
          <div key={member.assignment_id} className={`rounded-lg p-3 ${isMyself ? 'bg-green-700' : 'bg-blue-700'}`}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-bold text-white text-base">
                  {member.users?.first_name} {member.users?.last_name}
                  {isMyself && ' (You)'}
                </p>
                <p className="text-xs text-white opacity-75 capitalize">{member.role?.replace('_', ' ')}</p>
              </div>
              {isLeadTech && !isMyself && (
                <button
                  onClick={() => {
                    if (confirm(`Remove ${member.users?.first_name} from this job?`)) {
                      removeTeamMemberMobile(member.assignment_id);
                    }
                  }}
                  className="bg-red-600 text-white px-2 py-1 rounded text-xs"
                >
                  Remove
                </button>
              )}
            </div>

            {/* Show hours input for lead or if it's the current user */}
            {(isLeadTech || isMyself) && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-white opacity-90 mb-1">RT Hours</label>
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
                      className="w-full bg-gray-900 text-white px-2 py-2 rounded text-sm"
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white opacity-90 mb-1">OT Hours</label>
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
                      className="w-full bg-gray-900 text-white px-2 py-2 rounded text-sm"
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white opacity-90 mb-1">Miles</label>
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
                      className="w-full bg-gray-900 text-white px-2 py-2 rounded text-sm"
                      placeholder="0.0"
                    />
                  </div>
                </div>
                <p className="text-xs text-white opacity-75">
                  Labor: ${(
                    ((member.hours_regular || 0) * (member.users?.hourly_rate_regular || 64)) +
                    ((member.hours_overtime || 0) * (member.users?.hourly_rate_overtime || 96))
                  ).toFixed(2)}
                </p>
              </div>
            )}

            {/* Read-only view for others */}
            {!isLeadTech && !isMyself && (
              <p className="text-sm text-white opacity-90">
                {member.hours_regular || 0} RT + {member.hours_overtime || 0} OT • {member.miles || 0} mi
              </p>
            )}
          </div>
        );
      })}
    </div>
  )}
</div>

        {/* Costs (Lead Tech Only) */}
        {isLeadTech && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="font-bold mb-3 text-lg">💰 Costs</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Materials ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.material_cost || ''}
                  onChange={(e) => setSelectedWO({...selectedWO, material_cost: parseFloat(e.target.value) || 0})}
                  onBlur={() => updateWorkOrder({ material_cost: selectedWO.material_cost })}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Equipment ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.emf_equipment_cost || ''}
                  onChange={(e) => setSelectedWO({...selectedWO, emf_equipment_cost: parseFloat(e.target.value) || 0})}
                  onBlur={() => updateWorkOrder({ emf_equipment_cost: selectedWO.emf_equipment_cost })}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
<div className="bg-gradient-to-br from-green-900 to-green-800 rounded-lg p-4">
  <h2 className="font-bold mb-3 text-lg">📊 Cost Summary</h2>
  <div className="space-y-2 text-sm">
    {/* Labor Breakdown */}
    <div className="bg-green-800 bg-opacity-50 rounded p-2 mb-2">
      <p className="text-xs text-green-200 mb-1">LABOR</p>
      <div className="flex justify-between">
        <span className="text-green-100">Team Labor:</span>
        <span className="font-bold text-white">${totals.totalLabor.toFixed(2)}</span>
      </div>
      <p className="text-xs text-green-200 mt-1">
        {totals.totalHours.toFixed(1)} hrs total ({((selectedWO.hours_regular || 0) + teamMembers.reduce((sum, m) => sum + (m.hours_regular || 0), 0)).toFixed(1)} RT + {((selectedWO.hours_overtime || 0) + teamMembers.reduce((sum, m) => sum + (m.hours_overtime || 0), 0)).toFixed(1)} OT)
      </p>
    </div>

    {/* Other Costs */}
    <div className="flex justify-between">
      <span className="text-green-200">Mileage ({totals.totalMiles.toFixed(1)} mi × $1.00):</span>
      <span className="font-medium text-white">${(totals.totalMiles * 1.00).toFixed(2)}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-green-200">Materials:</span>
      <span className="font-medium text-white">${(selectedWO.material_cost || 0).toFixed(2)}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-green-200">Equipment:</span>
      <span className="font-medium text-white">${(selectedWO.emf_equipment_cost || 0).toFixed(2)}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-green-200">Trailer:</span>
      <span className="font-medium text-white">${(selectedWO.trailer_cost || 0).toFixed(2)}</span>
    </div>
    <div className="flex justify-between">
      <span className="text-green-200">Rental:</span>
      <span className="font-medium text-white">${(selectedWO.rental_cost || 0).toFixed(2)}</span>
    </div>

    {/* Total */}
    <div className="border-t-2 border-green-700 pt-2 mt-2">
      <div className="flex justify-between font-bold text-base">
        <span className="text-white">GRAND TOTAL:</span>
        <span className="text-white text-lg">
          ${(
            totals.totalLabor +
            (totals.totalMiles * 1.00) +
            (selectedWO.material_cost || 0) +
            (selectedWO.emf_equipment_cost || 0) +
            (selectedWO.trailer_cost || 0) +
            (selectedWO.rental_cost || 0)
          ).toFixed(2)}
        </span>
      </div>
    </div>

    {/* NTE Comparison */}
    <div className="border-t border-green-700 pt-2 mt-2">
      <div className="flex justify-between">
        <span className="text-green-200">NTE Budget:</span>
        <span className="font-medium text-white">${(selectedWO.nte || 0).toFixed(2)}</span>
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-green-200">Remaining:</span>
        <span className={`font-bold text-base ${
          (selectedWO.nte || 0) - (
            totals.totalLabor +
            (totals.totalMiles * 1.00) +
            (selectedWO.material_cost || 0) +
            (selectedWO.emf_equipment_cost || 0) +
            (selectedWO.trailer_cost || 0) +
            (selectedWO.rental_cost || 0)
          ) >= 0 ? 'text-green-300' : 'text-red-300'
        }`}>
          ${(
            (selectedWO.nte || 0) - (
              totals.totalLabor +
              (totals.totalMiles * 1.00) +
              (selectedWO.material_cost || 0) +
              (selectedWO.emf_equipment_cost || 0) +
              (selectedWO.trailer_cost || 0) +
              (selectedWO.rental_cost || 0)
            )
          ).toFixed(2)}
        </span>
      </div>
    </div>
  </div>
</div>