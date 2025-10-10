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
      .in('role', ['lead_tech', 'admin'])
      .order('first_name');

    if (error) {
      console.error('Error fetching users:', error);
    } else {
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

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(wo => wo.status === statusFilter);
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(wo => wo.priority === priorityFilter);
    }

    // Search filter
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

    // If changed to completed, show invoice button
    if (newStatus === 'completed') {
      const wo = workOrders.find(w => w.wo_id === woId);
      if (wo && !wo.is_locked) {
        alert('✅ Work Order marked as Completed! You can now generate an invoice.');
      }
    }
  };

  // Delete Work Order (Password Protected)
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

  // Check if Invoice Can Be Generated
  const checkCanGenerateInvoice = async (woId) => {
    const { data: invoice } = await supabase
      .from('invoices')
      .select('invoice_id, status')
      .eq('wo_id', woId)
      .single();

    const wo = workOrders.find(w => w.wo_id === woId);
    setShowInvoiceButton(wo?.status === 'completed' && !invoice && !wo?.is_locked);
  };

  // Generate Invoice
  const generateInvoice = async (woId) => {
    if (!confirm('Generate invoice for this work order?\n\nThis will:\n- Create a draft invoice\n- Lock the work order from technician edits\n- Send to invoicing for review\n\nContinue?')) {
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
      // Extract spreadsheet ID from URL
      const match = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        alert('Invalid Google Sheets URL');
        setImporting(false);
        return;
      }

      const spreadsheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

      // Fetch CSV data
      const response = await fetch(csvUrl);
      const csvText = await response.text();

      // Parse CSV
      const rows = csvText.split('\n').map(row => {
        // Simple CSV parsing (handle quotes properly in production)
        return row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
      });

      // Skip header row
      const dataRows = rows.slice(1).filter(row => row[0]); // Filter out empty rows

      // Transform to work orders
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

      // Insert into database
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
            {/* Search */}
            <input
              type="text"
              placeholder="🔍 Search WO#, Building, Description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 min-w-[250px] bg-gray-700 text-white px-4 py-2 rounded-lg"
            />

            {/* Status Filter */}
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

            {/* Priority Filter */}
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

            {/* New WO Button */}
            <button
              onClick={() => setShowNewWOModal(true)}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition"
            >
              + New Work Order
            </button>

            {/* Import Button */}
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
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkOrders.map(wo => {
                    const totalCost = calculateTotalCost(wo);
                    const overBudget = totalCost > (wo.nte || 0) && (wo.nte || 0) > 0;

                    return (
                      <tr
                        key={wo.wo_id}
                        className="border-t border-gray-700 hover:bg-gray-750 transition"
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
                              title={`Locked by ${wo.locked_by_user?.first_name} ${wo.locked_by_user?.last_name} on ${new Date(wo.locked_at).toLocaleDateString()}`}
                              className="cursor-help"
                            >
                              🔒
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setSelectedWO(wo)}
                            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm transition"
                          >
                            View
                          </button>
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

      {/* All your modals stay the same - Work Order Detail, New WO, Import */}
      {/* Copy from your previous complete working version */}
    </div>
  );
}