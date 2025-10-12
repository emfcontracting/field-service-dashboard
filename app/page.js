'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  // State Management
  const [workOrders, setWorkOrders] = useState([]);
  const [filteredWorkOrders, setFilteredWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [showNewWOModal, setShowNewWOModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // New Work Order Form
  const [newWO, setNewWO] = useState({
    wo_number: '',
    building: '',
    work_order_description: '',
    requestor: '',
    priority: 'medium',
    status: 'pending',
    lead_tech_id: '',
    nte: 0,
    comments: ''
  });

  // Google Sheets Import
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [importing, setImporting] = useState(false);

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
    needs_return: 0
  });

  // Invoice Generation
  const [showInvoiceButton, setShowInvoiceButton] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  // Admin Password for Delete
  const adminPassword = 'admin123'; // ⚠️ Change this in production!

  // Fetch Data on Mount
  useEffect(() => {
    fetchWorkOrders();
    fetchUsers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply Filters
  useEffect(() => {
    applyFilters();
  }, [workOrders, statusFilter, priorityFilter, searchTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if selected WO can generate invoice
  useEffect(() => {
    if (selectedWO) {
      checkCanGenerateInvoice(selectedWO.wo_id);
    }
  }, [selectedWO]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch Work Orders
  const fetchWorkOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!lead_tech_id(first_name, last_name, email),
        locked_by_user:users!locked_by(first_name, last_name)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching work orders:', error);
    } else {
      setWorkOrders(data || []);
      calculateStats(data || []);
    }
    setLoading(false);
  };

  // Fetch Users
  const fetchUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('is_active', true)
    .in('role', ['admin', 'lead_tech', 'tech', 'helper', 'office']) // Include all roles
    .order('first_name');

  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('Fetched users:', data?.length, 'users');
    setUsers(data || []);
  }
};

  // Calculate Statistics
  const calculateStats = (orders) => {
    const stats = {
      total: orders.length,
      pending: orders.filter(wo => wo.status === 'pending').length,
      assigned: orders.filter(wo => wo.status === 'assigned').length,
      in_progress: orders.filter(wo => wo.status === 'in_progress').length,
      completed: orders.filter(wo => wo.status === 'completed').length,
      needs_return: orders.filter(wo => wo.status === 'needs_return').length
    };
    setStats(stats);
  };

  // Apply Filters
  const applyFilters = () => {
    let filtered = [...workOrders];

    if (statusFilter !== 'all') {
      filtered = filtered.filter(wo => wo.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(wo => wo.priority === priorityFilter);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(wo =>
        wo.wo_number.toLowerCase().includes(search) ||
        wo.building.toLowerCase().includes(search) ||
        wo.work_order_description.toLowerCase().includes(search) ||
        wo.requestor?.toLowerCase().includes(search)
      );
    }

    setFilteredWorkOrders(filtered);
  };

  // Calculate Total Costs for a WO
  const calculateTotalCost = (wo) => {
    const labor = ((wo.hours_regular || 0) * 64) + ((wo.hours_overtime || 0) * 96);
    const materials = wo.material_cost || 0;
    const equipment = wo.emf_equipment_cost || 0;
    const trailer = wo.trailer_cost || 0;
    const rental = wo.rental_cost || 0;
    const mileage = (wo.miles || 0) * 1.00;
    
    return labor + materials + equipment + trailer + rental + mileage;
  };

  // Get Status Color
  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-gray-600',
      assigned: 'bg-blue-600',
      in_progress: 'bg-yellow-600',
      needs_return: 'bg-purple-600',
      completed: 'bg-green-600'
    };
    return colors[status] || 'bg-gray-600';
  };

  // Get Priority Color
  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-green-600',
      medium: 'bg-yellow-600',
      high: 'bg-orange-600',
      emergency: 'bg-red-600'
    };
    return colors[priority] || 'bg-gray-600';
  };

