'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MobileApp() {
  const [currentUser, setCurrentUser] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  
  // Login states
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');

  // Team member modal states
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('helper');

  useEffect(() => {
    if (currentUser) {
      loadWorkOrders();
      loadAvailableUsers();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedWO) {
      loadTeamMembers();
    }
  }, [selectedWO]);

  // Load available users for dropdown
  const loadAvailableUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, role')
      .order('first_name');
    
    if (data) {
      setAvailableUsers(data);
    }
  };

  // PIN Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('pin', pin)
      .single();

    if (error || !data) {
      setLoginError('Invalid email or PIN');
      return;
    }

    setCurrentUser(data);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setEmail('');
    setPin('');
    setSelectedWO(null);
    setWorkOrders([]);
  };

  // Load work orders (only field-assigned ones)
  const loadWorkOrders = async () => {
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        buildings (building_name, address),
        users!work_orders_lead_tech_fkey (first_name, last_name)
      `)
      .eq('assigned_to_field', true)
      .order('created_at', { ascending: false });

    if (data) {
      setWorkOrders(data);
    }
  };

  // Load team members
  const loadTeamMembers = async () => {
    const { data, error } = await supabase
      .from('work_order_assignments')
      .select(`
        *,
        users (user_id, first_name, last_name, role, hourly_rate_regular, hourly_rate_overtime)
      `)
      .eq('wo_id', selectedWO.wo_id);

    if (data) {
      setTeamMembers(data);
    }
  };

  // Add team member with dropdown selection
  const handleAddTeamMember = async () => {
    if (!selectedUserId) {
      alert('Please select a team member');
      return;
    }

    const { data, error } = await supabase
      .from('work_order_assignments')
      .insert({
        wo_id: selectedWO.wo_id,
        user_id: selectedUserId,
        role: selectedRole,
        hours_regular: 0,
        hours_overtime: 0,
        miles: 0
      })
      .select();

    if (error) {
      alert('Error adding team member: ' + error.message);
    } else {
      loadTeamMembers();
      setShowAddTeamModal(false);
      setSelectedUserId('');
      setSelectedRole('helper');
    }
  };

  // Remove team member
  const handleRemoveTeamMember = async (assignmentId) => {
    if (!confirm('Remove this team member?')) return;

    const { error } = await supabase
      .from('work_order_assignments')
      .delete()
      .eq('assignment_id', assignmentId);

    if (!error) {
      loadTeamMembers();
    }
  };

  // Update team member hours/miles
  const updateTeamMemberField = async (assignmentId, field, value) => {
    const { error } = await supabase
      .from('work_order_assignments')
      .update({ [field]: parseFloat(value) || 0 })
      .eq('assignment_id', assignmentId);

    if (!error) {
      loadTeamMembers();
    }
  };

  // Login Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">FSM Mobile</h1>
            <p className="text-gray-600">Field Service Management</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="your.email@company.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength="4"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                placeholder="••••"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Default PIN: 5678</p>
            </div>

            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Work Order Detail View
  if (selectedWO) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Fixed Header */}
        <div className="bg-blue-600 text-white p-4 sticky top-0 z-10 shadow-lg">
          <button
            onClick={() => setSelectedWO(null)}
            className="mb-2 text-sm flex items-center"
          >
            ← Back to Work Orders
          </button>
          <h1 className="text-xl font-bold">{selectedWO.wo_number}</h1>
          <p className="text-sm opacity-90">{selectedWO.buildings?.building_name}</p>
        </div>

        {/* Content with proper spacing */}
        <div className="p-4 space-y-6 pb-20">
          {/* Work Order Info */}
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-bold text-lg mb-2">Work Order Details</h2>
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Description:</span> {selectedWO.description}</p>
              <p><span className="font-semibold">Priority:</span> {selectedWO.priority}</p>
              <p><span className="font-semibold">Status:</span> {selectedWO.status}</p>
              <p><span className="font-semibold">Lead Tech:</span> {selectedWO.users?.first_name} {selectedWO.users?.last_name}</p>
            </div>
          </div>

          {/* Team Members Section */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Team Members</h2>
              <button
                onClick={() => setShowAddTeamModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
              >
                + Add Member
              </button>
            </div>

            {teamMembers.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No team members assigned yet</p>
            ) : (
              <div className="space-y-4">
                {teamMembers.map(member => (
                  <div key={member.assignment_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-gray-900">
                          {member.users?.first_name} {member.users?.last_name}
                        </p>
                        <p className="text-sm text-gray-500 capitalize">
                          {member.role?.replace('_', ' ')}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveTeamMember(member.assignment_id)}
                        className="text-red-600 text-sm"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">RT Hours</label>
                        <input
                          type="number"
                          step="0.5"
                          value={member.hours_regular || ''}
                          onChange={(e) => {
                            const updated = teamMembers.map(tm =>
                              tm.assignment_id === member.assignment_id
                                ? { ...tm, hours_regular: parseFloat(e.target.value) || 0 }
                                : tm
                            );
                            setTeamMembers(updated);
                          }}
                          onBlur={(e) => updateTeamMemberField(member.assignment_id, 'hours_regular', e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded"
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
                                ? { ...tm, hours_overtime: parseFloat(e.target.value) || 0 }
                                : tm
                            );
                            setTeamMembers(updated);
                          }}
                          onBlur={(e) => updateTeamMemberField(member.assignment_id, 'hours_overtime', e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded"
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
                                ? { ...tm, miles: parseFloat(e.target.value) || 0 }
                                : tm
                            );
                            setTeamMembers(updated);
                          }}
                          onBlur={(e) => updateTeamMemberField(member.assignment_id, 'miles', e.target.value)}
                          className="w-full px-2 py-1 text-sm border rounded"
                        />
                      </div>
                    </div>

                    <div className="text-xs text-gray-600 mt-2">
                      Labor Cost: ${(
                        ((member.hours_regular || 0) * (member.users?.hourly_rate_regular || 64)) +
                        ((member.hours_overtime || 0) * (member.users?.hourly_rate_overtime || 96))
                      ).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add Team Member Modal */}
        {showAddTeamModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold mb-4">Add Team Member</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Team Member
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Choose a person...</option>
                    {availableUsers.map(user => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.first_name} {user.last_name} ({user.role?.replace('_', ' ').toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role on this Job
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="helper">Helper</option>
                    <option value="lead_tech">Lead Tech</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddTeamModal(false);
                    setSelectedUserId('');
                    setSelectedRole('helper');
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddTeamMember}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                  Add Member
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Work Orders List View - FIXED HEADER
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header with proper spacing */}
      <div className="bg-blue-600 text-white sticky top-0 z-10 shadow-lg">
        <div className="p-4 flex flex-col space-y-3">
          {/* User Info Row */}
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">👋</span>
                <span className="text-lg font-bold">{currentUser.first_name}</span>
              </div>
              <p className="text-sm opacity-90 uppercase tracking-wide">
                {currentUser.role?.replace('_', ' ')}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Logout
            </button>
          </div>

          {/* Title Row */}
          <div>
            <h1 className="text-xl font-bold">My Work Orders</h1>
          </div>
        </div>
      </div>

      {/* Work Orders List with proper top padding */}
      <div className="p-4 space-y-4">
        {workOrders.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No work orders assigned</p>
          </div>
        ) : (
          workOrders.map(wo => (
            <div
              key={wo.wo_id}
              onClick={() => setSelectedWO(wo)}
              className="bg-white rounded-lg shadow p-4 active:bg-gray-50"
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-bold text-lg">{wo.wo_number}</h3>
                  <p className="text-sm text-gray-600">{wo.buildings?.building_name}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  wo.status === 'completed' ? 'bg-green-100 text-green-800' :
                  wo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {wo.status?.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-2">{wo.description}</p>
              <div className="flex justify-between text-xs text-gray-500">
                <span>Priority: {wo.priority}</span>
                <span>→</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}