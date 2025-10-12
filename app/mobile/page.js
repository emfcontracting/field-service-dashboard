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
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');

  // Check In/Out
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);

  // Field Data
  const [fieldData, setFieldData] = useState({
    hours_regular: 0,
    hours_overtime: 0,
    miles: 0,
    material_cost: 0,
    emf_equipment_cost: 0,
    trailer_cost: 0,
    rental_cost: 0
  });

  // Comments
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    const savedSession = localStorage.getItem('mobile_session');
    if (savedSession) {
      const user = JSON.parse(savedSession);
      setCurrentUser(user);
      fetchWorkOrders(user.user_id);
      fetchAvailableUsers();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchWorkOrders = async (userId) => {
  setLoading(true);
  const { data, error } = await supabase
    .from('work_orders')
    .select(`
      *,
      lead_tech:users!lead_tech_id(first_name, last_name)
    `)
    .eq('lead_tech_id', userId)
    .in('status', ['assigned', 'in_progress', 'needs_return', 'completed'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching work orders:', error);
    setLoading(false);
    return;
  }

  // Show completed WOs only if they're not locked/acknowledged yet
  const filteredData = (data || []).filter(wo => {
    if (wo.status !== 'completed') return true; // Show all non-completed
    return !wo.is_locked && !wo.acknowledged; // Show completed only if not locked
  });

  setWorkOrders(filteredData);
  setLoading(false);
};

  const fetchAvailableUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .in('role', ['tech', 'lead_tech'])
      .order('first_name');

    setAvailableUsers(data || []);
  };

  const selectWorkOrder = async (wo) => {
    setSelectedWO(wo);
    setUserRole(wo.lead_tech_id === currentUser?.user_id ? 'lead' : 'helper');

    // Load field data
    setFieldData({
      hours_regular: wo.hours_regular || 0,
      hours_overtime: wo.hours_overtime || 0,
      miles: wo.miles || 0,
      material_cost: wo.material_cost || 0,
      emf_equipment_cost: wo.emf_equipment_cost || 0,
      trailer_cost: wo.trailer_cost || 0,
      rental_cost: wo.rental_cost || 0
    });

    // Fetch team members
    await fetchTeamMembers(wo.wo_id);

    // Fetch comments
    await fetchComments(wo.wo_id);

    // Check if already checked in
    checkIfCheckedIn(wo.wo_id);
  };

  const fetchTeamMembers = async (woId) => {
    const { data } = await supabase
      .from('work_order_assignments')
      .select(`
        *,
        user:users(first_name, last_name, email)
      `)
      .eq('wo_id', woId);

    setTeamMembers(data || []);
  };

  const fetchComments = async (woId) => {
    const { data } = await supabase
      .from('work_order_comments')
      .select(`
        *,
        user:users(first_name, last_name)
      `)
      .eq('wo_id', woId)
      .order('created_at', { ascending: false });

    setComments(data || []);
  };

  const checkIfCheckedIn = async (woId) => {
    const { data } = await supabase
      .from('work_order_comments')
      .select('*')
      .eq('wo_id', woId)
      .eq('user_id', currentUser.user_id)
      .eq('comment_type', 'check_in')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const { data: checkOut } = await supabase
        .from('work_order_comments')
        .select('*')
        .eq('wo_id', woId)
        .eq('user_id', currentUser.user_id)
        .eq('comment_type', 'check_out')
        .gt('created_at', data.created_at)
        .single();

      if (!checkOut) {
        setIsCheckedIn(true);
        setCheckInTime(data.created_at);
      }
    }
  };

  const handleCheckIn = async () => {
  if (!selectedWO) return;

  try {
    const now = new Date().toISOString();
    const location = await getLocation();

    const { data, error } = await supabase
      .from('work_order_comments')
      .insert({
        wo_id: selectedWO.wo_id,
        user_id: currentUser.user_id,
        comment: `CHECKED IN\nGPS: ${location.lat}, ${location.lng}`,
        comment_type: 'check_in'
      })
      .select()
      .single();

    if (error) {
      console.error('Check-in error:', error);
      alert('Failed to check in: ' + error.message);
    } else {
      setIsCheckedIn(true);
      setCheckInTime(now);
      await fetchComments(selectedWO.wo_id);
      alert('✅ Checked In!');
    }
  } catch (err) {
    console.error('Check-in exception:', err);
    alert('Failed to check in: ' + err.message);
  }
};

