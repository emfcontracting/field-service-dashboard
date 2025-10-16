'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import ImportModal from '../components/ImportModal';

const supabase = createClientComponentClient();

export default function Dashboard() {
  // State Management
  const [activeView, setActiveView] = useState('workorders'); // ADD THIS LINE
  const [workOrders, setWorkOrders] = useState([]);
  const [filteredWorkOrders, setFilteredWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [showNewWOModal, setShowNewWOModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Availability Dashboard States - ADD THESE
  const [availabilityData, setAvailabilityData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityStats, setAvailabilityStats] = useState({
    totalTechs: 0,
    submitted: 0,
    available: 0,
    emergencyOnly: 0,
    notAvailable: 0,
    pending: 0
  });
  
  // NEW: Team Member Modal States
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [selectedTeamUserId, setSelectedTeamUserId] = useState('');
  const [selectedTeamRole, setSelectedTeamRole] = useState('helper');
  
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

  // Load Availability Data when view changes - ADD THIS
  useEffect(() => {
    if (activeView === 'availability') {
      loadAvailabilityData();
    }
  }, [activeView, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ADD THIS FUNCTION - Load Availability Data
  const loadAvailabilityData = async () => {
    try {
      setAvailabilityLoading(true);
      
      // Get all active techs and helpers
      const { data: techUsers, error: usersError } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, role, email')
        .in('role', ['tech', 'helper', 'lead_tech'])
        .eq('is_active', true)
        .order('role')
        .order('first_name');

      if (usersError) throw usersError;

      // Get availability for selected date
      const dateStr = selectedDate.toISOString().split('T')[0];
      const { data: availability, error: availError } = await supabase
        .from('daily_availability')
        .select('*')
        .eq('availability_date', dateStr);

      if (availError) throw availError;

      // Combine data
      const combinedData = techUsers.map(user => {
        const userAvail = availability.find(a => a.user_id === user.user_id);
        
        let status = 'pending';
        let statusColor = 'text-yellow-400';
        let statusIcon = '⏰';
        let statusText = 'Awaiting Response';
        
        if (userAvail) {
          if (userAvail.not_available) {
            status = 'not_available';
            statusColor = 'text-red-400';
            statusIcon = '🚫';
            statusText = 'Not Available';
          } else if (userAvail.scheduled_work && userAvail.emergency_work) {
            status = 'fully_available';
            statusColor = 'text-green-400';
            statusIcon = '✅';
            statusText = 'Available All';
          } else if (userAvail.scheduled_work) {
            status = 'scheduled_only';
            statusColor = 'text-blue-400';
            statusIcon = '📅';
            statusText = 'Scheduled Only';
          } else if (userAvail.emergency_work) {
            status = 'emergency_only';
            statusColor = 'text-orange-400';
            statusIcon = '🚨';
            statusText = 'Emergency Only';
          }
        }

        return {
          ...user,
          availability: userAvail,
          status,
          statusColor,
          statusIcon,
          statusText,
          submitted: !!userAvail,
          submitted_at: userAvail?.submitted_at
        };
      });

      setAvailabilityData(combinedData);
      
      // Calculate stats
      const newStats = {
        totalTechs: techUsers.length,
        submitted: combinedData.filter(u => u.submitted).length,
        available: combinedData.filter(u => 
          u.availability?.scheduled_work || u.availability?.emergency_work
        ).length,
        emergencyOnly: combinedData.filter(u => 
          u.availability?.emergency_work && !u.availability?.scheduled_work
        ).length,
        notAvailable: combinedData.filter(u => u.availability?.not_available).length,
        pending: combinedData.filter(u => !u.submitted).length
      };
      
      setAvailabilityStats(newStats);
    } catch (err) {
      console.error('Error loading availability:', err);
    } finally {
      setAvailabilityLoading(false);
    }
  };

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
    .order('date_entered', { ascending: true });

  if (error) {
    console.error('Error fetching work orders:', error);
  } else {
    // Filter out acknowledged and invoiced work orders from the dashboard
    // They will only appear in the Invoicing page
    const filteredData = (data || []).filter(wo => {
      // Hide acknowledged work orders
      if (wo.acknowledged) return false;
      
      // Hide invoiced work orders (is_locked = true)
      if (wo.is_locked) return false;
      
      return true;
    });
    
    setWorkOrders(filteredData);
    calculateStats(filteredData);
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
  if (!confirm('Acknowledge this completed work order?\n\nThis will prepare it for invoicing.')) {
    return;
  }

  const { error } = await supabase
    .from('work_orders')
    .update({
      acknowledged: true,
      acknowledged_at: new Date().toISOString(),
      acknowledged_by: null
      // DON'T lock it yet - only lock when invoice is generated
    })
    .eq('wo_id', woId);

  if (error) {
    console.error('Error acknowledging work order:', error);
    alert('Failed to acknowledge work order');
  } else {
    alert('✅ Work order acknowledged and ready for invoicing!');
    fetchWorkOrders();
    if (selectedWO?.wo_id === woId) {
      setSelectedWO({
        ...selectedWO,
        acknowledged: true,
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
// Add this function after generateInvoice
const assignToField = async (woId) => {
  if (!confirm('Assign this work order to field workers?\n\nThis will make it visible in the mobile app.')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('work_orders')
      .update({
        assigned_to_field: true,
        assigned_to_field_by: 'admin',
        assigned_to_field_at: new Date().toISOString()
      })
      .eq('wo_id', woId);

    if (error) {
      alert('❌ Error assigning to field: ' + error.message);
    } else {
      alert('✅ Work order assigned to field workers!');
      setSelectedWO(null);
      fetchWorkOrders();
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
    console.error(err);
  }
};

const unassignFromField = async (woId) => {
  if (!confirm('Remove this work order from field workers?\n\nThis will hide it from the mobile app.')) {
    return;
  }

  try {
    const { error } = await supabase
      .from('work_orders')
      .update({
        assigned_to_field: false,
        assigned_to_field_by: null,
        assigned_to_field_at: null
      })
      .eq('wo_id', woId);

    if (error) {
      alert('❌ Error unassigning from field: ' + error.message);
    } else {
      alert('✅ Work order removed from field workers!');
      setSelectedWO(null);
      fetchWorkOrders();
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
    console.error(err);
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

    console.log('Fetching from:', csvUrl);

    const response = await fetch(csvUrl);
    const csvText = await response.text();

    console.log('Raw CSV (first 500 chars):', csvText.substring(0, 500));

    // Split into lines
    const lines = csvText.split('\n');
    const header = lines[0];
    console.log('Header:', header);
    
    const dataRows = [];
    
    // Parse each line properly handling quotes
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Better CSV parsing that handles quoted commas
      const result = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = line[j + 1];
        
        if (char === '"' && nextChar === '"') {
          // Escaped quote
          current += '"';
          j++; // Skip next quote
        } else if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim()); // Don't forget last column
      
      if (result[0]) { // Has WO#
        dataRows.push(result);
      }
    }

    console.log(`Found ${dataRows.length} rows to import`);
    console.log('First data row:', dataRows[0]);
    console.log('Columns in first row:', dataRows[0].length);

    const workOrdersToImport = dataRows.map((row, idx) => {
      // Column 0: WO#
      // Column 1: Building
      // Column 2: Priority  
      // Column 3: Date entered (format: "6/6/2025 9:31:00")
      // Column 4: Work Order Description
      // Column 5: NTE
      // Column 6: CONTACT
      
      console.log(`Row ${idx + 2} date value:`, row[3]);
      
      // Parse date - handle format like "6/6/2025 9:31:00" or "7/16/2025 15:42:00"
      let dateEntered;
      const dateStr = String(row[3] || '').trim();
      
      if (dateStr) {
        // Try to parse the date string
        const parsed = new Date(dateStr);
        
        if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000) {
          dateEntered = parsed.toISOString();
          console.log(`  ✓ Parsed "${dateStr}" → ${dateEntered}`);
        } else {
          console.warn(`  ✗ Failed to parse "${dateStr}"`);
          dateEntered = new Date().toISOString();
        }
      } else {
        console.warn(`  ✗ No date in row ${idx + 2}`);
        dateEntered = new Date().toISOString();
      }

      // Parse priority
      let priority = 'medium';
      const priorityStr = String(row[2] || '').toLowerCase();
      if (priorityStr.includes('emergency') || priorityStr.includes('p1')) {
        priority = 'emergency';
      } else if (priorityStr.includes('urgent') || priorityStr.includes('p2')) {
        priority = 'high';
      } else if (priorityStr.includes('p3') || priorityStr.includes('p4')) {
        priority = 'medium';
      } else if (priorityStr.includes('p5')) {
        priority = 'low';
      }

      return {
        wo_number: String(row[0] || '').trim(),
        building: String(row[1] || '').trim(),
        priority: priority,
        date_entered: dateEntered,
        work_order_description: String(row[4] || '').trim(),
        nte: parseFloat(String(row[5] || '').replace(/[^0-9.]/g, '')) || 0,
        requestor: String(row[6] || '').trim(),
        status: 'pending',
        comments: ''
      };
    });

    console.log('Sample work order to import:', workOrdersToImport[0]);

    const { data, error } = await supabase
      .from('work_orders')
      .insert(workOrdersToImport)
      .select();

    if (error) {
      console.error('Import error:', error);
      alert('❌ Import error: ' + error.message);
    } else {
      console.log(`✅ Imported ${data.length} work orders`);
      alert(`✅ Successfully imported ${data.length} work orders!`);
      setShowImportModal(false);
      setSheetsUrl('');
      fetchWorkOrders();
    }
  } catch (error) {
    console.error('Import exception:', error);
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
          <div className="flex items-center gap-4">
  <img 
    src="/emf-logo.png" 
    alt="EMF Contracting LLC" 
    className="h-12 w-auto"
  />
  <div>
    <h1 className="text-2xl font-bold">EMF Contracting LLC</h1>
    <p className="text-sm text-gray-400">Field Service Dashboard</p>
  </div>
</div>
          <div className="flex gap-3">
            {/* UPDATED NAVIGATION WITH AVAILABILITY BUTTON */}
            <button
              onClick={() => setActiveView(activeView === 'availability' ? 'workorders' : 'availability')}
              className={`${
                activeView === 'availability' ? 'bg-green-700' : 'bg-green-600'
              } hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2`}
            >
              {activeView === 'availability' ? '← Back to WOs' : '📅 Daily Availability'}
            </button>
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
  onClick={() => window.location.href = '/settings'}
  className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold transition"
>
  ⚙️ Settings
</button>
            <button
              onClick={() => window.location.href = '/mobile'}
              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition"
            >
              📱 Mobile App
            </button>
          </div>
        </div>

        {/* AVAILABILITY VIEW - ADD THIS ENTIRE SECTION */}
        {activeView === 'availability' ? (
          <div className="space-y-6">
            {/* Date Navigation */}
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setDate(newDate.getDate() - 1);
                    setSelectedDate(newDate);
                  }}
                  className="bg-gray-700 hover:bg-gray-600 p-3 rounded-lg transition"
                >
                  ←
                </button>
                
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const compareDate = new Date(selectedDate);
                      compareDate.setHours(0, 0, 0, 0);
                      
                      if (compareDate.getTime() === today.getTime()) return 'Today';
                      if (compareDate.getTime() === today.getTime() + 86400000) return 'Tomorrow';
                      if (compareDate.getTime() === today.getTime() - 86400000) return 'Yesterday';
                      return selectedDate.toLocaleDateString();
                    })()}
                  </div>
                  <div className="text-sm text-gray-400">
                    {selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    const newDate = new Date(selectedDate);
                    newDate.setDate(newDate.getDate() + 1);
                    setSelectedDate(newDate);
                  }}
                  className="bg-gray-700 hover:bg-gray-600 p-3 rounded-lg transition"
                >
                  →
                </button>
              </div>

              <button
                onClick={loadAvailabilityData}
                className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold transition"
              >
                ⟳ Refresh Availability
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-3xl font-bold">{availabilityStats.totalTechs}</div>
                <div className="text-sm text-gray-400">Total Team</div>
              </div>
              <div className="bg-green-900 rounded-lg p-4">
                <div className="text-3xl font-bold text-green-400">{availabilityStats.submitted}</div>
                <div className="text-sm text-green-300">Submitted</div>
              </div>
              <div className="bg-blue-900 rounded-lg p-4">
                <div className="text-3xl font-bold text-blue-400">{availabilityStats.available}</div>
                <div className="text-sm text-blue-300">Available</div>
              </div>
              <div className="bg-orange-900 rounded-lg p-4">
                <div className="text-3xl font-bold text-orange-400">{availabilityStats.emergencyOnly}</div>
                <div className="text-sm text-orange-300">Emergency</div>
              </div>
              <div className="bg-red-900 rounded-lg p-4">
                <div className="text-3xl font-bold text-red-400">{availabilityStats.notAvailable}</div>
                <div className="text-sm text-red-300">Not Available</div>
              </div>
              <div className="bg-yellow-900 rounded-lg p-4">
                <div className="text-3xl font-bold text-yellow-400">{availabilityStats.pending}</div>
                <div className="text-sm text-yellow-300">Pending</div>
              </div>
            </div>

            {/* Legend */}
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex flex-wrap gap-6 text-sm justify-center">
                <span>✅ Fully Available</span>
                <span>📅 Scheduled Only</span>
                <span>🚨 Emergency Only</span>
                <span>🚫 Not Available</span>
                <span>⏰ Pending</span>
              </div>
            </div>

            {/* Availability List */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              {availabilityLoading ? (
                <div className="p-8 text-center text-gray-400">Loading availability...</div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {availabilityData.map(user => (
                    <div key={user.user_id} className="p-4 hover:bg-gray-700 transition">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="text-4xl">{user.statusIcon}</span>
                          <div>
                            <div className="font-bold text-white text-lg">
                              {user.first_name} {user.last_name}
                              <span className="ml-2 text-sm text-gray-400">
                                ({user.role?.replace('_', ' ').toUpperCase()})
                              </span>
                            </div>
                            <div className="text-sm text-gray-400">{user.email}</div>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className={`font-bold text-lg ${user.statusColor}`}>
                            {user.statusText}
                          </div>
                          {user.submitted_at && (
                            <div className="text-sm text-gray-400">
                              Submitted at {new Date(user.submitted_at).toLocaleTimeString()}
                            </div>
                          )}
                          {!user.submitted && (
                            <div className="text-sm text-yellow-400 font-semibold">
                              ⚠️ Not submitted yet
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {user.availability && (
                        <div className="mt-3 flex gap-3">
                          {user.availability.scheduled_work && (
                            <span className="px-3 py-1 bg-blue-900 text-blue-300 text-xs rounded-full">
                              📅 SCHEDULED WORK
                            </span>
                          )}
                          {user.availability.emergency_work && (
                            <span className="px-3 py-1 bg-orange-900 text-orange-300 text-xs rounded-full">
                              🚨 EMERGENCY WORK
                            </span>
                          )}
                          {user.availability.not_available && (
                            <span className="px-3 py-1 bg-red-900 text-red-300 text-xs rounded-full">
                              🚫 NOT AVAILABLE
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-yellow-900 rounded-lg p-4">
              <div className="text-yellow-300 font-bold mb-2">Daily Availability System</div>
              <ul className="text-sm text-yellow-200 space-y-1">
                <li>• All field workers must submit by 8:00 PM EST daily</li>
                <li>• Mobile app locks after 8 PM until submission</li>
                <li>• Navigate dates to view past/future availability</li>
              </ul>
            </div>
          </div>
        ) : (
          // YOUR EXISTING WORK ORDERS VIEW - Everything else stays the same
          <>
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
    <div className="overflow-x-auto overflow-y-visible" style={{ maxWidth: '100%' }}>
      <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: '1400px' }}>
        <thead className="bg-gray-700">
          <tr>
            <th className="px-2 py-2 text-left" style={{ width: '100px' }}>WO#</th>
            <th className="px-2 py-2 text-left" style={{ width: '80px' }}>Date</th>
            <th className="px-2 py-2 text-left" style={{ width: '80px' }}>Building</th>
            <th className="px-2 py-2 text-left" style={{ width: '300px' }}>Description</th>
            <th className="px-2 py-2 text-left" style={{ width: '120px' }}>Status</th>
            <th className="px-2 py-2 text-left" style={{ width: '80px' }}>Priority</th>
            <th className="px-2 py-2 text-left" style={{ width: '120px' }}>Lead Tech</th>
            <th className="px-2 py-2 text-right" style={{ width: '80px' }}>NTE</th>
            <th className="px-2 py-2 text-right" style={{ width: '80px' }}>Est Cost</th>
            <th className="px-2 py-2 text-center" style={{ width: '40px' }}>🔒</th>
            <th className="px-2 py-2 text-center" style={{ width: '60px' }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {filteredWorkOrders.map(wo => {
            const totalCost = calculateTotalCost(wo);
            const overBudget = totalCost > (wo.nte || 0) && (wo.nte || 0) > 0;
            
            // Debug log first item only
            if (wo === filteredWorkOrders[0]) {
              console.log('First WO data:', {
                wo_number: wo.wo_number,
                date_entered: wo.date_entered,
                created_at: wo.date_entered,
                date_entered_type: typeof wo.date_entered,
                created_at_type: typeof wo.date_entered
              });
            }

            return (
             <tr
  key={wo.wo_id}
  onClick={() => selectWorkOrderEnhanced(wo)}
  className="border-t border-gray-700 hover:bg-gray-700 transition cursor-pointer"
>
                <td className="px-2 py-2 font-semibold">{wo.wo_number}</td>
                <td className="px-2 py-2">
                  {(() => {
                    // Try to get a valid date from any available field
                    const dateValue = wo.date_entered || wo.date_entered;
                    
                    if (!dateValue) return 'No Date';
                    
                    const date = new Date(dateValue);
                    
                    // Check if date is valid and not epoch
                    if (isNaN(date.getTime()) || date.getFullYear() < 2000) {
                      return 'Invalid';
                    }
                    
                    return date.toLocaleDateString('en-US', { 
                      month: '2-digit', 
                      day: '2-digit',
                      year: '2-digit'
                    });
                  })()}
                </td>
                <td className="px-2 py-2">{wo.building}</td>
                <td className="px-2 py-2">
                  <div className="truncate" title={wo.work_order_description}>
                    {wo.work_order_description}
                  </div>
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-col gap-1">
                    <span className={`px-2 py-1 rounded text-xs font-semibold text-center ${getStatusColor(wo.status)}`}>
                      {wo.status.replace('_', ' ').toUpperCase()}
                    </span>
                    {wo.assigned_to_field && (
                      <span className="px-1 py-0.5 bg-blue-600 rounded text-xs font-bold text-center">
                        📱
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-2 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(wo.priority)}`}>
                    {wo.priority.charAt(0).toUpperCase()}
                  </span>
                </td>
                <td className="px-2 py-2">
                  {wo.lead_tech ? (
                    <div className="truncate" title={`${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`}>
                      {wo.lead_tech.first_name} {wo.lead_tech.last_name.charAt(0)}.
                    </div>
                  ) : (
                    <span className="text-gray-500">Unassigned</span>
                  )}
                </td>
                <td className="px-2 py-2 text-right font-semibold">
                  ${(wo.nte || 0).toFixed(0)}
                </td>
                <td className="px-2 py-2 text-right">
                  <span className={overBudget ? 'text-red-400 font-bold' : ''}>
                    ${(totalCost || 0).toFixed(0)}
                  </span>
                </td>
                <td className="px-2 py-2 text-center">
                  {wo.is_locked && '🔒'}
                </td>
                <td className="px-2 py-2 text-center">
                  <button
  className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs font-bold"
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
          </>
        )}
        {/* END OF CONDITIONAL RENDER */}
      </div>

      {/* ALL YOUR EXISTING MODALS STAY HERE UNCHANGED */}
      {/* Work Order Detail Modal */}
      {selectedWO && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          {/* Your entire existing modal code stays exactly the same */}
          {/* I'm not including it here to save space but it all stays */}
        </div>
      )}

      {/* New Work Order Modal */}
      {showNewWOModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          {/* Your entire existing modal code stays exactly the same */}
        </div>
      )}

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => fetchWorkOrders()}
      />
    </div>
  );
}