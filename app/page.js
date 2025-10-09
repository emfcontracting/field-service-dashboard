'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function Dashboard() {
  const [workOrders, setWorkOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// ... your supabase client setup

export default function Dashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // ... keep all your existing state variables (workOrders, filteredOrders, etc.)

  // Add this FIRST useEffect before any others
  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      router.push('/login');
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    if (!userData) {
      await supabase.auth.signOut();
      router.push('/login');
      return;
    }

    setCurrentUser(userData);
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // ... rest of your existing code continues here

  // New work order form state
  const [newOrder, setNewOrder] = useState({
    wo_number: '',
    building: '',
    priority: 'medium',
    work_order_description: '',
    nte: '',
    requestor: '',
    status: 'pending'
  });

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [workOrders, searchTerm, statusFilter, priorityFilter]);

  async function fetchWorkOrders() {
    try {
      console.log('Fetching work orders...');
      const { data, error } = await supabase
        .from('work_orders')
        .select('*')
        .order('date_entered', { ascending: false });

      if (error) throw error;
      console.log('Fetched work orders:', data?.length);
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateWorkOrder(e) {
    e.preventDefault();
    setSaving(true);

    try {
      const orderData = {
        wo_number: newOrder.wo_number || `WO-${Date.now()}`,
        building: newOrder.building,
        priority: newOrder.priority,
        date_entered: new Date().toISOString().split('T')[0],
        work_order_description: newOrder.work_order_description,
        nte: parseFloat(newOrder.nte) || null,
        requestor: newOrder.requestor,
        status: 'pending'
      };

async function handleImportFromSheet() {
  if (!confirm('Import new work orders from Google Sheet? This will only add new tickets that don\'t exist yet.')) {
    return;
  }

  setImporting(true);
  
  try {
    const response = await fetch('/api/import-sheet', {
      method: 'POST',
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert(result.message);
      fetchWorkOrders(); // Refresh the list
    } else {
      alert('Import failed: ' + result.message);
    }
  } catch (error) {
    console.error('Import error:', error);
    alert('Import failed: ' + error.message);
  } finally {
    setImporting(false);
  }
}

      const { data, error } = await supabase
        .from('work_orders')
        .insert([orderData])
        .select();

      if (error) throw error;

      alert('Work order created successfully!');
      setShowNewOrderModal(false);
      setNewOrder({
        wo_number: '',
        building: '',
        priority: 'medium',
        work_order_description: '',
        nte: '',
        requestor: '',
        status: 'pending'
      });
      fetchWorkOrders(); // Refresh the list
    } catch (error) {
      console.error('Error creating work order:', error);
      alert('Error creating work order: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

async function handleImportFromSheet() {
  if (!confirm('Import new work orders from Google Sheet? This will only add new tickets that don\'t exist yet.')) {
    return;
  }

  setImporting(true);
  
  try {
    const response = await fetch('/api/import-sheet', {
      method: 'POST',
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert(result.message);
      fetchWorkOrders();
    } else {
      alert('Import failed: ' + result.message);
    }
  } catch (error) {
    console.error('Import error:', error);
    alert('Import failed: ' + error.message);
  } finally {
    setImporting(false);
  }
}

  function filterOrders() {
    let filtered = [...workOrders];

    if (searchTerm) {
      filtered = filtered.filter(wo =>
        wo.wo_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.building?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.work_order_description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(wo => wo.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(wo => wo.priority === priorityFilter);
    }

    setFilteredOrders(filtered);
  }

  function getPriorityColor(priority) {
  switch (priority) {
    case 'emergency': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'medium': return 'bg-yellow-100 text-yellow-800';
    case 'low': return 'bg-green-100 text-green-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

  function getStatusColor(status) {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'assigned': return 'bg-purple-100 text-purple-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading work orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div className="flex justify-between items-center">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Field Service Dashboard</h1>
        {currentUser && (
          <p className="text-sm text-gray-500 mt-1">
            Welcome, {currentUser.first_name} {currentUser.last_name}
          </p>
        )}
      </div>
      <button
        onClick={handleLogout}
        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium"
      >
        Logout
      </button>
    </div>
  </div>
</header>
      <div className="flex gap-3">
        <button 
          onClick={handleImportFromSheet}
          disabled={importing}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 flex items-center gap-2"
        >
          {importing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Importing...
            </>
          ) : (
            '↻ Import from Sheet'
          )}
        </button>
        <button 
          onClick={() => setShowNewOrderModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + New Work Order
        </button>
      </div>
    </div>
  </div>
</header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm font-medium">Total Orders</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{workOrders.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm font-medium">Pending</p>
            <p className="text-3xl font-bold text-yellow-600 mt-2">
              {workOrders.filter(wo => wo.status === 'pending').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm font-medium">In Progress</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {workOrders.filter(wo => wo.status === 'in_progress').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-500 text-sm font-medium">Completed</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {workOrders.filter(wo => wo.status === 'completed').length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <input
                type="text"
                placeholder="Search by WO#, Building, Description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
              <select
  value={priorityFilter}
  onChange={(e) => setPriorityFilter(e.target.value)}
  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
>
  <option value="all">All Priorities</option>
  <option value="emergency">Emergency</option>
  <option value="high">High</option>
  <option value="medium">Medium</option>
  <option value="low">Low</option>
</select>
            </div>
          </div>
        </div>

        {/* Work Orders Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">WO#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Building</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">NTE</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrders.map((wo) => (
                  <tr key={wo.wo_id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-blue-600">{wo.wo_number}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{wo.building}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-900 line-clamp-2">
                        {wo.work_order_description?.substring(0, 100)}...
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(wo.priority)}`}>
                        {wo.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(wo.status)}`}>
                        {wo.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">
                        ${wo.nte ? wo.nte.toLocaleString() : 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500">
                        {new Date(wo.date_entered).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button 
                        onClick={() => window.location.href = `/work-orders/${wo.wo_id}`}
                        className="text-blue-600 hover:text-blue-900 font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No work orders found matching your filters.</p>
            </div>
          )}
        </div>

        <div className="mt-4 text-sm text-gray-600 text-center">
          Showing {filteredOrders.length} of {workOrders.length} work orders
        </div>
      </main>

      {/* New Work Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Create New Work Order</h2>
                <button 
                  onClick={() => setShowNewOrderModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateWorkOrder} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Work Order Number <span className="text-gray-400">(leave blank for auto-generate)</span>
                    </label>
                    <input
                      type="text"
                      value={newOrder.wo_number}
                      onChange={(e) => setNewOrder({...newOrder, wo_number: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="WO-12345 (optional)"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Building <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={newOrder.building}
                      onChange={(e) => setNewOrder({...newOrder, building: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Building name or code"
                    />
                  </div>

                 <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
    Priority <span className="text-red-500">*</span>
  </label>
  <select
    required
    value={newOrder.priority}
    onChange={(e) => setNewOrder({...newOrder, priority: e.target.value})}
    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
  >
    <option value="low">Low</option>
    <option value="medium">Medium</option>
    <option value="high">High</option>
    <option value="emergency">Emergency</option>
  </select>
</div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      NTE (Not To Exceed)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={newOrder.nte}
                      onChange={(e) => setNewOrder({...newOrder, nte: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="2500.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Requestor / Contact
                    </label>
                    <input
                      type="text"
                      value={newOrder.requestor}
                      onChange={(e) => setNewOrder({...newOrder, requestor: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Contact name, phone"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Work Order Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      rows="6"
                      value={newOrder.work_order_description}
                      onChange={(e) => setNewOrder({...newOrder, work_order_description: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Detailed description of the work to be performed..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowNewOrderModal(false)}
                    className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {saving ? 'Creating...' : 'Create Work Order'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}