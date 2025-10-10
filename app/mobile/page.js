'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MobileApp() {
  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  // Work Orders State
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState(null); // 'lead' or 'member'
  const [userAssignment, setUserAssignment] = useState(null); // For team members

  // Team Members
  const [availableUsers, setAvailableUsers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [newTeamMember, setNewTeamMember] = useState({ user_id: '', role: 'helper' });

  // Check-in State
  const [checkInTime, setCheckInTime] = useState(null);
  const [checkInLocation, setCheckInLocation] = useState(null);

  // Comments
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  // Check for existing session on mount
  useEffect(() => {
    const savedSession = localStorage.getItem('mobile_session');
    if (savedSession) {
      const session = JSON.parse(savedSession);
      setCurrentUser(session);
      setIsLoggedIn(true);
      fetchWorkOrders(session.user_id);
    }
  }, []);

  // Fetch work orders when user logs in
  useEffect(() => {
    if (currentUser) {
      fetchWorkOrders(currentUser.user_id);
      fetchAvailableUsers();
    }
  }, [currentUser]);

  // Fetch team members and determine role when WO is selected
  useEffect(() => {
    if (selectedWO && currentUser) {
      determineUserRole();
      fetchTeamMembers(selectedWO.wo_id);
      loadCheckInStatus(selectedWO.wo_id);
      fetchComments(selectedWO.wo_id);
    }
  }, [selectedWO, currentUser]);

  // Login Function
  const handleLogin = async () => {
    if (!email || !pin) {
      alert('Please enter both email and PIN');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('pin', pin)
      .eq('is_active', true)
      .single();

    setLoading(false);

    if (error || !data) {
      alert('❌ Invalid email or PIN');
      return;
    }

    if (data.role !== 'lead_tech' && data.role !== 'helper' && data.role !== 'admin') {
      alert('❌ Access denied. Mobile app is for field technicians only.');
      return;
    }

    // Save session
    localStorage.setItem('mobile_session', JSON.stringify(data));
    setCurrentUser(data);
    setIsLoggedIn(true);
    setEmail('');
    setPin('');
  };

  // Logout Function
  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('mobile_session');
      setIsLoggedIn(false);
      setCurrentUser(null);
      setWorkOrders([]);
      setSelectedWO(null);
    }
  };

  // Fetch Work Orders (both as lead tech and as team member)
  const fetchWorkOrders = async (userId) => {
    setLoading(true);

    // Fetch work orders where user is lead tech
    const { data: leadWOs, error: leadError } = await supabase
      .from('work_orders')
      .select('*')
      .eq('lead_tech_id', userId)
      .in('status', ['assigned', 'in_progress', 'needs_return'])
      .order('priority', { ascending: false })
      .order('date_entered', { ascending: true });

    // Fetch work orders where user is a team member
    const { data: assignments, error: assignError } = await supabase
      .from('work_order_assignments')
      .select('wo_id')
      .eq('user_id', userId);

    const assignedWOIds = assignments?.map(a => a.wo_id) || [];

    let memberWOs = [];
    if (assignedWOIds.length > 0) {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .in('wo_id', assignedWOIds)
        .in('status', ['assigned', 'in_progress', 'needs_return'])
        .order('priority', { ascending: false })
        .order('date_entered', { ascending: true });

      if (!error) memberWOs = data || [];
    }

    // Combine and deduplicate
    const allWOs = [...(leadWOs || []), ...memberWOs];
    const uniqueWOs = Array.from(new Map(allWOs.map(wo => [wo.wo_id, wo])).values());

    setWorkOrders(uniqueWOs);
    setLoading(false);
  };

  // Determine if user is lead tech or team member for this WO
  const determineUserRole = async () => {
    if (!selectedWO || !currentUser) return;

    // Check if user is lead tech
    if (selectedWO.lead_tech_id === currentUser.user_id) {
      setUserRole('lead');
      setUserAssignment(null);
      return;
    }

    // Check if user is a team member
    const { data, error } = await supabase
      .from('work_order_assignments')
      .select('*')
      .eq('wo_id', selectedWO.wo_id)
      .eq('user_id', currentUser.user_id)
      .single();

    if (!error && data) {
      setUserRole('member');
      setUserAssignment(data);
    } else {
      setUserRole(null);
      setUserAssignment(null);
    }
  };

  // Fetch Available Users for Team
  const fetchAvailableUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('user_id, first_name, last_name, role')
      .eq('is_active', true)
      .in('role', ['lead_tech', 'helper'])
      .order('first_name');

    if (error) {
      console.error('Error fetching users:', error);
    } else {
      setAvailableUsers(data || []);
    }
  };

  // Fetch Team Members
  const fetchTeamMembers = async (woId) => {
    const { data, error } = await supabase
      .from('work_order_assignments')
      .select(`
        *,
        user:users(first_name, last_name, role)
      `)
      .eq('wo_id', woId);

    if (error) {
      console.error('Error fetching team members:', error);
    } else {
      setTeamMembers(data || []);
    }
  };

  // Update Work Order (Lead Tech Only)
  const updateWorkOrder = async (updates) => {
    if (!selectedWO) return;

    // Check if locked
    if (selectedWO.is_locked && currentUser?.role !== 'admin') {
      alert('❌ This work order is locked. Invoice has been generated. Contact admin for changes.');
      return;
    }

    // Check if user is lead tech
    if (userRole !== 'lead') {
      alert('❌ Only the lead tech can modify work order details.');
      return;
    }

    const { error } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('wo_id', selectedWO.wo_id);

    if (error) {
      console.error('Error updating work order:', error);
      alert('Failed to update');
    } else {
      // Update local state
      setSelectedWO({ ...selectedWO, ...updates });
      // Refresh work orders list
      fetchWorkOrders(currentUser.user_id);
    }
  };

  // Update Team Member Assignment (for their own hours/miles)
  const updateMyAssignment = async (updates) => {
    if (!userAssignment) return;

    // Check if locked
    if (selectedWO.is_locked && currentUser?.role !== 'admin') {
      alert('❌ This work order is locked. Invoice has been generated. Contact admin for changes.');
      return;
    }

    const { error } = await supabase
      .from('work_order_assignments')
      .update(updates)
      .eq('assignment_id', userAssignment.assignment_id);

    if (error) {
      console.error('Error updating assignment:', error);
      alert('Failed to update');
    } else {
      // Update local state
      setUserAssignment({ ...userAssignment, ...updates });
    }
  };

  // Check In
  const handleCheckIn = async () => {
    if (!selectedWO) return;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          const checkIn = {
            time: new Date().toISOString(),
            location
          };

          // Save to localStorage for this WO
          localStorage.setItem(`checkin_${selectedWO.wo_id}`, JSON.stringify(checkIn));
          setCheckInTime(checkIn.time);
          setCheckInLocation(location);

          // Update WO status to in_progress if not already (lead tech only)
          if (selectedWO.status === 'assigned' && userRole === 'lead') {
            await updateWorkOrder({ status: 'in_progress' });
          }

          alert('✅ Checked in successfully!');
        },
        (error) => {
          console.error('Geolocation error:', error);
          alert('⚠️ Could not get location, but checking in anyway...');
          
          const checkIn = {
            time: new Date().toISOString(),
            location: null
          };
          localStorage.setItem(`checkin_${selectedWO.wo_id}`, JSON.stringify(checkIn));
          setCheckInTime(checkIn.time);
        }
      );
    } else {
      alert('Geolocation not supported');
    }
  };

  // Check Out
  const handleCheckOut = async () => {
    if (!checkInTime) {
      alert('You must check in first');
      return;
    }

    if (confirm('Check out from this work order?')) {
      localStorage.removeItem(`checkin_${selectedWO.wo_id}`);
      setCheckInTime(null);
      setCheckInLocation(null);
      alert('✅ Checked out successfully!');
    }
  };

  // Load Check-in Status
  const loadCheckInStatus = (woId) => {
    const saved = localStorage.getItem(`checkin_${woId}`);
    if (saved) {
      const checkIn = JSON.parse(saved);
      setCheckInTime(checkIn.time);
      setCheckInLocation(checkIn.location);
    } else {
      setCheckInTime(null);
      setCheckInLocation(null);
    }
  };

  // Add Team Member (Lead Tech Only)
  const addTeamMember = async () => {
    if (userRole !== 'lead') {
      alert('❌ Only the lead tech can add team members.');
      return;
    }

    if (!newTeamMember.user_id) {
      alert('Please select a team member');
      return;
    }

    // Check if already added
    const alreadyAdded = teamMembers.some(tm => tm.user_id === newTeamMember.user_id);
    if (alreadyAdded) {
      alert('This person is already on the team');
      return;
    }

    const { error } = await supabase
      .from('work_order_assignments')
      .insert({
        wo_id: selectedWO.wo_id,
        user_id: newTeamMember.user_id,
        role: newTeamMember.role,
        hours_regular: 0,
        hours_overtime: 0,
        miles: 0
      });

    if (error) {
      console.error('Error adding team member:', error);
      alert('Failed to add team member');
    } else {
      alert('✅ Team member added!');
      setNewTeamMember({ user_id: '', role: 'helper' });
      fetchTeamMembers(selectedWO.wo_id);
    }
  };

  // Update Team Member Hours (Lead Tech Only)
  const updateTeamMemberHours = async (assignmentId, field, value) => {
    if (userRole !== 'lead') return;

    const { error } = await supabase
      .from('work_order_assignments')
      .update({ [field]: value })
      .eq('assignment_id', assignmentId);

    if (error) {
      console.error('Error updating team member:', error);
    }
  };

  // Remove Team Member (Lead Tech Only)
  const removeTeamMember = async (assignmentId) => {
    if (userRole !== 'lead') {
      alert('❌ Only the lead tech can remove team members.');
      return;
    }

    if (!confirm('Remove this team member?')) return;

    const { error } = await supabase
      .from('work_order_assignments')
      .delete()
      .eq('assignment_id', assignmentId);

    if (error) {
      console.error('Error removing team member:', error);
      alert('Failed to remove team member');
    } else {
      alert('✅ Team member removed');
      fetchTeamMembers(selectedWO.wo_id);
    }
  };

  // Fetch Comments
  const fetchComments = async (woId) => {
    const { data, error } = await supabase
      .from('work_orders')
      .select('comments')
      .eq('wo_id', woId)
      .single();

    if (error) {
      console.error('Error fetching comments:', error);
    } else {
      try {
        const parsedComments = data.comments ? JSON.parse(data.comments) : [];
        setComments(Array.isArray(parsedComments) ? parsedComments : []);
      } catch {
        setComments([]);
      }
    }
  };

  // Add Comment
  const addComment = async () => {
    if (!newComment.trim()) return;

    const comment = {
      text: newComment,
      author: `${currentUser.first_name} ${currentUser.last_name}`,
      timestamp: new Date().toISOString(),
      location: checkInLocation
    };

    const updatedComments = [...comments, comment];

    const { error } = await supabase
      .from('work_orders')
      .update({ comments: JSON.stringify(updatedComments) })
      .eq('wo_id', selectedWO.wo_id);

    if (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    } else {
      setComments(updatedComments);
      setNewComment('');
    }
  };

  // Get Priority Color
  const getPriorityColor = (priority) => {
    const colors = {
      emergency: 'bg-red-600',
      high: 'bg-orange-600',
      medium: 'bg-yellow-600',
      low: 'bg-green-600'
    };
    return colors[priority] || 'bg-gray-600';
  };

  // Get Status Color
  const getStatusColor = (status) => {
    const colors = {
      assigned: 'bg-blue-600',
      in_progress: 'bg-yellow-600',
      needs_return: 'bg-purple-600',
      completed: 'bg-green-600'
    };
    return colors[status] || 'bg-gray-600';
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">🔧 Field Service App</h1>
            <p className="text-gray-400">Mobile Access for Technicians</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg"
                placeholder="your.email@company.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">PIN Code</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg text-center text-2xl tracking-widest"
                placeholder="••••"
                maxLength="10"
                inputMode="numeric"
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-4 rounded-lg font-bold text-lg transition"
            >
              {loading ? '⏳ Signing In...' : '🔓 Sign In'}
            </button>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500">
            Need help? Contact your admin
          </div>
        </div>
      </div>
    );
  }

  // Work Order List View
  if (!selectedWO) {
    return (
      <div className="min-h-screen bg-gray-900 text-white pb-20">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">👋 {currentUser.first_name}</h1>
              <p className="text-sm text-gray-400">{currentUser.role.replace('_', ' ').toUpperCase()}</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Work Orders List */}
        <div className="p-4">
          <h2 className="text-2xl font-bold mb-4">📋 My Work Orders ({workOrders.length})</h2>

          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : workOrders.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <div className="text-4xl mb-4">✅</div>
              <div className="text-xl font-bold mb-2">No Active Work Orders</div>
              <div className="text-gray-400">You&apos;re all caught up!</div>
            </div>
          ) : (
            <div className="space-y-3">
              {workOrders.map(wo => {
                const isLead = wo.lead_tech_id === currentUser.user_id;
                return (
                  <div
                    key={wo.wo_id}
                    onClick={() => setSelectedWO(wo)}
                    className="bg-gray-800 rounded-lg p-4 active:bg-gray-700 transition"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-bold text-lg">{wo.wo_number}</div>
                      <div className="flex gap-2 items-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(wo.priority)}`}>
                          {wo.priority.toUpperCase()}
                        </span>
                        {!isLead && (
                          <span className="text-xs bg-purple-600 px-2 py-1 rounded-full">
                            TEAM MEMBER
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-gray-300 mb-2">{wo.building}</div>
                    <div className="text-sm text-gray-400 mb-3 line-clamp-2">
                      {wo.work_order_description}
                    </div>

                    <div className="flex justify-between items-center">
                      <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(wo.status)}`}>
                        {wo.status.replace('_', ' ').toUpperCase()}
                      </span>
                      {wo.is_locked && (
                        <span className="text-yellow-500 text-sm">🔒 Locked</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Work Order Detail View
  const isLocked = selectedWO.is_locked && currentUser?.role !== 'admin';
  const isLeadTech = userRole === 'lead';

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedWO(null)}
            className="text-2xl"
          >
            ← 
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">{selectedWO.wo_number}</h1>
            <p className="text-sm text-gray-400">{selectedWO.building}</p>
          </div>
          {!isLeadTech && (
            <div className="text-xs bg-purple-600 px-3 py-1 rounded-full">
              TEAM MEMBER
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Locked Warning */}
        {isLocked && (
          <div className="bg-red-900 text-red-200 p-4 rounded-lg">
            <div className="font-bold text-lg">🔒 Work Order Locked</div>
            <div className="text-sm mt-1">
              Invoice has been generated. This work order is read-only for technicians.
            </div>
          </div>
        )}

        {/* Work Order Info */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="font-bold mb-3 text-lg">📝 Work Order Details</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-400">Description:</span>
              <div className="mt-1">{selectedWO.work_order_description}</div>
            </div>
            <div>
              <span className="text-gray-400">Requestor:</span> {selectedWO.requestor || 'N/A'}
            </div>
            <div>
              <span className="text-gray-400">Date Entered:</span> {new Date(selectedWO.date_entered).toLocaleDateString()}
            </div>
            <div>
              <span className="text-gray-400">NTE Budget:</span> ${(selectedWO.nte || 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Check In/Out */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="font-bold mb-3 text-lg">📍 Check In/Out</h2>
          {checkInTime ? (
            <div className="space-y-3">
              <div className="bg-green-900 text-green-200 p-3 rounded-lg">
                <div className="font-semibold">✅ Checked In</div>
                <div className="text-sm mt-1">
                  {new Date(checkInTime).toLocaleString()}
                </div>
                {checkInLocation && (
                  <div className="text-xs mt-1 opacity-75">
                    📍 {checkInLocation.lat.toFixed(6)}, {checkInLocation.lng.toFixed(6)}
                  </div>
                )}
              </div>
              <button
                onClick={handleCheckOut}
                className="w-full bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-bold"
              >
                🛑 CHECK OUT
              </button>
            </div>
          ) : (
            <button
              onClick={handleCheckIn}
              className="w-full bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold"
            >
              ✅ CHECK IN
            </button>
          )}
        </div>

        {/* My Hours - For Lead Tech */}
        {isLeadTech && (
          <div className={`rounded-lg p-4 ${isLocked ? 'bg-gray-700 opacity-60' : 'bg-blue-900'}`}>
            <h2 className="font-bold mb-3 text-lg">⏰ My Hours (Lead Tech)</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Regular Time (hrs)</label>
                <input
                  type="number"
                  step="0.25"
                  value={selectedWO.hours_regular || ''}
                  onChange={(e) => setSelectedWO({ ...selectedWO, hours_regular: parseFloat(e.target.value) || 0 })}
                  onBlur={() => updateWorkOrder({ hours_regular: selectedWO.hours_regular })}
                  disabled={isLocked}
                  className={`w-full bg-gray-700 text-white px-4 py-3 rounded-lg ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Overtime (hrs)</label>
                <input
                  type="number"
                  step="0.25"
                  value={selectedWO.hours_overtime || ''}
                  onChange={(e) => setSelectedWO({ ...selectedWO, hours_overtime: parseFloat(e.target.value) || 0 })}
                  onBlur={() => updateWorkOrder({ hours_overtime: selectedWO.hours_overtime })}
                  disabled={isLocked}
                  className={`w-full bg-gray-700 text-white px-4 py-3 rounded-lg ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Miles</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedWO.miles || ''}
                  onChange={(e) => setSelectedWO({ ...selectedWO, miles: parseFloat(e.target.value) || 0 })}
                  onBlur={() => updateWorkOrder({ miles: selectedWO.miles })}
                  disabled={isLocked}
                  className={`w-full bg-gray-700 text-white px-4 py-3 rounded-lg ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                  placeholder="0.0"
                />
              </div>
            </div>
          </div>
        )}

        {/* My Hours - For Team Member */}
        {userRole === 'member' && userAssignment && (
          <div className={`rounded-lg p-4 ${isLocked ? 'bg-gray-700 opacity-60' : 'bg-green-900'}`}>
            <h2 className="font-bold mb-3 text-lg">⏰ My Hours (Team Member)</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Regular Time (hrs)</label>
                <input
                  type="number"
                  step="0.25"
                  value={userAssignment.hours_regular || ''}
                  onChange={(e) => setUserAssignment({ ...userAssignment, hours_regular: parseFloat(e.target.value) || 0 })}
                  onBlur={() => updateMyAssignment({ hours_regular: userAssignment.hours_regular })}
                  disabled={isLocked}
                  className={`w-full bg-gray-700 text-white px-4 py-3 rounded-lg ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Overtime (hrs)</label>
                <input
                  type="number"
                  step="0.25"
                  value={userAssignment.hours_overtime || ''}
                  onChange={(e) => setUserAssignment({ ...userAssignment, hours_overtime: parseFloat(e.target.value) || 0 })}
                  onBlur={() => updateMyAssignment({ hours_overtime: userAssignment.hours_overtime })}
                  disabled={isLocked}
                  className={`w-full bg-gray-700 text-white px-4 py-3 rounded-lg ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">Miles</label>
                <input
                  type="number"
                  step="0.1"
                  value={userAssignment.miles || ''}
                  onChange={(e) => setUserAssignment({ ...userAssignment, miles: parseFloat(e.target.value) || 0 })}
                  onBlur={() => updateMyAssignment({ miles: userAssignment.miles })}
                  disabled={isLocked}
                  className={`w-full bg-gray-700 text-white px-4 py-3 rounded-lg ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                  placeholder="0.0"
                />
              </div>
            </div>
            <div className="mt-3 text-sm text-gray-300 bg-gray-800 p-3 rounded">
              💡 You can only edit your own hours and mileage. Contact the lead tech for other changes.
            </div>
          </div>
        )}

        {/* Team Members - Lead Tech Only */}
        {isLeadTech && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="font-bold mb-3 text-lg">👥 Team Members</h2>

            {/* Existing Team Members */}
            {teamMembers.length > 0 && (
              <div className="space-y-3 mb-4">
                {teamMembers.map(member => (
                  <div key={member.assignment_id} className="bg-gray-700 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold">
                          {member.user.first_name} {member.user.last_name}
                        </div>
                        <div className="text-xs text-gray-400">{member.role}</div>
                      </div>
                      <button
                        onClick={() => removeTeamMember(member.assignment_id)}
                        disabled={isLocked}
                        className={`text-red-400 text-sm ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Regular</label>
                        <input
                          type="number"
                          step="0.25"
                          value={member.hours_regular || ''}
                          onChange={(e) => {
                            const newMembers = teamMembers.map(m =>
                              m.assignment_id === member.assignment_id
                                ? { ...m, hours_regular: parseFloat(e.target.value) || 0 }
                                : m
                            );
                            setTeamMembers(newMembers);
                          }}
                          onBlur={() => updateTeamMemberHours(member.assignment_id, 'hours_regular', member.hours_regular)}
                          disabled={isLocked}
                          className={`w-full bg-gray-600 text-white px-2 py-1 rounded text-center ${isLocked ? 'opacity-50' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">OT</label>
                        <input
                          type="number"
                          step="0.25"
                          value={member.hours_overtime || ''}
                          onChange={(e) => {
                            const newMembers = teamMembers.map(m =>
                              m.assignment_id === member.assignment_id
                                ? { ...m, hours_overtime: parseFloat(e.target.value) || 0 }
                                : m
                            );
                            setTeamMembers(newMembers);
                          }}
                          onBlur={() => updateTeamMemberHours(member.assignment_id, 'hours_overtime', member.hours_overtime)}
                          disabled={isLocked}
                          className={`w-full bg-gray-600 text-white px-2 py-1 rounded text-center ${isLocked ? 'opacity-50' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-1">Miles</label>
                        <input
                          type="number"
                          step="0.1"
                          value={member.miles || ''}
                          onChange={(e) => {
                            const newMembers = teamMembers.map(m =>
                              m.assignment_id === member.assignment_id
                                ? { ...m, miles: parseFloat(e.target.value) || 0 }
                                : m
                            );
                            setTeamMembers(newMembers);
                          }}
                          onBlur={() => updateTeamMemberHours(member.assignment_id, 'miles', member.miles)}
                          disabled={isLocked}
                          className={`w-full bg-gray-600 text-white px-2 py-1 rounded text-center ${isLocked ? 'opacity-50' : ''}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Team Member */}
            {!isLocked && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <select
                    value={newTeamMember.user_id}
                    onChange={(e) => setNewTeamMember({ ...newTeamMember, user_id: e.target.value })}
                    className="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg"
                  >
                    <option value="">Select person...</option>
                    {availableUsers
                      .filter(u => u.user_id !== currentUser.user_id)
                      .filter(u => !teamMembers.some(tm => tm.user_id === u.user_id))
                      .map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.first_name} {user.last_name}
                        </option>
                      ))}
                  </select>
                  <select
                    value={newTeamMember.role}
                    onChange={(e) => setNewTeamMember({ ...newTeamMember, role: e.target.value })}
                    className="bg-gray-700 text-white px-3 py-2 rounded-lg"
                  >
                    <option value="helper">Helper</option>
                    <option value="lead_tech">Co-Lead</option>
                  </select>
                </div>
                <button
                  onClick={addTeamMember}
                  className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold"
                >
                  + Add Member
                </button>
              </div>
            )}
          </div>
        )}

        {/* Costs (Lead Tech Only) */}
        {isLeadTech && (
          <div className={`rounded-lg p-4 ${isLocked ? 'bg-gray-700 opacity-60' : 'bg-gray-800'}`}>
            <h2 className="font-bold mb-3 text-lg">💰 Costs (Lead Tech Only)</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Materials ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.material_cost || ''}
                  onChange={(e) => setSelectedWO({ ...selectedWO, material_cost: parseFloat(e.target.value) || 0 })}
                  onBlur={() => updateWorkOrder({ material_cost: selectedWO.material_cost })}
                  disabled={isLocked}
                  className={`w-full bg-gray-700 text-white px-4 py-3 rounded-lg ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Equipment ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.emf_equipment_cost || ''}
                  onChange={(e) => setSelectedWO({ ...selectedWO, emf_equipment_cost: parseFloat(e.target.value) || 0 })}
                  onBlur={() => updateWorkOrder({ emf_equipment_cost: selectedWO.emf_equipment_cost })}
                  disabled={isLocked}
                  className={`w-full bg-gray-700 text-white px-4 py-3 rounded-lg ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Trailer ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.trailer_cost || ''}
                  onChange={(e) => setSelectedWO({ ...selectedWO, trailer_cost: parseFloat(e.target.value) || 0 })}
                  onBlur={() => updateWorkOrder({ trailer_cost: selectedWO.trailer_cost })}
                  disabled={isLocked}
                  className={`w-full bg-gray-700 text-white px-4 py-3 rounded-lg ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Rental ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.rental_cost || ''}
                  onChange={(e) => setSelectedWO({ ...selectedWO, rental_cost: parseFloat(e.target.value) || 0 })}
                  onBlur={() => updateWorkOrder({ rental_cost: selectedWO.rental_cost })}
                  disabled={isLocked}
                  className={`w-full bg-gray-700 text-white px-4 py-3 rounded-lg ${isLocked ? 'cursor-not-allowed opacity-50' : ''}`}
                  placeholder="0.00"
                />
              </div>
            </div>
            {isLocked && (
              <div className="mt-3 text-sm text-yellow-300">
                ⚠️ Fields are locked - Invoice has been generated
              </div>
            )}
          </div>
        )}

        {/* Status Update (Lead Tech Only) */}
        {isLeadTech && (
          <div className="bg-gray-800 rounded-lg p-4">
            <h2 className="font-bold mb-3 text-lg">🔄 Status</h2>
            <select
              value={selectedWO.status}
              onChange={(e) => {
                const newStatus = e.target.value;
                setSelectedWO({ ...selectedWO, status: newStatus });
                updateWorkOrder({ status: newStatus });
                
                if (newStatus === 'completed') {
                  alert('✅ Work order marked as Completed!');
                }
              }}
              disabled={isLocked}
              className={`w-full px-4 py-3 rounded-lg font-semibold text-white ${getStatusColor(selectedWO.status)} ${
                isLocked ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="needs_return">Needs Return Visit</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}

        {/* Comments */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="font-bold mb-3 text-lg">💬 Comments & Notes</h2>

          {/* Existing Comments */}
          {comments.length > 0 && (
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {comments.map((comment, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-1">
                    <div className="font-semibold text-sm">{comment.author}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(comment.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-sm">{comment.text}</div>
                  {comment.location && (
                    <div className="text-xs text-gray-500 mt-1">
                      📍 {comment.location.lat.toFixed(4)}, {comment.location.lng.toFixed(4)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Comment */}
          <div className="space-y-2">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg"
              rows="3"
              placeholder="Add a comment or note..."
            />
            <button
              onClick={addComment}
              disabled={!newComment.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg font-semibold"
            >
              📝 Add Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}