// Create New Work Order
  const createWorkOrder = async () => {
    if (!newWO.wo_number || !newWO.building || !newWO.work_order_description) {
      alert('Please fill in WO#, Building, and Description');
      return;
    }

    const { data, error } = await supabase
      .from('work_orders')
      .insert([{
        ...newWO,
        date_entered: new Date().toISOString().split('T')[0]
      }])
      .select();

    if (error) {
      console.error('Error creating work order:', error);
      alert('Error creating work order: ' + error.message);
    } else {
      alert('✅ Work order created successfully!');
      setShowNewWOModal(false);
      setNewWO({
        wo_number: '',
        building: '',
        work_order_description: '',
        requestor: '',
        priority: 'medium',
        status: 'pending',
        lead_tech_id: '',
        nte: 0,
        comments: ''
      });
      fetchWorkOrders();
    }
  };

  // Update Work Order
  const updateWorkOrder = async (woId, updates) => {
    const { error } = await supabase
      .from('work_orders')
      .update(updates)
      .eq('wo_id', woId);

    if (error) {
      console.error('Error updating work order:', error);
      alert('Failed to update work order');
    } else {
      fetchWorkOrders();
      if (selectedWO?.wo_id === woId) {
        setSelectedWO({ ...selectedWO, ...updates });
      }
    }
  };

  // Update Status with Invoice Check
  const updateWorkOrderStatus = async (woId, newStatus) => {
    await updateWorkOrder(woId, { status: newStatus });

    if (newStatus === 'completed') {
      const wo = workOrders.find(w => w.wo_id === woId);
      if (wo && !wo.is_locked) {
        alert('✅ Work Order marked as Completed! Please acknowledge to lock it.');
      }
    }
  };
