'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function MobileApp() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  
  const [workOrders, setWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamMember, setNewTeamMember] = useState({ user_id: '', role: 'helper' });
  const [newComment, setNewComment] = useState('');
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);

  // Check for existing session on page load
  useEffect(() => {
    checkExistingSession();
  }, []);

  async function checkExistingSession() {
    try {
      const savedUserId = localStorage.getItem('mobile_user_id');
      if (savedUserId) {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('user_id', savedUserId)
          .eq('is_active', true)
          .single();

        if (data && !error) {
          setCurrentUser(data);
          setIsLoggedIn(true);
          fetchUsers();
          fetchWorkOrders(data.user_id);
        } else {
          localStorage.removeItem('mobile_user_id');
        }
      }
    } catch (error) {
      console.error('Session check error:', error);
      localStorage.removeItem('mobile_user_id');
    } finally {
      setCheckingSession(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError('');
    setLoggingIn(true);

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', loginEmail.trim().toLowerCase())
        .eq('pin', loginPin.trim())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        throw new Error('Invalid email or PIN');
      }

      if (data.role !== 'lead_tech' && data.role !== 'helper') {
        throw new Error('Access denied. Mobile app is for field technicians only.');
      }

      // Save session
      localStorage.setItem('mobile_user_id', data.user_id);

      setCurrentUser(data);
      setIsLoggedIn(true);
      fetchUsers();
      fetchWorkOrders(data.user_id);
    } catch (error) {
      console.error('Login error:', error);
      setLoginError(error.message);
    } finally {
      setLoggingIn(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('mobile_user_id');
    setIsLoggedIn(false);
    setCurrentUser(null);
    setLoginEmail('');
    setLoginPin('');
    setWorkOrders([]);
    setSelectedWO(null);
    setTeamMembers([]);
  }

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && isLoggedIn) {
      fetchWorkOrders(currentUser.user_id);
    }
  }, [currentUser, isLoggedIn]);

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
    }
  }

  async function fetchWorkOrders(userId) {
    setLoading(true);
    try {
      const { data: leadOrders, error: leadError } = await supabase
        .from('work_orders')
        .select('*')
        .eq('lead_tech_id', userId)
        .in('status', ['assigned', 'in_progress', 'needs_return'])
        .order('priority', { ascending: false })
        .order('date_entered', { ascending: true });

      const { data: teamOrders, error: teamError } = await supabase
        .from('work_order_assignments')
        .select('wo_id')
        .eq('user_id', userId);

      if (leadError) throw leadError;

      let allOrders = leadOrders || [];

      if (teamOrders && teamOrders.length > 0) {
        const teamWoIds = teamOrders.map(t => t.wo_id);
        const { data: additionalOrders } = await supabase
          .from('work_orders')
          .select('*')
          .in('wo_id', teamWoIds)
          .in('status', ['assigned', 'in_progress', 'needs_return'])
          .not('lead_tech_id', 'eq', userId);

        if (additionalOrders) {
          allOrders = [...allOrders, ...additionalOrders];
        }
      }

      setWorkOrders(allOrders);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
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
      await fetchWorkOrders(currentUser.user_id);
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

  async function addTeamMemberMobile(userId, role = 'helper') {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_order_assignments')
        .insert({
          wo_id: selectedWO.wo_id,
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

  async function handleAddComment() {
    if (!newComment.trim()) {
      alert('Please enter a comment');
      return;
    }

    setSaving(true);
    try {
      const updatedComments = selectedWO.comments 
        ? `${selectedWO.comments}\n\n[${new Date().toLocaleString()}] ${currentUser?.first_name}:\n${newComment}`
        : `[${new Date().toLocaleString()}] ${currentUser?.first_name}:\n${newComment}`;

      const { error } = await supabase
        .from('work_orders')
        .update({ comments: updatedComments })
        .eq('wo_id', selectedWO.wo_id);

      if (error) throw error;

      setSelectedWO({ ...selectedWO, comments: updatedComments });
      setNewComment('');
      alert('✅ Comment added!');
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('❌ Error adding comment');
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckIn() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const timestamp = new Date().toLocaleString();
          const gpsInfo = `${position.coords.latitude}, ${position.coords.longitude}`;
          
          setIsCheckedIn(true);
          setCheckInTime(timestamp);
          
          const checkInComment = `[${timestamp}] ${currentUser?.first_name} CHECKED IN\nGPS: ${gpsInfo}`;
          const updatedComments = selectedWO.comments 
            ? `${selectedWO.comments}\n\n${checkInComment}`
            : checkInComment;

          try {
            const { error } = await supabase
              .from('work_orders')
              .update({ comments: updatedComments })
              .eq('wo_id', selectedWO.wo_id);

            if (error) throw error;
            setSelectedWO({ ...selectedWO, comments: updatedComments });
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
          
          const checkOutComment = `[${timestamp}] ${currentUser?.first_name} CHECKED OUT\nGPS: ${gpsInfo}\nDuration: ${checkInTime ? `from ${checkInTime}` : 'N/A'}`;
          const updatedComments = selectedWO.comments 
            ? `${selectedWO.comments}\n\n${checkOutComment}`
            : checkOutComment;

          try {
            const { error } = await supabase
              .from('work_orders')
              .update({ comments: updatedComments })
              .eq('wo_id', selectedWO.wo_id);

            if (error) throw error;
            
            setSelectedWO({ ...selectedWO, comments: updatedComments });
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

  // Checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">🔧 Field Service</h1>
            <p className="text-gray-600">Sign in to access your work orders</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {loginError}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                placeholder="your.email@company.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PIN Code
              </label>
              <input
                type="password"
                required
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg text-center tracking-widest"
                placeholder="••••"
                maxLength="10"
                autoComplete="off"
              />
            </div>

            <button
              type="submit"
              disabled={loggingIn}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400 transition text-lg"
            >
              {loggingIn ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>Default PIN: 1234</p>
            <p className="mt-1">Contact your administrator if you need help</p>
          </div>
        </div>
      </div>
    );
  }

  // Work Order List Screen
  if (!selectedWO) {
    return (
      <div className="min-h-screen bg-gray-900 text-white">
        <header className="bg-blue-600 p-4 sticky top-0 z-10 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold">My Work Orders</h1>
              <p className="text-sm text-blue-200">{currentUser?.first_name} {currentUser?.last_name}</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 px-4 py-2 rounded-lg text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
              <p className="mt-4 text-gray-400">Loading work orders...</p>
            </div>
          ) : workOrders.length === 0 ? (
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
  const isLeadTech = selectedWO.lead_tech_id === currentUser?.user_id;
  const myAssignment = teamMembers.find(tm => tm.user_id === currentUser?.user_id);
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
            <div>
              <p className="text-gray-400">Main Lead Tech</p>
              <p className="font-medium">
                {(() => {
                  const leadTech = users.find(u => u.user_id === selectedWO.lead_tech_id);
                  return leadTech ? `${leadTech.first_name} ${leadTech.last_name}` : 'Unassigned';
                })()}
                {isLeadTech && ' (You)'}
              </p>
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
            <h2 className="font-bold mb-3 text-lg">⏱️ My Hours (Main Lead Tech)</h2>
            <p className="text-xs text-blue-200 mb-3">Enter your hours here as the main lead technician</p>
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
                <p className="text-xs text-blue-300 mt-1">@ ${users.find(u => u.user_id === selectedWO.lead_tech_id)?.hourly_rate_regular || 64}/hr</p>
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
                <p className="text-xs text-blue-300 mt-1">@ ${users.find(u => u.user_id === selectedWO.lead_tech_id)?.hourly_rate_overtime || 96}/hr</p>
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
            <h2 className="font-bold mb-3 text-lg">
              ⏱️ My Hours ({myAssignment.role === 'lead_tech' ? 'Co-Lead Tech' : 'Helper'})
            </h2>
            <p className="text-xs text-green-200 mb-3">
              ⚠️ ONLY enter your hours here. Don't update the Team Members section below - it's just for viewing.
            </p>
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
                <p className="text-xs text-green-300 mt-1">@ ${myAssignment.users?.hourly_rate_regular || 64}/hr</p>
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
                <p className="text-xs text-green-300 mt-1">@ ${myAssignment.users?.hourly_rate_overtime || 96}/hr</p>
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

        {/* Team Members */}
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-lg text-white">👥 Team Members</h2>
            {isLeadTech && (
              <button
                onClick={() => setShowAddTeamModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                + Add Member
              </button>
            )}
          </div>

          {myAssignment && (
            <div className="bg-yellow-900 bg-opacity-50 border border-yellow-600 rounded-lg p-3 mb-3">
              <p className="text-yellow-200 text-xs">
                ℹ️ You appear in this list as a team member. Update your hours in the "My Hours" section above, NOT here.
              </p>
            </div>
          )}
          
          {teamMembers && teamMembers.length === 0 && (
            <div className="text-center py-4">
              <p className="text-gray-300">No team members yet</p>
              {isLeadTech && (
                <p className="text-xs text-gray-400 mt-2">Tap + Add Member to assign helpers</p>
              )}
            </div>
          )}
          
          {teamMembers && teamMembers.length > 0 && (
            <div className="space-y-3">
              {teamMembers.map(member => {
                const isMyself = member.user_id === currentUser?.user_id;
                return (
                  <div key={member.assignment_id} className={`rounded-lg p-3 ${isMyself ? 'bg-gray-700 border-2 border-yellow-500' : 'bg-blue-700'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold text-white text-base">
                          {member.users?.first_name} {member.users?.last_name}
                          {isMyself && ' (You - View Only)'}
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

                    {/* Only allow lead tech to edit other team members, or show read-only for yourself */}
                    {isLeadTech && !isMyself ? (
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
                    ) : (
                      <div className="bg-gray-800 bg-opacity-50 rounded p-2">
                        <p className="text-sm text-white">
                          {member.hours_regular || 0} RT hrs • {member.hours_overtime || 0} OT hrs • {member.miles || 0} mi
                        </p>
                        <p className="text-xs text-gray-300 mt-1">
                          Labor: ${(
                            ((member.hours_regular || 0) * (member.users?.hourly_rate_regular || 64)) +
                            ((member.hours_overtime || 0) * (member.users?.hourly_rate_overtime || 96))
                          ).toFixed(2)}
                        </p>
                        {isMyself && (
                          <p className="text-xs text-yellow-300 mt-1">
                            ⬆️ Update your hours in "My Hours" section above
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Team Member Modal */}
        {showAddTeamModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold text-white mb-4">Add Team Member</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Select Person</label>
                  <select
                    value={newTeamMember.user_id}
                    onChange={(e) => setNewTeamMember({...newTeamMember, user_id: e.target.value})}
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg text-base border-2 border-gray-600 focus:border-blue-500"
                  >
                    <option value="">Choose a person...</option>
                    {users
                      .filter(u => 
                        u.user_id !== currentUser?.user_id && 
                        !teamMembers.find(tm => tm.user_id === u.user_id)
                      )
                      .map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.first_name} {user.last_name} ({user.role?.replace('_', ' ')})
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Role on This Job</label>
                  <select
                    value={newTeamMember.role}
                    onChange={(e) => setNewTeamMember({...newTeamMember, role: e.target.value})}
                    className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg text-base border-2 border-gray-600 focus:border-blue-500"
                  >
                    <option value="helper">Helper</option>
                    <option value="lead_tech">Co-Lead Tech</option>
                  </select>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => {
                      setShowAddTeamModal(false);
                      setNewTeamMember({ user_id: '', role: 'helper' });
                    }}
                    className="flex-1 bg-gray-600 text-white px-4 py-3 rounded-lg text-base font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (!newTeamMember.user_id) {
                        alert('Please select a person');
                        return;
                      }
                      addTeamMemberMobile(newTeamMember.user_id, newTeamMember.role);
                      setShowAddTeamModal(false);
                      setNewTeamMember({ user_id: '', role: 'helper' });
                    }}
                    disabled={saving || !newTeamMember.user_id}
                    className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg text-base font-medium disabled:bg-gray-500"
                  >
                    {saving ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Check In/Out */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="font-bold mb-3 text-lg">📍 Check In/Out</h2>
          {!isCheckedIn ? (
            <button
              onClick={handleCheckIn}
              className="w-full bg-green-600 text-white px-4 py-4 rounded-lg text-lg font-bold hover:bg-green-700"
            >
              ✅ CHECK IN
            </button>
          ) : (
            <div className="space-y-3">
              <div className="bg-green-900 rounded p-3">
                <p className="text-green-200 text-sm">Checked in at:</p>
                <p className="text-white font-bold">{checkInTime}</p>
              </div>
              <button
                onClick={handleCheckOut}
                className="w-full bg-red-600 text-white px-4 py-4 rounded-lg text-lg font-bold hover:bg-red-700"
              >
                🛑 CHECK OUT
              </button>
            </div>
          )}
        </div>

        {/* Comments */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="font-bold mb-3 text-lg">💬 Comments & Notes</h2>
          
          {selectedWO.comments && (
            <div className="mb-4 bg-gray-700 rounded-lg p-3 max-h-60 overflow-y-auto">
              <p className="text-sm text-gray-200 whitespace-pre-wrap">{selectedWO.comments}</p>
            </div>
          )}

          <div className="space-y-3">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment or note..."
              rows="3"
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg text-base border-2 border-gray-600 focus:border-blue-500"
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || saving}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-500"
            >
              {saving ? 'Posting...' : '📝 Add Comment'}
            </button>
          </div>
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
              <div>
                <label className="block text-sm text-gray-400 mb-1">Trailer ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.trailer_cost || ''}
                  onChange={(e) => setSelectedWO({...selectedWO, trailer_cost: parseFloat(e.target.value) || 0})}
                  onBlur={() => updateWorkOrder({ trailer_cost: selectedWO.trailer_cost })}
                  className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Rental ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.rental_cost || ''}
                  onChange={(e) => setSelectedWO({...selectedWO, rental_cost: parseFloat(e.target.value) || 0})}
                  onBlur={() => updateWorkOrder({ rental_cost: selectedWO.rental_cost })}
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
      </div>
    </div>
  );
}
 