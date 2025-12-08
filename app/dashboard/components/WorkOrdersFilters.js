// app/dashboard/components/WorkOrdersFilters.js
'use client';

import { useState, useEffect } from 'react';

export default function WorkOrdersFilters({
  searchTerm,
  setSearchTerm,
  statusFilter,
  setStatusFilter,
  priorityFilter,
  setPriorityFilter,
  cbreStatusFilter,
  setCbreStatusFilter,
  techFilter,
  setTechFilter,
  users,
  onNewWorkOrder,
  onImport,     
  exportDropdown
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  
  // Dropdown visibility states
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTechDropdown, setShowTechDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showCbreDropdown, setShowCbreDropdown] = useState(false);

  // Multi-select states (arrays)
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [selectedCbreStatuses, setSelectedCbreStatuses] = useState([]);

  // Get techs (lead_tech, tech, helper roles)
  const techs = (users || []).filter(u => 
    ['lead_tech', 'tech', 'helper'].includes(u.role) && u.is_active
  ).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

  // Get admins and office staff
  const admins = (users || []).filter(u => 
    ['admin', 'office_staff', 'operations'].includes(u.role) && u.is_active
  ).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

  // Combined list for finding selected user name
  const allUsers = [...techs, ...admins];

  // Options definitions
  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'bg-gray-600' },
    { value: 'assigned', label: 'Assigned', color: 'bg-blue-600' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-600' },
    { value: 'needs_return', label: 'Needs Return', color: 'bg-purple-600' },
    { value: 'completed', label: 'Completed', color: 'bg-green-600' }
  ];

  const priorityOptions = [
    { value: 'emergency', label: 'Emergency', color: 'bg-red-600' },
    { value: 'high', label: 'High', color: 'bg-orange-600' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-600' },
    { value: 'low', label: 'Low', color: 'bg-blue-600' },
    { value: 'P1', label: 'P1 - Emergency', color: 'bg-red-600' },
    { value: 'P2', label: 'P2 - Urgent', color: 'bg-orange-600' },
    { value: 'P3', label: 'P3 - Urgent (Non-Emerg)', color: 'bg-yellow-600' },
    { value: 'P4', label: 'P4 - Non-Urgent', color: 'bg-blue-600' },
    { value: 'P5', label: 'P5 - Handyman', color: 'bg-green-600' },
    { value: 'P10', label: 'P10 - PM', color: 'bg-cyan-600' }
  ];

  const cbreStatusOptions = [
    { value: 'escalation', label: '🚨 Escalation', color: 'bg-red-600' },
    { value: 'quote_approved', label: '✅ Quote Approved', color: 'bg-green-600' },
    { value: 'quote_rejected', label: '❌ Quote Rejected', color: 'bg-red-700' },
    { value: 'quote_submitted', label: '📤 Quote Submitted', color: 'bg-blue-600' },
    { value: 'reassigned', label: '🔄 Reassigned', color: 'bg-purple-600' },
    { value: 'pending_quote', label: '📋 Pending Quote', color: 'bg-orange-600' }
  ];

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.status-dropdown') && !e.target.closest('.status-dropdown-btn')) {
        setShowStatusDropdown(false);
      }
      if (!e.target.closest('.tech-dropdown') && !e.target.closest('.tech-dropdown-btn')) {
        setShowTechDropdown(false);
      }
      if (!e.target.closest('.priority-dropdown') && !e.target.closest('.priority-dropdown-btn')) {
        setShowPriorityDropdown(false);
      }
      if (!e.target.closest('.cbre-dropdown') && !e.target.closest('.cbre-dropdown-btn')) {
        setShowCbreDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Sync multi-select to parent (convert arrays to single value for backward compatibility)
  useEffect(() => {
    // Status filter
    if (selectedStatuses.length === 0) {
      setStatusFilter('all');
    } else if (selectedStatuses.length === 1) {
      setStatusFilter(selectedStatuses[0]);
    } else {
      setStatusFilter(selectedStatuses); // Pass array for multi-select
    }
  }, [selectedStatuses]);

  useEffect(() => {
    // Tech filter
    if (selectedTechs.length === 0) {
      setTechFilter('all');
    } else if (selectedTechs.length === 1) {
      setTechFilter(selectedTechs[0]);
    } else {
      setTechFilter(selectedTechs); // Pass array for multi-select
    }
  }, [selectedTechs]);

  useEffect(() => {
    // Priority filter
    if (selectedPriorities.length === 0) {
      setPriorityFilter('all');
    } else if (selectedPriorities.length === 1) {
      setPriorityFilter(selectedPriorities[0]);
    } else {
      setPriorityFilter(selectedPriorities); // Pass array for multi-select
    }
  }, [selectedPriorities]);

  useEffect(() => {
    // CBRE Status filter
    if (setCbreStatusFilter) {
      if (selectedCbreStatuses.length === 0) {
        setCbreStatusFilter('all');
      } else if (selectedCbreStatuses.length === 1) {
        setCbreStatusFilter(selectedCbreStatuses[0]);
      } else {
        setCbreStatusFilter(selectedCbreStatuses); // Pass array for multi-select
      }
    }
  }, [selectedCbreStatuses]);

  // Toggle functions
  const toggleStatus = (value) => {
    setSelectedStatuses(prev => 
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const toggleTech = (value) => {
    setSelectedTechs(prev => 
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const togglePriority = (value) => {
    setSelectedPriorities(prev => 
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const toggleCbreStatus = (value) => {
    setSelectedCbreStatuses(prev => 
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  // Select all functions
  const toggleAllStatuses = () => {
    if (selectedStatuses.length === statusOptions.length) {
      setSelectedStatuses([]);
    } else {
      setSelectedStatuses(statusOptions.map(o => o.value));
    }
  };

  const toggleAllTechs = () => {
    const allTechIds = allUsers.map(u => u.user_id);
    if (selectedTechs.length === allTechIds.length) {
      setSelectedTechs([]);
    } else {
      setSelectedTechs(allTechIds);
    }
  };

  const toggleAllPriorities = () => {
    if (selectedPriorities.length === priorityOptions.length) {
      setSelectedPriorities([]);
    } else {
      setSelectedPriorities(priorityOptions.map(o => o.value));
    }
  };

  const toggleAllCbreStatuses = () => {
    if (selectedCbreStatuses.length === cbreStatusOptions.length) {
      setSelectedCbreStatuses([]);
    } else {
      setSelectedCbreStatuses(cbreStatusOptions.map(o => o.value));
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedStatuses([]);
    setSelectedTechs([]);
    setSelectedPriorities([]);
    setSelectedCbreStatuses([]);
    setSearchTerm('');
  };

  const hasActiveFilters = selectedStatuses.length > 0 || selectedTechs.length > 0 || 
                          selectedPriorities.length > 0 || selectedCbreStatuses.length > 0 || 
                          searchTerm;

  // Get display text for dropdown buttons
  const getStatusButtonText = () => {
    if (selectedStatuses.length === 0) return 'All Status';
    if (selectedStatuses.length === 1) {
      return statusOptions.find(o => o.value === selectedStatuses[0])?.label || selectedStatuses[0];
    }
    return `${selectedStatuses.length} Statuses`;
  };

  const getTechButtonText = () => {
    if (selectedTechs.length === 0) return 'All Staff';
    if (selectedTechs.length === 1) {
      if (selectedTechs[0] === 'unassigned') return 'Unassigned';
      const user = allUsers.find(u => u.user_id === selectedTechs[0]);
      return user ? `${user.first_name} ${user.last_name.charAt(0)}.` : selectedTechs[0];
    }
    return `${selectedTechs.length} Staff`;
  };

  const getPriorityButtonText = () => {
    if (selectedPriorities.length === 0) return 'All Priority';
    if (selectedPriorities.length === 1) {
      return priorityOptions.find(o => o.value === selectedPriorities[0])?.label || selectedPriorities[0];
    }
    return `${selectedPriorities.length} Priorities`;
  };

  const getCbreButtonText = () => {
    if (selectedCbreStatuses.length === 0) return 'All CBRE';
    if (selectedCbreStatuses.length === 1) {
      return cbreStatusOptions.find(o => o.value === selectedCbreStatuses[0])?.label || selectedCbreStatuses[0];
    }
    return `${selectedCbreStatuses.length} CBRE`;
  };

  // Get role badge for dropdown
  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin': return '👑';
      case 'office_staff': return '🏢';
      case 'operations': return '📋';
      case 'lead_tech': return '⭐';
      default: return '';
    }
  };

  // Sync CBRE status from Gmail labels
  const handleSyncCBRE = async () => {
    setSyncing(true);
    setSyncResult(null);
    
    try {
      const response = await fetch('/api/email-sync');
      const result = await response.json();
      
      setSyncResult(result);
      
      if (result.success && result.updated > 0) {
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    } catch (error) {
      setSyncResult({ success: false, error: error.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-6">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <input
          type="text"
          placeholder="🔍 Search WO#, Building, Description..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] bg-gray-700 text-white px-4 py-2 rounded-lg"
        />

        {/* Multi-Select Status Filter */}
        <div className="relative">
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className={`status-dropdown-btn px-4 py-2 rounded-lg flex items-center gap-2 ${
              selectedStatuses.length > 0 ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white'
            }`}
          >
            <span>📋</span>
            {getStatusButtonText()}
            <span className="ml-1">▼</span>
          </button>
          
          {showStatusDropdown && (
            <div className="status-dropdown absolute top-full left-0 mt-1 bg-gray-700 rounded-lg shadow-xl z-50 min-w-[200px]">
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
              {statusOptions.map(opt => (
                <div 
                  key={opt.value}
                  className="px-4 py-2 hover:bg-gray-600 cursor-pointer flex items-center gap-2"
                  onClick={() => toggleStatus(opt.value)}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedStatuses.includes(opt.value)}
                    onChange={() => {}}
                    className="w-4 h-4"
                  />
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${opt.color}`}>
                    {opt.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Multi-Select Tech/Staff Filter */}
        <div className="relative">
          <button
            onClick={() => setShowTechDropdown(!showTechDropdown)}
            className={`tech-dropdown-btn px-4 py-2 rounded-lg flex items-center gap-2 ${
              selectedTechs.length > 0 ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white'
            }`}
          >
            <span>👷</span>
            {getTechButtonText()}
            <span className="ml-1">▼</span>
          </button>
          
          {showTechDropdown && (
            <div className="tech-dropdown absolute top-full left-0 mt-1 bg-gray-700 rounded-lg shadow-xl z-50 min-w-[250px] max-h-[350px] overflow-y-auto">
              <div 
                className="px-4 py-2 hover:bg-gray-600 cursor-pointer border-b border-gray-600 flex items-center gap-2"
                onClick={toggleAllTechs}
              >
                <input 
                  type="checkbox" 
                  checked={selectedTechs.length === allUsers.length}
                  onChange={() => {}}
                  className="w-4 h-4"
                />
                <span className="font-semibold">Select All</span>
              </div>
              
              {/* Unassigned option */}
              <div 
                className="px-4 py-2 hover:bg-gray-600 cursor-pointer flex items-center gap-2 border-b border-gray-600"
                onClick={() => toggleTech('unassigned')}
              >
                <input 
                  type="checkbox" 
                  checked={selectedTechs.includes('unassigned')}
                  onChange={() => {}}
                  className="w-4 h-4"
                />
                <span className="text-yellow-400">⚠️ Unassigned</span>
              </div>

              {/* Field Techs */}
              {techs.length > 0 && (
                <>
                  <div className="px-4 py-1 text-xs text-gray-400 bg-gray-800">── Field Techs ──</div>
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
                      {getRoleBadge(tech.role) && <span className="text-yellow-400">{getRoleBadge(tech.role)}</span>}
                    </div>
                  ))}
                </>
              )}
              
              {/* Admin/Office */}
              {admins.length > 0 && (
                <>
                  <div className="px-4 py-1 text-xs text-gray-400 bg-gray-800">── Admin/Office ──</div>
                  {admins.map(admin => (
                    <div 
                      key={admin.user_id}
                      className="px-4 py-2 hover:bg-gray-600 cursor-pointer flex items-center gap-2"
                      onClick={() => toggleTech(admin.user_id)}
                    >
                      <input 
                        type="checkbox" 
                        checked={selectedTechs.includes(admin.user_id)}
                        onChange={() => {}}
                        className="w-4 h-4"
                      />
                      <span>{admin.first_name} {admin.last_name}</span>
                      {getRoleBadge(admin.role) && <span>{getRoleBadge(admin.role)}</span>}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Multi-Select Priority Filter */}
        <div className="relative">
          <button
            onClick={() => setShowPriorityDropdown(!showPriorityDropdown)}
            className={`priority-dropdown-btn px-4 py-2 rounded-lg flex items-center gap-2 ${
              selectedPriorities.length > 0 ? 'bg-blue-700 text-white' : 'bg-gray-700 text-white'
            }`}
          >
            <span>🎯</span>
            {getPriorityButtonText()}
            <span className="ml-1">▼</span>
          </button>
          
          {showPriorityDropdown && (
            <div className="priority-dropdown absolute top-full left-0 mt-1 bg-gray-700 rounded-lg shadow-xl z-50 min-w-[220px] max-h-[300px] overflow-y-auto">
              <div 
                className="px-4 py-2 hover:bg-gray-600 cursor-pointer border-b border-gray-600 flex items-center gap-2"
                onClick={toggleAllPriorities}
              >
                <input 
                  type="checkbox" 
                  checked={selectedPriorities.length === priorityOptions.length}
                  onChange={() => {}}
                  className="w-4 h-4"
                />
                <span className="font-semibold">Select All</span>
              </div>
              {priorityOptions.map(opt => (
                <div 
                  key={opt.value}
                  className="px-4 py-2 hover:bg-gray-600 cursor-pointer flex items-center gap-2"
                  onClick={() => togglePriority(opt.value)}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedPriorities.includes(opt.value)}
                    onChange={() => {}}
                    className="w-4 h-4"
                  />
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${opt.color}`}>
                    {opt.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Multi-Select CBRE Status Filter */}
        <div className="relative">
          <button
            onClick={() => setShowCbreDropdown(!showCbreDropdown)}
            className={`cbre-dropdown-btn px-4 py-2 rounded-lg flex items-center gap-2 ${
              selectedCbreStatuses.length > 0 ? 'bg-purple-700 text-white' : 'bg-gray-700 text-white'
            }`}
          >
            <span>📧</span>
            {getCbreButtonText()}
            <span className="ml-1">▼</span>
          </button>
          
          {showCbreDropdown && (
            <div className="cbre-dropdown absolute top-full left-0 mt-1 bg-gray-700 rounded-lg shadow-xl z-50 min-w-[220px]">
              <div 
                className="px-4 py-2 hover:bg-gray-600 cursor-pointer border-b border-gray-600 flex items-center gap-2"
                onClick={toggleAllCbreStatuses}
              >
                <input 
                  type="checkbox" 
                  checked={selectedCbreStatuses.length === cbreStatusOptions.length}
                  onChange={() => {}}
                  className="w-4 h-4"
                />
                <span className="font-semibold">Select All</span>
              </div>
              {cbreStatusOptions.map(opt => (
                <div 
                  key={opt.value}
                  className="px-4 py-2 hover:bg-gray-600 cursor-pointer flex items-center gap-2"
                  onClick={() => toggleCbreStatus(opt.value)}
                >
                  <input 
                    type="checkbox" 
                    checked={selectedCbreStatuses.includes(opt.value)}
                    onChange={() => {}}
                    className="w-4 h-4"
                  />
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${opt.color}`}>
                    {opt.label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Clear All Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="bg-red-700 hover:bg-red-600 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            ✕ Clear
          </button>
        )}

        <button
          onClick={onNewWorkOrder}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition"
        >
          + New WO
        </button>

        <button
          onClick={onImport}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition"
        >
          📥 Import
        </button>

        {/* CBRE Sync Button */}
        <button
          onClick={handleSyncCBRE}
          disabled={syncing}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition"
          title="Sync CBRE status updates from Gmail"
        >
          {syncing ? '⏳...' : '🔄 Sync'}
        </button>
		
        {exportDropdown}
      </div>

      {/* Active Filter Tags */}
      {hasActiveFilters && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedStatuses.map(status => {
            const opt = statusOptions.find(o => o.value === status);
            return opt ? (
              <span 
                key={status}
                className={`${opt.color} text-white px-3 py-1 rounded-full text-xs flex items-center gap-2`}
              >
                {opt.label}
                <button onClick={() => toggleStatus(status)} className="hover:text-red-300">✕</button>
              </span>
            ) : null;
          })}
          {selectedTechs.map(techId => {
            if (techId === 'unassigned') {
              return (
                <span 
                  key={techId}
                  className="bg-yellow-700 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2"
                >
                  ⚠️ Unassigned
                  <button onClick={() => toggleTech(techId)} className="hover:text-red-300">✕</button>
                </span>
              );
            }
            const user = allUsers.find(u => u.user_id === techId);
            return user ? (
              <span 
                key={techId}
                className="bg-blue-700 text-white px-3 py-1 rounded-full text-xs flex items-center gap-2"
              >
                👷 {user.first_name} {user.last_name.charAt(0)}.
                <button onClick={() => toggleTech(techId)} className="hover:text-red-300">✕</button>
              </span>
            ) : null;
          })}
          {selectedPriorities.map(priority => {
            const opt = priorityOptions.find(o => o.value === priority);
            return opt ? (
              <span 
                key={priority}
                className={`${opt.color} text-white px-3 py-1 rounded-full text-xs flex items-center gap-2`}
              >
                {opt.label}
                <button onClick={() => togglePriority(priority)} className="hover:text-red-300">✕</button>
              </span>
            ) : null;
          })}
          {selectedCbreStatuses.map(cbreStatus => {
            const opt = cbreStatusOptions.find(o => o.value === cbreStatus);
            return opt ? (
              <span 
                key={cbreStatus}
                className={`${opt.color} text-white px-3 py-1 rounded-full text-xs flex items-center gap-2`}
              >
                {opt.label}
                <button onClick={() => toggleCbreStatus(cbreStatus)} className="hover:text-red-300">✕</button>
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Sync Result Message */}
      {syncResult && (
        <div className={`mt-3 p-3 rounded-lg ${
          syncResult.success ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'
        }`}>
          {syncResult.success ? (
            <>
              <strong>✅ {syncResult.message}</strong>
              {syncResult.updates && syncResult.updates.length > 0 && (
                <ul className="mt-2 text-sm space-y-1">
                  {syncResult.updates.map((update, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-2">
                      <span>• <strong>{update.wo_number}</strong> → {update.new_status.toUpperCase()}</span>
                      {update.new_nte && (
                        <span className="bg-green-700 px-2 py-0.5 rounded text-xs">
                          💰 NTE: ${update.old_nte?.toFixed(2) || '0'} → ${update.new_nte.toFixed(2)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {syncResult.updated > 0 && (
                <p className="text-xs mt-2 animate-pulse">🔄 Refreshing page in 3 seconds...</p>
              )}
            </>
          ) : (
            <strong>❌ {syncResult.error}</strong>
          )}
        </div>
      )}
    </div>
  );
}