// Enhanced Select Work Order - loads team members
const selectWorkOrderEnhanced = async (wo) => {
  // Fetch team members for this work order
  const { data: teamMembers } = await supabase
    .from('work_order_assignments')
    .select(`
      *,
      user:users(first_name, last_name, email, role)
    `)
    .eq('wo_id', wo.wo_id);

  setSelectedWO({ ...wo, teamMembers: teamMembers || [] });
};
  // Delete Work Order
  const deleteWorkOrder = async (woId) => {
    const password = prompt('Enter admin password to delete:');
    if (password !== adminPassword) {
      alert('❌ Incorrect password');
      return;
    }

    const confirmText = prompt('Type DELETE to confirm deletion:');
    if (confirmText !== 'DELETE') {
      alert('Deletion cancelled');
      return;
    }

    const { error } = await supabase
      .from('work_orders')
      .delete()
      .eq('wo_id', woId);

    if (error) {
      console.error('Error deleting work order:', error);
      alert('Failed to delete work order');
    } else {
      alert('✅ Work order deleted');
      setSelectedWO(null);
      fetchWorkOrders();
    }
  };

  // Acknowledge Work Order (Office/Admin only)
  const acknowledgeWorkOrder = async (woId) => {
    if (!confirm('Acknowledge this completed work order?\n\nThis will lock the work order and prevent the technician from making further changes.')) {
      return;
    }

    const { error } = await supabase
      .from('work_orders')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: null,
        is_locked: true,
        locked_at: new Date().toISOString(),
        locked_by: null
      })
      .eq('wo_id', woId);

    if (error) {
      console.error('Error acknowledging work order:', error);
      alert('Failed to acknowledge work order');
    } else {
      alert('✅ Work order acknowledged and locked!');
      fetchWorkOrders();
      if (selectedWO?.wo_id === woId) {
        setSelectedWO({
          ...selectedWO,
          acknowledged: true,
          is_locked: true,
          acknowledged_at: new Date().toISOString()
        });
      }
    }
  };

  // Check if Invoice Can Be Generated
  const checkCanGenerateInvoice = async (woId) => {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('invoice_id, status')
      .eq('wo_id', woId)
      .single();

    const wo = workOrders.find(w => w.wo_id === woId);
    setShowInvoiceButton(wo?.acknowledged && !invoice && !wo?.is_locked);
  };

  // Generate Invoice
  const generateInvoice = async (woId) => {
    if (!confirm('Generate invoice for this work order?\n\nThis will:\n- Create a draft invoice\n- Lock the work order\n- Send to invoicing for review\n\nContinue?')) {
      return;
    }

    setGeneratingInvoice(true);

    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wo_id: woId })
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Invoice generated successfully!\n\nThe work order is now locked and ready for review in the Invoicing section.');
        setShowInvoiceButton(false);
        setSelectedWO(null);
        fetchWorkOrders();
      } else {
        alert('❌ Error generating invoice:\n' + result.error);
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert('❌ Failed to generate invoice');
    } finally {
      setGeneratingInvoice(false);
    }
  };

  // Import from Google Sheets
  const importFromSheets = async () => {
    if (!sheetsUrl) {
      alert('Please enter a Google Sheets URL');
      return;
    }

    setImporting(true);

    try {
      const match = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        alert('Invalid Google Sheets URL');
        setImporting(false);
        return;
      }

      const spreadsheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

      const response = await fetch(csvUrl);
      const csvText = await response.text();

      const rows = csvText.split('\n').map(row => {
        return row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
      });

      const dataRows = rows.slice(1).filter(row => row[0]);

      const workOrdersToImport = dataRows.map(row => ({
        wo_number: row[0] || '',
        date_entered: row[1] || new Date().toISOString().split('T')[0],
        building: row[2] || '',
        work_order_description: row[3] || '',
        requestor: row[4] || '',
        priority: row[5]?.toLowerCase() || 'medium',
        status: row[6]?.toLowerCase() || 'pending',
        nte: parseFloat(row[7]) || 0,
        comments: row[8] || ''
      }));

      const { data, error } = await supabase
        .from('work_orders')
        .insert(workOrdersToImport)
        .select();

      if (error) {
        console.error('Error importing:', error);
        alert('❌ Import error: ' + error.message);
      } else {
        alert(`✅ Successfully imported ${data.length} work orders!`);
        setShowImportModal(false);
        setSheetsUrl('');
        fetchWorkOrders();
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('❌ Failed to import: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">🔧 Field Service Dashboard</h1>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.href = '/invoices'}
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold transition"
            >
              💰 Invoicing
            </button>
            <button
              onClick={() => window.location.href = '/users'}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition"
            >
              👥 Users
            </button>
            <button
              onClick={() => window.location.href = '/mobile'}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition"
            >
              📱 Mobile App
            </button>
          </div>
        </div>
{/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total</div>
            <div className="text-3xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Pending</div>
            <div className="text-3xl font-bold">{stats.pending}</div>
          </div>
          <div className="bg-blue-900 rounded-lg p-4">
            <div className="text-blue-300 text-sm">Assigned</div>
            <div className="text-3xl font-bold">{stats.assigned}</div>
          </div>
          <div className="bg-yellow-900 rounded-lg p-4">
            <div className="text-yellow-300 text-sm">In Progress</div>
            <div className="text-3xl font-bold">{stats.in_progress}</div>
          </div>
          <div className="bg-purple-900 rounded-lg p-4">
            <div className="text-purple-300 text-sm">Needs Return</div>
            <div className="text-3xl font-bold">{stats.needs_return}</div>
          </div>
          <div className="bg-green-900 rounded-lg p-4">
            <div className="text-green-300 text-sm">Completed</div>
            <div className="text-3xl font-bold">{stats.completed}</div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="text"
              placeholder="🔍 Search WO#, Building, Description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-[250px] bg-gray-700 text-white px-4 py-2 rounded-lg"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="needs_return">Needs Return</option>
              <option value="completed">Completed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg"
            >
              <option value="all">All Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="emergency">Emergency</option>
            </select>

            <button
              onClick={() => setShowNewWOModal(true)}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition"
            >
              + New Work Order
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition"
            >
              📥 Import
            </button>
          </div>
        </div>

        {/* Work Orders Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading work orders...</div>
          ) : filteredWorkOrders.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'No work orders match your filters'
                : 'No work orders yet. Create your first one!'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">WO#</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Building</th>
                    <th className="px-4 py-3 text-left">Description</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Priority</th>
                    <th className="px-4 py-3 text-left">Lead Tech</th>
                    <th className="px-4 py-3 text-right">NTE</th>
                    <th className="px-4 py-3 text-right">Est. Cost</th>
                    <th className="px-4 py-3 text-center">🔒</th>
                    <th className="px-4 py-3 text-center">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkOrders.map(wo => {
                    const totalCost = calculateTotalCost(wo);
                    const overBudget = totalCost > (wo.nte || 0) && (wo.nte || 0) > 0;

                    return (
                      <tr
                        key={wo.wo_id}
                        onClick={() => selectWorkOrderEnhanced(wo)}
                        className="border-t border-gray-700 hover:bg-gray-700 transition cursor-pointer"
                      >
                        <td className="px-4 py-3 font-semibold">{wo.wo_number}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {new Date(wo.date_entered).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">{wo.building}</td>
                        <td className="px-4 py-3">
                          <div className="max-w-xs truncate">
                            {wo.work_order_description}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${getStatusColor(wo.status)}`}>
                            {wo.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(wo.priority)}`}>
                            {wo.priority.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {wo.lead_tech ? (
                            <div>
                              <div className="font-semibold">
                                {wo.lead_tech.first_name} {wo.lead_tech.last_name}
                              </div>
                              <div className="text-xs text-gray-400">{wo.lead_tech.email}</div>
                            </div>
                          ) : (
                            <span className="text-gray-500">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          ${(wo.nte || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={overBudget ? 'text-red-400 font-bold' : ''}>
                            ${(totalCost || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {wo.is_locked && (
                            <span
                              title={`Locked on ${new Date(wo.locked_at).toLocaleDateString()}`}
                              className="cursor-help"
                            >
                              🔒
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400">
                          →
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Work Order Detail Modal */}
      {selectedWO && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg max-w-6xl w-full my-8">
            
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-start z-10 rounded-t-lg">
              <div>
                <h2 className="text-2xl font-bold">{selectedWO.wo_number}</h2>
                {selectedWO.acknowledged && (
                  <div className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm mt-2 inline-block">
                    ✅ Acknowledged
                  </div>
                )}
                {selectedWO.is_locked && (
                  <div className="bg-red-900 text-red-200 px-3 py-1 rounded-lg text-sm mt-2 inline-block ml-2">
                    🔒 Locked
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedWO(null);
                  setShowInvoiceButton(false);
                }}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Work Order #</label>
                  <input
                    type="text"
                    value={selectedWO.wo_number}
                    onChange={(e) => setSelectedWO({ ...selectedWO, wo_number: e.target.value })}
                    onBlur={() => updateWorkOrder(selectedWO.wo_id, { wo_number: selectedWO.wo_number })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Date Entered</label>
                  <input
                    type="date"
                    value={selectedWO.date_entered}
                    onChange={(e) => setSelectedWO({ ...selectedWO, date_entered: e.target.value })}
                    onBlur={() => updateWorkOrder(selectedWO.wo_id, { date_entered: selectedWO.date_entered })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Building</label>
                <input
                  type="text"
                  value={selectedWO.building}
                  onChange={(e) => setSelectedWO({ ...selectedWO, building: e.target.value })}
                  onBlur={() => updateWorkOrder(selectedWO.wo_id, { building: selectedWO.building })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Description</label>
                <textarea
                  value={selectedWO.work_order_description}
                  onChange={(e) => setSelectedWO({ ...selectedWO, work_order_description: e.target.value })}
                  onBlur={() => updateWorkOrder(selectedWO.wo_id, { work_order_description: selectedWO.work_order_description })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Requestor</label>
                <input
                  type="text"
                  value={selectedWO.requestor || ''}
                  onChange={(e) => setSelectedWO({ ...selectedWO, requestor: e.target.value })}
                  onBlur={() => updateWorkOrder(selectedWO.wo_id, { requestor: selectedWO.requestor })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Status</label>
                  <select
                    value={selectedWO.status}
                    onChange={(e) => {
                      setSelectedWO({ ...selectedWO, status: e.target.value });
                      updateWorkOrderStatus(selectedWO.wo_id, e.target.value);
                    }}
                    disabled={selectedWO.is_locked || selectedWO.acknowledged}
                    className={`w-full px-4 py-2 rounded-lg font-semibold ${getStatusColor(selectedWO.status)} ${
                      (selectedWO.is_locked || selectedWO.acknowledged) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="needs_return">Needs Return</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Priority</label>
                  <select
                    value={selectedWO.priority}
                    onChange={(e) => {
                      setSelectedWO({ ...selectedWO, priority: e.target.value });
                      updateWorkOrder(selectedWO.wo_id, { priority: e.target.value });
                    }}
                    className={`w-full px-4 py-2 rounded-lg font-semibold ${getPriorityColor(selectedWO.priority)}`}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Lead Tech</label>
                  <select
                    value={selectedWO.lead_tech_id || ''}
                    onChange={(e) => {
                      setSelectedWO({ ...selectedWO, lead_tech_id: e.target.value });
                      updateWorkOrder(selectedWO.wo_id, { lead_tech_id: e.target.value || null });
                    }}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  >
                    <option value="">Unassigned</option>
                    {users.filter(u => u.role === 'lead_tech' || u.role === 'admin').map(user => (
                      <option key={user.user_id} value={user.user_id}>
                        {user.first_name} {user.last_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-lg">Team Members</h3>
                  <button
                    onClick={async () => {
                      // Fetch current team members
                      const { data } = await supabase
                        .from('work_order_assignments')
                        .select(`
                          *,
                          user:users(first_name, last_name, email, role)
                        `)
                        .eq('wo_id', selectedWO.wo_id);
                      
                      setSelectedWO({ ...selectedWO, teamMembers: data || [] });
                      
                      // Filter available users - exclude lead tech and current team members
                      // Include lead_tech, tech, and helper roles
                      const availableUsers = users.filter(u => 
                        (u.role === 'lead_tech' || u.role === 'tech' || u.role === 'helper') &&
                        u.user_id !== selectedWO.lead_tech_id &&
                        !(data || []).some(tm => tm.user_id === u.user_id)
                      );
                      
                      console.log('Available users for team:', availableUsers);
                      
                      if (availableUsers.length === 0) {
                        alert('No available team members to add. Make sure you have active users with tech, helper, or lead_tech roles.');
                        return;
                      }
                      
                      // Create a better selection dialog
                      const userOptions = availableUsers.map((u, i) => 
                        `${i + 1}. ${u.first_name} ${u.last_name} (${u.role.replace('_', ' ').toUpperCase()})`
                      ).join('\n');
                      
                      const selection = prompt(`Select team member:\n\n${userOptions}\n\nEnter number:`);
                      
                      if (selection) {
                        const index = parseInt(selection) - 1;
                        if (index >= 0 && index < availableUsers.length) {
                          const selectedUser = availableUsers[index];
                          const { error } = await supabase
                            .from('work_order_assignments')
                            .insert({
                              wo_id: selectedWO.wo_id,
                              user_id: selectedUser.user_id,
                              role: 'helper' // All added members are helpers
                            });
                          
                          if (error) {
                            console.error('Error adding team member:', error);
                            alert('Failed to add team member: ' + error.message);
                          } else {
                            alert(`✅ ${selectedUser.first_name} ${selectedUser.last_name} added to team!`);
                            // Refresh the work order with team members
                            const wo = workOrders.find(w => w.wo_id === selectedWO.wo_id);
                            if (wo) selectWorkOrderEnhanced(wo);
                          }
                        } else {
                          alert('Invalid selection');
                        }
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm font-semibold"
                  >
                    + Add Team Member
                  </button>
                </div>

                <div className="space-y-3">
                  {(selectedWO.teamMembers || []).length === 0 ? (
                    <div className="text-center text-gray-400 py-4 text-sm">
                      No additional team members yet
                    </div>
                  ) : (
                    (selectedWO.teamMembers || []).map(member => (
                      <div key={member.assignment_id} className="bg-gray-600 rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-bold">
                              {member.user?.first_name} {member.user?.last_name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {member.user?.email} • {member.user?.role?.replace('_', ' ').toUpperCase()}
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              if (!confirm('Remove this team member?')) return;
                              
                              const { error } = await supabase
                                .from('work_order_assignments')
                                .delete()
                                .eq('assignment_id', member.assignment_id);
                              
                              if (!error) {
                                alert('✅ Team member removed');
                                const wo = workOrders.find(w => w.wo_id === selectedWO.wo_id);
                                if (wo) selectWorkOrderEnhanced(wo);
                              }
                            }}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <label className="text-xs text-gray-400">RT Hours</label>
                            <input
                              type="number"
                              step="0.5"
                              value={member.hours_regular || 0}
                              onChange={async (e) => {
                                const value = parseFloat(e.target.value) || 0;
                                await supabase
                                  .from('work_order_assignments')
                                  .update({ hours_regular: value })
                                  .eq('assignment_id', member.assignment_id);
                                
                                // Update local state
                                const updatedMembers = selectedWO.teamMembers.map(m => 
                                  m.assignment_id === member.assignment_id 
                                    ? { ...m, hours_regular: value }
                                    : m
                                );
                                setSelectedWO({ ...selectedWO, teamMembers: updatedMembers });
                              }}
                              className="w-full bg-gray-700 text-white px-2 py-1 rounded mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400">OT Hours</label>
                            <input
                              type="number"
                              step="0.5"
                              value={member.hours_overtime || 0}
                              onChange={async (e) => {
                                const value = parseFloat(e.target.value) || 0;
                                await supabase
                                  .from('work_order_assignments')
                                  .update({ hours_overtime: value })
                                  .eq('assignment_id', member.assignment_id);
                                
                                // Update local state
                                const updatedMembers = selectedWO.teamMembers.map(m => 
                                  m.assignment_id === member.assignment_id 
                                    ? { ...m, hours_overtime: value }
                                    : m
                                );
                                setSelectedWO({ ...selectedWO, teamMembers: updatedMembers });
                              }}
                              className="w-full bg-gray-700 text-white px-2 py-1 rounded mt-1"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-400">Miles</label>
                            <input
                              type="number"
                              value={member.miles || 0}
                              onChange={async (e) => {
                                const value = parseFloat(e.target.value) || 0;
                                await supabase
                                  .from('work_order_assignments')
                                  .update({ miles: value })
                                  .eq('assignment_id', member.assignment_id);
                                
                                // Update local state
                                const updatedMembers = selectedWO.teamMembers.map(m => 
                                  m.assignment_id === member.assignment_id 
                                    ? { ...m, miles: value }
                                    : m
                                );
                                setSelectedWO({ ...selectedWO, teamMembers: updatedMembers });
                              }}
                              className="w-full bg-gray-700 text-white px-2 py-1 rounded mt-1"
                            />
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-400 mt-2">
                          Labor: ${(((member.hours_regular || 0) * 64) + ((member.hours_overtime || 0) * 96)).toFixed(2)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold mb-3 text-lg">Primary Tech Field Data</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Regular Hours (RT)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={selectedWO.hours_regular || 0}
                      onChange={(e) => setSelectedWO({ ...selectedWO, hours_regular: parseFloat(e.target.value) || 0 })}
                      onBlur={() => updateWorkOrder(selectedWO.wo_id, { hours_regular: selectedWO.hours_regular })}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                    />
                    <div className="text-xs text-gray-500 mt-1">Up to 8 hrs @ $64/hr</div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Overtime Hours (OT)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={selectedWO.hours_overtime || 0}
                      onChange={(e) => setSelectedWO({ ...selectedWO, hours_overtime: parseFloat(e.target.value) || 0 })}
                      onBlur={() => updateWorkOrder(selectedWO.wo_id, { hours_overtime: selectedWO.hours_overtime })}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                    />
                    <div className="text-xs text-gray-500 mt-1">Over 8 hrs @ $96/hr</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Miles</label>
                    <input
                      type="number"
                      value={selectedWO.miles || 0}
                      onChange={(e) => setSelectedWO({ ...selectedWO, miles: parseFloat(e.target.value) || 0 })}
                      onBlur={() => updateWorkOrder(selectedWO.wo_id, { miles: selectedWO.miles })}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                    />
                    <div className="text-xs text-gray-500 mt-1">@ $1.00/mile</div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Material Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedWO.material_cost || 0}
                      onChange={(e) => setSelectedWO({ ...selectedWO, material_cost: parseFloat(e.target.value) || 0 })}
                      onBlur={() => updateWorkOrder(selectedWO.wo_id, { material_cost: selectedWO.material_cost })}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Equipment Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedWO.emf_equipment_cost || 0}
                      onChange={(e) => setSelectedWO({ ...selectedWO, emf_equipment_cost: parseFloat(e.target.value) || 0 })}
                      onBlur={() => updateWorkOrder(selectedWO.wo_id, { emf_equipment_cost: selectedWO.emf_equipment_cost })}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Trailer Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedWO.trailer_cost || 0}
                      onChange={(e) => setSelectedWO({ ...selectedWO, trailer_cost: parseFloat(e.target.value) || 0 })}
                      onBlur={() => updateWorkOrder(selectedWO.wo_id, { trailer_cost: selectedWO.trailer_cost })}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Rental Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedWO.rental_cost || 0}
                      onChange={(e) => setSelectedWO({ ...selectedWO, rental_cost: parseFloat(e.target.value) || 0 })}
                      onBlur={() => updateWorkOrder(selectedWO.wo_id, { rental_cost: selectedWO.rental_cost })}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold mb-3 text-lg">💰 Budget & Cost Summary</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">NTE (Not To Exceed)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedWO.nte || ''}
                      onChange={(e) => setSelectedWO({ ...selectedWO, nte: parseFloat(e.target.value) || 0 })}
                      onBlur={() => updateWorkOrder(selectedWO.wo_id, { nte: selectedWO.nte })}
                      className="w-full bg-gray-600 text-white px-4 py-2 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Grand Total Cost</label>
                    <div className="bg-gray-600 px-4 py-2 rounded-lg font-bold text-2xl text-green-400">
                      ${(calculateTotalCost(selectedWO) || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="bg-blue-900 text-blue-100 rounded-lg p-3 mb-3">
                  <div className="font-bold mb-2">TEAM LABOR</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Total RT Hours</span>
                      <span>{(selectedWO.hours_regular || 0) + ((selectedWO.teamMembers || []).reduce((sum, m) => sum + (m.hours_regular || 0), 0))} hrs</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total OT Hours</span>
                      <span>{(selectedWO.hours_overtime || 0) + ((selectedWO.teamMembers || []).reduce((sum, m) => sum + (m.hours_overtime || 0), 0))} hrs</span>
                    </div>
                    <div className="border-t border-blue-700 pt-1 mt-1 flex justify-between font-bold">
                      <span>Total Labor Cost:</span>
                      <span>
                        ${(
                          ((selectedWO.hours_regular || 0) * 64) + 
                          ((selectedWO.hours_overtime || 0) * 96) +
                          ((selectedWO.teamMembers || []).reduce((sum, m) => sum + ((m.hours_regular || 0) * 64) + ((m.hours_overtime || 0) * 96), 0))
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Materials:</span>
                    <span>${(selectedWO.material_cost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Equipment:</span>
                    <span>${(selectedWO.emf_equipment_cost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Trailer:</span>
                    <span>${(selectedWO.trailer_cost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Rental:</span>
                    <span>${(selectedWO.rental_cost || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Mileage:</span>
                    <span>{(selectedWO.miles || 0) + ((selectedWO.teamMembers || []).reduce((sum, m) => sum + (m.miles || 0), 0))} mi</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Mileage Cost:</span>
                    <span>${(((selectedWO.miles || 0) + ((selectedWO.teamMembers || []).reduce((sum, m) => sum + (m.miles || 0), 0))) * 1.00).toFixed(2)}</span>
                  </div>
                </div>

                <div className="border-t border-gray-600 pt-3 mt-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">NTE Budget:</span>
                    <span>${(selectedWO.nte || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Remaining:</span>
                    <span className={calculateTotalCost(selectedWO) > selectedWO.nte ? 'text-red-400 font-bold' : 'text-green-400'}>
                      ${((selectedWO.nte || 0) - calculateTotalCost(selectedWO)).toFixed(2)}
                    </span>
                  </div>
                </div>

                {calculateTotalCost(selectedWO) > (selectedWO.nte || 0) && (selectedWO.nte || 0) > 0 && (
                  <div className="bg-red-900 text-red-200 p-3 rounded-lg mt-3 text-sm">
                    ⚠️ Over budget by ${(calculateTotalCost(selectedWO) - (selectedWO.nte || 0)).toFixed(2)}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Comments / Notes</label>
                <textarea
                  value={selectedWO.comments || ''}
                  onChange={(e) => setSelectedWO({ ...selectedWO, comments: e.target.value })}
                  onBlur={() => updateWorkOrder(selectedWO.wo_id, { comments: selectedWO.comments })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  rows="4"
                  placeholder="Add any notes or comments..."
                />
              </div>

              <div className="flex flex-col gap-3 pt-4 border-t border-gray-700">
                
                {selectedWO.status === 'completed' && !selectedWO.acknowledged && !selectedWO.is_locked && (
                  <button
                    onClick={() => acknowledgeWorkOrder(selectedWO.wo_id)}
                    className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold text-lg transition"
                  >
                    ✅ Acknowledge Completion & Lock
                  </button>
                )}

                {selectedWO.acknowledged && !selectedWO.is_locked && (
                  <div className="bg-blue-900 text-blue-200 p-4 rounded-lg text-center">
                    <div className="font-bold">✅ Acknowledged - Ready for Invoice</div>
                    <div className="text-sm mt-1">
                      Acknowledged on {new Date(selectedWO.acknowledged_at).toLocaleString()}
                    </div>
                  </div>
                )}

                {selectedWO.acknowledged && !selectedWO.is_locked && showInvoiceButton && (
                  <button
                    onClick={() => generateInvoice(selectedWO.wo_id)}
                    disabled={generatingInvoice}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-bold text-lg transition"
                  >
                    {generatingInvoice ? '⏳ Generating...' : '📄 Generate Invoice'}
                  </button>
                )}

                {selectedWO.is_locked && selectedWO.acknowledged && (
                  <div className="bg-purple-900 text-purple-200 p-4 rounded-lg text-center">
                    <div className="font-bold">🔒 Invoice Generated</div>
                    <div className="text-sm mt-1">
                      <button 
                        onClick={() => window.location.href = '/invoices'}
                        className="underline hover:text-purple-100"
                      >
                        View in Invoicing →
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => deleteWorkOrder(selectedWO.wo_id)}
                  className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded-lg font-semibold transition"
                >
                  🗑️ Delete
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* New Work Order Modal */}
      {showNewWOModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">+ New Work Order</h2>
              <button
                onClick={() => setShowNewWOModal(false)}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Work Order # *</label>
                  <input
                    type="text"
                    value={newWO.wo_number}
                    onChange={(e) => setNewWO({ ...newWO, wo_number: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    placeholder="WO-2025-001"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Building *</label>
                  <input
                    type="text"
                    value={newWO.building}
                    onChange={(e) => setNewWO({ ...newWO, building: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    placeholder="Building A"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Description *</label>
                <textarea
                  value={newWO.work_order_description}
                  onChange={(e) => setNewWO({ ...newWO, work_order_description: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  rows="3"
                  placeholder="Describe the work to be done..."
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Requestor</label>
                <input
                  type="text"
                  value={newWO.requestor}
                  onChange={(e) => setNewWO({ ...newWO, requestor: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="John Manager"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Priority</label>
                  <select
                    value={newWO.priority}
                    onChange={(e) => setNewWO({ ...newWO, priority: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Status</label>
                  <select
                    value={newWO.status}
                    onChange={(e) => setNewWO({ ...newWO, status: e.target.value })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  >
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-400 mb-1">NTE Budget</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newWO.nte || ''}
                    onChange={(e) => setNewWO({ ...newWO, nte: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                    placeholder="5000.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Assign to Lead Tech</label>
                <select
                  value={newWO.lead_tech_id}
                  onChange={(e) => setNewWO({ ...newWO, lead_tech_id: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="">Unassigned</option>
                  {users.map(user => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.first_name} {user.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Comments / Notes</label>
                <textarea
                  value={newWO.comments}
                  onChange={(e) => setNewWO({ ...newWO, comments: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  rows="3"
                  placeholder="Add any initial notes..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={createWorkOrder}
                  className="flex-1 bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold transition"
                >
                  Create Work Order
                </button>
                <button
                  onClick={() => setShowNewWOModal(false)}
                  className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl w-full">
            <div className="border-b border-gray-700 p-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold">📥 Import from Google Sheets</h2>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg text-sm">
                <div className="font-bold mb-2">📋 Required Column Format:</div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Column A: WO Number</li>
                  <li>Column B: Date Entered (YYYY-MM-DD)</li>
                  <li>Column C: Building</li>
                  <li>Column D: Description</li>
                  <li>Column E: Requestor</li>
                  <li>Column F: Priority (low/medium/high/emergency)</li>
                  <li>Column G: Status (pending/assigned/in_progress/completed)</li>
                  <li>Column H: NTE Amount</li>
                  <li>Column I: Comments (optional)</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Google Sheets URL (must be set to &quot;Anyone with link can view&quot;)
                </label>
                <input
                  type="text"
                  value={sheetsUrl}
                  onChange={(e) => setSheetsUrl(e.target.value)}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={importFromSheets}
                  disabled={importing}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-bold transition"
                >
                  {importing ? '⏳ Importing...' : 'Import Work Orders'}
                </button>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}