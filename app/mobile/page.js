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

  const supabase = createClientComponentClient();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadWorkOrders();
      loadCompletedWorkOrders();
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
      };
    }
  }, [currentUser]);

  // Load team members when work order is selected
  useEffect(() => {
    if (selectedWO) {
      loadTeamForWorkOrder(selectedWO.wo_id);
      setEditingField({}); // Clear editing state when work order changes
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
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('work_orders')
        .update({
          time_in: now,
          status: 'in_progress'
        })
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
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('work_orders')
        .update({
          time_out: now
        })
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

  async function handleCompleteWorkOrder() {
    if (!selectedWO) return;

    if (!confirm('Mark this work order as completed?')) return;

    try {
      setSaving(true);
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('work_orders')
        .update({
          status: 'completed',
          date_completed: now,
          time_out: selectedWO.time_out || now
        })
        .eq('wo_id', selectedWO.wo_id);

      if (error) throw error;

      await loadWorkOrders();
      await loadCompletedWorkOrders();
      setSelectedWO(null);
      alert('Work order completed successfully!');
    } catch (err) {
      alert('Error completing work order: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function loadTeamMembers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'tech')
        .neq('user_id', currentUser.user_id)
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
    const { data } = await supabase
      .from('work_order_assignments')
      .select(`
        user_id,
        role_on_job,
        user:users(first_name, last_name)
      `)
      .eq('wo_id', woId);
    
    setCurrentTeamList(data || []);
  }

  function getPriorityColor(priority) {
    switch(priority) {
      case 1: return 'text-red-500';
      case 2: return 'text-orange-500';
      case 3: return 'text-yellow-500';
      case 4: return 'text-blue-500';
      default: return 'text-gray-500';
    }
  }

  function getPriorityBadge(priority) {
    const badges = {
      1: '🔴 Emergency',
      2: '🟠 Urgent',
      3: '🟡 Normal',
      4: '🔵 Low'
    };
    return badges[priority] || '⚪ Unknown';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

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
                🔐
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
              completedWorkOrders.map(wo => (
                <div
                  key={wo.wo_id}
                  className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold text-lg">{wo.wo_number}</span>
                      <span className={`ml-2 text-sm ${getPriorityColor(wo.priority)}`}>
                        {getPriorityBadge(wo.priority)}
                      </span>
                    </div>
                    <span className="text-green-500 text-sm">✅ Completed</span>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <p className="font-semibold">{wo.building}</p>
                    <p className="text-gray-400">{wo.work_order_description}</p>
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

  if (selectedWO) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setSelectedWO(null)}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            >
              ← Back to List
            </button>
            <h1 className="text-xl font-bold">{selectedWO.wo_number}</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setShowChangePinModal(true)}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm"
              >
                🔐
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
                  <p className="font-semibold">{selectedWO.building}</p>
                </div>
                
                <div>
                  <span className="text-gray-400">Requestor:</span>
                  <p className="font-semibold">{selectedWO.requestor || 'N/A'}</p>
                </div>
                
                <div>
                  <span className="text-gray-400">Other Plant Equip-Mechanic:</span>
                  <p className="text-gray-300">{selectedWO.work_order_description}</p>
                </div>
                
                <div className="flex justify-between items-center pt-2 border-t border-gray-700">
                  <span className="text-gray-400">NTE (Not to Exceed):</span>
                  <span className="text-green-500 font-bold text-lg">${(selectedWO.nte || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Quick Actions</h3>
              <button
                onClick={() => alert('Print WO feature coming soon')}
                className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-semibold"
              >
                Print WO
              </button>
            </div>

            {/* Check In/Out */}
            {!selectedWO.time_in ? (
              <button
                onClick={() => handleCheckIn(selectedWO.wo_id)}
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition active:scale-95"
              >
                ✓ CHECK IN
              </button>
            ) : !selectedWO.time_out ? (
              <button
                onClick={() => handleCheckOut(selectedWO.wo_id)}
                disabled={saving}
                className="w-full bg-orange-600 hover:bg-orange-700 py-4 rounded-lg font-bold text-lg transition active:scale-95"
              >
                Check Out
              </button>
            ) : (
              <div className="bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-green-500 font-bold">✅ Checked Out</p>
                <p className="text-sm text-gray-400 mt-2">
                  In: {formatDate(selectedWO.time_in)}
                </p>
                <p className="text-sm text-gray-400">
                  Out: {formatDate(selectedWO.time_out)}
                </p>
              </div>
            )}

            {/* Primary Assignment */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Primary Assignment</h3>
              <div className="bg-gray-700 rounded-lg p-3">
                <p className="font-semibold">
                  {selectedWO.lead_tech?.first_name} {selectedWO.lead_tech?.last_name}
                </p>
              </div>
            </div>

            {/* Team Members */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold">Team Members</h3>
                {selectedWO.status !== 'completed' && (
                  <button
                    onClick={loadTeamMembers}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-semibold"
                  >
                    + Add Helper/Tech
                  </button>
                )}
              </div>
              {currentTeamList.length > 0 ? (
                <div className="space-y-2">
                  {currentTeamList.map((member, idx) => (
                    <div key={member.user_id} className="bg-gray-700 rounded-lg p-3">
                      <p className="font-semibold">
                        {member.user?.first_name} {member.user?.last_name}
                      </p>
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
                value={selectedWO.status}
                onChange={(e) => handleUpdateField(selectedWO.wo_id, 'status', e.target.value)}
                disabled={saving || selectedWO.status === 'completed'}
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
                      handleUpdateField(selectedWO.wo_id, field, parseFloat(editingField[field]) || 0);
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
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'hours_regular', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || selectedWO.status === 'completed'}
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
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'hours_overtime', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || selectedWO.status === 'completed'}
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
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'miles', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || selectedWO.status === 'completed'}
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
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'material_cost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || selectedWO.status === 'completed'}
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
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'emf_equipment_cost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || selectedWO.status === 'completed'}
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
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'trailer_cost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || selectedWO.status === 'completed'}
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
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'rental_cost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white text-sm"
                    disabled={saving || selectedWO.status === 'completed'}
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
                  const subject = encodeURIComponent(`Photos - ${selectedWO.wo_number} - ${selectedWO.building}`);
                  const body = encodeURIComponent(
                    `Work Order: ${selectedWO.wo_number}\n` +
                    `Building: ${selectedWO.building}\n` +
                    `Description: ${selectedWO.work_order_description}\n` +
                    `Status: ${selectedWO.status.replace('_', ' ').toUpperCase()}\n` +
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
              <h3 className="font-bold mb-3 text-blue-400">LABOR (with 2 Admin Hours)</h3>
              
              {/* Labor Costs */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total RT Hours</span>
                  <span>{parseFloat(getFieldValue('hours_regular')) || 0} hrs × $64</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total OT Hours</span>
                  <span>{parseFloat(getFieldValue('hours_overtime')) || 0} hrs × $96</span>
                </div>
                <div className="flex justify-between text-sm text-yellow-400">
                  <span>+ Admin Hours</span>
                  <span>2 hrs × $64 = $128.00</span>
                </div>
                <div className="flex justify-between font-bold border-t border-gray-700 pt-2">
                  <span>Total Labor:</span>
                  <span className="text-green-500">
                    ${(((parseFloat(getFieldValue('hours_regular')) || 0) * 64) + ((parseFloat(getFieldValue('hours_overtime')) || 0) * 96) + 128).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="border-t border-gray-600 my-4"></div>

              {/* Materials */}
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Materials:</span>
                <span>${(parseFloat(getFieldValue('material_cost')) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-yellow-400 mb-3">
                <span className="ml-4">+ 25% Markup:</span>
                <span>+ ${((parseFloat(getFieldValue('material_cost')) || 0) * 0.25).toFixed(2)}</span>
              </div>

              {/* Equipment */}
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Equipment:</span>
                <span>${(parseFloat(getFieldValue('emf_equipment_cost')) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-yellow-400 mb-3">
                <span className="ml-4">+ 15% Markup:</span>
                <span>+ ${((parseFloat(getFieldValue('emf_equipment_cost')) || 0) * 0.15).toFixed(2)}</span>
              </div>

              {/* Trailer */}
              <div className="flex justify-between text-sm mb-3">
                <span className="text-gray-400">Trailer:</span>
                <div className="flex gap-4">
                  <span>${(parseFloat(getFieldValue('trailer_cost')) || 0).toFixed(2)}</span>
                  <span className="text-gray-500">No Markup</span>
                </div>
              </div>

              {/* Rental */}
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Rental:</span>
                <span>${(parseFloat(getFieldValue('rental_cost')) || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-yellow-400 mb-3">
                <span className="ml-4">+ 15% Markup:</span>
                <span>+ ${((parseFloat(getFieldValue('rental_cost')) || 0) * 0.15).toFixed(2)}</span>
              </div>

              {/* Mileage */}
              <div className="flex justify-between text-sm mb-4">
                <span className="text-gray-400">Total Mileage:</span>
                <span>{parseFloat(getFieldValue('miles')) || 0} mi × $1.00 = ${((parseFloat(getFieldValue('miles')) || 0) * 1.00).toFixed(2)}</span>
              </div>

              {/* Budget */}
              <div className="border-t-2 border-gray-700 pt-3">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-400">NTE Budget:</span>
                  <span>${(selectedWO.nte || 0).toFixed(2)}</span>
                </div>
                
                <div className={`flex justify-between font-bold text-lg ${
                  (
                    (((parseFloat(getFieldValue('hours_regular')) || 0) * 64) + ((parseFloat(getFieldValue('hours_overtime')) || 0) * 96) + 128) +
                    ((parseFloat(getFieldValue('material_cost')) || 0) * 1.25) +
                    ((parseFloat(getFieldValue('emf_equipment_cost')) || 0) * 1.15) +
                    (parseFloat(getFieldValue('trailer_cost')) || 0) +
                    ((parseFloat(getFieldValue('rental_cost')) || 0) * 1.15) +
                    ((parseFloat(getFieldValue('miles')) || 0) * 1.00)
                  ) > (selectedWO.nte || 0) ? 'text-red-500' : 'text-green-500'
                }`}>
                  <span>Remaining:</span>
                  <span>
                    ${(
                      (selectedWO.nte || 0) - (
                        (((parseFloat(getFieldValue('hours_regular')) || 0) * 64) + ((parseFloat(getFieldValue('hours_overtime')) || 0) * 96) + 128) +
                        ((parseFloat(getFieldValue('material_cost')) || 0) * 1.25) +
                        ((parseFloat(getFieldValue('emf_equipment_cost')) || 0) * 1.15) +
                        (parseFloat(getFieldValue('trailer_cost')) || 0) +
                        ((parseFloat(getFieldValue('rental_cost')) || 0) * 1.15) +
                        ((parseFloat(getFieldValue('miles')) || 0) * 1.00)
                      )
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Field Data</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Regular Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={getFieldValue('hours_regular')}
                    onChange={(e) => handleFieldChange('hours_regular', e.target.value)}
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'hours_regular', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                    disabled={saving || selectedWO.status === 'completed'}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Overtime Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={getFieldValue('hours_overtime')}
                    onChange={(e) => handleFieldChange('hours_overtime', e.target.value)}
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'hours_overtime', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                    disabled={saving || selectedWO.status === 'completed'}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Miles</label>
                  <input
                    type="number"
                    step="0.1"
                    value={getFieldValue('miles')}
                    onChange={(e) => handleFieldChange('miles', e.target.value)}
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'miles', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                    disabled={saving || selectedWO.status === 'completed'}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Material Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={getFieldValue('material_cost')}
                    onChange={(e) => handleFieldChange('material_cost', e.target.value)}
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'material_cost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                    disabled={saving || selectedWO.status === 'completed'}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Trailer Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={getFieldValue('trailer_cost')}
                    onChange={(e) => handleFieldChange('trailer_cost', e.target.value)}
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'trailer_cost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                    disabled={saving || selectedWO.status === 'completed'}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">EMF Equipment Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={getFieldValue('emf_equipment_cost')}
                    onChange={(e) => handleFieldChange('emf_equipment_cost', e.target.value)}
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'emf_equipment_cost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                    disabled={saving || selectedWO.status === 'completed'}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rental Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={getFieldValue('rental_cost')}
                    onChange={(e) => handleFieldChange('rental_cost', e.target.value)}
                    onBlur={(e) => handleUpdateField(selectedWO.wo_id, 'rental_cost', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                    disabled={saving || selectedWO.status === 'completed'}
                  />
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Comments & Notes</h3>
              <div className="mb-3 max-h-40 overflow-y-auto bg-gray-700 rounded-lg p-3">
                {selectedWO.comments ? (
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
                    {selectedWO.comments}
                  </pre>
                ) : (
                  <p className="text-gray-500 text-sm">No comments yet</p>
                )}
              </div>
              {selectedWO.status !== 'completed' && (
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

            {selectedWO.time_out && selectedWO.status !== 'completed' && (
              <button
                onClick={handleCompleteWorkOrder}
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
              🔐 PIN
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
                onClick={() => setSelectedWO(wo)}
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
                <p className="text-sm text-gray-400 mb-3">{wo.work_order_description}</p>
                
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Entered: {formatDate(wo.date_entered)}</span>
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