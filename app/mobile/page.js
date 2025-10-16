'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function MobilePage() {
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showCompletedPage, setShowCompletedPage] = useState(false);
  const [completedWorkOrders, setCompletedWorkOrders] = useState([]);
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentTeamList, setCurrentTeamList] = useState([]);
  const [editingField, setEditingField] = useState({});
  
  // NEW: Availability states
const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
const [availabilityBlocked, setAvailabilityBlocked] = useState(false);
const [scheduledWork, setScheduledWork] = useState(false);
const [emergencyWork, setEmergencyWork] = useState(false);
const [notAvailable, setNotAvailable] = useState(false);
const [hasSubmittedToday, setHasSubmittedToday] = useState(false);

  const supabase = createClientComponentClient();

useEffect(() => {
  checkAuth();
}, []);

useEffect(() => {
  if (!currentUser) return;
  
  loadWorkOrders();
  loadCompletedWorkOrders();
  checkAvailabilityStatus();
  
  // Check availability every minute
  const availabilityInterval = setInterval(() => {
    checkAvailabilityStatus();
  }, 60000);

  const channel = supabase
    .channel('work-orders-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'work_orders'
      },
      () => {
        loadWorkOrders();
        loadCompletedWorkOrders();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
    clearInterval(availabilityInterval);
  };
}, [currentUser]);

// Load team members when work order is selected
useEffect(() => {
  if (selectedWO && selectedWO.wo_id) {
    console.log('Loading team for work order:', selectedWO.wo_id);
    loadTeamForWorkOrder(selectedWO.wo_id).catch(err => {
      console.error('Error in useEffect loading team:', err);
    });
    setEditingField({});
  }
}, [selectedWO?.wo_id]);

  async function checkAuth() {
    const savedEmail = localStorage.getItem('mobileEmail');
    const savedPin = localStorage.getItem('mobilePin');
    if (savedEmail && savedPin) {
      await loginWithCredentials(savedEmail, savedPin);
    }
    setLoading(false);
  }

  async function loginWithCredentials(emailValue, pinValue) {
    try {
      console.log('Attempting login with email:', emailValue);
      
      // Check if user exists with this email
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailValue)
        .single();

      console.log('User query result:', users, error);

      if (error || !users) {
        setError('Invalid email - user not found');
        localStorage.removeItem('mobileEmail');
        localStorage.removeItem('mobilePin');
        return;
      }

      // Check if user has a PIN set
      if (!users.pin) {
        setError('No PIN set for this user. Contact admin to set up your PIN.');
        localStorage.removeItem('mobileEmail');
        localStorage.removeItem('mobilePin');
        return;
      }

      // Check if PIN matches user's PIN
      if (users.pin !== pinValue) {
        setError('Invalid PIN - PIN does not match');
        localStorage.removeItem('mobileEmail');
        localStorage.removeItem('mobilePin');
        return;
      }

      console.log('Login successful! User:', users);
      setCurrentUser(users);
      localStorage.setItem('mobileEmail', emailValue);
      localStorage.setItem('mobilePin', pinValue);
      setError('');
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed: ' + err.message);
      localStorage.removeItem('mobileEmail');
      localStorage.removeItem('mobilePin');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    
    if (!email || !pin) {
      setError('Please enter both email and PIN');
      return;
    }
    
    await loginWithCredentials(email, pin);
  }

function handleLogout() {
  localStorage.removeItem('mobileEmail');
  localStorage.removeItem('mobilePin');
  setCurrentUser(null);
  setEmail('');
  setPin('');
  setSelectedWO(null);
}

// ✅ ADD THESE THREE FUNCTIONS HERE ✅

async function checkAvailabilityStatus() {
  if (!currentUser) return;

  // Check if user is tech, helper, or lead_tech
  const eligibleRoles = ['tech', 'helper', 'lead_tech'];
  if (!eligibleRoles.includes(currentUser.role)) {
    return;
  }

  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = estTime.getHours();
  const today = estTime.toISOString().split('T')[0];

  // Check if already submitted today
  const { data: todaySubmission } = await supabase
    .from('daily_availability')
    .select('*')
    .eq('user_id', currentUser.user_id)
    .eq('availability_date', today)
    .single();

  if (todaySubmission) {
    setHasSubmittedToday(true);
    setShowAvailabilityModal(false);
    setAvailabilityBlocked(false);
    return;
  }

  // Between 6 PM and 8 PM - show modal
  if (hour >= 18 && hour < 20) {
    setShowAvailabilityModal(true);
    setAvailabilityBlocked(false);
  }
  // After 8 PM and not submitted - block app
  else if (hour >= 20) {
    setAvailabilityBlocked(true);
    setShowAvailabilityModal(true);
  }
  // Before 6 PM - normal operation
  else {
    setShowAvailabilityModal(false);
    setAvailabilityBlocked(false);
  }
}

async function handleAvailabilitySubmit() {
  if (!currentUser) return;

  if (!scheduledWork && !emergencyWork && !notAvailable) {
    alert('Please select at least one availability option');
    return;
  }

  try {
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('daily_availability')
      .insert({
        user_id: currentUser.user_id,
        availability_date: today,
        scheduled_work: scheduledWork,
        emergency_work: emergencyWork,
        not_available: notAvailable,
        submitted_at: new Date().toISOString()
      });

    if (error) throw error;

    setHasSubmittedToday(true);
    setShowAvailabilityModal(false);
    setAvailabilityBlocked(false);
    
    setScheduledWork(false);
    setEmergencyWork(false);
    setNotAvailable(false);

    alert('✅ Availability submitted successfully!');
  } catch (err) {
    alert('Error submitting availability: ' + err.message);
  } finally {
    setSaving(false);
  }
}

function handleAvailabilityChange(option) {
  if (option === 'notAvailable') {
    if (!notAvailable) {
      setNotAvailable(true);
      setScheduledWork(false);
      setEmergencyWork(false);
    } else {
      setNotAvailable(false);
    }
  } else {
    if (notAvailable) return;

    if (option === 'scheduledWork') {
      setScheduledWork(!scheduledWork);
    } else if (option === 'emergencyWork') {
      setEmergencyWork(!emergencyWork);
    }
  }
}

// ✅ END OF NEW FUNCTIONS ✅

