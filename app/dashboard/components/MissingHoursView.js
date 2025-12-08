// app/dashboard/components/MissingHoursView.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getStatusColor } from '../utils/styleHelpers';

export default function MissingHoursView({ 
  workOrders, 
  users, 
  supabase, 
  onSelectWorkOrder,
  refreshWorkOrders 
}) {
  const [missingHoursWOs, setMissingHoursWOs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [techFilter, setTechFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30'); // days
  const [debugInfo, setDebugInfo] = useState('');

  // Get techs for filter dropdown
  const techs = (users || []).filter(u => 
    ['lead_tech', 'tech', 'helper'].includes(u.role) && u.is_active
  ).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

  const fetchMissingHours = useCallback(async () => {
    if (!workOrders || workOrders.length === 0) {
      setDebugInfo('No work orders available');
      setMissingHoursWOs([]);
      setLoading(false);
      return;
    }

    if (!supabase) {
      setDebugInfo('Supabase not available');
      setMissingHoursWOs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      // Get date range filter
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));
      
      // Filter work orders that should have hours:
      // - Status is assigned, in_progress, or completed
      // - Has a lead tech assigned
      // - Created within date range
      const eligibleWOs = workOrders.filter(wo => {
        const hasAssignment = wo.lead_tech_id;
        const relevantStatus = ['assigned', 'in_progress', 'completed'].includes(wo.status);
        const woDate = new Date(wo.date_entered || wo.created_at);
        const withinDateRange = woDate >= cutoffDate;
        return hasAssignment && relevantStatus && withinDateRange;
      });

      setDebugInfo(`Total WOs: ${workOrders.length}, Eligible (assigned/in_progress/completed with lead tech in last ${dateRange} days): ${eligibleWOs.length}`);

      if (eligibleWOs.length === 0) {
        setMissingHoursWOs([]);
        setLoading(false);
        return;
      }

      // Get hours logged for these work orders
      const woIds = eligibleWOs.map(wo => wo.wo_id);
      const { data: hoursData, error } = await supabase
        .from('daily_hours_log')
        .select('wo_id, user_id, regular_hours, overtime_hours')
        .in('wo_id', woIds);

      if (error) {
        console.error('Error fetching hours:', error);
        setDebugInfo(`Error fetching hours: ${error.message}`);
        setMissingHoursWOs([]);
        setLoading(false);
        return;
      }

      // Calculate total hours per work order
      const hoursPerWO = {};
      const techHoursPerWO = {}; // Track which techs logged hours
      
      (hoursData || []).forEach(entry => {
        const woId = entry.wo_id;
        const totalHours = (entry.regular_hours || 0) + (entry.overtime_hours || 0);
        
        if (!hoursPerWO[woId]) {
          hoursPerWO[woId] = 0;
          techHoursPerWO[woId] = new Set();
        }
        hoursPerWO[woId] += totalHours;
        if (totalHours > 0) {
          techHoursPerWO[woId].add(entry.user_id);
        }
      });

      // Get team assignments for each WO
      const { data: assignments } = await supabase
        .from('work_order_assignments')
        .select('wo_id, user_id, user:users(first_name, last_name)')
        .in('wo_id', woIds);

      const assignmentsPerWO = {};
      (assignments || []).forEach(a => {
        if (!assignmentsPerWO[a.wo_id]) {
          assignmentsPerWO[a.wo_id] = [];
        }
        assignmentsPerWO[a.wo_id].push(a);
      });

      // Find work orders with missing hours (ONLY zero hours - simpler logic)
      const missing = eligibleWOs
        .map(wo => {
          const totalHours = hoursPerWO[wo.wo_id] || 0;
          const techsWithHours = techHoursPerWO[wo.wo_id] || new Set();
          const woAssignments = assignmentsPerWO[wo.wo_id] || [];
          
          // Calculate days since started
          const startDate = new Date(wo.date_entered || wo.created_at);
          const now = new Date();
          const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

          // Get all assigned tech IDs (lead + team)
          const assignedTechIds = new Set();
          if (wo.lead_tech_id) assignedTechIds.add(wo.lead_tech_id);
          woAssignments.forEach(a => assignedTechIds.add(a.user_id));

          // Find techs missing hours
          const techsMissingHours = [];
          assignedTechIds.forEach(techId => {
            if (!techsWithHours.has(techId)) {
              const tech = users.find(u => u.user_id === techId);
              if (tech) {
                techsMissingHours.push(tech);
              }
            }
          });

          return {
            ...wo,
            totalHoursLogged: totalHours,
            daysSinceStart,
            assignedTechIds: Array.from(assignedTechIds),
            techsMissingHours,
            teamAssignments: woAssignments,
            // Only flag as missing if ZERO hours logged (matches stats card logic)
            hasMissingHours: totalHours === 0
          };
        })
        .filter(wo => wo.hasMissingHours)
        .sort((a, b) => b.daysSinceStart - a.daysSinceStart); // Oldest first

      setDebugInfo(`Eligible: ${eligibleWOs.length}, Hours records: ${hoursData?.length || 0}, Missing hours: ${missing.length}`);
      setMissingHoursWOs(missing);
    } catch (err) {
      console.error('Error in fetchMissingHours:', err);
      setDebugInfo(`Error: ${err.message}`);
      setMissingHoursWOs([]);
    } finally {
      setLoading(false);
    }
  }, [workOrders, users, supabase, dateRange]);

  // Fetch when component mounts or dependencies change
  useEffect(() => {
    fetchMissingHours();
  }, [fetchMissingHours]);

  // Apply filters
  const filteredWOs = missingHoursWOs.filter(wo => {
    // Tech filter
    if (techFilter !== 'all') {
      const hasTech = wo.lead_tech_id === techFilter || 
                      wo.assignedTechIds.includes(techFilter) ||
                      wo.techsMissingHours.some(t => t.user_id === techFilter);
      if (!hasTech) return false;
    }

    // Status filter
    if (statusFilter !== 'all' && wo.status !== statusFilter) {
      return false;
    }

    return true;
  });

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['WO#', 'Date', 'Building', 'Status', 'Lead Tech', 'Days Open', 'Hours Logged', 'Techs Missing Hours'];
    const rows = filteredWOs.map(wo => [
      wo.wo_number,
      new Date(wo.date_entered || wo.created_at).toLocaleDateString(),
      wo.building,
      wo.status,
      wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : 'Unassigned',
      wo.daysSinceStart,
      wo.totalHoursLogged.toFixed(1),
      wo.techsMissingHours.map(t => `${t.first_name} ${t.last_name}`).join('; ')
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `missing-hours-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get selected tech name for display
  const getSelectedTechName = () => {
    if (techFilter === 'all') return null;
    const tech = techs.find(t => t.user_id === techFilter);
    return tech ? `${tech.first_name} ${tech.last_name}` : null;
  };

  return (
    <div>
      {/* Header */}
      <div className="bg-gradient-to-r from-red-900 to-orange-900 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span>⚠️</span> Missing Hours Report
            </h2>
            <p className="text-gray-300 text-sm mt-1">
              Work orders with assigned techs but no hours logged
            </p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold">{filteredWOs.length}</div>
            <div className="text-gray-300 text-sm">Work Orders</div>
          </div>
        </div>
      </div>

      {/* Debug Info - Remove in production */}
      {debugInfo && (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 mb-4 text-xs text-gray-400">
          🔍 Debug: {debugInfo}
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Tech Filter */}
          <select
            value={techFilter}
            onChange={(e) => setTechFilter(e.target.value)}
            className={`px-4 py-2 rounded-lg ${
              techFilter !== 'all' ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white'
            }`}
          >
            <option value="all">👷 All Techs</option>
            {techs.map(tech => (
              <option key={tech.user_id} value={tech.user_id}>
                {tech.first_name} {tech.last_name}
                {tech.role === 'lead_tech' ? ' ⭐' : ''}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg"
          >
            <option value="all">All Status</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>

          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-gray-700 text-white px-4 py-2 rounded-lg"
          >
            <option value="7">Last 7 Days</option>
            <option value="14">Last 14 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="60">Last 60 Days</option>
            <option value="90">Last 90 Days</option>
            <option value="365">Last Year</option>
          </select>

          {/* Refresh Button */}
          <button
            onClick={fetchMissingHours}
            className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg font-semibold transition"
          >
            🔄 Refresh
          </button>

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            disabled={filteredWOs.length === 0}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition ml-auto"
          >
            📊 Export CSV
          </button>
        </div>

        {/* Active Filter Indicator */}
        {techFilter !== 'all' && (
          <div className="mt-3 bg-blue-900/50 border border-blue-600 rounded-lg p-2 flex justify-between items-center">
            <span className="text-blue-200 text-sm">
              <strong>👷 Tech Filter:</strong> {getSelectedTechName()}
            </span>
            <button
              onClick={() => setTechFilter('all')}
              className="bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded text-xs font-semibold"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          Loading missing hours data...
        </div>
      ) : filteredWOs.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <div className="text-green-400 text-4xl mb-4">✅</div>
          <div className="text-xl font-semibold text-green-400">All Caught Up!</div>
          <div className="text-gray-400 mt-2">
            {techFilter !== 'all' 
              ? `No missing hours for ${getSelectedTechName()}`
              : 'No work orders with missing hours in the selected date range'
            }
          </div>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left">WO#</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Building</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Lead Tech</th>
                  <th className="px-4 py-3 text-center">Days Open</th>
                  <th className="px-4 py-3 text-center">Hours Logged</th>
                  <th className="px-4 py-3 text-left">Techs Missing Hours</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredWOs.map(wo => (
                  <tr 
                    key={wo.wo_id}
                    className={`border-t border-gray-700 hover:bg-gray-700 transition cursor-pointer ${
                      wo.daysSinceStart > 7 ? 'bg-red-900/20' : 
                      wo.daysSinceStart > 3 ? 'bg-orange-900/20' : ''
                    }`}
                    onClick={() => onSelectWorkOrder(wo)}
                  >
                    <td className="px-4 py-3 font-semibold">{wo.wo_number}</td>
                    <td className="px-4 py-3">
                      {new Date(wo.date_entered || wo.created_at).toLocaleDateString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                        year: '2-digit'
                      })}
                    </td>
                    <td className="px-4 py-3">{wo.building}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(wo.status)}`}>
                        {wo.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {wo.lead_tech ? (
                        `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`
                      ) : (
                        <span className="text-gray-500">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded font-bold ${
                        wo.daysSinceStart > 7 ? 'bg-red-600 text-white' :
                        wo.daysSinceStart > 3 ? 'bg-orange-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {wo.daysSinceStart}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {wo.totalHoursLogged === 0 ? (
                        <span className="text-red-400 font-bold">0.0</span>
                      ) : (
                        <span className="text-yellow-400">{wo.totalHoursLogged.toFixed(1)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {wo.techsMissingHours.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {wo.techsMissingHours.slice(0, 3).map(tech => (
                            <span 
                              key={tech.user_id}
                              className="bg-red-700 text-white px-2 py-0.5 rounded text-xs"
                            >
                              {tech.first_name} {tech.last_name.charAt(0)}.
                            </span>
                          ))}
                          {wo.techsMissingHours.length > 3 && (
                            <span className="bg-gray-600 text-white px-2 py-0.5 rounded text-xs">
                              +{wo.techsMissingHours.length - 3} more
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-red-400 text-xs">No hours logged</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button 
                        className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs font-bold"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectWorkOrder(wo);
                        }}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {!loading && filteredWOs.length > 0 && (
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total Missing</div>
            <div className="text-2xl font-bold">{filteredWOs.length}</div>
          </div>
          <div className="bg-red-900/50 rounded-lg p-4">
            <div className="text-red-300 text-sm">Critical (&gt;7 days)</div>
            <div className="text-2xl font-bold text-red-400">
              {filteredWOs.filter(wo => wo.daysSinceStart > 7).length}
            </div>
          </div>
          <div className="bg-orange-900/50 rounded-lg p-4">
            <div className="text-orange-300 text-sm">Warning (3-7 days)</div>
            <div className="text-2xl font-bold text-orange-400">
              {filteredWOs.filter(wo => wo.daysSinceStart > 3 && wo.daysSinceStart <= 7).length}
            </div>
          </div>
          <div className="bg-yellow-900/50 rounded-lg p-4">
            <div className="text-yellow-300 text-sm">Zero Hours Logged</div>
            <div className="text-2xl font-bold text-yellow-400">
              {filteredWOs.filter(wo => wo.totalHoursLogged === 0).length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
