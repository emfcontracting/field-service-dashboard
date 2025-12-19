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
  const [dateRange, setDateRange] = useState('30');
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [showTechDropdown, setShowTechDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  const techs = (users || []).filter(u => 
    ['lead_tech', 'tech', 'helper'].includes(u.role) && u.is_active
  ).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

  const statusOptions = [
    { value: 'assigned', label: 'Assigned', color: 'bg-blue-600' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-600' },
    { value: 'completed', label: 'Completed', color: 'bg-green-600' }
  ];

  const chunkArray = (array, size) => {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  const toggleTech = (techId) => {
    setSelectedTechs(prev => prev.includes(techId) ? prev.filter(id => id !== techId) : [...prev, techId]);
  };

  const toggleStatus = (status) => {
    setSelectedStatuses(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
  };

  const toggleAllTechs = () => {
    setSelectedTechs(selectedTechs.length === techs.length ? [] : techs.map(t => t.user_id));
  };

  const toggleAllStatuses = () => {
    setSelectedStatuses(selectedStatuses.length === statusOptions.length ? [] : statusOptions.map(s => s.value));
  };

  const clearAllFilters = () => {
    setSelectedTechs([]);
    setSelectedStatuses([]);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.tech-dropdown') && !e.target.closest('.tech-dropdown-btn')) setShowTechDropdown(false);
      if (!e.target.closest('.status-dropdown') && !e.target.closest('.status-dropdown-btn')) setShowStatusDropdown(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchMissingHours = useCallback(async () => {
    if (!workOrders || workOrders.length === 0 || !supabase) {
      setMissingHoursWOs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - parseInt(dateRange));
      
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

      const woIds = eligibleWOs.map(wo => wo.wo_id);
      const woIdChunks = chunkArray(woIds, 10);
      
      let allHoursData = [];
      for (const chunk of woIdChunks) {
        const { data: hoursData, error } = await supabase
          .from('daily_hours_log')
          .select('wo_id, user_id, hours_regular, hours_overtime')
          .in('wo_id', chunk);

        if (!error && hoursData) allHoursData = [...allHoursData, ...hoursData];
      }

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
        if (totalHours > 0) techHoursPerWO[woId].add(entry.user_id);
      });

      let allAssignments = [];
      for (const chunk of woIdChunks) {
        const { data: assignments, error } = await supabase
          .from('work_order_assignments')
          .select('wo_id, user_id, user:users(first_name, last_name)')
          .in('wo_id', chunk);

        if (!error && assignments) allAssignments = [...allAssignments, ...assignments];
      }

      const assignmentsPerWO = {};
      allAssignments.forEach(a => {
        if (!assignmentsPerWO[a.wo_id]) assignmentsPerWO[a.wo_id] = [];
        assignmentsPerWO[a.wo_id].push(a);
      });

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
              if (tech) techsMissingHours.push(tech);
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

  const filteredWOs = missingHoursWOs.filter(wo => {
    if (selectedTechs.length > 0) {
      const hasTech = selectedTechs.some(techId => 
        wo.lead_tech_id === techId || 
        wo.assignedTechIds.includes(techId) ||
        wo.techsMissingHours.some(t => t.user_id === techId)
      );
      if (!hasTech) return false;
    }
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(wo.status)) return false;
    return true;
  });

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

  const getTechName = (techId) => {
    const tech = techs.find(t => t.user_id === techId);
    return tech ? `${tech.first_name} ${tech.last_name.charAt(0)}.` : '';
  };

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Header - Compact on mobile */}
      <div className="bg-gradient-to-r from-red-900 to-orange-900 rounded-lg p-3 md:p-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-base md:text-2xl font-bold flex items-center gap-2">
              <span>⚠️</span> Missing Hours
            </h2>
            <p className="text-gray-300 text-xs md:text-sm mt-0.5 md:mt-1 hidden sm:block">
              Work orders with assigned techs but no hours logged
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl md:text-4xl font-bold">{filteredWOs.length}</div>
            <div className="text-gray-300 text-xs md:text-sm">WOs</div>
          </div>
        </div>
      </div>

      {/* Filters - Compact grid on mobile */}
      <div className="bg-gray-800 rounded-lg p-2 md:p-4">
        <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3 mb-2">
          {/* Tech Filter */}
          <div className="relative">
            <button
              onClick={() => setShowTechDropdown(!showTechDropdown)}
              className={`tech-dropdown-btn w-full md:w-auto px-2 md:px-4 py-2 rounded-lg flex items-center justify-between md:justify-start gap-1 md:gap-2 text-xs md:text-sm ${
                selectedTechs.length > 0 ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white'
              }`}
            >
              <span className="flex items-center gap-1 truncate">
                <span>👷</span>
                <span className="truncate">
                  {selectedTechs.length === 0 ? 'All Techs' : 
                   selectedTechs.length === 1 ? getTechName(selectedTechs[0]) :
                   `${selectedTechs.length} Techs`}
                </span>
              </span>
              <span>▼</span>
            </button>
            
            {showTechDropdown && (
              <div className="tech-dropdown absolute top-full left-0 mt-1 bg-gray-700 rounded-lg shadow-xl z-50 min-w-[200px] max-w-[90vw] max-h-[250px] overflow-y-auto">
                <div className="px-3 py-2 hover:bg-gray-600 cursor-pointer border-b border-gray-600 flex items-center gap-2" onClick={toggleAllTechs}>
                  <input type="checkbox" checked={selectedTechs.length === techs.length} onChange={() => {}} className="w-4 h-4" />
                  <span className="font-semibold text-sm">Select All</span>
                </div>
                {techs.map(tech => (
                  <div key={tech.user_id} className="px-3 py-2 hover:bg-gray-600 cursor-pointer flex items-center gap-2" onClick={() => toggleTech(tech.user_id)}>
                    <input type="checkbox" checked={selectedTechs.includes(tech.user_id)} onChange={() => {}} className="w-4 h-4" />
                    <span className="text-sm truncate">{tech.first_name} {tech.last_name}</span>
                    {tech.role === 'lead_tech' && <span className="text-yellow-400">⭐</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className={`status-dropdown-btn w-full md:w-auto px-2 md:px-4 py-2 rounded-lg flex items-center justify-between md:justify-start gap-1 md:gap-2 text-xs md:text-sm ${
                selectedStatuses.length > 0 ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white'
              }`}
            >
              <span className="flex items-center gap-1 truncate">
                <span>📋</span>
                <span className="truncate">
                  {selectedStatuses.length === 0 ? 'All Status' : 
                   selectedStatuses.length === 1 ? statusOptions.find(s => s.value === selectedStatuses[0])?.label :
                   `${selectedStatuses.length} Status`}
                </span>
              </span>
              <span>▼</span>
            </button>
            
            {showStatusDropdown && (
              <div className="status-dropdown absolute top-full left-0 mt-1 bg-gray-700 rounded-lg shadow-xl z-50 min-w-[160px]">
                <div className="px-3 py-2 hover:bg-gray-600 cursor-pointer border-b border-gray-600 flex items-center gap-2" onClick={toggleAllStatuses}>
                  <input type="checkbox" checked={selectedStatuses.length === statusOptions.length} onChange={() => {}} className="w-4 h-4" />
                  <span className="font-semibold text-sm">Select All</span>
                </div>
                {statusOptions.map(status => (
                  <div key={status.value} className="px-3 py-2 hover:bg-gray-600 cursor-pointer flex items-center gap-2" onClick={() => toggleStatus(status.value)}>
                    <input type="checkbox" checked={selectedStatuses.includes(status.value)} onChange={() => {}} className="w-4 h-4" />
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${status.color}`}>{status.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Date Range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="bg-gray-700 text-white px-2 md:px-4 py-2 rounded-lg text-xs md:text-sm"
          >
            <option value="7">7 Days</option>
            <option value="14">14 Days</option>
            <option value="30">30 Days</option>
            <option value="60">60 Days</option>
            <option value="90">90 Days</option>
          </select>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button onClick={fetchMissingHours} className="bg-gray-600 active:bg-gray-500 px-2 md:px-3 py-2 rounded-lg text-xs md:text-sm">
              🔄
            </button>
            {(selectedTechs.length > 0 || selectedStatuses.length > 0) && (
              <button onClick={clearAllFilters} className="bg-red-700 active:bg-red-600 px-2 md:px-3 py-2 rounded-lg text-xs md:text-sm">
                ✕
              </button>
            )}
            <button onClick={exportToCSV} disabled={filteredWOs.length === 0} className="bg-green-600 active:bg-green-500 disabled:bg-gray-600 px-2 md:px-3 py-2 rounded-lg text-xs md:text-sm hidden md:block">
              📊 CSV
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Card View / Desktop Table View */}
      {loading ? (
        <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-400">
          <div className="animate-spin text-3xl mb-2">⏳</div>
          <span className="text-sm">Loading...</span>
        </div>
      ) : filteredWOs.length === 0 ? (
        <div className="bg-gray-800 rounded-lg p-6 text-center">
          <div className="text-green-400 text-3xl mb-2">✅</div>
          <div className="text-lg font-semibold text-green-400">All Caught Up!</div>
          <div className="text-gray-400 text-sm mt-1">No missing hours found</div>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-2">
            {filteredWOs.map(wo => (
              <div
                key={wo.wo_id}
                onClick={() => onSelectWorkOrder(wo)}
                className={`bg-gray-800 rounded-lg p-3 cursor-pointer active:bg-gray-700 ${
                  wo.daysSinceStart > 7 ? 'border-l-4 border-red-500' : 
                  wo.daysSinceStart > 3 ? 'border-l-4 border-orange-500' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold text-sm">{wo.wo_number}</div>
                    <div className="text-xs text-gray-400">{wo.building}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                      wo.daysSinceStart > 7 ? 'bg-red-600' :
                      wo.daysSinceStart > 3 ? 'bg-orange-600' : 'bg-gray-600'
                    }`}>
                      {wo.daysSinceStart}d
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(wo.status)}`}>
                      {wo.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-400">
                    {wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name.charAt(0)}.` : 'Unassigned'}
                  </span>
                  <span className="text-red-400 font-bold">0 hrs</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-3 py-2 text-left">WO#</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Building</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Lead Tech</th>
                    <th className="px-3 py-2 text-center">Days</th>
                    <th className="px-3 py-2 text-center">Hours</th>
                    <th className="px-3 py-2 text-center">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWOs.map(wo => (
                    <tr 
                      key={wo.wo_id}
                      className={`border-t border-gray-700 hover:bg-gray-700 cursor-pointer ${
                        wo.daysSinceStart > 7 ? 'bg-red-900/20' : wo.daysSinceStart > 3 ? 'bg-orange-900/20' : ''
                      }`}
                      onClick={() => onSelectWorkOrder(wo)}
                    >
                      <td className="px-3 py-2 font-semibold">{wo.wo_number}</td>
                      <td className="px-3 py-2">{new Date(wo.date_entered || wo.created_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })}</td>
                      <td className="px-3 py-2">{wo.building}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(wo.status)}`}>
                          {wo.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-2">{wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name.charAt(0)}.` : <span className="text-gray-500">—</span>}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                          wo.daysSinceStart > 7 ? 'bg-red-600' : wo.daysSinceStart > 3 ? 'bg-orange-600' : 'bg-gray-600'
                        }`}>{wo.daysSinceStart}</span>
                      </td>
                      <td className="px-3 py-2 text-center text-red-400 font-bold">0.0</td>
                      <td className="px-3 py-2 text-center">
                        <button className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs font-bold">View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Summary Stats - Compact on mobile */}
      {!loading && filteredWOs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <div className="bg-gray-800 rounded-lg p-2 md:p-4">
            <div className="text-gray-400 text-xs">Total</div>
            <div className="text-xl md:text-2xl font-bold">{filteredWOs.length}</div>
          </div>
          <div className="bg-red-900/50 rounded-lg p-2 md:p-4">
            <div className="text-red-300 text-xs">Critical (&gt;7d)</div>
            <div className="text-xl md:text-2xl font-bold text-red-400">{filteredWOs.filter(wo => wo.daysSinceStart > 7).length}</div>
          </div>
          <div className="bg-orange-900/50 rounded-lg p-2 md:p-4">
            <div className="text-orange-300 text-xs">Warning (3-7d)</div>
            <div className="text-xl md:text-2xl font-bold text-orange-400">{filteredWOs.filter(wo => wo.daysSinceStart > 3 && wo.daysSinceStart <= 7).length}</div>
          </div>
          <div className="bg-yellow-900/50 rounded-lg p-2 md:p-4">
            <div className="text-yellow-300 text-xs">Zero Hours</div>
            <div className="text-xl md:text-2xl font-bold text-yellow-400">{filteredWOs.filter(wo => wo.totalHoursLogged === 0).length}</div>
          </div>
        </div>
      )}
    </div>
  );
}