async function handleChangePin() {
  // ... your existing handleChangePin code continues here

  async function handleChangePin() {
    if (!newPin || !confirmPin) {
      alert('Please enter both PIN fields');
      return;
    }

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      alert('PIN must be exactly 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      alert('PINs do not match');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('users')
        .update({ pin: newPin })
        .eq('user_id', currentUser.user_id);

      if (error) throw error;
	  
	  // NEW: Check availability status function
function handleLogout() {
  localStorage.removeItem('mobileEmail');
  localStorage.removeItem('mobilePin');
  setCurrentUser(null);
  setEmail('');
  setPin('');
  setSelectedWO(null);
}

async function checkAvailabilityStatus() {
  if (!currentUser) return;

  const eligibleRoles = ['tech', 'helper', 'lead_tech'];
  if (!eligibleRoles.includes(currentUser.role)) {
    return;
  }

  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = estTime.getHours();
  const today = estTime.toISOString().split('T')[0];

  const { data: todaySubmission } = await supabase
    .from('daily_availability')
    .select('*')
    .eq('user_id', currentUser.user_id)
    .eq('availability_date', today)
    .single();

  if (todaySubmission) {
    setHasSubmittedToday(true);
    setShowAvailabilityModal(false);
    setAvailabilityBlocked(false);
    return;
  }

  if (hour >= 18 && hour < 20) {
    setShowAvailabilityModal(true);
    setAvailabilityBlocked(false);
  } else if (hour >= 20) {
    setAvailabilityBlocked(true);
    setShowAvailabilityModal(true);
  } else {
    setShowAvailabilityModal(false);
    setAvailabilityBlocked(false);
  }
}

async function handleAvailabilitySubmit() {
  if (!currentUser) return;

  if (!scheduledWork && !emergencyWork && !notAvailable) {
    alert('Please select at least one availability option');
    return;
  }

  try {
    setSaving(true);
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('daily_availability')
      .insert({
        user_id: currentUser.user_id,
        availability_date: today,
        scheduled_work: scheduledWork,
        emergency_work: emergencyWork,
        not_available: notAvailable,
        submitted_at: new Date().toISOString()
      });

    if (error) throw error;

    setHasSubmittedToday(true);
    setShowAvailabilityModal(false);
    setAvailabilityBlocked(false);
    
    setScheduledWork(false);
    setEmergencyWork(false);
    setNotAvailable(false);

    alert('✅ Availability submitted successfully!');
  } catch (err) {
    alert('Error submitting availability: ' + err.message);
  } finally {
    setSaving(false);
  }
}

function handleAvailabilityChange(option) {
  if (option === 'notAvailable') {
    if (!notAvailable) {
      setNotAvailable(true);
      setScheduledWork(false);
      setEmergencyWork(false);
    } else {
      setNotAvailable(false);
    }
  } else {
    if (notAvailable) return;

    if (option === 'scheduledWork') {
      setScheduledWork(!scheduledWork);
    } else if (option === 'emergencyWork') {
      setEmergencyWork(!emergencyWork);
    }
  }
}

async function handleChangePin() {
  // Your existing code continues here...

      // Update local storage with new PIN
      localStorage.setItem('mobilePin', newPin);
      
      // Update current user state
      setCurrentUser({ ...currentUser, pin: newPin });

      alert('PIN changed successfully!');
      setShowChangePinModal(false);
      setNewPin('');
      setConfirmPin('');
    } catch (err) {
      alert('Error changing PIN: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadWorkOrders() {
    if (!currentUser) return;

    try {
      // Query 1: Get work orders where user is lead tech
      const { data: leadWOs, error: leadError } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .eq('lead_tech_id', currentUser.user_id)
        .in('status', ['assigned', 'in_progress', 'pending', 'needs_return', 'return_trip'])
        .order('priority', { ascending: true })
        .order('date_entered', { ascending: true });

      if (leadError) throw leadError;

      // Query 2: Get work order assignments where user is helper
      const { data: assignments, error: assignError } = await supabase
        .from('work_order_assignments')
        .select('wo_id, role_on_job')
        .eq('user_id', currentUser.user_id);

      if (assignError) throw assignError;

      // Query 3: Get full work order details for assignments
      let helperWOs = [];
      if (assignments && assignments.length > 0) {
        const woIds = assignments.map(a => a.wo_id);
        const { data: helperWOData, error: helperError } = await supabase
          .from('work_orders')
          .select(`
            *,
            lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
          `)
          .in('wo_id', woIds)
          .in('status', ['assigned', 'in_progress', 'pending', 'needs_return', 'return_trip']);

        if (helperError) throw helperError;
        helperWOs = helperWOData || [];
      }

      // Combine and deduplicate
      const allWOs = [...(leadWOs || []), ...helperWOs];
      const uniqueWOs = Array.from(
        new Map(allWOs.map(wo => [wo.wo_id, wo])).values()
      );

      setWorkOrders(uniqueWOs);
    } catch (err) {
      console.error('Error loading work orders:', err);
    }
  }

  async function loadCompletedWorkOrders() {
    if (!currentUser) {
      console.log('loadCompletedWorkOrders: No current user');
      return;
    }

    console.log('Loading completed work orders for user:', currentUser.user_id);

    try {
      // Get completed work orders where user is lead tech
      const { data: leadWOs, error: leadError } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .eq('lead_tech_id', currentUser.user_id)
        .eq('status', 'completed')
        .order('date_completed', { ascending: false })
        .limit(50);

      // Get assignments where user is helper
      const { data: assignments } = await supabase
        .from('work_order_assignments')
        .select('wo_id')
        .eq('user_id', currentUser.user_id);

      // Get completed work orders for those assignments
      let helperWOs = [];
      if (assignments && assignments.length > 0) {
        const woIds = assignments.map(a => a.wo_id);
        const { data: helperWOData } = await supabase
          .from('work_orders')
          .select(`
            *,
            lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
          `)
          .in('wo_id', woIds)
          .eq('status', 'completed')
          .order('date_completed', { ascending: false })
          .limit(50);

        helperWOs = helperWOData || [];
      }

      // Combine and deduplicate
      const allWOs = [...(leadWOs || []), ...helperWOs];
      const uniqueWOs = Array.from(
        new Map(allWOs.map(wo => [wo.wo_id, wo])).values()
      );

      setCompletedWorkOrders(uniqueWOs);
      console.log('Completed work orders loaded:', uniqueWOs.length);
    } catch (err) {
      console.error('Error loading completed work orders:', err);
    }
  }

  async function handleCheckIn(woId) {
    try {
      setSaving(true);
      const now = new Date();
      const timestamp = now.toLocaleString();
      const isoTime = now.toISOString();
      
      // Get current work order
      const { data: wo } = await supabase
        .from('work_orders')
        .select('*')
        .eq('wo_id', woId)
        .single();
      
      // Add check-in note to comments
      const existingComments = wo.comments || '';
      const checkInNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ✓ CHECKED IN`;
      const updatedComments = existingComments 
        ? `${existingComments}\n\n${checkInNote}`
        : checkInNote;
      
      // Update work order with check-in
      const updateData = {
        comments: updatedComments,
        status: 'in_progress'
      };
      
      // If this is the first check-in, also set time_in field
      if (!wo.time_in) {
        updateData.time_in = isoTime;
      }
      
      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('wo_id', woId);

      if (error) throw error;

      await loadWorkOrders();
      if (selectedWO && selectedWO.wo_id === woId) {
        const { data: updated } = await supabase
          .from('work_orders')
          .select('*')
          .eq('wo_id', woId)
          .single();
        setSelectedWO(updated);
      }
    } catch (err) {
      alert('Error checking in: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckOut(woId) {
    try {
      setSaving(true);
      const now = new Date();
      const timestamp = now.toLocaleString();
      const isoTime = now.toISOString();
      
      // Get current work order
      const { data: wo } = await supabase
        .from('work_orders')
        .select('*')
        .eq('wo_id', woId)
        .single();
      
      // Add check-out note to comments
      const existingComments = wo.comments || '';
      const checkOutNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ⏸ CHECKED OUT`;
      const updatedComments = existingComments 
        ? `${existingComments}\n\n${checkOutNote}`
        : checkOutNote;
      
      // Update work order with check-out
      const updateData = {
        comments: updatedComments
      };
      
      // If this is the first check-out, also set time_out field
      if (!wo.time_out) {
        updateData.time_out = isoTime;
      }
      
      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('wo_id', woId);

      if (error) throw error;

      await loadWorkOrders();
      if (selectedWO && selectedWO.wo_id === woId) {
        const { data: updated } = await supabase
          .from('work_orders')
          .select('*')
          .eq('wo_id', woId)
          .single();
        setSelectedWO(updated);
      }
    } catch (err) {
      alert('Error checking out: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteWorkOrder() {
    if (!selectedWO) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to mark this work order as completed? This action cannot be undone from the mobile app.'
    );
    
    if (!confirmed) return;

    try {
      setSaving(true);
      const now = new Date();
      const timestamp = now.toLocaleString();
      const isoTime = now.toISOString();
      
      // Get current work order
      const { data: wo } = await supabase
        .from('work_orders')
        .select('*')
        .eq('wo_id', selectedWO.wo_id)
        .single();
      
      // Add completion note to comments
      const existingComments = wo.comments || '';
      const completionNote = `[${timestamp}] ${currentUser.first_name} ${currentUser.last_name} - ✅ WORK ORDER COMPLETED`;
      const updatedComments = existingComments 
        ? `${existingComments}\n\n${completionNote}`
        : completionNote;
      
      // Update work order to completed status
      const { error } = await supabase
        .from('work_orders')
        .update({
          status: 'completed',
          date_completed: isoTime,
          comments: updatedComments
        })
        .eq('wo_id', selectedWO.wo_id);

      if (error) throw error;

      alert('Work order marked as completed! ✅');
      
      // Reload work orders and go back to list
      await loadWorkOrders();
      await loadCompletedWorkOrders();
      setSelectedWO(null);
    } catch (err) {
      alert('Error completing work order: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateField(woId, field, value) {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('work_orders')
        .update({ [field]: value })
        .eq('wo_id', woId);

      if (error) throw error;

      // Update selected work order locally
      setSelectedWO({ ...selectedWO, [field]: value });
      
      // Clear editing state
      setEditingField({});
    } catch (err) {
      alert('Error updating: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleFieldChange(field, value) {
    // Update local editing state without saving
    setEditingField({ ...editingField, [field]: value });
  }

  function getFieldValue(field) {
    // Return editing value if exists, otherwise return from selectedWO
    if (!selectedWO) return '';
    return editingField.hasOwnProperty(field) ? editingField[field] : (selectedWO[field] || '');
  }

  async function handleAddComment() {
    if (!newComment.trim() || !selectedWO) return;

    try {
      setSaving(true);
      const existingComments = selectedWO.comments || '';
      const timestamp = new Date().toLocaleString();
      const updatedComments = existingComments 
        ? `${existingComments}\n\n[${timestamp}] ${currentUser.first_name}: ${newComment}`
        : `[${timestamp}] ${currentUser.first_name}: ${newComment}`;

      const { error } = await supabase
        .from('work_orders')
        .update({ comments: updatedComments })
        .eq('wo_id', selectedWO.wo_id);

      if (error) throw error;

      setNewComment('');
      await loadWorkOrders();
      const { data: updated } = await supabase
        .from('work_orders')
        .select('*')
        .eq('wo_id', selectedWO.wo_id)
        .single();
      setSelectedWO(updated);
    } catch (err) {
      alert('Error adding comment: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadTeamMembers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .in('role', ['tech', 'helper', 'lead_tech'])
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setTeamMembers(data || []);
      setShowTeamModal(true);
    } catch (err) {
      alert('Error loading team members: ' + err.message);
    }
  }

  async function handleAddTeamMember(memberId) {
    try {
      setSaving(true);
      
      // Add to work_order_assignments table instead
      const { error } = await supabase
        .from('work_order_assignments')
        .insert({
          wo_id: selectedWO.wo_id,
          user_id: memberId,
          role_on_job: 'helper'
        });

      if (error) throw error;

      await loadWorkOrders();
      await loadTeamForWorkOrder(selectedWO.wo_id);
      setShowTeamModal(false);
    } catch (err) {
      alert('Error adding team member: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadTeamForWorkOrder(woId) {
    if (!woId) {
      console.error('loadTeamForWorkOrder: No work order ID provided');
      setCurrentTeamList([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('work_order_assignments')
        .select(`
          assignment_id,
          user_id,
          role_on_job,
          hours_regular,
          hours_overtime,
          miles,
          user:users(first_name, last_name)
        `)
        .eq('wo_id', woId);
      
      if (error) {
        console.error('Error loading team for work order:', error);
        setCurrentTeamList([]);
        return;
      }
      
      console.log('Team loaded successfully:', data);
      setCurrentTeamList(data || []);
    } catch (err) {
      console.error('Exception in loadTeamForWorkOrder:', err);
      setCurrentTeamList([]);
    }
  }

  async function handleUpdateTeamMemberField(assignmentId, field, value) {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('work_order_assignments')
        .update({ [field]: value })
        .eq('assignment_id', assignmentId);

      if (error) throw error;

      // Refresh team list
      await loadTeamForWorkOrder(selectedWO.wo_id);
    } catch (err) {
      alert('Error updating team member: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function getPriorityColor(priority) {
    const priorityStr = String(priority).toUpperCase();
    
    const colors = {
      'P1': 'text-red-500',
      'P2': 'text-orange-500',
      'P3': 'text-yellow-500',
      'P4': 'text-blue-500',
      'P5': 'text-green-500',
      'P6': 'text-purple-500',
      'P10': 'text-cyan-500',
      'P11': 'text-indigo-500',
      'P23': 'text-pink-500'
    };
    return colors[priorityStr] || 'text-gray-500';
  }

  function getPriorityBadge(priority) {
    const priorityStr = String(priority).toUpperCase();
    
    const badges = {
      'P1': '🔴 P1 - Emergency',
      'P2': '🟠 P2 - Urgent',
      'P3': '🟡 P3 - Urgent (Non-Emerg)',
      'P4': '🔵 P4 - Non-Urgent',
      'P5': '🟢 P5 - Handyman',
      'P6': '🟣 P6 - Tech/Vendor',
      'P10': '🔷 P10 - PM',
      'P11': '💠 P11 - PM Compliance',
      'P23': '💬 P23 - Complaints'
    };
    
    return badges[priorityStr] || `⚪ ${priority || 'Not Set'}`;
  }

  function getStatusBadge(status) {
    const badges = {
      'assigned': '📋 Assigned',
      'in_progress': '⚙️ In Progress',
      'pending': '⏸️ Pending',
      'needs_return': '🔄 Needs Return',
      'return_trip': '↩️ Return Trip',
      'completed': '✅ Completed'
    };
    return badges[status] || status;
  }

  function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function calculateAge(dateEntered) {
    if (!dateEntered) return 0;
    const entered = new Date(dateEntered);
    const now = new Date();
    const diffTime = Math.abs(now - entered);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  function handlePrintWO() {
    if (!selectedWO) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Unable to open print window. Please check your popup settings.');
      return;
    }
    
    const age = calculateAge(selectedWO.date_entered);
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Work Order ${selectedWO.wo_number}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1e40af; }
          .header { border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .label { font-weight: bold; color: #4b5563; }
          .value { margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
          th { background-color: #f3f4f6; }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Work Order: ${selectedWO.wo_number || 'N/A'}</h1>
          <p><strong>Created:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="section">
          <h2>Work Order Details</h2>
          <div class="value"><span class="label">Building:</span> ${selectedWO.building || 'N/A'}</div>
          <div class="value"><span class="label">Priority:</span> ${selectedWO.priority || 'N/A'}</div>
          <div class="value"><span class="label">Status:</span> ${(selectedWO.status || '').replace('_', ' ').toUpperCase()}</div>
          <div class="value"><span class="label">Age:</span> ${age} days</div>
          <div class="value"><span class="label">Date Entered:</span> ${formatDate(selectedWO.date_entered)}</div>
          <div class="value"><span class="label">Requestor:</span> ${selectedWO.requestor || 'N/A'}</div>
          <div class="value"><span class="label">NTE:</span> ${(selectedWO.nte || 0).toFixed(2)}</div>
        </div>
        
        <div class="section">
          <h2>Description</h2>
          <p>${selectedWO.work_order_description || 'N/A'}</p>
        </div>
        
        <div class="section">
          <h2>Team</h2>
          <div class="value"><span class="label">Lead Tech:</span> ${selectedWO.lead_tech?.first_name || ''} ${selectedWO.lead_tech?.last_name || ''}</div>
          ${currentTeamList.map((member, idx) => 
            `<div class="value"><span class="label">Helper ${idx + 1}:</span> ${member.user?.first_name || ''} ${member.user?.last_name || ''}</div>`
          ).join('')}
        </div>
        
        <div class="section">
          <h2>Time & Costs</h2>
          <table>
            <tr>
              <th>Item</th>
              <th>Amount</th>
            </tr>
            <tr>
              <td>Regular Hours</td>
              <td>${selectedWO.hours_regular || 0} hrs</td>
            </tr>
            <tr>
              <td>Overtime Hours</td>
              <td>${selectedWO.hours_overtime || 0} hrs</td>
            </tr>
            <tr>
              <td>Miles</td>
              <td>${selectedWO.miles || 0} mi</td>
            </tr>
            <tr>
              <td>Material Cost</td>
              <td>${(selectedWO.material_cost || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Equipment Cost</td>
              <td>${(selectedWO.emf_equipment_cost || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Trailer Cost</td>
              <td>${(selectedWO.trailer_cost || 0).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Rental Cost</td>
              <td>${(selectedWO.rental_cost || 0).toFixed(2)}</td>
            </tr>
          </table>
        </div>
        
        ${selectedWO.comments ? `
          <div class="section">
            <h2>Comments</h2>
            <p style="white-space: pre-wrap;">${selectedWO.comments}</p>
          </div>
        ` : ''}
        
        <div class="section" style="margin-top: 40px;">
          <p><strong>Signature:</strong> ___________________________ <strong>Date:</strong> _______________</p>
        </div>
        
        <button onclick="window.print()" style="margin-top: 20px; padding: 10px 20px; background: #1e40af; color: white; border: none; cursor: pointer; border-radius: 5px;">
          Print
        </button>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

// NEW: Availability Modal Component
const AvailabilityModal = () => {
  const estNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = estNow.getHours();
  const isAfter8PM = hour >= 20;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border-4 border-yellow-500">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">⏰</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isAfter8PM ? '🚨 AVAILABILITY OVERDUE' : 'Daily Availability'}
          </h2>
          <p className="text-gray-300">
            {isAfter8PM 
              ? 'You must submit your availability to continue using the app!'
              : 'Please submit your availability for tomorrow (Deadline: 8:00 PM EST)'}
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <button
            onClick={() => handleAvailabilityChange('scheduledWork')}
            disabled={notAvailable}
            className={`w-full p-4 rounded-lg border-2 transition ${
              scheduledWork
                ? 'bg-green-600 border-green-400 text-white'
                : notAvailable
                ? 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 border-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                  scheduledWork ? 'bg-green-500 border-green-400' : 'border-gray-400'
                }`}>
                  {scheduledWork && <span className="text-white font-bold">✓</span>}
                </div>
                <div className="text-left">
                  <div className="font-bold">📅 Scheduled Work</div>
                  <div className="text-xs opacity-75">Available for planned jobs</div>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleAvailabilityChange('emergencyWork')}
            disabled={notAvailable}
            className={`w-full p-4 rounded-lg border-2 transition ${
              emergencyWork
                ? 'bg-red-600 border-red-400 text-white'
                : notAvailable
                ? 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 border-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                  emergencyWork ? 'bg-red-500 border-red-400' : 'border-gray-400'
                }`}>
                  {emergencyWork && <span className="text-white font-bold">✓</span>}
                </div>
                <div className="text-left">
                  <div className="font-bold">🚨 Emergency Work</div>
                  <div className="text-xs opacity-75">Available for urgent calls</div>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleAvailabilityChange('notAvailable')}
            className={`w-full p-4 rounded-lg border-2 transition ${
              notAvailable
                ? 'bg-gray-600 border-gray-400 text-white'
                : 'bg-gray-700 border-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                  notAvailable ? 'bg-gray-500 border-gray-400' : 'border-gray-400'
                }`}>
                  {notAvailable && <span className="text-white font-bold">✓</span>}
                </div>
                <div className="text-left">
                  <div className="font-bold">🚫 Not Available</div>
                  <div className="text-xs opacity-75">Cannot work tomorrow</div>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="bg-blue-900 rounded-lg p-3 mb-4 text-sm text-blue-200">
          <p className="font-semibold mb-1">ℹ️ Selection Rules:</p>
          <ul className="text-xs space-y-1 ml-4">
            <li>• Select Scheduled, Emergency, or both</li>
            <li>• OR select Not Available</li>
            <li>• Cannot combine work options with Not Available</li>
          </ul>
        </div>

        <button
          onClick={handleAvailabilitySubmit}
          disabled={saving || (!scheduledWork && !emergencyWork && !notAvailable)}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-4 rounded-lg font-bold text-lg text-white transition"
        >
          {saving ? 'Submitting...' : '✅ Submit Availability'}
        </button>

        {isAfter8PM && (
          <div className="mt-4 bg-red-900 rounded-lg p-3 text-center">
            <p className="text-red-200 text-sm font-bold">
              ⚠️ App is locked until you submit
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-white w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg p-3">
              <img 
                src="/emf-logo.png" 
                alt="EMF Contracting LLC" 
                className="w-full h-full object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">EMF Contracting LLC</h1>
            <p className="text-gray-300">Field Service Mobile</p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Login</h2>
            <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-4 text-lg text-gray-900 bg-white border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  autoFocus
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength="4"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="4-digit PIN"
                  className="w-full px-4 py-4 text-lg text-gray-900 bg-white border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                  required
                />
              </div>
              {error && <p className="text-red-500 mb-4">{error}</p>}
              <button
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-xl text-lg font-bold hover:bg-blue-700 transition active:scale-95"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }
  if (showAvailabilityModal && (availabilityBlocked || !hasSubmittedToday)) {
    return <AvailabilityModal />;
  }
  if (selectedWO) {
    try {
      console.log('Rendering selectedWO view:', selectedWO);
      
      // Safely access properties with fallbacks
      const wo = selectedWO || {};
      const woNumber = wo.wo_number || 'Unknown';
      const building = wo.building || 'Unknown Location';
      const description = wo.work_order_description || 'No description';
      const status = wo.status || 'assigned';
      const nte = wo.nte || 0;
      const dateEntered = wo.date_entered;
      const requestor = wo.requestor || 'N/A';
      const leadTech = wo.lead_tech || {};
      
     // Calculate team totals for display
const primaryRT = parseFloat(wo.hours_regular) || 0;
const primaryOT = parseFloat(wo.hours_overtime) || 0;
const primaryMiles = parseFloat(wo.miles) || 0;

let teamRT = 0;
let teamOT = 0;
let teamMiles = 0;

if (currentTeamList && Array.isArray(currentTeamList)) {
  currentTeamList.forEach(member => {
    if (member) {
      teamRT += parseFloat(member.hours_regular) || 0;
      teamOT += parseFloat(member.hours_overtime) || 0;
      teamMiles += parseFloat(member.miles) || 0;
    }
  });
}

const totalRT = primaryRT + teamRT;
const totalOT = primaryOT + teamOT;
const totalMiles = primaryMiles + teamMiles;
const adminHours = 2;

const laborCost = (totalRT * 64) + (totalOT * 96) + (adminHours * 64);
const materialBase = parseFloat(wo.material_cost) || 0;
const materialWithMarkup = materialBase * 1.25;
const equipmentBase = parseFloat(wo.emf_equipment_cost) || 0;
const equipmentWithMarkup = equipmentBase * 1.25; // 25% markup (CHANGED from 1.15)
const trailerBase = parseFloat(wo.trailer_cost) || 0;
const trailerWithMarkup = trailerBase * 1.25; // 25% markup (NEW)
const rentalBase = parseFloat(wo.rental_cost) || 0;
const rentalWithMarkup = rentalBase * 1.25; // 25% markup (CHANGED from 1.15)
const mileageCost = totalMiles * 1.00;
const grandTotal = laborCost + materialWithMarkup + equipmentWithMarkup + trailerWithMarkup + rentalWithMarkup + mileageCost;
const remaining = nte - grandTotal;

      return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <button
                onClick={() => {
                  console.log('Going back to list');
                  setSelectedWO(null);
                  // If viewing a completed WO, stay on completed page
                  if (status === 'completed') {
                    setShowCompletedPage(true);
                  }
                }}
                className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
              >
                ← Back
              </button>
              <h1 className="text-xl font-bold">{woNumber}</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowChangePinModal(true)}
                  className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm"
                >
                  🔒
                </button>
                <button
                  onClick={handleLogout}
                  className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
                >
                  Logout
                </button>
              </div>
            </div>

          <div className="space-y-4">
            {/* Work Order Details */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3 text-blue-400">Work Order Details</h3>
              
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-gray-400">Building:</span>
                  <p className="font-semibold">{building}</p>
                </div>
                
                <div>
                  <span className="text-gray-400">Requestor:</span>
                  <p className="font-semibold">{requestor}</p>
                </div>
                
                <div>
                  <span className="text-gray-400">Description:</span>
                  <p className="text-gray-300">{description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-700">
                  <div>
                    <span className="text-gray-400">Date Entered:</span>
                    <p className="font-semibold">{formatDate(dateEntered)}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Age:</span>
                    <p className="font-semibold text-orange-500">{calculateAge(dateEntered)} days</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                  <span className="text-gray-400">NTE (Not to Exceed):</span>
                  <span className="text-green-500 font-bold text-lg">${nte.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Quick Actions</h3>
              <button
                onClick={handlePrintWO}
                className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-semibold"
              >
                🖨️ Print WO
              </button>
            </div>

            {/* Check In/Out - Always Available */}
            {status !== 'completed' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleCheckIn(wo.wo_id)}
                    disabled={saving}
                    className="bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition active:scale-95 disabled:bg-gray-600"
                  >
                    ✓ CHECK IN
                  </button>
                  <button
                    onClick={() => handleCheckOut(wo.wo_id)}
                    disabled={saving}
                    className="bg-orange-600 hover:bg-orange-700 py-4 rounded-lg font-bold text-lg transition active:scale-95 disabled:bg-gray-600"
                  >
                    ⏸ CHECK OUT
                  </button>
                </div>
                
                {/* Check-in/out History Indicator */}
                {wo.time_in && (
                  <div className="bg-gray-800 rounded-lg p-3 text-center text-sm">
                    <p className="text-gray-400">
                      First Check-In: {formatDate(wo.time_in)}
                      {wo.time_out && (
                        <> • First Check-Out: {formatDate(wo.time_out)}</>
                      )}
                    </p>
                    <p className="text-blue-400 text-xs mt-1">
                      See Comments below for full check-in/out history
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Primary Assignment */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Primary Assignment</h3>
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="font-semibold">
                  {leadTech.first_name || 'Unknown'} {leadTech.last_name || ''}
                </p>
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">Team Members</h3>
                {status !== 'completed' && (
                  <button
                    onClick={loadTeamMembers}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-semibold"
                  >
                    + Add Helper/Tech
                  </button>
                )}
              </div>
              {currentTeamList.length > 0 ? (
                <div className="space-y-4">
                  {currentTeamList.map((member) => (
                    <div key={member.assignment_id} className="bg-gray-700 rounded-lg p-3">
                      <p className="font-semibold mb-3">
                        {member.user?.first_name || 'Unknown'} {member.user?.last_name || ''}
                      </p>
                      
                      {/* Team Member Fields */}
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">RT (hrs)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={member.hours_regular || ''}
                            onChange={(e) => handleUpdateTeamMemberField(member.assignment_id, 'hours_regular', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 bg-gray-600 rounded text-white text-sm"
                            disabled={saving || status === 'completed'}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">OT (hrs)</label>
                          <input
                            type="number"
                            step="0.5"
                            value={member.hours_overtime || ''}
                            onChange={(e) => handleUpdateTeamMemberField(member.assignment_id, 'hours_overtime', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 bg-gray-600 rounded text-white text-sm"
                            disabled={saving || status === 'completed'}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Miles</label>
                          <input
                            type="number"
                            step="0.1"
                            value={member.miles || ''}
                            onChange={(e) => handleUpdateTeamMemberField(member.assignment_id, 'miles', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 bg-gray-600 rounded text-white text-sm"
                            disabled={saving || status === 'completed'}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 text-sm text-center py-2">No additional team members yet</p>
              )}
            </div>

            {/* Update Status */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Update Status</h3>
              <select
                value={status}
                onChange={(e) => handleUpdateField(wo.wo_id, 'status', e.target.value)}
                disabled={saving || status === 'completed'}
                className="w-full px-4 py-3 bg-blue-600 rounded-lg text-white font-semibold text-center"
              >
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="pending">Pending</option>
                <option value="needs_return">Needs Return</option>
                <option value="return_trip">Return Trip</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Primary Tech Field Data */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">Primary Tech Field Data</h3>
                <button
                  onClick={() => {
                    // Save all fields at once
                    Object.keys(editingField).forEach(field => {
                      handleUpdateField(wo.wo_id, field, parseFloat(editingField[field]) || 0);
                    });
                  }}
                  disabled={saving || Object.keys(editingField).length === 0}
                  className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-semibold disabled:bg-gray-600"
                >
                  💾 Save Changes
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Regular Hours (RT)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={getFieldValue('hours_regular')}
                    onChange={(e) => handleFieldChange('hours_regular', e.target.value)}
                    onBlur={(e) => handleUpdateField(wo.wo_id, 'hours_regular', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || status === 'completed'}
                    placeholder="0 hrs @ $64/hr"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Overtime Hours (OT)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={getFieldValue('hours_overtime')}
                    onChange={(e) => handleFieldChange('hours_overtime', e.target.value)}
                    onBlur={(e) => handleUpdateField(wo.wo_id, 'hours_overtime', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || status === 'completed'}
                    placeholder="0 hrs @ $96/hr"
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Miles</label>
                  <input
                    type="number"
                    step="0.1"
                    value={getFieldValue('miles')}
                    onChange={(e) => handleFieldChange('miles', e.target.value)}
                    onBlur={(e) => handleUpdateField(wo.wo_id, 'miles', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || status === 'completed'}
                    placeholder="0 mi @ $1/mi"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Material Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={getFieldValue('material_cost')}
                    onChange={(e) => handleFieldChange('material_cost', e.target.value)}
                    onBlur={(e) => handleUpdateField(wo.wo_id, 'material_cost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || status === 'completed'}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">EMF Equipment ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={getFieldValue('emf_equipment_cost')}
                    onChange={(e) => handleFieldChange('emf_equipment_cost', e.target.value)}
                    onBlur={(e) => handleUpdateField(wo.wo_id, 'emf_equipment_cost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || status === 'completed'}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Trailer Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={getFieldValue('trailer_cost')}
                    onChange={(e) => handleFieldChange('trailer_cost', e.target.value)}
                    onBlur={(e) => handleUpdateField(wo.wo_id, 'trailer_cost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || status === 'completed'}
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Rental Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={getFieldValue('rental_cost')}
                    onChange={(e) => handleFieldChange('rental_cost', e.target.value)}
                    onBlur={(e) => handleUpdateField(wo.wo_id, 'rental_cost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || status === 'completed'}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            {/* Email Photos Section */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">📸 Send Photos</h3>
              <p className="text-sm text-gray-400 mb-3">
                Take photos and email them for this work order
              </p>
              <button
                onClick={() => {
                  const subject = encodeURIComponent(`Photos - ${woNumber} - ${building}`);
                  const body = encodeURIComponent(
                    `Work Order: ${woNumber}\n` +
                    `Building: ${building}\n` +
                    `Description: ${description}\n` +
                    `Status: ${status.replace('_', ' ').toUpperCase()}\n` +
                    `Submitted by: ${currentUser.first_name} ${currentUser.last_name}\n` +
                    `Date: ${new Date().toLocaleString()}\n\n` +
                    `--- Attach photos below ---`
                  );
                  const mailtoLink = `mailto:emfcbre@gmail.com?subject=${subject}&body=${body}`;
                  window.location.href = mailtoLink;
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 py-4 rounded-lg font-bold text-lg shadow-lg transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span className="text-2xl">📸</span>
                <span>Email Photos to Office</span>
              </button>
            </div>

            {/* Cost Summary Section */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3 text-blue-400">💰 Cost Summary</h3>
              
              {/* Labor Costs */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">TEAM RT Hours (Primary + Helpers)</span>
                  <span>{totalRT.toFixed(2)} hrs × $64</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">TEAM OT Hours (Primary + Helpers)</span>
                  <span>{totalOT.toFixed(2)} hrs × $96</span>
                </div>
                <div className="flex justify-between text-sm text-yellow-400">
                  <span>+ Admin Hours</span>
                  <span>2 hrs × $64 = $128.00</span>
                </div>
                <div className="flex justify-between font-bold border-t border-gray-700 pt-2">
                  <span>Total Labor:</span>
                  <span className="text-green-500">
                    ${laborCost.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-600 my-4"></div>

              {/* Materials */}
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Materials:</span>
                <span>${materialBase.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-yellow-400 mb-3">
                <span className="ml-4">+ 25% Markup:</span>
                <span>+ ${(materialBase * 0.25).toFixed(2)}</span>
              </div>

              {/* Equipment */}
              {/* Equipment */}
<div className="flex justify-between text-sm mb-2">
  <span className="text-gray-400">Equipment:</span>
  <span>${equipmentBase.toFixed(2)}</span>
</div>
<div className="flex justify-between text-sm text-yellow-400 mb-3">
  <span className="ml-4">+ 25% Markup:</span>
  <span>+ ${(equipmentBase * 0.25).toFixed(2)}</span>
</div>

              {/* Trailer */}
              {/* Trailer */}
<div className="flex justify-between text-sm mb-2">
  <span className="text-gray-400">Trailer:</span>
  <span>${(parseFloat(wo.trailer_cost) || 0).toFixed(2)}</span>
</div>
<div className="flex justify-between text-sm text-yellow-400 mb-3">
  <span className="ml-4">+ 25% Markup:</span>
  <span>+ ${((parseFloat(wo.trailer_cost) || 0) * 0.25).toFixed(2)}</span>
</div>

              {/* Rental */}
              {/* Rental */}
<div className="flex justify-between text-sm mb-2">
  <span className="text-gray-400">Rental:</span>
  <span>${rentalBase.toFixed(2)}</span>
</div>
<div className="flex justify-between text-sm text-yellow-400 mb-3">
  <span className="ml-4">+ 25% Markup:</span>
  <span>+ ${(rentalBase * 0.25).toFixed(2)}</span>
</div>

              {/* Mileage */}
              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-400">Total Mileage (All Team):</span>
                <span>{totalMiles.toFixed(1)} mi × $1.00 = ${mileageCost.toFixed(2)}</span>
              </div>

              {/* Budget */}
              <div className="border-t-2 border-gray-700 pt-3">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">NTE Budget:</span>
                  <span>${nte.toFixed(2)}</span>
                </div>
                
                <div className={`flex justify-between font-bold text-lg ${remaining >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  <span>Remaining:</span>
                  <span>${remaining.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Time Tracking - Team Totals */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">⏱️ Time Tracking (All Team)</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-blue-400">
                    {totalRT.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">RT Hours</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-400">
                    {totalOT.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">OT Hours</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-400">
                    {totalMiles.toFixed(0)}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">Miles</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Comments & Notes</h3>
              <p className="text-xs text-gray-400 mb-2">
                📝 Includes check-in/out history and team notes
              </p>
              <div className="mb-3 max-h-40 overflow-y-auto bg-gray-700 rounded-lg p-3">
                {wo.comments ? (
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                    {wo.comments}
                  </pre>
                ) : (
                  <p className="text-gray-500 text-sm">No comments yet</p>
                )}
              </div>
              {status !== 'completed' && (
                <>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg mb-2 text-sm text-white"
                    rows="3"
                    disabled={saving}
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={saving || !newComment.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-semibold disabled:bg-gray-600"
                  >
                    Add Comment
                  </button>
                </>
              )}
            </div>

            {wo.time_out && status !== 'completed' && (
              <button
                onClick={() => handleCompleteWorkOrder()}
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition active:scale-95"
              >
                ✅ Complete Work Order
              </button>
            )}
          </div>
        </div>

        {showTeamModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Add Helper</h3>
                <button
                  onClick={() => setShowTeamModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-2">
                {teamMembers.map(member => (
                  <button
                    key={member.user_id}
                    onClick={() => handleAddTeamMember(member.user_id)}
                    disabled={saving}
                    className="w-full bg-gray-700 hover:bg-gray-600 p-3 rounded-lg text-left transition"
                  >
                    {member.first_name} {member.last_name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Change PIN Modal */}
        {showChangePinModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Change PIN</h3>
                <button
                  onClick={() => {
                    setShowChangePinModal(false);
                    setNewPin('');
                    setConfirmPin('');
                  }}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">New PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength="4"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="4-digit PIN"
                    className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength="4"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="Re-enter PIN"
                    className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={handleChangePin}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold transition active:scale-95 disabled:bg-gray-600"
                >
                  {saving ? 'Changing...' : 'Change PIN'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
    } catch (err) {
      console.error('Error rendering work order detail:', err);
      return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
          <div className="max-w-2xl mx-auto">
            <div className="bg-red-900 rounded-lg p-6 text-center">
              <h2 className="text-xl font-bold mb-4">Error Loading Work Order</h2>
              <p className="mb-4">There was an error displaying the work order details.</p>
              <p className="text-sm text-gray-300 mb-6">Error: {err.message || 'Unknown error'}</p>
              <button
                onClick={() => {
                  console.log('Resetting selectedWO after error');
                  setSelectedWO(null);
                  setCurrentTeamList([]);
                }}
                className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
              >
                Back to List
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  if (showCompletedPage) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setShowCompletedPage(false)}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            >
              ← Back
            </button>
            <h1 className="text-2xl font-bold">Completed Work Orders</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowChangePinModal(true)}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm"
              >
                🔒
              </button>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {completedWorkOrders.length === 0 ? (
              <div className="bg-gray-800 rounded-lg p-8 text-center">
                <p className="text-gray-400">No completed work orders</p>
              </div>
            ) : (
              <>
                <div className="bg-blue-900 rounded-lg p-3 mb-4 text-center">
                  <p className="text-sm text-blue-200">
                    👆 Tap any completed work order to view details
                  </p>
                </div>
                {completedWorkOrders.map(wo => (
                  <div
                    key={wo.wo_id}
                    onClick={() => setSelectedWO(wo)}
                    className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold text-lg">{wo.wo_number}</span>
                        <span className={`ml-2 text-sm ${getPriorityColor(wo.priority)}`}>
                          {getPriorityBadge(wo.priority)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-green-500 text-sm">✅ Completed</span>
                        <span className="text-blue-400 text-lg">📊</span>
                      </div>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <p className="font-semibold">{wo.building}</p>
                      <p className="text-gray-400">{wo.work_order_description}</p>
                      <p className="text-orange-500 text-xs">{calculateAge(wo.date_entered)} days old</p>
                      <p className="text-gray-500">Completed: {formatDate(wo.date_completed)}</p>
                      {wo.lead_tech && (
                        <p className="text-gray-500">Tech: {wo.lead_tech.first_name} {wo.lead_tech.last_name}</p>
                      )}
                    </div>

                    {wo.hours_regular || wo.hours_overtime ? (
                      <div className="mt-2 text-xs text-gray-400">
                        Hours: RT {wo.hours_regular || 0} / OT {wo.hours_overtime || 0} | Miles: {wo.miles || 0}
                      </div>
                    ) : null}
                    
                    {/* Tap to View Indicator */}
                    <div className="mt-3 pt-3 border-t border-gray-700 text-center">
                      <p className="text-xs text-blue-400 font-semibold">
                        👆 Tap to View Details
                      </p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Change PIN Modal */}
          {showChangePinModal && (
            <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
              <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Change PIN</h3>
                  <button
                    onClick={() => {
                      setShowChangePinModal(false);
                      setNewPin('');
                      setConfirmPin('');
                    }}
                    className="text-gray-400 hover:text-white text-2xl"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">New PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength="4"
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      placeholder="4-digit PIN"
                      className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Confirm PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength="4"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="Re-enter PIN"
                      className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <button
                    onClick={handleChangePin}
                    disabled={saving}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold transition active:scale-95 disabled:bg-gray-600"
                  >
                    {saving ? 'Changing...' : 'Change PIN'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <img 
              src="/emf-logo.png" 
              alt="EMF Contracting LLC" 
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-lg font-bold">👋 {currentUser.first_name}</h1>
              <p className="text-xs text-gray-400">{currentUser.role.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCompletedPage(true)}
              className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-semibold"
            >
              ✅ Completed
            </button>
            <button
              onClick={() => setShowChangePinModal(true)}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-semibold"
            >
              🔒 PIN
            </button>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">My Work Orders</h2>
          <p className="text-gray-400">
            {workOrders.length} active work {workOrders.length === 1 ? 'order' : 'orders'}
          </p>
        </div>

        <div className="space-y-4">
          {workOrders.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg">No active work orders</p>
              <p className="text-gray-500 text-sm mt-2">Check back later for new assignments</p>
            </div>
          ) : (
            workOrders.map(wo => (
              <div
                key={wo.wo_id}
                onClick={() => {
                  try {
                    console.log('Setting selected work order:', wo);
                    setSelectedWO(wo);
                  } catch (err) {
                    console.error('Error setting work order:', err);
                    alert('Error opening work order. Please try again.');
                  }
                }}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer active:scale-98"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold text-lg">{wo.wo_number}</span>
                    <span className={`ml-2 text-sm ${getPriorityColor(wo.priority)}`}>
                      {getPriorityBadge(wo.priority)}
                    </span>
                  </div>
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded-full">
                    {getStatusBadge(wo.status)}
                  </span>
                </div>
                
                <h3 className="font-semibold mb-1">{wo.building}</h3>
                <p className="text-sm text-gray-400 mb-2">{wo.work_order_description}</p>
                
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <div>
                    <span>Entered: {formatDate(wo.date_entered)}</span>
                    <span className="ml-2 text-orange-500 font-semibold">
                      {calculateAge(wo.date_entered)} days old
                    </span>
                  </div>
                  <span className="text-green-500 font-bold">NTE: ${(wo.nte || 0).toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Change PIN Modal */}
        {showChangePinModal && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Change PIN</h3>
                <button
                  onClick={() => {
                    setShowChangePinModal(false);
                    setNewPin('');
                    setConfirmPin('');
                  }}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">New PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength="4"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="4-digit PIN"
                    className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength="4"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="Re-enter PIN"
                    className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={handleChangePin}
                  disabled={saving}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold transition active:scale-95 disabled:bg-gray-600"
                >
                  {saving ? 'Changing...' : 'Change PIN'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}