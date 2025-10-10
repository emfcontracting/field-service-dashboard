'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function Dashboard() {
  const router = useRouter();
  const [workOrders, setWorkOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');

  useEffect(() => {
    fetchWorkOrders();
    fetchUsers();
  }, []);

  useEffect(() => {
    filterWorkOrders();
  }, [workOrders, statusFilter, priorityFilter, searchTerm]);

  async function fetchWorkOrders() {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:lead_tech_id (
            user_id,
            first_name,
            last_name
          )
        `)
        .order('date_entered', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  }
async function handleImport() {
  if (!importUrl.trim()) {
    setImportError('Please enter a Google Sheets URL');
    return;
  }

  // Convert Google Sheets URL to CSV export URL
  let csvUrl = importUrl;
  if (importUrl.includes('docs.google.com/spreadsheets')) {
    const match = importUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      const sheetId = match[1];
      csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    }
  }

  setImporting(true);
  setImportError('');

  try {
    // Fetch CSV data
    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch data. Make sure the sheet is publicly accessible.');
    }

    const csvText = await response.text();
    const lines = csvText.split('\n');
    
    if (lines.length < 2) {
      throw new Error('Sheet is empty or invalid format');
    }

    // Parse CSV (skip header row)
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const dataLines = lines.slice(1).filter(line => line.trim());

    let successCount = 0;
    let errorCount = 0;

    for (const line of dataLines) {
      if (!line.trim()) continue;

      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      
      // Map CSV columns to work order fields
      const woData = {
        wo_number: values[0] || `WO-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        date_entered: values[1] || new Date().toISOString().split('T')[0],
        building: values[2] || '',
        work_order_description: values[3] || '',
        requestor: values[4] || '',
        priority: (values[5] || 'medium').toLowerCase(),
        status: (values[6] || 'pending').toLowerCase(),
        nte: parseFloat(values[7]) || 0,
        comments: values[8] || ''
      };

      try {
        const { error } = await supabase
          .from('work_orders')
          .insert(woData);

        if (error) throw error;
        successCount++;
      } catch (error) {
        console.error('Error importing row:', error);
        errorCount++;
      }
    }

    alert(`✅ Import complete!\n${successCount} work orders imported\n${errorCount} errors`);
    setShowImportModal(false);
    setImportUrl('');
    fetchWorkOrders(); // Refresh the list
  } catch (error) {
    console.error('Import error:', error);
    setImportError(error.message);
  } finally {
    setImporting(false);
  }
}

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  }

  function filterWorkOrders() {
    let filtered = workOrders;

    if (statusFilter !== 'all') {
      filtered = filtered.filter(wo => wo.status === statusFilter);
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(wo => wo.priority === priorityFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(wo =>
        wo.wo_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.building?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        wo.work_order_description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredOrders(filtered);
  }

  function getStatusColor(status) {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'assigned': return 'bg-yellow-100 text-yellow-800';
      case 'needs_return': return 'bg-orange-100 text-orange-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Field Service Dashboard</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="WO #, Building, Description..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="needs_return">Needs Return</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  {/* ... existing search, status, priority filters ... */}

  <div className="flex items-end gap-2">
    <button
      onClick={() => router.push('/work-orders/new')}
      className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
    >
      + New Work Order
    </button>
    <button
      onClick={() => setShowImportModal(true)}
      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
      title="Import from Google Sheets"
    >
      📥 Import
    </button>
  </div>
</div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Total Work Orders</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{workOrders.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">In Progress</div>
            <div className="mt-2 text-3xl font-bold text-blue-600">
              {workOrders.filter(wo => wo.status === 'in_progress').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Assigned</div>
            <div className="mt-2 text-3xl font-bold text-yellow-600">
              {workOrders.filter(wo => wo.status === 'assigned').length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm font-medium text-gray-500">Completed</div>
            <div className="mt-2 text-3xl font-bold text-green-600">
              {workOrders.filter(wo => wo.status === 'completed').length}
            </div>
          </div>
        </div>

        {/* Work Orders Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    WO #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Building
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead Tech
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Priority
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-4 text-center text-gray-500">
                      No work orders found
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((wo) => (
                    <tr key={wo.wo_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {wo.wo_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {wo.building}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {wo.work_order_description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : 'Unassigned'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getPriorityColor(wo.priority)}`}>
                          {wo.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(wo.status)}`}>
                          {wo.status?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => router.push(`/work-orders/${wo.wo_id}`)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            onClick={() => router.push('/users')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition text-left"
          >
            <h3 className="text-lg font-semibold text-gray-900">👥 Manage Users</h3>
            <p className="mt-2 text-sm text-gray-500">Add, edit, or deactivate technicians</p>
          </button>
          <button
            onClick={() => router.push('/mobile')}
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition text-left"
          >
            <h3 className="text-lg font-semibold text-gray-900">📱 Mobile View</h3>
            <p className="mt-2 text-sm text-gray-500">Field technician mobile interface</p>
          </button>
          <button
            className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition text-left"
          >
            <h3 className="text-lg font-semibold text-gray-900">📊 Reports</h3>
            <p className="mt-2 text-sm text-gray-500">View analytics and generate reports</p>
          </button>
        </div>
      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">📥 Import from Google Sheets</h2>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportUrl('');
                  setImportError('');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google Sheets URL
                </label>
                <input
                  type="text"
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {importError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {importError}
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-700 font-medium mb-2">📋 Required Sheet Format:</p>
                <div className="text-xs text-gray-600 space-y-1">
                  <p><strong>Column A:</strong> WO Number</p>
                  <p><strong>Column B:</strong> Date Entered (YYYY-MM-DD)</p>
                  <p><strong>Column C:</strong> Building</p>
                  <p><strong>Column D:</strong> Description</p>
                  <p><strong>Column E:</strong> Requestor</p>
                  <p><strong>Column F:</strong> Priority (emergency/high/medium/low)</p>
                  <p><strong>Column G:</strong> Status (pending/assigned/in_progress/completed)</p>
                  <p><strong>Column H:</strong> NTE Amount (number)</p>
                  <p><strong>Column I:</strong> Comments (optional)</p>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>⚠️ Important:</strong> Make sure your Google Sheet is set to "Anyone with the link can view"
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportUrl('');
                    setImportError('');
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing || !importUrl.trim()}
                  className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400"
                >
                  {importing ? 'Importing...' : '📥 Import Work Orders'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
    </div>
  );
}