const handleCheckOut = async () => {
  if (!selectedWO || !checkInTime) return;

  try {
    const now = new Date().toISOString();
    const location = await getLocation();
    const duration = calculateDuration(checkInTime, now);

    const { data, error } = await supabase
      .from('work_order_comments')
      .insert({
        wo_id: selectedWO.wo_id,
        user_id: currentUser.user_id,
        comment: `CHECKED OUT\nGPS: ${location.lat}, ${location.lng}\nDuration: ${duration}`,
        comment_type: 'check_out'
      })
      .select()
      .single();

    if (error) {
      console.error('Check-out error:', error);
      alert('Failed to check out: ' + error.message);
    } else {
      setIsCheckedIn(false);
      setCheckInTime(null);
      await fetchComments(selectedWO.wo_id);
      alert('✅ Checked Out!');
    }
  } catch (err) {
    console.error('Check-out exception:', err);
    alert('Failed to check out: ' + err.message);
  }
};

  const getLocation = () => {
    return new Promise((resolve) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              lat: position.coords.latitude.toFixed(6),
              lng: position.coords.longitude.toFixed(6)
            });
          },
          () => resolve({ lat: 'N/A', lng: 'N/A' })
        );
      } else {
        resolve({ lat: 'N/A', lng: 'N/A' });
      }
    });
  };

  const calculateDuration = (start, end) => {
    const diff = new Date(end) - new Date(start);
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  const updateFieldData = async (field, value) => {
    if (!selectedWO || userRole !== 'lead') {
      alert('Only lead tech can update field data');
      return;
    }

    const { error } = await supabase
      .from('work_orders')
      .update({ [field]: value })
      .eq('wo_id', selectedWO.wo_id);

    if (!error) {
      setFieldData({ ...fieldData, [field]: value });
      setSelectedWO({ ...selectedWO, [field]: value });
    }
  };

  const updateStatus = async (newStatus) => {
    if (!selectedWO || userRole !== 'lead') return;

    const { error } = await supabase
      .from('work_orders')
      .update({ status: newStatus })
      .eq('wo_id', selectedWO.wo_id);

    if (!error) {
      setSelectedWO({ ...selectedWO, status: newStatus });
      alert('✅ Status updated!');
    }
  };

  const addComment = async () => {
    if (!newComment.trim() || !selectedWO) return;

    const { error } = await supabase
      .from('work_order_comments')
      .insert({
        wo_id: selectedWO.wo_id,
        user_id: currentUser.user_id,
        comment: newComment,
        comment_type: 'note'
      });

    if (error) {
      alert('Failed to add comment');
    } else {
      setNewComment('');
      fetchComments(selectedWO.wo_id);
    }
  };

  const addTeamMember = async (userId) => {
    if (!selectedWO || userRole !== 'lead') return;

    const { error } = await supabase
      .from('work_order_assignments')
      .insert({
        wo_id: selectedWO.wo_id,
        user_id: userId,
        role: 'helper'
      });

    if (error) {
      alert('Failed to add team member');
    } else {
      fetchTeamMembers(selectedWO.wo_id);
      setShowAddMemberModal(false);
      alert('✅ Team member added!');
    }
  };

  const removeTeamMember = async (assignmentId) => {
    if (!selectedWO || userRole !== 'lead') return;

    if (!confirm('Remove this team member?')) return;

    const { error } = await supabase
      .from('work_order_assignments')
      .delete()
      .eq('assignment_id', assignmentId);

    if (!error) {
      fetchTeamMembers(selectedWO.wo_id);
    }
  };

  const updateTeamMemberHours = async (assignmentId, field, value) => {
    if (userRole !== 'lead') return;

    const { error } = await supabase
      .from('work_order_assignments')
      .update({ [field]: value })
      .eq('assignment_id', assignmentId);

    if (!error) {
      fetchTeamMembers(selectedWO.wo_id);
    }
  };

  const calculateTotalCost = () => {
    if (!selectedWO) return 0;

    const leadRegular = (fieldData.hours_regular || 0) * 64;
    const leadOvertime = (fieldData.hours_overtime || 0) * 96;
    
    const teamLabor = teamMembers.reduce((sum, member) => {
      const regular = (member.hours_regular || 0) * 64;
      const overtime = (member.hours_overtime || 0) * 96;
      return sum + regular + overtime;
    }, 0);

    const totalMiles = (fieldData.miles || 0) + teamMembers.reduce((sum, m) => sum + (m.miles || 0), 0);

    return leadRegular + leadOvertime + teamLabor + 
           (fieldData.material_cost || 0) +
           (fieldData.emf_equipment_cost || 0) +
           (fieldData.trailer_cost || 0) +
           (fieldData.rental_cost || 0) +
           (totalMiles * 1.00);
  };

  const handleLogout = () => {
    localStorage.removeItem('mobile_session');
    window.location.reload();
  };

  const getStatusColor = (status) => {
    const colors = {
      assigned: 'bg-blue-600',
      in_progress: 'bg-yellow-600',
      needs_return: 'bg-purple-600',
      completed: 'bg-green-600'
    };
    return colors[status] || 'bg-gray-600';
  };

// Login Component
  const LoginScreen = () => {
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState('');

    useEffect(() => {
      fetchUsers();
    }, []);

    const fetchUsers = async () => {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('first_name');
      setUsers(data || []);
    };

    const handleLogin = () => {
      if (!selectedUserId) {
        alert('Please select a user');
        return;
      }

      const user = users.find(u => u.user_id === selectedUserId);
      localStorage.setItem('mobile_session', JSON.stringify(user));
      setCurrentUser(user);
      fetchWorkOrders(user.user_id);
    };

    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md">
          <h1 className="text-3xl font-bold text-white mb-6 text-center">
            📱 Mobile Field App
          </h1>
          
          <div className="mb-4">
            <label className="block text-gray-400 mb-2">Select Your Profile</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg"
            >
              <option value="">Choose user...</option>
              {users.map(user => (
                <option key={user.user_id} value={user.user_id}>
                  {user.first_name} {user.last_name} - {user.role.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition"
          >
            Login
          </button>
        </div>
      </div>
    );
  };

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      
      {/* Work Order List View */}
      {!selectedWO && (
        <div>
          {/* Header */}
          <div className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-xl font-bold">👋 {currentUser.first_name}</h1>
                <p className="text-sm text-gray-400">{currentUser.role.replace('_', ' ').toUpperCase()}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.href = '/completed'}
                  className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-semibold"
                >
                  ✅ Completed
                </button>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm font-semibold"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>

          {/* Work Orders List */}
          <div className="p-4 space-y-3">
            <h2 className="text-lg font-bold mb-3">My Work Orders ({workOrders.length})</h2>
            
            {loading ? (
              <div className="text-center py-12 text-gray-400">Loading...</div>
            ) : workOrders.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
                <div className="text-4xl mb-3">📋</div>
                <div>No work orders assigned yet</div>
              </div>
            ) : (
              workOrders.map(wo => (
                <div
                  key={wo.wo_id}
                  onClick={() => selectWorkOrder(wo)}
                  className="bg-gray-800 rounded-lg p-4 cursor-pointer active:bg-gray-700"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-lg">{wo.wo_number}</div>
                      <div className="text-sm text-gray-400">{wo.building}</div>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(wo.status)}`}>
                      {wo.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300">
                    {wo.work_order_description.substring(0, 100)}...
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    NTE: ${(wo.nte || 0).toFixed(2)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Work Order Detail View */}
      {selectedWO && (
        <div className="pb-20">
          {/* Header */}
          <div className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-10">
            <button
              onClick={() => {
                setSelectedWO(null);
                setIsCheckedIn(false);
                setCheckInTime(null);
              }}
              className="text-blue-400 mb-2"
            >
              ← Back to List
            </button>
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold">{selectedWO.wo_number}</h1>
                <p className="text-sm text-gray-400">Created on {new Date(selectedWO.date_entered).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <span className={`px-3 py-2 rounded-lg text-sm font-semibold ${selectedWO.priority === 'emergency' ? 'bg-red-600' : selectedWO.priority === 'high' ? 'bg-orange-600' : 'bg-yellow-600'}`}>
                  {selectedWO.priority.toUpperCase()}
                </span>
                <span className={`px-3 py-2 rounded-lg text-sm font-semibold ${getStatusColor(selectedWO.status)}`}>
                  {selectedWO.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
            </div>
          </div>

<div className="p-4 space-y-6">

  {/* Locked/Acknowledged Warning */}
  {(selectedWO.is_locked || selectedWO.acknowledged) && (
    <div className="bg-red-900 text-red-200 p-4 rounded-lg">
      <div className="font-bold text-lg">🔒 Work Order Locked</div>
      <div className="text-sm mt-1">
        {selectedWO.acknowledged && 'This work order has been acknowledged by the office. '}
        {selectedWO.is_locked && 'Invoice has been generated. '}
        You can view details but cannot make changes.
      </div>
    </div>
  )}
  
  {/* Work Order Details */}

          <div className="p-4 space-y-6">
            
            {/* Work Order Details */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-bold mb-3">Work Order Details</h2>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Building:</span>
                  <div className="font-semibold">{selectedWO.building}</div>
                </div>
                
                <div>
                  <span className="text-gray-400">Requestor:</span>
                  <div className="font-semibold">{selectedWO.requestor || 'N/A'}</div>
                </div>
                
                <div>
                  <span className="text-gray-400">Description:</span>
                  <div className="mt-1">{selectedWO.work_order_description}</div>
                </div>
                
                <div>
                  <span className="text-gray-400">NTE (Not To Exceed):</span>
                  <div className="font-bold text-lg">${(selectedWO.nte || 0).toFixed(2)}</div>
                </div>

                <div>
                  <span className="text-gray-400">Age:</span>
                  <div>
                    {Math.floor((new Date() - new Date(selectedWO.date_entered)) / (1000 * 60 * 60 * 24))} days
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Quick Actions</h3>
              <div className="space-y-2">
                {selectedWO.acknowledged && selectedWO.is_locked && (
                  <button
                    onClick={() => alert('Invoice feature - redirect to invoicing page')}
                    className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold"
                  >
                    Generate Invoice
                  </button>
                )}
                <button
                  onClick={() => alert('Print WO feature coming soon')}
                  className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-semibold"
                >
                  Print WO
                </button>
              </div>
            </div>

            {/* Check In/Out */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2">
                <span className="text-pink-500">●</span> Check In/Out
              </h3>
              
              {!isCheckedIn ? (
                <button
                  onClick={handleCheckIn}
                  className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-bold text-lg"
                >
                  ✓ CHECK IN
                </button>
              ) : (
                <div>
                  <div className="bg-green-900 text-green-200 p-3 rounded-lg mb-3 text-center">
                    <div className="font-bold">✓ Checked In</div>
                    <div className="text-sm mt-1">
                      Since {new Date(checkInTime).toLocaleTimeString()}
                    </div>
                  </div>
                  <button
                    onClick={handleCheckOut}
                    className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-lg font-bold text-lg"
                  >
                    CHECK OUT
                  </button>
                </div>
              )}
            </div>

            {/* Primary Assignment */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Primary Assignment</h3>
              <div className="text-sm text-gray-400 mb-1">Lead Technician</div>
              <div className="bg-gray-700 p-3 rounded-lg font-semibold">
                {selectedWO.lead_tech?.first_name} {selectedWO.lead_tech?.last_name}
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">Team Members</h3>
                {userRole === 'lead' && (
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm font-semibold"
                  >
                    + Add Helper/Tech
                  </button>
                )}
              </div>

              {teamMembers.length === 0 ? (
                <div className="text-center text-gray-400 py-4 text-sm">
                  No additional team members yet
                </div>
              ) : (
                <div className="space-y-3">
                  {teamMembers.map(member => (
                    <div key={member.assignment_id} className="bg-gray-700 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-bold">
                            {member.user?.first_name} {member.user?.last_name}
                          </div>
                          <div className="text-xs text-gray-400 capitalize">{member.role}</div>
                        </div>
                        {userRole === 'lead' && (
                          <button
                            onClick={() => removeTeamMember(member.assignment_id)}
                            className="text-red-400 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <label className="text-xs text-gray-400">RT Hours</label>
                          <input
                            type="number"
                            step="0.5"
                            value={member.hours_regular || 0}
                            onChange={(e) => updateTeamMemberHours(member.assignment_id, 'hours_regular', parseFloat(e.target.value) || 0)}
                            disabled={userRole !== 'lead'}
                            className="w-full bg-gray-600 text-white px-2 py-1 rounded mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">OT Hours</label>
                          <input
                            type="number"
                            step="0.5"
                            value={member.hours_overtime || 0}
                            onChange={(e) => updateTeamMemberHours(member.assignment_id, 'hours_overtime', parseFloat(e.target.value) || 0)}
                            disabled={userRole !== 'lead'}
                            className="w-full bg-gray-600 text-white px-2 py-1 rounded mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400">Miles</label>
                          <input
                            type="number"
                            value={member.miles || 0}
                            onChange={(e) => updateTeamMemberHours(member.assignment_id, 'miles', parseFloat(e.target.value) || 0)}
                            disabled={userRole !== 'lead'}
                            className="w-full bg-gray-600 text-white px-2 py-1 rounded mt-1"
                          />
                        </div>
                      </div>
                      
                      <div className="text-xs text-gray-400 mt-2">
                        Labor: ${(((member.hours_regular || 0) * 64) + ((member.hours_overtime || 0) * 96)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

{/* Update Status */}
            {userRole === 'lead' && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="font-bold mb-3">Update Status</h3>
                <select
                  value={selectedWO.status}
                  onChange={(e) => updateStatus(e.target.value)}
                  disabled={selectedWO.is_locked || selectedWO.acknowledged}
                  className={`w-full px-4 py-3 rounded-lg font-semibold ${getStatusColor(selectedWO.status)} ${
                    (selectedWO.is_locked || selectedWO.acknowledged) ? 'opacity-50' : ''
                  }`}
                >
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="needs_return">Needs Return</option>
                  <option value="completed">Completed</option>
                </select>
                {(selectedWO.is_locked || selectedWO.acknowledged) && (
                  <div className="text-xs text-red-400 mt-2">
                    Status locked - work order has been acknowledged
                  </div>
                )}
              </div>
            )}

            {/* Primary Tech Field Data */}
            {userRole === 'lead' && (
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold">Primary Tech Field Data</h3>
                  <button
                    onClick={() => {
                      if (confirm('Save all field data changes?')) {
                        alert('✅ Changes saved!');
                      }
                    }}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold"
                  >
                    💾 Save Changes
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Hours */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Regular Hours (RT)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={fieldData.hours_regular}
                        onChange={(e) => updateFieldData('hours_regular', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Up to 8 hrs @ $64/hr
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Overtime Hours (OT)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={fieldData.hours_overtime}
                        onChange={(e) => updateFieldData('hours_overtime', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Over 8 hrs @ $96/hr
                      </div>
                    </div>
                  </div>

                  {/* Miles & Materials */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Miles</label>
                      <input
                        type="number"
                        value={fieldData.miles}
                        onChange={(e) => updateFieldData('miles', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        @ $1.00 per mile
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Material Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={fieldData.material_cost}
                        onChange={(e) => updateFieldData('material_cost', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Equipment & Trailer */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Equipment Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={fieldData.emf_equipment_cost}
                        onChange={(e) => updateFieldData('emf_equipment_cost', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="text-sm text-gray-400 mb-1 block">Trailer Cost ($)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={fieldData.trailer_cost}
                        onChange={(e) => updateFieldData('trailer_cost', parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Rental */}
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Rental Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={fieldData.rental_cost}
                      onChange={(e) => updateFieldData('rental_cost', parseFloat(e.target.value) || 0)}
                      className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Cost Summary */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Cost Summary</h3>

              {/* Team Labor Breakdown */}
              <div className="bg-blue-900 text-blue-100 rounded-lg p-3 mb-3">
                <div className="font-bold mb-2">TEAM LABOR</div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Total RT ({fieldData.hours_regular + teamMembers.reduce((sum, m) => sum + (m.hours_regular || 0), 0)} hrs)</span>
                    <span>${((fieldData.hours_regular + teamMembers.reduce((sum, m) => sum + (m.hours_regular || 0), 0)) * 64).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total OT ({fieldData.hours_overtime + teamMembers.reduce((sum, m) => sum + (m.hours_overtime || 0), 0)} hrs)</span>
                    <span>${((fieldData.hours_overtime + teamMembers.reduce((sum, m) => sum + (m.hours_overtime || 0), 0)) * 96).toFixed(2)}</span>
                  </div>
                  <div className="border-t border-blue-700 pt-1 mt-1 flex justify-between font-bold">
                    <span>Total Labor:</span>
                    <span>
                      ${(
                        ((fieldData.hours_regular + teamMembers.reduce((sum, m) => sum + (m.hours_regular || 0), 0)) * 64) +
                        ((fieldData.hours_overtime + teamMembers.reduce((sum, m) => sum + (m.hours_overtime || 0), 0)) * 96)
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Other Costs */}
              <div className="space-y-2 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Mileage ({fieldData.miles + teamMembers.reduce((sum, m) => sum + (m.miles || 0), 0)} mi × $1.00)</span>
                  <span>${((fieldData.miles + teamMembers.reduce((sum, m) => sum + (m.miles || 0), 0)) * 1.00).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Materials</span>
                  <span>${(fieldData.material_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Equipment</span>
                  <span>${(fieldData.emf_equipment_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Trailer</span>
                  <span>${(fieldData.trailer_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Rental</span>
                  <span>${(fieldData.rental_cost || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Grand Total */}
              <div className="border-t border-gray-700 pt-3 mt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-lg">Grand Total:</span>
                  <span className="text-2xl font-bold text-green-400">
                    ${calculateTotalCost().toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">NTE Budget:</span>
                  <span>${(selectedWO.nte || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Remaining:</span>
                  <span className={calculateTotalCost() > selectedWO.nte ? 'text-red-400 font-bold' : 'text-green-400'}>
                    ${((selectedWO.nte || 0) - calculateTotalCost()).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Time Tracking */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Time Tracking</h3>
              
              <div className="bg-gray-700 rounded-lg p-3 mb-3">
                <div className="text-sm text-gray-400 mb-1">TEAM TOTALS</div>
                <div className="text-2xl font-bold text-blue-400">
                  {fieldData.hours_regular + teamMembers.reduce((sum, m) => sum + (m.hours_regular || 0), 0)} RT + {fieldData.hours_overtime + teamMembers.reduce((sum, m) => sum + (m.hours_overtime || 0), 0)} OT
                </div>
                <div className="text-xs text-gray-400">
                  = {fieldData.hours_regular + fieldData.hours_overtime + teamMembers.reduce((sum, m) => sum + (m.hours_regular || 0) + (m.hours_overtime || 0), 0)} total hours
                </div>
              </div>

              <div className="text-sm">
                <div className="text-gray-400 mb-1">Total Miles Traveled</div>
                <div className="text-xl font-bold">
                  {fieldData.miles + teamMembers.reduce((sum, m) => sum + (m.miles || 0), 0)} mi
                </div>
              </div>
            </div>

           {/* Comments & Notes */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Comments & Notes</h3>

              {/* Comments List */}
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {comments.length === 0 ? (
                  <div className="text-center text-gray-400 py-4 text-sm">
                    No comments yet
                  </div>
                ) : (
                  comments.map(comment => (
                    <div key={comment.comment_id} className="bg-gray-700 rounded p-3 text-sm">
                      <div className="text-xs text-gray-400 mb-1">
                        [{new Date(comment.created_at).toLocaleString()}] {comment.user?.first_name} {comment.user?.last_name}
                      </div>
                      <div className="whitespace-pre-wrap">{comment.comment}</div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment */}
              <div>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a new comment..."
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg mb-2"
                  rows="3"
                />
                <button
                  onClick={addComment}
                  disabled={!newComment.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-2 rounded-lg font-semibold"
                >
                  Add Comment
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Add Team Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-md">
            <div className="border-b border-gray-700 p-4 flex justify-between items-center">
              <h3 className="text-lg font-bold">Add Team Member</h3>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            <div className="p-4">
              <div className="space-y-2">
                {availableUsers
                  .filter(user => 
                    user.user_id !== currentUser.user_id && 
                    !teamMembers.some(m => m.user_id === user.user_id)
                  )
                  .map(user => (
                    <button
                      key={user.user_id}
                      onClick={() => addTeamMember(user.user_id)}
                      className="w-full bg-gray-700 hover:bg-gray-600 p-3 rounded-lg text-left transition"
                    >
                      <div className="font-semibold">
                        {user.first_name} {user.last_name}
                      </div>
                      <div className="text-xs text-gray-400">{user.email}</div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}