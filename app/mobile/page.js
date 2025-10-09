'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function MobileApp() {
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('list'); // list, detail, profile
  const [techId, setTechId] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (techId) {
      fetchMyWorkOrders();
    }
  }, [techId]);

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'lead_tech')
        .eq('is_active', true);

      if (error) throw error;
      setUsers(data || []);
      
      // Auto-select first tech for demo
      if (data && data.length > 0) {
        setTechId(data[0].user_id);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMyWorkOrders() {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .eq('lead_tech_id', techId)
        .in('status', ['assigned', 'in_progress', 'needs_return'])
        .order('date_entered', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    }
  }

  async function updateWorkOrder(woId, updates) {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update(updates)
        .eq('wo_id', woId);

      if (error) throw error;
      
      fetchMyWorkOrders();
      if (selectedWO && selectedWO.wo_id === woId) {
        setSelectedWO({ ...selectedWO, ...updates });
      }
    } catch (error) {
      console.error('Error updating work order:', error);
      alert('Error updating work order');
    }
  }

  async function clockIn(wo) {
  if (!navigator.geolocation) {
    alert('GPS not available on this device');
    return;
  }

  // Show loading state
  const clockInBtn = document.activeElement;
  if (clockInBtn) clockInBtn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      console.log('GPS Location:', position.coords);
      
      const updates = {
        status: 'in_progress',
        time_in: new Date().toISOString(),
        clock_in_latitude: position.coords.latitude,
        clock_in_longitude: position.coords.longitude
      };
      
      await updateWorkOrder(wo.wo_id, updates);
      alert(`Clocked in successfully!\nLocation: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
      
      if (clockInBtn) clockInBtn.disabled = false;
    },
    (error) => {
      if (clockInBtn) clockInBtn.disabled = false;
      
      let errorMsg = 'Could not get GPS location. ';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMsg += 'Please allow location access in your browser settings.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMsg += 'Location information is unavailable.';
          break;
        case error.TIMEOUT:
          errorMsg += 'Location request timed out.';
          break;
        default:
          errorMsg += 'An unknown error occurred.';
      }
      
      alert(errorMsg);
      console.error('GPS Error:', error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

 async function clockOut(wo) {
  if (!navigator.geolocation) {
    alert('GPS not available on this device');
    return;
  }

  const clockOutBtn = document.activeElement;
  if (clockOutBtn) clockOutBtn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const timeIn = new Date(wo.time_in);
      const timeOut = new Date();
      const hoursWorked = ((timeOut - timeIn) / (1000 * 60 * 60)).toFixed(2);

      const updates = {
        time_out: timeOut.toISOString(),
        clock_out_latitude: position.coords.latitude,
        clock_out_longitude: position.coords.longitude,
        hours: parseFloat(hoursWorked)
      };
      
      await updateWorkOrder(wo.wo_id, updates);
      alert(`Clocked out successfully!\nTotal hours: ${hoursWorked}\nLocation: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
      
      if (clockOutBtn) clockOutBtn.disabled = false;
    },
    (error) => {
      if (clockOutBtn) clockOutBtn.disabled = false;
      
      let errorMsg = 'Could not get GPS location. ';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMsg += 'Please allow location access in your browser settings.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMsg += 'Location information is unavailable.';
          break;
        case error.TIMEOUT:
          errorMsg += 'Location request timed out.';
          break;
        default:
          errorMsg += 'An unknown error occurred.';
      }
      
      alert(errorMsg);
      console.error('GPS Error:', error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

  function getPriorityColor(priority) {
    switch (priority) {
      case 'emergency': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  }

  function getStatusColor(status) {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500';
      case 'assigned': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Loading...</p>
        </div>
      </div>
    );
  }

  // Tech Selector Screen
  if (!techId) {
    return (
      <div className="min-h-screen bg-gray-900 p-4">
        <div className="max-w-md mx-auto pt-8">
          <h1 className="text-3xl font-bold text-white mb-2">Field Service App</h1>
          <p className="text-gray-400 mb-8">Select your profile to continue</p>
          
          <div className="space-y-3">
            {users.map(user => (
              <button
                key={user.user_id}
                onClick={() => setTechId(user.user_id)}
                className="w-full bg-gray-800 text-white p-4 rounded-lg text-left hover:bg-gray-700 transition"
              >
                <div className="font-semibold">{user.first_name} {user.last_name}</div>
                <div className="text-sm text-gray-400">{user.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Work Order List
  if (currentTab === 'list' && !selectedWO) {
    return (
      <div className="min-h-screen bg-gray-900 pb-20">
        {/* Header */}
        <div className="bg-gray-800 p-4 sticky top-0 z-10">
          <h1 className="text-xl font-bold text-white">My Work Orders</h1>
          <p className="text-sm text-gray-400">{workOrders.length} active tickets</p>
        </div>

        {/* Work Orders List */}
        <div className="p-4 space-y-3">
          {workOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400">No active work orders</p>
            </div>
          ) : (
            workOrders.map((wo) => (
              <div
                key={wo.wo_id}
                onClick={() => {
                  setSelectedWO(wo);
                  setCurrentTab('detail');
                }}
                className="bg-gray-800 rounded-lg p-4 active:bg-gray-700 transition"
              >
                {/* Priority & Status Badges */}
                <div className="flex gap-2 mb-2">
                  <span className={`${getPriorityColor(wo.priority)} text-white text-xs px-2 py-1 rounded-full`}>
                    {wo.priority?.toUpperCase()}
                  </span>
                  <span className={`${getStatusColor(wo.status)} text-white text-xs px-2 py-1 rounded-full`}>
                    {wo.status?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>

                {/* WO Details */}
                <div className="text-white font-semibold mb-1">
                  WO #{wo.wo_number}
                </div>
                <div className="text-sm text-gray-400 mb-2">
                  {wo.building}
                </div>
                <div className="text-sm text-gray-300 line-clamp-2">
                  {wo.work_order_description}
                </div>

                {/* Quick Info */}
                <div className="flex justify-between items-center mt-3 text-xs text-gray-400">
                  <span>NTE: ${wo.nte?.toLocaleString() || 'N/A'}</span>
                  <span>{new Date(wo.date_entered).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex">
          <button
            onClick={() => setCurrentTab('list')}
            className="flex-1 py-4 text-white font-semibold"
          >
            📋 Work Orders
          </button>
          <button
            onClick={() => setCurrentTab('profile')}
            className="flex-1 py-4 text-gray-400"
          >
            👤 Profile
          </button>
        </div>
      </div>
    );
  }

  // Work Order Detail
  if (currentTab === 'detail' && selectedWO) {
    return (
      <div className="min-h-screen bg-gray-900 pb-20">
        {/* Header */}
        <div className="bg-gray-800 p-4 sticky top-0 z-10">
          <button
            onClick={() => setSelectedWO(null)}
            className="text-blue-400 mb-2"
          >
            ← Back
          </button>
          <h1 className="text-xl font-bold text-white">WO #{selectedWO.wo_number}</h1>
          <div className="flex gap-2 mt-2">
            <span className={`${getPriorityColor(selectedWO.priority)} text-white text-xs px-2 py-1 rounded-full`}>
              {selectedWO.priority?.toUpperCase()}
            </span>
            <span className={`${getStatusColor(selectedWO.status)} text-white text-xs px-2 py-1 rounded-full`}>
              {selectedWO.status?.replace('_', ' ').toUpperCase()}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Clock In/Out Buttons */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Time Tracking</h3>
            {!selectedWO.time_in ? (
              <button
                onClick={() => clockIn(selectedWO)}
                className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold"
              >
                🕐 Clock In
              </button>
            ) : !selectedWO.time_out ? (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-gray-400 text-sm">Clocked in at</p>
                  <p className="text-white font-semibold">
                    {new Date(selectedWO.time_in).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => clockOut(selectedWO)}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold"
                >
                  🕐 Clock Out
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-gray-400 text-sm">Total Hours</p>
                <p className="text-white text-2xl font-bold">{selectedWO.hours} hrs</p>
              </div>
            )}
          </div>

          {/* Work Details */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Details</h3>
            <div className="space-y-3">
              <div>
                <p className="text-gray-400 text-sm">Building</p>
                <p className="text-white">{selectedWO.building}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Description</p>
                <p className="text-white text-sm">{selectedWO.work_order_description}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Requestor</p>
                <p className="text-white">{selectedWO.requestor || 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">NTE</p>
                <p className="text-white font-semibold">${selectedWO.nte?.toLocaleString() || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Update Status */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Update Status</h3>
            <select
              value={selectedWO.status}
              onChange={(e) => updateWorkOrder(selectedWO.wo_id, { status: e.target.value })}
              className="w-full bg-gray-700 text-white p-3 rounded-lg"
            >
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="needs_return">Needs Return Visit</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Field Data */}
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">Field Data</h3>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-sm block mb-1">Miles</label>
                <input
                  type="number"
                  step="0.1"
                  value={selectedWO.miles || ''}
                  onChange={(e) => updateWorkOrder(selectedWO.wo_id, { miles: parseFloat(e.target.value) || null })}
                  className="w-full bg-gray-700 text-white p-3 rounded-lg"
                  placeholder="0.0"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Material Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.material_cost || ''}
                  onChange={(e) => updateWorkOrder(selectedWO.wo_id, { material_cost: parseFloat(e.target.value) || null })}
                  className="w-full bg-gray-700 text-white p-3 rounded-lg"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-gray-400 text-sm block mb-1">Equipment Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={selectedWO.emf_equipment_cost || ''}
                  onChange={(e) => updateWorkOrder(selectedWO.wo_id, { emf_equipment_cost: parseFloat(e.target.value) || null })}
                  className="w-full bg-gray-700 text-white p-3 rounded-lg"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>

          {/* Comments */}
          {selectedWO.comments && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-3">Comments</h3>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{selectedWO.comments}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Profile Tab
  if (currentTab === 'profile') {
    const currentUser = users.find(u => u.user_id === techId);
    
    return (
      <div className="min-h-screen bg-gray-900 pb-20">
        <div className="bg-gray-800 p-4">
          <h1 className="text-xl font-bold text-white">Profile</h1>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <h3 className="text-white font-semibold mb-3">User Info</h3>
            <div className="space-y-2">
              <div>
                <p className="text-gray-400 text-sm">Name</p>
                <p className="text-white">{currentUser?.first_name} {currentUser?.last_name}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Email</p>
                <p className="text-white">{currentUser?.email}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Role</p>
                <p className="text-white capitalize">{currentUser?.role?.replace('_', ' ')}</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setTechId(null);
              setWorkOrders([]);
              setSelectedWO(null);
              setCurrentTab('list');
            }}
            className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold"
          >
            Switch User
          </button>

          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-gray-700 text-white py-3 rounded-lg font-semibold"
          >
            Go to Admin Dashboard
          </button>
        </div>

        {/* Bottom Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 flex">
          <button
            onClick={() => setCurrentTab('list')}
            className="flex-1 py-4 text-gray-400"
          >
            📋 Work Orders
          </button>
          <button
            onClick={() => setCurrentTab('profile')}
            className="flex-1 py-4 text-white font-semibold"
          >
            👤 Profile
          </button>
        </div>
      </div>
    );
  }

  return null;
}