'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function MobilePage() {
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [teamMembers, setTeamMembers] = useState([]);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [showCompletedPage, setShowCompletedPage] = useState(false);
  const [completedWorkOrders, setCompletedWorkOrders] = useState([]);

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

  async function checkAuth() {
    const savedPin = localStorage.getItem('mobilePin');
    if (savedPin) {
      await loginWithPin(savedPin);
    }
    setLoading(false);
  }

  async function loginWithPin(pinValue) {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('pin', pinValue)
        .single();

      if (error || !users) {
        setError('Invalid PIN');
        localStorage.removeItem('mobilePin');
        return;
      }

      setCurrentUser(users);
      localStorage.setItem('mobilePin', pinValue);
      setError('');
    } catch (err) {
      setError('Login failed');
      localStorage.removeItem('mobilePin');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    await loginWithPin(pin);
  }

  function handleLogout() {
    localStorage.removeItem('mobilePin');
    setCurrentUser(null);
    setPin('');
    setSelectedWO(null);
  }

  async function loadWorkOrders() {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name),
          helper1:users!work_orders_helper1_id_fkey(first_name, last_name),
          helper2:users!work_orders_helper2_id_fkey(first_name, last_name),
          helper3:users!work_orders_helper3_id_fkey(first_name, last_name),
          helper4:users!work_orders_helper4_id_fkey(first_name, last_name)
        `)
        .or(`lead_tech_id.eq.${currentUser.user_id},helper1_id.eq.${currentUser.user_id},helper2_id.eq.${currentUser.user_id},helper3_id.eq.${currentUser.user_id},helper4_id.eq.${currentUser.user_id}`)
        .in('status', ['assigned', 'in_progress', 'pending'])
        .order('priority', { ascending: true })
        .order('date_entered', { ascending: true });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (err) {
      console.error('Error loading work orders:', err);
    }
  }

  async function loadCompletedWorkOrders() {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .or(`lead_tech_id.eq.${currentUser.user_id},helper1_id.eq.${currentUser.user_id},helper2_id.eq.${currentUser.user_id},helper3_id.eq.${currentUser.user_id},helper4_id.eq.${currentUser.user_id}`)
        .eq('status', 'completed')
        .order('date_completed', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCompletedWorkOrders(data || []);
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
      alert('Error updating: ' + err.message);
    } finally {
      setSaving(false);
    }
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

  async function handleAddTeamMember(memberId, helperSlot) {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('work_orders')
        .update({ [helperSlot]: memberId })
        .eq('wo_id', selectedWO.wo_id);

      if (error) throw error;

      await loadWorkOrders();
      const { data: updated } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name),
          helper1:users!work_orders_helper1_id_fkey(first_name, last_name),
          helper2:users!work_orders_helper2_id_fkey(first_name, last_name),
          helper3:users!work_orders_helper3_id_fkey(first_name, last_name),
          helper4:users!work_orders_helper4_id_fkey(first_name, last_name)
        `)
        .eq('wo_id', selectedWO.wo_id)
        .single();
      
      setSelectedWO(updated);
      setShowTeamModal(false);
    } catch (err) {
      alert('Error adding team member: ' + err.message);
    } finally {
      setSaving(false);
    }
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
            <h2 className="text-2xl font-bold mb-6 text-gray-900">Enter PIN</h2>
            <form onSubmit={handleLogin}>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength="4"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4-digit PIN"
                className="w-full px-4 py-4 text-lg text-gray-900 bg-white border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 mb-4"
                autoFocus
              />
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
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg"
            >
              Logout
            </button>
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

                  {wo.hours && (
                    <div className="mt-2 text-xs text-gray-400">
                      Hours: {wo.hours} | Miles: {wo.miles || 0}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (selectedWO) {
    const availableHelperSlots = [];
    if (!selectedWO.helper1_id) availableHelperSlots.push('helper1_id');
    if (!selectedWO.helper2_id) availableHelperSlots.push('helper2_id');
    if (!selectedWO.helper3_id) availableHelperSlots.push('helper3_id');
    if (!selectedWO.helper4_id) availableHelperSlots.push('helper4_id');

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <button
              onClick={() => setSelectedWO(null)}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            >
              ← Back
            </button>
            <h1 className="text-xl font-bold">{selectedWO.wo_number}</h1>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
            >
              Logout
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-lg font-bold ${getPriorityColor(selectedWO.priority)}`}>
                  {getPriorityBadge(selectedWO.priority)}
                </span>
                <span className="text-sm bg-gray-700 px-3 py-1 rounded-full">
                  {getStatusBadge(selectedWO.status)}
                </span>
              </div>
              
              <h2 className="text-xl font-bold mb-2">{selectedWO.building}</h2>
              <p className="text-gray-300 mb-4">{selectedWO.work_order_description}</p>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Entered</p>
                  <p className="font-semibold">{formatDate(selectedWO.date_entered)}</p>
                </div>
                <div>
                  <p className="text-gray-400">NTE</p>
                  <p className="font-semibold text-green-500">${(selectedWO.nte || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Requestor</p>
                  <p className="font-semibold">{selectedWO.requestor || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-400">Status</p>
                  <p className="font-semibold">{selectedWO.status.replace('_', ' ').toUpperCase()}</p>
                </div>
              </div>
            </div>

            {!selectedWO.time_in ? (
              <button
                onClick={() => handleCheckIn(selectedWO.wo_id)}
                disabled={saving}
                className="w-full bg-green-600 hover:bg-green-700 py-4 rounded-lg font-bold text-lg transition active:scale-95"
              >
                ✅ Check In
              </button>
            ) : !selectedWO.time_out ? (
              <button
                onClick={() => handleCheckOut(selectedWO.wo_id)}
                disabled={saving}
                className="w-full bg-orange-600 hover:bg-orange-700 py-4 rounded-lg font-bold text-lg transition active:scale-95"
              >
                ⏰ Check Out
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

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Team</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-blue-500">👷</span>
                  <span>Lead: {selectedWO.lead_tech?.first_name} {selectedWO.lead_tech?.last_name}</span>
                </div>
                {selectedWO.helper1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">👤</span>
                    <span>Helper 1: {selectedWO.helper1.first_name} {selectedWO.helper1.last_name}</span>
                  </div>
                )}
                {selectedWO.helper2 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">👤</span>
                    <span>Helper 2: {selectedWO.helper2.first_name} {selectedWO.helper2.last_name}</span>
                  </div>
                )}
                {selectedWO.helper3 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">👤</span>
                    <span>Helper 3: {selectedWO.helper3.first_name} {selectedWO.helper3.last_name}</span>
                  </div>
                )}
                {selectedWO.helper4 && (
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">👤</span>
                    <span>Helper 4: {selectedWO.helper4.first_name} {selectedWO.helper4.last_name}</span>
                  </div>
                )}
              </div>
              {availableHelperSlots.length > 0 && selectedWO.status !== 'completed' && (
                <button
                  onClick={loadTeamMembers}
                  className="mt-3 w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg text-sm font-semibold"
                >
                  + Add Helper
                </button>
              )}
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
              <div className="text-xs text-gray-500 mt-2 text-center">
                Opens your email app with pre-filled details
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="font-bold mb-3">Field Data</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    value={selectedWO.hours || ''}
                    onChange={(e) => handleUpdateField(selectedWO.wo_id, 'hours', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                    disabled={saving || selectedWO.status === 'completed'}
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Miles</label>
                  <input
                    type="number"
                    step="0.1"
                    value={selectedWO.miles || ''}
                    onChange={(e) => handleUpdateField(selectedWO.wo_id, 'miles', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                    disabled={saving || selectedWO.status === 'completed'}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Material Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedWO.material || ''}
                    onChange={(e) => handleUpdateField(selectedWO.wo_id, 'material', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                    disabled={saving || selectedWO.status === 'completed'}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Trailer Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedWO.trailer || ''}
                    onChange={(e) => handleUpdateField(selectedWO.wo_id, 'trailer', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                    disabled={saving || selectedWO.status === 'completed'}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">EMF Equipment Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedWO.emf_equipment || ''}
                    onChange={(e) => handleUpdateField(selectedWO.wo_id, 'emf_equipment', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-gray-700 rounded-lg text-white"
                    disabled={saving || selectedWO.status === 'completed'}
                  />
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rental Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedWO.rental || ''}
                    onChange={(e) => handleUpdateField(selectedWO.wo_id, 'rental', parseFloat(e.target.value) || 0)}
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
                    onClick={() => handleAddTeamMember(member.user_id, availableHelperSlots[0])}
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
      </div>
    </div>
  );
}