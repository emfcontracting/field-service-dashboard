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
  const [dateRange, setDateRange] = useState('30'); // days
  
  // Multi-select filters - arrays instead of single values
  const [selectedTechs, setSelectedTechs] = useState([]); // empty = all
  const [selectedStatuses, setSelectedStatuses] = useState([]); // empty = all
  
  // Dropdown visibility
  const [showTechDropdown, setShowTechDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Get techs for filter dropdown
  const techs = (users || []).filter(u => 
    ['lead_tech', 'tech', 'helper'].includes(u.role) && u.is_active
  ).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

  // Status options
  const statusOptions = [
    { value: 'assigned', label: 'Assigned', color: 'bg-blue-600' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-600' },
    { value: 'completed', label: 'Completed', color: 'bg-green-600' }
  ];

  // Helper function to batch array into chunks
  const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  // Toggle tech selection
  const toggleTech = (techId) => {
    setSelectedTechs(prev => {
      if (prev.includes(techId)) {
        return prev.filter(id => id !== techId);
      } else {
        return [...prev, techId];
      }
    });
  };

  // Toggle status selection
  const toggleStatus = (status) => {
    setSelectedStatuses(prev => {
      if (prev.includes(status)) {
        return prev.filter(s => s !== status);
      } else {
        return [...prev, status];
      }
    });
  };

  // Select/deselect all techs
  const toggleAllTechs = () => {
    if (selectedTechs.length === techs.length) {
      setSelectedTechs([]);
    } else {
      setSelectedTechs(techs.map(t => t.user_id));
    }
  };

  // Select/deselect all statuses
  const toggleAllStatuses = () => {
    if (selectedStatuses.length === statusOptions.length) {
      setSelectedStatuses([]);
    } else {
      setSelectedStatuses(statusOptions.map(s => s.value));
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedTechs([]);
    setSelectedStatuses([]);
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.tech-dropdown') && !e.target.closest('.tech-dropdown-btn')) {
        setShowTechDropdown(false);
      }
      if (!e.target.closest('.status-dropdown') && !e.target.closest('.status-dropdown-btn')) {
        setShowStatusDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchMissingHours = useCallback(async () => {
    if (!workOrders || workOrders.length === 0) {
      setMissingHoursWOs([]);
      setLoading(false);
      return;
    }

    if (!supabase) {
      setMissingHoursWOs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      // Get date range filter
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));
      
      // Filter work orders that should have hours
      const eligibleWOs = workOrders.filter(wo => {
        const hasAssignment = wo.lead_tech_id;
        const relevantStatus = ['assigned', 'in_progress', 'completed'].includes(wo.status);
        const woDate = new Date(wo.date_entered || wo.created_at);
        const withinDateRange = woDate >= cutoffDate;
        return hasAssignment && relevantStatus && withinDateRange;
      });

      if (eligibleWOs.length === 0) {
        setMissingHoursWOs([]);
        setLoading(false);
        return;
      }

      // Get hours logged for these work orders - batch to avoid URL length issues
      const woIds = eligibleWOs.map(wo => wo.wo_id);
      const woIdChunks = chunkArray(woIds, 10);
      
      let allHoursData = [];
      for (const chunk of woIdChunks) {
        const { data: hoursData, error } = await supabase
          .from('daily_hours_log')
          .select('wo_id, user_id, hours_regular, hours_overtime')
          .in('wo_id', chunk);

        if (error) {
          console.error('Error fetching hours batch:', error);
          continue;
        }
        if (hoursData) {
          allHoursData = [...allHoursData, ...hoursData];
        }
      }

      // Calculate total hours per work order
      const hoursPerWO = {};
      const techHoursPerWO = {};
      
      allHoursData.forEach(entry => {
        const woId = entry.wo_id;
        const totalHours = (parseFloat(entry.hours_regular) || 0) + (parseFloat(entry.hours_overtime) || 0);
        
        if (!hoursPerWO[woId]) {
          hoursPerWO[woId] = 0;
          techHoursPerWO[woId] = new Set();
        }
        hoursPerWO[woId] += totalHours;
        if (totalHours > 0) {
          techHoursPerWO[woId].add(entry.user_id);
        }
      });

      // Get team assignments for each WO - also batch
      let allAssignments = [];
      for (const chunk of woIdChunks) {
        const { data: assignments, error } = await supabase
          .from('work_order_assignments')
          .select('wo_id, user_id, user:users(first_name, last_name)')
          .in('wo_id', chunk);

        if (!error && assignments) {
          allAssignments = [...allAssignments, ...assignments];
        }
      }

      const assignmentsPerWO = {};
      allAssignments.forEach(a => {
        if (!assignmentsPerWO[a.wo_id]) {
          assignmentsPerWO[a.wo_id] = [];
        }
        assignmentsPerWO[a.wo_id].push(a);
      });

      // Find work orders with missing hours
      const missing = eligibleWOs
        .map(wo => {
          const totalHours = hoursPerWO[wo.wo_id] || 0;
          const techsWithHours = techHoursPerWO[wo.wo_id] || new Set();
          const woAssignments = assignmentsPerWO[wo.wo_id] || [];
          
          const startDate = new Date(wo.date_entered || wo.created_at);
          const now = new Date();
          const daysSinceStart = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

          const assignedTechIds = new Set();
          if (wo.lead_tech_id) assignedTechIds.add(wo.lead_tech_id);
          woAssignments.forEach(a => assignedTechIds.add(a.user_id));

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
            hasMissingHours: totalHours === 0
          };
        })
        .filter(wo => wo.hasMissingHours)
        .sort((a, b) => b.daysSinceStart - a.daysSinceStart);

      setMissingHoursWOs(missing);
    } catch (err) {
      console.error('Error in fetchMissingHours:', err);
      setMissingHoursWOs([]);
    } finally {
      setLoading(false);
    }
  }, [workOrders, users, supabase, dateRange]);

  useEffect(() => {
    fetchMissingHours();
  }, [fetchMissingHours]);

  // Apply multi-select filters
  const filteredWOs = missingHoursWOs.filter(wo => {
    // Tech filter (if any selected)
    if (selectedTechs.length > 0) {
      const hasTech = selectedTechs.some(techId => 
        wo.lead_tech_id === techId || 
        wo.assignedTechIds.includes(techId) ||
        wo.techsMissingHours.some(t => t.user_id === techId)
      );
      if (!hasTech) return false;
    }

    // Status filter (if any selected)
    if (selectedStatuses.length > 0) {
      if (!selectedStatuses.includes(wo.status)) return false;
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

  // Get tech name by ID
  const getTechName = (techId) => {
    const tech = techs.find(t => t.user_id === techId);
    return tech ? `${tech.first_name} ${tech.last_name.charAt(0)}.` : '';
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

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          
          {/* Multi-Select Tech Filter */}
          <div className="relative">
            <button
              onClick={() => setShowTechDropdown(!showTechDropdown)}
              className={`tech-dropdown-btn px-4 py-2 rounded-lg flex items-center gap-2 ${
                selectedTechs.length > 0 ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white'
              }`}
            >
              <span>👷</span>
              {selectedTechs.length === 0 
                ? 'All Techs' 
                : selectedTechs.length === 1 
                  ? getTechName(selectedTechs[0])
                  : `${selectedTechs.length} Techs`
              }
              <span className="ml-1">▼</span>
            </button>
            
            {showTechDropdown && (
              <div className="tech-dropdown absolute top-full left-0 mt-1 bg-gray-700 rounded-lg shadow-xl z-50 min-w-[250px] max-h-[300px] overflow-y-auto">
                {/* Select All */}
                <div 
                  className="px-4 py-2 hover:bg-gray-600 cursor-pointer border-b border-gray-600 flex items-center gap-2"
                  onClick={toggleAllTechs}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedTechs.length === techs.length}
                    onChange={() => {}}
                    className="w-4 h-4"
                  />
                  <span className="font-semibold">Select All</span>
                </div>
                {/* Individual Techs */}
                {techs.map(tech => (
                  <div 
                    key={tech.user_id}
                    className="px-4 py-2 hover:bg-gray-600 cursor-pointer flex items-center gap-2"
                    onClick={() => toggleTech(tech.user_id)}
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedTechs.includes(tech.user_id)}
                      onChange={() => {}}
                      className="w-4 h-4"
                    />
                    <span>{tech.first_name} {tech.last_name}</span>
                    {tech.role === 'lead_tech' && <span className="text-yellow-400">⭐</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Multi-Select Status Filter */}
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className={`status-dropdown-btn px-4 py-2 rounded-lg flex items-center gap-2 ${
                selectedStatuses.length > 0 ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white'
              }`}
            >
              <span>📋</span>
              {selectedStatuses.length === 0 
                ? 'All Status' 
                : selectedStatuses.length === 1 
                  ? statusOptions.find(s => s.value === selectedStatuses[0])?.label
                  : `${selectedStatuses.length} Statuses`
              }
              <span className="ml-1">▼</span>
            </button>
            
            {showStatusDropdown && (
              <div className="status-dropdown absolute top-full left-0 mt-1 bg-gray-700 rounded-lg shadow-xl z-50 min-w-[200px]">
                {/* Select All */}
                <div 
                  className="px-4 py-2 hover:bg-gray-600 cursor-pointer border-b border-gray-600 flex items-center gap-2"
                  onClick={toggleAllStatuses}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedStatuses.length === statusOptions.length}
                    onChange={() => {}}
                    className="w-4 h-4"
                  />
                  <span className="font-semibold">Select All</span>
                </div>
                {/* Individual Statuses */}
                {statusOptions.map(status => (
                  <div 
                    key={status.value}
                    className="px-4 py-2 hover:bg-gray-600 cursor-pointer flex items-center gap-2"
                    onClick={() => toggleStatus(status.value)}
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedStatuses.includes(status.value)}
                      onChange={() => {}}
                      className="w-4 h-4"
                    />
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Date Range (single select) */}
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

          {/* Clear Filters */}
          {(selectedTechs.length > 0 || selectedStatuses.length > 0) && (
            <button
              onClick={clearAllFilters}
              className="bg-red-700 hover:bg-red-600 px-4 py-2 rounded-lg font-semibold transition"
            >
              ✕ Clear Filters
            </button>
          )}

          {/* Export Button */}
          <button
            onClick={exportToCSV}
            disabled={filteredWOs.length === 0}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition ml-auto"
          >
            📊 Export CSV
          </button>
        </div>

        {/* Active Filter Tags */}
        {(selectedTechs.length > 0 || selectedStatuses.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedTechs.map(techId => {
              const tech = techs.find(t => t.user_id === techId);
              return tech ? (
                <span 
                  key={techId}
                  className="bg-blue-700 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2"
                >
                  👷 {tech.first_name} {tech.last_name.charAt(0)}.
                  <button 
                    onClick={() => toggleTech(techId)}
                    className="hover:text-red-300"
                  >
                    ✕
                  </button>
                </span>
              ) : null;
            })}
            {selectedStatuses.map(status => {
              const opt = statusOptions.find(s => s.value === status);
              return opt ? (
                <span 
                  key={status}
                  className={`${opt.color} text-white px-3 py-1 rounded-full text-sm flex items-center gap-2`}
                >
                  {opt.label}
                  <button 
                    onClick={() => toggleStatus(status)}
                    className="hover:text-red-300"
                  >
                    ✕
                  </button>
                </span>
              ) : null;
            })}
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
            {(selectedTechs.length > 0 || selectedStatuses.length > 0)
              ? 'No work orders match your filters'
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
                              className="bg-red-700 hover:bg-red-600 text-white px-2 py-0.5 rounded text-xs cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!selectedTechs.includes(tech.user_id)) {
                                  setSelectedTechs([...selectedTechs, tech.user_id]);
                                }
                              }}
                              title={`Click to filter by ${tech.first_name} ${tech.last_name}`}
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
