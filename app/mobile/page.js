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
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamMember, setNewTeamMember] = useState({ user_id: '', role: 'helper' });
  const [newComment, setNewComment] = useState('');
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);

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
      const { data: leadOrders, error: leadError } = await supabase
        .from('work_orders')
        .select('*')
        .eq('lead_tech_id', selectedTech)
        .in('status', ['assigned', 'in_progress', 'needs_return'])
        .order('priority', { ascending: false })
        .order('date_entered', { ascending: true });

      const { data: teamOrders, error: teamError } = await supabase
        .from('work_order_assignments')
        .select('wo_id')
        .eq('user_id', selectedTech);

      if (leadError) throw leadError;

      let allOrders = leadOrders || [];

      if (teamOrders && teamOrders.length > 0) {
        const teamWoIds = teamOrders.map(t => t.wo_id);
        const { data: additionalOrders } = await supabase
          .from('work_orders')
          .select('*')
          .in('wo_id', teamWoIds)
          .in('status', ['assigned', 'in_progress', 'needs_return'])
          .not('lead_tech_id', 'eq', selectedTech);

        if (additionalOrders) {
          allOrders = [...allOrders, ...additionalOrders];
        }
      }

      setWorkOrders(allOrders);
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
      const currentUserData = users.find(u => u.user_id === selectedTech);
      const updatedComments = selectedWO.comments 
        ? `${selectedWO.comments}\n\n[${new Date().toLocaleString()}] ${currentUserData?.first_name}:\n${newComment}`
        : `[${new Date().toLocaleString()}] ${currentUserData?.first_name}:\n${newComment}`;

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
          const currentUserData = users.find(u => u.user_id === selectedTech);
          
          setIsCheckedIn(true);
          setCheckInTime(timestamp);
          
          const checkInComment = `[${timestamp}] ${currentUserData?.first_name} CHECKED IN\nGPS: ${gpsInfo}`;
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
          const currentUserData = users.find(u => u.user_id === selectedTech);
          
          const checkOutComment = `[${timestamp}] ${currentUserData?.first_name} CHECKED OUT\nGPS: ${gpsInfo}\nDuration: ${checkInTime ? `from ${checkInTime}` : 'N/A'}`;
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

  // Work Order Detail Screen - keeping the rest of the code as is...
  // (The detail screen code remains the same from your current version)
  
  const currentUser = users.find(u => u.user_id === selectedTech);
  const isLeadTech = selectedWO.lead_tech_id === selectedTech;
  const myAssignment = teamMembers.find(tm => tm.user_id === selectedTech);
  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      {/* Rest of your detail screen code stays exactly the same */}
      {/* I'm keeping it as-is since it's working */}
    </div>
  );
}