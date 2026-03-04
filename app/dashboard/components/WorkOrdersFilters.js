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
  exportDropdown,
  nteFilter,
  setNteFilter,
  pendingNTECount = 0
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showTechDropdown, setShowTechDropdown] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [showCbreDropdown, setShowCbreDropdown] = useState(false);

  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectedTechs, setSelectedTechs] = useState([]);
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [selectedCbreStatuses, setSelectedCbreStatuses] = useState([]);

  const techs = (users || []).filter(u =>
    ['lead_tech', 'tech', 'helper'].includes(u.role) && u.is_active
  ).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

  const admins = (users || []).filter(u =>
    ['admin', 'office_staff', 'operations'].includes(u.role) && u.is_active
  ).sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));

  const allUsers = [...techs, ...admins];

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'bg-slate-600' },
    { value: 'assigned', label: 'Assigned', color: 'bg-blue-600' },
    { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-600' },
    { value: 'tech_review', label: 'Tech Review', color: 'bg-purple-600' },
    { value: 'return_trip', label: 'Return Trip', color: 'bg-orange-600' },
    { value: 'completed', label: 'Completed', color: 'bg-emerald-600' }
  ];

  const priorityOptions = [
    { value: 'emergency', label: 'Emergency', color: 'bg-red-600' },
    { value: 'high', label: 'High', color: 'bg-orange-600' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-600' },
    { value: 'low', label: 'Low', color: 'bg-blue-600' },
    { value: 'P1', label: 'P1', color: 'bg-red-600' },
    { value: 'P2', label: 'P2', color: 'bg-orange-600' },
    { value: 'P3', label: 'P3', color: 'bg-yellow-600' },
    { value: 'P4', label: 'P4', color: 'bg-blue-600' },
    { value: 'P5', label: 'P5', color: 'bg-emerald-600' },
    { value: 'P10', label: 'P10', color: 'bg-cyan-600' }
  ];

  const cbreStatusOptions = [
    { value: 'escalation', label: '🚨 Escalation', color: 'bg-red-600' },
    { value: 'quote_approved', label: '✅ Approved', color: 'bg-emerald-600' },
    { value: 'quote_rejected', label: '❌ Rejected', color: 'bg-red-700' },
    { value: 'quote_submitted', label: '📤 Submitted', color: 'bg-blue-600' },
    { value: 'reassigned', label: '🔄 Reassigned', color: 'bg-purple-600' },
    { value: 'pending_quote', label: '📋 Pending', color: 'bg-orange-600' }
  ];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.status-dropdown') && !e.target.closest('.status-dropdown-btn')) setShowStatusDropdown(false);
      if (!e.target.closest('.tech-dropdown') && !e.target.closest('.tech-dropdown-btn')) setShowTechDropdown(false);
      if (!e.target.closest('.priority-dropdown') && !e.target.closest('.priority-dropdown-btn')) setShowPriorityDropdown(false);
      if (!e.target.closest('.cbre-dropdown') && !e.target.closest('.cbre-dropdown-btn')) setShowCbreDropdown(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedStatuses.length === 0) setStatusFilter('all');
    else if (selectedStatuses.length === 1) setStatusFilter(selectedStatuses[0]);
    else setStatusFilter(selectedStatuses);
  }, [selectedStatuses]);

  useEffect(() => {
    if (selectedTechs.length === 0) setTechFilter('all');
    else if (selectedTechs.length === 1) setTechFilter(selectedTechs[0]);
    else setTechFilter(selectedTechs);
  }, [selectedTechs]);

  useEffect(() => {
    if (selectedPriorities.length === 0) setPriorityFilter('all');
    else if (selectedPriorities.length === 1) setPriorityFilter(selectedPriorities[0]);
    else setPriorityFilter(selectedPriorities);
  }, [selectedPriorities]);

  useEffect(() => {
    if (setCbreStatusFilter) {
      if (selectedCbreStatuses.length === 0) setCbreStatusFilter('all');
      else if (selectedCbreStatuses.length === 1) setCbreStatusFilter(selectedCbreStatuses[0]);
      else setCbreStatusFilter(selectedCbreStatuses);
    }
  }, [selectedCbreStatuses]);

  const toggleStatus = (value) => setSelectedStatuses(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  const toggleTech = (value) => setSelectedTechs(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  const togglePriority = (value) => setSelectedPriorities(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  const toggleCbreStatus = (value) => setSelectedCbreStatuses(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);

  const toggleAllStatuses = () => setSelectedStatuses(prev => prev.length === statusOptions.length ? [] : statusOptions.map(o => o.value));
  const toggleAllTechs = () => { const ids = allUsers.map(u => u.user_id); setSelectedTechs(prev => prev.length === ids.length ? [] : ids); };
  const toggleAllPriorities = () => setSelectedPriorities(prev => prev.length === priorityOptions.length ? [] : priorityOptions.map(o => o.value));
  const toggleAllCbreStatuses = () => setSelectedCbreStatuses(prev => prev.length === cbreStatusOptions.length ? [] : cbreStatusOptions.map(o => o.value));

  const clearAllFilters = () => {
    setSelectedStatuses([]);
    setSelectedTechs([]);
    setSelectedPriorities([]);
    setSelectedCbreStatuses([]);
    setSearchTerm('');
    if (setNteFilter) setNteFilter(false);
  };

  const hasActiveFilters = selectedStatuses.length > 0 || selectedTechs.length > 0 ||
    selectedPriorities.length > 0 || selectedCbreStatuses.length > 0 || searchTerm || nteFilter;

  const getStatusButtonText = () => {
    if (selectedStatuses.length === 0) return 'Status';
    if (selectedStatuses.length === 1) return statusOptions.find(o => o.value === selectedStatuses[0])?.label || selectedStatuses[0];
    return `Status · ${selectedStatuses.length}`;
  };

  const getTechButtonText = () => {
    if (selectedTechs.length === 0) return 'Staff';
    if (selectedTechs.length === 1) {
      if (selectedTechs[0] === 'unassigned') return 'Unassigned';
      const user = allUsers.find(u => u.user_id === selectedTechs[0]);
      return user ? `${user.first_name} ${user.last_name.charAt(0)}.` : selectedTechs[0];
    }
    return `Staff · ${selectedTechs.length}`;
  };

  const getPriorityButtonText = () => {
    if (selectedPriorities.length === 0) return 'Priority';
    if (selectedPriorities.length === 1) return priorityOptions.find(o => o.value === selectedPriorities[0])?.label || selectedPriorities[0];
    return `Priority · ${selectedPriorities.length}`;
  };

  const getCbreButtonText = () => {
    if (selectedCbreStatuses.length === 0) return 'CBRE';
    if (selectedCbreStatuses.length === 1) return cbreStatusOptions.find(o => o.value === selectedCbreStatuses[0])?.label || selectedCbreStatuses[0];
    return `CBRE · ${selectedCbreStatuses.length}`;
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin': return '👑';
      case 'office_staff': return '🏢';
      case 'operations': return '📋';
      case 'lead_tech': return '⭐';
      default: return '';
    }
  };

  const dropdownBase = "absolute top-full left-0 mt-1 bg-[#0d0d14] border border-[#2d2d44] rounded-lg shadow-2xl z-50 min-w-[180px] max-w-[90vw]";
  const dropdownItem = "px-3 py-2 hover:bg-[#1e1e2e] cursor-pointer flex items-center gap-2 text-sm text-slate-300";
  const filterBtn = (active) => `w-full md:w-auto px-3 py-1.5 rounded-md flex items-center justify-between md:justify-start gap-1.5 text-xs font-medium transition border ${
    active
      ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
      : 'bg-[#1e1e2e] border-[#2d2d44] text-slate-400 hover:text-slate-200 hover:border-slate-500'
  }`;

  const handleSyncCBRE = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch('/api/email-sync');
      const result = await response.json();
      setSyncResult(result);
      if (result.success && result.updated > 0) {
        setTimeout(() => window.location.reload(), 3000);
      }
    } catch (error) {
      setSyncResult({ success: false, error: error.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-3 mb-4">

      {/* Search + Actions row */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">🔍</span>
          <input
            type="text"
            placeholder="Search WO#, Building, Description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#1e1e2e] border border-[#2d2d44] text-slate-200 placeholder-slate-600 pl-8 pr-3 py-1.5 rounded-md text-xs focus:outline-none focus:border-blue-500/50 transition"
          />
        </div>
        <button onClick={onNewWorkOrder}
          className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap">
          + New WO
        </button>
        <button onClick={onImport}
          className="bg-[#1e1e2e] hover:bg-[#2d2d44] border border-[#2d2d44] text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-md text-xs font-medium transition">
          📥 Import
        </button>
        <button onClick={handleSyncCBRE} disabled={syncing}
          className="bg-[#1e1e2e] hover:bg-[#2d2d44] border border-[#2d2d44] text-slate-400 hover:text-slate-200 disabled:opacity-50 px-3 py-1.5 rounded-md text-xs font-medium transition">
          {syncing ? '⏳' : '🔄 Sync'}
        </button>
        <div className="hidden md:block">{exportDropdown}</div>
      </div>

      {/* Filter row */}
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-2 items-center">

        {/* Status */}
        <div className="relative">
          <button onClick={() => setShowStatusDropdown(!showStatusDropdown)} className={`status-dropdown-btn ${filterBtn(selectedStatuses.length > 0)}`}>
            <span>Status {selectedStatuses.length > 0 ? `· ${selectedStatuses.length}` : ''}</span>
            <span className="opacity-50">▾</span>
          </button>
          {showStatusDropdown && (
            <div className={`status-dropdown ${dropdownBase}`}>
              <div className={`${dropdownItem} border-b border-[#1e1e2e] font-semibold`} onClick={toggleAllStatuses}>
                <input type="checkbox" checked={selectedStatuses.length === statusOptions.length} onChange={() => {}} className="w-3.5 h-3.5 accent-blue-500" />
                <span>Select All</span>
              </div>
              {statusOptions.map(opt => (
                <div key={opt.value} className={dropdownItem} onClick={() => toggleStatus(opt.value)}>
                  <input type="checkbox" checked={selectedStatuses.includes(opt.value)} onChange={() => {}} className="w-3.5 h-3.5 accent-blue-500" />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${opt.color} text-white`}>{opt.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff */}
        <div className="relative">
          <button onClick={() => setShowTechDropdown(!showTechDropdown)} className={`tech-dropdown-btn ${filterBtn(selectedTechs.length > 0)}`}>
            <span>{getTechButtonText()}</span>
            <span className="opacity-50">▾</span>
          </button>
          {showTechDropdown && (
            <div className={`tech-dropdown ${dropdownBase} max-h-[280px] overflow-y-auto`}>
              <div className={`${dropdownItem} border-b border-[#1e1e2e] font-semibold`} onClick={toggleAllTechs}>
                <input type="checkbox" checked={selectedTechs.length === allUsers.length} onChange={() => {}} className="w-3.5 h-3.5 accent-blue-500" />
                <span>Select All</span>
              </div>
              <div className={dropdownItem + " border-b border-[#1e1e2e]"} onClick={() => toggleTech('unassigned')}>
                <input type="checkbox" checked={selectedTechs.includes('unassigned')} onChange={() => {}} className="w-3.5 h-3.5 accent-blue-500" />
                <span className="text-yellow-400">⚠ Unassigned</span>
              </div>
              {techs.length > 0 && (
                <>
                  <div className="px-3 py-1 text-xs text-slate-600 bg-[#0a0a0f]">── Field Techs ──</div>
                  {techs.map(tech => (
                    <div key={tech.user_id} className={dropdownItem} onClick={() => toggleTech(tech.user_id)}>
                      <input type="checkbox" checked={selectedTechs.includes(tech.user_id)} onChange={() => {}} className="w-3.5 h-3.5 accent-blue-500" />
                      <span>{tech.first_name} {tech.last_name}</span>
                      {getRoleBadge(tech.role) && <span className="text-yellow-400 text-xs">{getRoleBadge(tech.role)}</span>}
                    </div>
                  ))}
                </>
              )}
              {admins.length > 0 && (
                <>
                  <div className="px-3 py-1 text-xs text-slate-600 bg-[#0a0a0f]">── Admin/Office ──</div>
                  {admins.map(admin => (
                    <div key={admin.user_id} className={dropdownItem} onClick={() => toggleTech(admin.user_id)}>
                      <input type="checkbox" checked={selectedTechs.includes(admin.user_id)} onChange={() => {}} className="w-3.5 h-3.5 accent-blue-500" />
                      <span>{admin.first_name} {admin.last_name}</span>
                      {getRoleBadge(admin.role) && <span className="text-xs">{getRoleBadge(admin.role)}</span>}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Priority */}
        <div className="relative">
          <button onClick={() => setShowPriorityDropdown(!showPriorityDropdown)} className={`priority-dropdown-btn ${filterBtn(selectedPriorities.length > 0)}`}>
            <span>{getPriorityButtonText()}</span>
            <span className="opacity-50">▾</span>
          </button>
          {showPriorityDropdown && (
            <div className={`priority-dropdown ${dropdownBase} max-h-[260px] overflow-y-auto`}>
              <div className={`${dropdownItem} border-b border-[#1e1e2e] font-semibold`} onClick={toggleAllPriorities}>
                <input type="checkbox" checked={selectedPriorities.length === priorityOptions.length} onChange={() => {}} className="w-3.5 h-3.5 accent-blue-500" />
                <span>Select All</span>
              </div>
              {priorityOptions.map(opt => (
                <div key={opt.value} className={dropdownItem} onClick={() => togglePriority(opt.value)}>
                  <input type="checkbox" checked={selectedPriorities.includes(opt.value)} onChange={() => {}} className="w-3.5 h-3.5 accent-blue-500" />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${opt.color} text-white`}>{opt.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CBRE */}
        <div className="relative">
          <button onClick={() => setShowCbreDropdown(!showCbreDropdown)} className={`cbre-dropdown-btn ${filterBtn(selectedCbreStatuses.length > 0)}`}>
            <span>{getCbreButtonText()}</span>
            <span className="opacity-50">▾</span>
          </button>
          {showCbreDropdown && (
            <div className={`cbre-dropdown ${dropdownBase}`}>
              <div className={`${dropdownItem} border-b border-[#1e1e2e] font-semibold`} onClick={toggleAllCbreStatuses}>
                <input type="checkbox" checked={selectedCbreStatuses.length === cbreStatusOptions.length} onChange={() => {}} className="w-3.5 h-3.5 accent-blue-500" />
                <span>Select All</span>
              </div>
              {cbreStatusOptions.map(opt => (
                <div key={opt.value} className={dropdownItem} onClick={() => toggleCbreStatus(opt.value)}>
                  <input type="checkbox" checked={selectedCbreStatuses.includes(opt.value)} onChange={() => {}} className="w-3.5 h-3.5 accent-blue-500" />
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${opt.color} text-white`}>{opt.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* NTE Filter */}
        <button
          onClick={() => setNteFilter && setNteFilter(!nteFilter)}
          className={`w-full md:w-auto px-3 py-1.5 rounded-md flex items-center gap-1.5 text-xs font-medium transition border ${
            nteFilter
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-[#1e1e2e] border-[#2d2d44] text-slate-400 hover:text-slate-200 hover:border-slate-500'
          }`}
          title="Show only work orders with a pending NTE increase request"
        >
          <span>💰 NTE</span>
          {pendingNTECount > 0 && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${nteFilter ? 'bg-amber-500 text-black' : 'bg-amber-500/30 text-amber-400'}`}>
              {pendingNTECount}
            </span>
          )}
        </button>

        {/* Clear */}
        {hasActiveFilters && (
          <button onClick={clearAllFilters}
            className="w-full md:w-auto px-3 py-1.5 rounded-md text-xs font-medium transition border border-red-900/50 bg-red-950/30 text-red-400 hover:bg-red-950/60">
            ✕ Clear
          </button>
        )}
      </div>

      {/* Active filter tags */}
      {hasActiveFilters && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 max-h-[60px] overflow-y-auto">
          {nteFilter && (
            <span className="bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
              💰 NTE Requests
              <button onClick={() => setNteFilter && setNteFilter(false)} className="hover:text-red-300 text-xs">✕</button>
            </span>
          )}
          {selectedStatuses.map(status => {
            const opt = statusOptions.find(o => o.value === status);
            return opt ? (
              <span key={status} className={`${opt.color} text-white px-2 py-0.5 rounded-full text-xs flex items-center gap-1 opacity-90`}>
                {opt.label}
                <button onClick={() => toggleStatus(status)} className="hover:text-red-200">✕</button>
              </span>
            ) : null;
          })}
          {selectedTechs.map(techId => {
            if (techId === 'unassigned') return (
              <span key={techId} className="bg-yellow-600/30 border border-yellow-600/40 text-yellow-300 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                ⚠ Unassigned
                <button onClick={() => toggleTech(techId)} className="hover:text-red-300">✕</button>
              </span>
            );
            const user = allUsers.find(u => u.user_id === techId);
            return user ? (
              <span key={techId} className="bg-blue-600/20 border border-blue-600/30 text-blue-300 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                {user.first_name} {user.last_name.charAt(0)}.
                <button onClick={() => toggleTech(techId)} className="hover:text-red-300">✕</button>
              </span>
            ) : null;
          })}
          {selectedPriorities.map(priority => {
            const opt = priorityOptions.find(o => o.value === priority);
            return opt ? (
              <span key={priority} className={`${opt.color} text-white px-2 py-0.5 rounded-full text-xs flex items-center gap-1 opacity-90`}>
                {opt.label}
                <button onClick={() => togglePriority(priority)} className="hover:text-red-200">✕</button>
              </span>
            ) : null;
          })}
          {selectedCbreStatuses.map(cbreStatus => {
            const opt = cbreStatusOptions.find(o => o.value === cbreStatus);
            return opt ? (
              <span key={cbreStatus} className={`${opt.color} text-white px-2 py-0.5 rounded-full text-xs flex items-center gap-1 opacity-90`}>
                {opt.label}
                <button onClick={() => toggleCbreStatus(cbreStatus)} className="hover:text-red-200">✕</button>
              </span>
            ) : null;
          })}
        </div>
      )}

      {/* Sync Result */}
      {syncResult && (
        <div className={`mt-3 p-2.5 rounded-lg text-xs border ${syncResult.success ? 'bg-emerald-950/40 border-emerald-900/50 text-emerald-300' : 'bg-red-950/40 border-red-900/50 text-red-300'}`}>
          {syncResult.success ? (
            <>
              <strong>✅ {syncResult.message}</strong>
              {syncResult.updates && syncResult.updates.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {syncResult.updates.slice(0, 5).map((update, i) => (
                    <li key={i}>· <strong>{update.wo_number}</strong> → {update.new_status}</li>
                  ))}
                  {syncResult.updates.length > 5 && <li>...and {syncResult.updates.length - 5} more</li>}
                </ul>
              )}
              {syncResult.updated > 0 && <p className="mt-1 animate-pulse">🔄 Refreshing...</p>}
            </>
          ) : (
            <strong>❌ {syncResult.error}</strong>
          )}
        </div>
      )}
    </div>
  );
}
