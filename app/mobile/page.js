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
        .or(`lead_tech_id.eq.${selectedTech},wo_id.in.(select wo_id from work_order_assignments where user_id='${selectedTech}')`)
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
  
  console.log('👥 DEBUG: Fetching team members for WO:', selectedWO.wo_id); // DEBUG
  
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

    console.log('✅ DEBUG: Team members found:', data); // DEBUG
    console.log('❌ DEBUG: Team member errors?', error); // DEBUG

    if (error) throw error;
    setTeamMembers(data || []);
  } catch (error) {
    console.error('Error fetching team members:', error);
    alert('Team member error: ' + error.message);
  }
}

  async function fetchWorkOrders() {
  console.log('🔍 DEBUG: Selected Tech ID:', selectedTech); // DEBUG
  
  try {
    // First, let's see ALL work orders
    const { data: allWOs, error: allError } = await supabase
      .from('work_orders')
      .select('wo_number, building, status, lead_tech_id')
      .limit(5);
    
    console.log('📋 DEBUG: Sample of ALL work orders:', allWOs); // DEBUG
    
    // Now get work orders for this tech
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('lead_tech_id', selectedTech)
      .in('status', ['assigned', 'in_progress', 'needs_return']);

    console.log('✅ DEBUG: Work orders for this tech:', data); // DEBUG
    console.log('❌ DEBUG: Any errors?', error); // DEBUG

    if (error) throw error;
    setWorkOrders(data || []);
  } catch (error) {
    console.error('Error fetching work orders:', error);
    alert('Error: ' + error.message);
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

        {/* Team Members - ALWAYS VISIBLE */}
<div className="bg-gray-800 rounded-lg p-4">
  <h2 className="font-bold mb-3 text-lg">👥 Team Members</h2>
  
  {/* Show loading state */}
  {!teamMembers && (
    <p className="text-gray-400 text-center py-4">Loading team...</p>
  )}
  
  {/* Show if empty */}
  {teamMembers && teamMembers.length === 0 && (
    <div className="text-center py-4">
      <p className="text-gray-400">No team members on this job</p>
      <p className="text-xs text-gray-500 mt-2">Add them from the web dashboard</p>
    </div>
  )}
  
  {/* Show team members */}
  {teamMembers && teamMembers.length > 0 && (
    <div className="space-y-2">
      {teamMembers.map(member => (
        <div key={member.assignment_id} className="bg-gray-700 rounded p-3">
          <p className="font-medium">{member.users?.first_name} {member.users?.last_name}</p>
          <p className="text-xs text-gray-400">
            {member.hours_regular || 0} RT + {member.hours_overtime || 0} OT • {member.miles || 0} mi
          </p>
        </div>
      ))}
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
          <h2 className="font-bold mb-3 text-lg">📊 Summary</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-green-200">Total Team Labor:</span>
              <span className="font-bold">${totals.totalLabor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-200">Total Hours:</span>
              <span className="font-bold">{totals.totalHours.toFixed(1)} hrs</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-200">Total Miles:</span>
              <span className="font-bold">{totals.totalMiles.toFixed(1)} mi</span>
            </div>
            <div className="flex justify-between border-t border-green-700 pt-2 mt-2">
              <span className="text-green-200">NTE:</span>
              <span className="font-bold">${(selectedWO.nte || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-200">Remaining:</span>
              <span className={`font-bold ${
                (selectedWO.nte || 0) - totals.totalLabor >= 0 ? 'text-green-300' : 'text-red-300'
              }`}>
                ${((selectedWO.nte || 0) - totals.totalLabor).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}