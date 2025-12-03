'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function WorkOrderDetail({ params }) {
  const router = useRouter();
  const [workOrder, setWorkOrder] = useState(null);
  const [users, setUsers] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Daily Hours Log State
  const [dailyLogs, setDailyLogs] = useState([]);
  const [showAddHoursModal, setShowAddHoursModal] = useState(false);
  const [selectedUserForHours, setSelectedUserForHours] = useState(null);
  const [newHoursEntry, setNewHoursEntry] = useState({
    workDate: new Date().toISOString().split('T')[0],
    hoursRegular: '',
    hoursOvertime: '',
    miles: '',
    notes: ''
  });

  // Extract id from params
  const workOrderId = params?.id;

  useEffect(() => {
    if (workOrderId) {
      fetchUsers();
      fetchWorkOrder();
      fetchTeamMembers();
      fetchDailyLogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId]);

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

  async function fetchWorkOrder() {
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
        .eq('wo_id', workOrderId)
        .single();

      if (error) throw error;
      setWorkOrder(data);
    } catch (error) {
      console.error('Error fetching work order:', error);
      alert('Error loading work order');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTeamMembers() {
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
        .eq('wo_id', workOrderId);

      if (error) throw error;
      setTeamMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
    }
  }

  async function fetchDailyLogs() {
    try {
      const { data, error } = await supabase
        .from('daily_hours_log')
        .select(`
          *,
          user:users(user_id, first_name, last_name)
        `)
        .eq('wo_id', workOrderId)
        .order('work_date', { ascending: false });

      if (error) throw error;
      setDailyLogs(data || []);
    } catch (error) {
      console.error('Error fetching daily logs:', error);
    }
  }

  async function updateWorkOrder(updates) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update(updates)
        .eq('wo_id', workOrderId);

      if (error) throw error;

      setWorkOrder({ ...workOrder, ...updates });
      // Removed alert for cleaner UX on field updates
    } catch (error) {
      console.error('Error updating work order:', error);
      alert('❌ Error updating work order');
    } finally {
      setSaving(false);
    }
  }

  async function addTeamMember(userId, role) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_order_assignments')
        .insert({
          wo_id: workOrderId,
          user_id: userId,
          role_on_job: role,
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

  async function updateTeamMember(assignmentId, updates) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('work_order_assignments')
        .update(updates)
        .eq('assignment_id', assignmentId);

      if (error) throw error;

      // Update local state instead of refetching
      setTeamMembers(teamMembers.map(tm => 
        tm.assignment_id === assignmentId ? { ...tm, ...updates } : tm
      ));
    } catch (error) {
      console.error('Error updating team member:', error);
      alert('❌ Error updating');
    } finally {
      setSaving(false);
    }
  }

  async function removeTeamMember(assignmentId) {
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

  // ==================== DAILY HOURS LOG FUNCTIONS ====================

  async function addDailyHoursEntry() {
    if (!selectedUserForHours) {
      alert('Please select a user');
      return;
    }

    const rt = parseFloat(newHoursEntry.hoursRegular) || 0;
    const ot = parseFloat(newHoursEntry.hoursOvertime) || 0;
    
    if (rt === 0 && ot === 0) {
      alert('Please enter at least one hour (regular or overtime)');
      return;
    }

    if (rt + ot > 24) {
      alert('Total hours cannot exceed 24 hours per day');
      return;
    }

    setSaving(true);
    try {
      // Check for duplicate entry
      const { data: existing } = await supabase
        .from('daily_hours_log')
        .select('id')
        .eq('wo_id', workOrderId)
        .eq('user_id', selectedUserForHours.user_id)
        .eq('work_date', newHoursEntry.workDate)
        .single();

      if (existing) {
        alert('Hours already logged for this user on this date. Please edit the existing entry.');
        setSaving(false);
        return;
      }

      // Find assignment_id if user is a team member
      const assignment = teamMembers.find(tm => tm.user_id === selectedUserForHours.user_id);

      const { error } = await supabase
        .from('daily_hours_log')
        .insert({
          wo_id: workOrderId,
          user_id: selectedUserForHours.user_id,
          assignment_id: assignment?.assignment_id || null,
          work_date: newHoursEntry.workDate,
          hours_regular: rt,
          hours_overtime: ot,
          miles: parseFloat(newHoursEntry.miles) || 0,
          notes: newHoursEntry.notes || null
        });

      if (error) throw error;

      await fetchDailyLogs();
      setShowAddHoursModal(false);
      setSelectedUserForHours(null);
      setNewHoursEntry({
        workDate: new Date().toISOString().split('T')[0],
        hoursRegular: '',
        hoursOvertime: '',
        miles: '',
        notes: ''
      });
      alert('✅ Daily hours added!');
    } catch (error) {
      console.error('Error adding daily hours:', error);
      alert('❌ Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteDailyLog(logId) {
    if (!confirm('Are you sure you want to delete this hours entry?')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('daily_hours_log')
        .delete()
        .eq('id', logId);

      if (error) throw error;

      await fetchDailyLogs();
      alert('✅ Hours entry deleted');
    } catch (error) {
      console.error('Error deleting daily log:', error);
      alert('❌ Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  // ==================== CALCULATE TOTALS ====================

  function calculateTotals() {
    if (!workOrder) return { 
      legacyLabor: 0, legacyHours: 0, legacyMiles: 0,
      dailyLabor: 0, dailyHours: 0, dailyMiles: 0,
      totalLabor: 0, totalHours: 0, totalMiles: 0, totalCosts: 0 
    };

    // LEGACY: Lead tech hours from work_orders table
    const leadTech = users.find(u => u.user_id === workOrder.lead_tech_id);
    const legacyLeadLabor = 
      ((workOrder.hours_regular || 0) * (leadTech?.hourly_rate_regular || 64)) +
      ((workOrder.hours_overtime || 0) * (leadTech?.hourly_rate_overtime || 96));
    const legacyLeadHours = (workOrder.hours_regular || 0) + (workOrder.hours_overtime || 0);
    const legacyLeadMiles = workOrder.miles || 0;

    // LEGACY: Team member hours from work_order_assignments table
    const legacyTeamLabor = teamMembers.reduce((sum, member) => {
      return sum + 
        ((member.hours_regular || 0) * (member.users?.hourly_rate_regular || 64)) +
        ((member.hours_overtime || 0) * (member.users?.hourly_rate_overtime || 96));
    }, 0);
    const legacyTeamHours = teamMembers.reduce((sum, m) => 
      sum + (m.hours_regular || 0) + (m.hours_overtime || 0), 0);
    const legacyTeamMiles = teamMembers.reduce((sum, m) => sum + (m.miles || 0), 0);

    // Total legacy
    const legacyLabor = legacyLeadLabor + legacyTeamLabor;
    const legacyHours = legacyLeadHours + legacyTeamHours;
    const legacyMiles = legacyLeadMiles + legacyTeamMiles;

    // DAILY LOGS: Calculate from daily_hours_log table
    const dailyLabor = dailyLogs.reduce((sum, log) => {
      return sum + 
        ((log.hours_regular || 0) * 64) +
        ((log.hours_overtime || 0) * 96);
    }, 0);
    const dailyHours = dailyLogs.reduce((sum, log) => 
      sum + (log.hours_regular || 0) + (log.hours_overtime || 0), 0);
    const dailyMiles = dailyLogs.reduce((sum, log) => sum + (log.miles || 0), 0);

    // COMBINED TOTALS
    const totalLabor = legacyLabor + dailyLabor;
    const totalHours = legacyHours + dailyHours;
    const totalMiles = legacyMiles + dailyMiles;

    const totalCosts = 
      (workOrder.material_cost || 0) +
      (workOrder.emf_equipment_cost || 0) +
      (workOrder.trailer_cost || 0) +
      (workOrder.rental_cost || 0);

    return {
      legacyLabor, legacyHours, legacyMiles,
      dailyLabor, dailyHours, dailyMiles,
      totalLabor, totalHours, totalMiles, totalCosts
    };
  }

  // Get all users who can log hours (lead tech + team members)
  function getAssignedUsers() {
    const assignedUsers = [];
    
    // Add lead tech if exists
    if (workOrder?.lead_tech_id) {
      const leadTech = users.find(u => u.user_id === workOrder.lead_tech_id);
      if (leadTech) {
        assignedUsers.push({ ...leadTech, role: 'Lead Tech' });
      }
    }
    
    // Add team members
    teamMembers.forEach(tm => {
      if (tm.users && !assignedUsers.find(u => u.user_id === tm.users.user_id)) {
        assignedUsers.push({ ...tm.users, role: tm.role_on_job || 'Helper' });
      }
    });
    
    return assignedUsers;
  }

  // Group daily logs by user
  function getDailyLogsByUser() {
    const grouped = {};
    dailyLogs.forEach(log => {
      const userId = log.user_id;
      if (!grouped[userId]) {
        grouped[userId] = {
          user: log.user,
          logs: [],
          totalRT: 0,
          totalOT: 0,
          totalMiles: 0
        };
      }
      grouped[userId].logs.push(log);
      grouped[userId].totalRT += log.hours_regular || 0;
      grouped[userId].totalOT += log.hours_overtime || 0;
      grouped[userId].totalMiles += log.miles || 0;
    });
    return grouped;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-xl text-gray-600">Work order not found</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const totals = calculateTotals();
  const adminHours = 2; // 2 hours admin charge
  const adminCost = adminHours * 64;
  const grandTotal = totals.totalLabor + adminCost + (totals.totalMiles * 1.00) + totals.totalCosts;
  const remaining = (workOrder.nte || 0) - grandTotal;
  const dailyLogsByUser = getDailyLogsByUser();
  const assignedUsers = getAssignedUsers();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <button
                onClick={() => router.push('/')}
                className="text-blue-600 hover:text-blue-800 mb-2"
              >
                ← Back to Dashboard
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Work Order #{workOrder.wo_number}</h1>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Status</p>
              <span className={`inline-block px-4 py-2 rounded-lg text-lg font-semibold ${
                workOrder.status === 'needs_return' 
                  ? 'bg-orange-100 text-orange-800 border-2 border-orange-400'
                  : workOrder.status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : workOrder.status === 'in_progress'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {workOrder.status === 'needs_return' 
                  ? '⚠️ Review for Invoice' 
                  : workOrder.status?.replace('_', ' ').toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert for Review Status */}
        {workOrder.status === 'needs_return' && (
          <div className="mb-6 bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-bold text-orange-800">
                  Returned from Invoicing Team
                </h3>
                <p className="mt-1 text-sm text-orange-700">
                  This work order needs to be reviewed and updated before it can be invoiced. 
                  Please review the comments below for details on what needs to be changed.
                </p>
                <p className="mt-2 text-xs text-orange-600 font-medium">
                  After making updates, change the status to "Completed" to send it back for invoicing.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Work Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Work Order Details</h2>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={workOrder.status}
                    onChange={(e) => updateWorkOrder({ status: e.target.value })}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="needs_return">Review for Invoice</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    value={workOrder.priority}
                    onChange={(e) => updateWorkOrder({ priority: e.target.value })}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Building</label>
                  <input
                    type="text"
                    value={workOrder.building || ''}
                    onChange={(e) => setWorkOrder({...workOrder, building: e.target.value})}
                    onBlur={() => updateWorkOrder({ building: workOrder.building })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={workOrder.work_order_description || ''}
                    onChange={(e) => setWorkOrder({...workOrder, work_order_description: e.target.value})}
                    onBlur={() => updateWorkOrder({ work_order_description: workOrder.work_order_description })}
                    rows="4"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Requestor</label>
                  <input
                    type="text"
                    value={workOrder.requestor || ''}
                    onChange={(e) => setWorkOrder({...workOrder, requestor: e.target.value})}
                    onBlur={() => updateWorkOrder({ requestor: workOrder.requestor })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Lead Technician</label>
                  <select
                    value={workOrder.lead_tech_id || ''}
                    onChange={(e) => updateWorkOrder({ lead_tech_id: e.target.value || null })}
                    disabled={saving}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="">Unassigned</option>
                    {users
                      .filter(u => ['lead_tech', 'tech'].includes(u.role))
                      .map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.first_name} {user.last_name} ({user.role})
                        </option>
                      ))
                    }
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">NTE Budget</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.nte || ''}
                    onChange={(e) => setWorkOrder({...workOrder, nte: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ nte: workOrder.nte })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Legacy Hours Section (Existing Data) */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-gray-900">📋 Legacy Hours (Existing Data)</h2>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                  From original entry system
                </span>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                These are hours entered directly on the work order. New hours should be logged using the Daily Hours Log below.
              </p>
              
              {/* Lead Tech Legacy Hours */}
              <div className="mb-6">
                <h3 className="text-md font-semibold text-gray-700 mb-3">Lead Tech: {workOrder.lead_tech?.first_name} {workOrder.lead_tech?.last_name}</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Regular Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      value={workOrder.hours_regular || ''}
                      onChange={(e) => setWorkOrder({...workOrder, hours_regular: parseFloat(e.target.value) || 0})}
                      onBlur={() => updateWorkOrder({ hours_regular: workOrder.hours_regular })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Overtime Hours</label>
                    <input
                      type="number"
                      step="0.5"
                      value={workOrder.hours_overtime || ''}
                      onChange={(e) => setWorkOrder({...workOrder, hours_overtime: parseFloat(e.target.value) || 0})}
                      onBlur={() => updateWorkOrder({ hours_overtime: workOrder.hours_overtime })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Miles</label>
                    <input
                      type="number"
                      step="0.1"
                      value={workOrder.miles || ''}
                      onChange={(e) => setWorkOrder({...workOrder, miles: parseFloat(e.target.value) || 0})}
                      onBlur={() => updateWorkOrder({ miles: workOrder.miles })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Team Member Legacy Hours */}
              {teamMembers.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold text-gray-700 mb-3">Team Members</h3>
                  <div className="space-y-4">
                    {teamMembers.map(member => (
                      <div key={member.assignment_id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <p className="font-bold text-gray-900">
                              {member.users?.first_name} {member.users?.last_name}
                            </p>
                            <p className="text-sm text-gray-500 capitalize">{member.role_on_job?.replace('_', ' ') || 'Helper'}</p>
                          </div>
                          <button
                            onClick={() => {
                              if (confirm(`Remove ${member.users?.first_name} from this work order?`)) {
                                removeTeamMember(member.assignment_id);
                              }
                            }}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Regular Hours</label>
                            <input
                              type="number"
                              step="0.5"
                              value={member.hours_regular || ''}
                              onChange={(e) => {
                                const updated = teamMembers.map(tm => 
                                  tm.assignment_id === member.assignment_id 
                                    ? {...tm, hours_regular: parseFloat(e.target.value) || 0}
                                    : tm
                                );
                                setTeamMembers(updated);
                              }}
                              onBlur={() => updateTeamMember(member.assignment_id, { 
                                hours_regular: member.hours_regular 
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Overtime Hours</label>
                            <input
                              type="number"
                              step="0.5"
                              value={member.hours_overtime || ''}
                              onChange={(e) => {
                                const updated = teamMembers.map(tm => 
                                  tm.assignment_id === member.assignment_id 
                                    ? {...tm, hours_overtime: parseFloat(e.target.value) || 0}
                                    : tm
                                );
                                setTeamMembers(updated);
                              }}
                              onBlur={() => updateTeamMember(member.assignment_id, { 
                                hours_overtime: member.hours_overtime 
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Miles</label>
                            <input
                              type="number"
                              step="0.1"
                              value={member.miles || ''}
                              onChange={(e) => {
                                const updated = teamMembers.map(tm => 
                                  tm.assignment_id === member.assignment_id 
                                    ? {...tm, miles: parseFloat(e.target.value) || 0}
                                    : tm
                                );
                                setTeamMembers(updated);
                              }}
                              onBlur={() => updateTeamMember(member.assignment_id, { 
                                miles: member.miles 
                              })}
                              className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Team Member */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <select
                    id="add-user"
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    defaultValue=""
                  >
                    <option value="">Add team member...</option>
                    {users
                      .filter(u => 
                        u.user_id !== workOrder.lead_tech_id && 
                        !teamMembers.find(tm => tm.user_id === u.user_id) &&
                        ['tech', 'helper', 'lead_tech'].includes(u.role)
                      )
                      .map(user => (
                        <option key={user.user_id} value={user.user_id}>
                          {user.first_name} {user.last_name} ({user.role})
                        </option>
                      ))
                    }
                  </select>
                  <select
                    id="add-role"
                    className="px-4 py-2 border border-gray-300 rounded-lg"
                    defaultValue="helper"
                  >
                    <option value="helper">Helper</option>
                    <option value="tech">Tech</option>
                  </select>
                  <button
                    onClick={() => {
                      const userId = document.getElementById('add-user').value;
                      const role = document.getElementById('add-role').value;
                      if (userId) {
                        addTeamMember(userId, role);
                        document.getElementById('add-user').value = '';
                      }
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                  >
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* Daily Hours Log Section (NEW) */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">📅 Daily Hours Log</h2>
                  <p className="text-sm text-gray-500">Track hours by date for each team member</p>
                </div>
                <button
                  onClick={() => setShowAddHoursModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-semibold"
                >
                  + Log Hours
                </button>
              </div>

              {/* Summary by User */}
              {Object.keys(dailyLogsByUser).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(dailyLogsByUser).map(([userId, userData]) => (
                    <div key={userId} className="border border-blue-200 bg-blue-50 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div>
                          <p className="font-bold text-gray-900">
                            {userData.user?.first_name} {userData.user?.last_name}
                          </p>
                          <p className="text-sm text-gray-600">
                            Total: {userData.totalRT.toFixed(1)} RT + {userData.totalOT.toFixed(1)} OT = {(userData.totalRT + userData.totalOT).toFixed(1)} hrs | {userData.totalMiles.toFixed(1)} mi
                          </p>
                        </div>
                      </div>

                      {/* Individual Log Entries */}
                      <div className="space-y-2">
                        {userData.logs.map(log => (
                          <div key={log.id} className="bg-white rounded p-3 flex justify-between items-center">
                            <div>
                              <span className="font-medium text-gray-700">
                                {new Date(log.work_date).toLocaleDateString('en-US', { 
                                  weekday: 'short', month: 'short', day: 'numeric' 
                                })}
                              </span>
                              <span className="text-sm text-gray-500 ml-3">
                                RT: {log.hours_regular || 0} | OT: {log.hours_overtime || 0} | Miles: {log.miles || 0}
                              </span>
                              {log.notes && (
                                <p className="text-xs text-gray-400 mt-1 italic">{log.notes}</p>
                              )}
                            </div>
                            <button
                              onClick={() => deleteDailyLog(log.id)}
                              className="text-red-500 hover:text-red-700 text-sm"
                              title="Delete entry"
                            >
                              🗑️
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-2">📝</p>
                  <p>No daily hours logged yet</p>
                  <p className="text-sm">Click "Log Hours" to add entries</p>
                </div>
              )}
            </div>

            {/* Additional Costs */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">💵 Additional Costs</h2>
              <p className="text-sm text-gray-500 mb-4">25% markup applied automatically in cost summary</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Material Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.material_cost || ''}
                    onChange={(e) => setWorkOrder({...workOrder, material_cost: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ material_cost: workOrder.material_cost })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Equipment Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.emf_equipment_cost || ''}
                    onChange={(e) => setWorkOrder({...workOrder, emf_equipment_cost: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ emf_equipment_cost: workOrder.emf_equipment_cost })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Trailer Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.trailer_cost || ''}
                    onChange={(e) => setWorkOrder({...workOrder, trailer_cost: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ trailer_cost: workOrder.trailer_cost })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Rental Cost ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={workOrder.rental_cost || ''}
                    onChange={(e) => setWorkOrder({...workOrder, rental_cost: parseFloat(e.target.value) || 0})}
                    onBlur={() => updateWorkOrder({ rental_cost: workOrder.rental_cost })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Comments */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Comments & Notes</h2>
              <textarea
                value={workOrder.comments || ''}
                onChange={(e) => setWorkOrder({...workOrder, comments: e.target.value})}
                onBlur={() => updateWorkOrder({ comments: workOrder.comments })}
                rows="6"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Add notes, updates, or comments..."
              />
            </div>
          </div>

          {/* Right Column - Summary */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-900 mb-4">💰 Cost Summary</h2>
              
              {/* Source Breakdown */}
              {(totals.legacyHours > 0 && totals.dailyHours > 0) && (
                <div className="bg-blue-200 rounded p-2 mb-4 text-xs text-blue-800">
                  📊 Includes legacy hours + daily log entries
                </div>
              )}
              
              <div className="space-y-3 text-sm">
                {/* Legacy Hours Breakdown */}
                {totals.legacyHours > 0 && (
                  <div className="pb-2 border-b border-blue-200">
                    <p className="text-xs text-gray-500 mb-1">Legacy Hours:</p>
                    <div className="flex justify-between">
                      <span className="text-gray-700">({totals.legacyHours.toFixed(1)} hrs)</span>
                      <span className="font-bold text-gray-900">${totals.legacyLabor.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                {/* Daily Log Hours Breakdown */}
                {totals.dailyHours > 0 && (
                  <div className="pb-2 border-b border-blue-200">
                    <p className="text-xs text-gray-500 mb-1">Daily Log Hours:</p>
                    <div className="flex justify-between">
                      <span className="text-gray-700">({totals.dailyHours.toFixed(1)} hrs)</span>
                      <span className="font-bold text-gray-900">${totals.dailyLabor.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between pb-2 border-b border-blue-200">
                  <span className="text-gray-700">Total Labor ({totals.totalHours.toFixed(1)} hrs):</span>
                  <span className="font-bold text-gray-900">${totals.totalLabor.toFixed(2)}</span>
                </div>

                <div className="flex justify-between pb-2 border-b border-blue-200 text-yellow-700">
                  <span>Admin Hours (2 hrs):</span>
                  <span className="font-bold">${adminCost.toFixed(2)}</span>
                </div>

                <div className="flex justify-between pb-2 border-b border-blue-200">
                  <span className="text-gray-700">Mileage ({totals.totalMiles.toFixed(1)} mi):</span>
                  <span className="font-bold text-gray-900">${(totals.totalMiles * 1.00).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-blue-200">
                  <span className="text-gray-700">Materials:</span>
                  <span className="font-bold text-gray-900">${(workOrder.material_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-blue-200">
                  <span className="text-gray-700">Equipment:</span>
                  <span className="font-bold text-gray-900">${(workOrder.emf_equipment_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-blue-200">
                  <span className="text-gray-700">Trailer:</span>
                  <span className="font-bold text-gray-900">${(workOrder.trailer_cost || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between pb-3 border-b-2 border-blue-300">
                  <span className="text-gray-700">Rental:</span>
                  <span className="font-bold text-gray-900">${(workOrder.rental_cost || 0).toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-lg font-bold pt-2">
                  <span className="text-gray-900">TOTAL:</span>
                  <span className="text-blue-600">${grandTotal.toFixed(2)}</span>
                </div>

                <div className="mt-4 pt-4 border-t-2 border-blue-300">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-700">NTE Budget:</span>
                    <span className="font-bold text-gray-900">${(workOrder.nte || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Remaining:</span>
                    <span className={`font-bold text-lg ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${remaining.toFixed(2)}
                    </span>
                  </div>
                </div>

                {remaining < 0 && (
                  <div className="mt-4 bg-red-100 border border-red-300 rounded p-3">
                    <p className="text-red-800 text-xs font-medium">⚠️ Over budget by ${Math.abs(remaining).toFixed(2)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Hours Modal */}
      {showAddHoursModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">📝 Log Daily Hours</h3>
              <button
                onClick={() => {
                  setShowAddHoursModal(false);
                  setSelectedUserForHours(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Select User */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Team Member <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedUserForHours?.user_id || ''}
                  onChange={(e) => {
                    const user = assignedUsers.find(u => u.user_id === parseInt(e.target.value));
                    setSelectedUserForHours(user || null);
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a person...</option>
                  {assignedUsers.map(user => (
                    <option key={user.user_id} value={user.user_id}>
                      {user.first_name} {user.last_name} ({user.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Work Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Work Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newHoursEntry.workDate}
                  onChange={(e) => setNewHoursEntry({...newHoursEntry, workDate: e.target.value})}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Regular Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={newHoursEntry.hoursRegular}
                    onChange={(e) => setNewHoursEntry({...newHoursEntry, hoursRegular: e.target.value})}
                    placeholder="0.0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">@ $64/hr</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Overtime Hours</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={newHoursEntry.hoursOvertime}
                    onChange={(e) => setNewHoursEntry({...newHoursEntry, hoursOvertime: e.target.value})}
                    placeholder="0.0"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">@ $96/hr</p>
                </div>
              </div>

              {/* Miles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Miles</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={newHoursEntry.miles}
                  onChange={(e) => setNewHoursEntry({...newHoursEntry, miles: e.target.value})}
                  placeholder="0.0"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">@ $1.00/mi</p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={newHoursEntry.notes}
                  onChange={(e) => setNewHoursEntry({...newHoursEntry, notes: e.target.value})}
                  placeholder="Add notes about the work performed..."
                  rows="3"
                  maxLength="500"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <button
                  onClick={() => {
                    setShowAddHoursModal(false);
                    setSelectedUserForHours(null);
                  }}
                  disabled={saving}
                  className="bg-gray-300 hover:bg-gray-400 py-3 rounded-lg font-semibold text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={addDailyHoursEntry}
                  disabled={saving || !selectedUserForHours}
                  className="bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold text-white disabled:bg-gray-400"
                >
                  {saving ? 'Saving...' : '✓ Save Hours'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
