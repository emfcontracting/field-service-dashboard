// app/dashboard/components/WorkOrdersFilters.js
'use client';

import { useState } from 'react';

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

  // Sync CBRE status from Gmail labels
  const handleSyncCBRE = async () => {
    setSyncing(true);
    setSyncResult(null);
    
    try {
      const response = await fetch('/api/email-sync');
      const result = await response.json();
      
      setSyncResult(result);
      
      if (result.success && result.updated > 0) {
        // Refresh page to show updates
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

  // Get role badge for dropdown
  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin': return ' 👑';
      case 'office_staff': return ' 🏢';
      case 'operations': return ' 📋';
      case 'lead_tech': return ' ⭐';
      default: return '';
    }
  };

  return (
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
          <option value="all">All Work Status</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="needs_return">Needs Return</option>
          <option value="completed">Completed</option>
        </select>

        {/* Tech/Staff Filter */}
        <select
          value={techFilter || 'all'}
          onChange={(e) => setTechFilter && setTechFilter(e.target.value)}
          className={`px-4 py-2 rounded-lg ${
            techFilter && techFilter !== 'all' 
              ? 'bg-blue-700 text-white' 
              : 'bg-gray-700 text-white'
          }`}
        >
          <option value="all">👷 All Staff</option>
          <option value="unassigned">⚠️ Unassigned</option>
          
          {/* Techs Group */}
          {techs.length > 0 && (
            <optgroup label="── Field Techs ──">
              {techs.map(tech => (
                <option key={tech.user_id} value={tech.user_id}>
                  {tech.first_name} {tech.last_name}{getRoleBadge(tech.role)}
                </option>
              ))}
            </optgroup>
          )}
          
          {/* Admins/Office Group */}
          {admins.length > 0 && (
            <optgroup label="── Admin/Office ──">
              {admins.map(admin => (
                <option key={admin.user_id} value={admin.user_id}>
                  {admin.first_name} {admin.last_name}{getRoleBadge(admin.role)}
                </option>
              ))}
            </optgroup>
          )}
        </select>

        {/* CBRE Status Filter */}
        <select
          value={cbreStatusFilter || 'all'}
          onChange={(e) => setCbreStatusFilter && setCbreStatusFilter(e.target.value)}
          className={`px-4 py-2 rounded-lg ${
            cbreStatusFilter && cbreStatusFilter !== 'all' 
              ? 'bg-red-700 text-white' 
              : 'bg-gray-700 text-white'
          }`}
        >
          <option value="all">All CBRE Status</option>
          <option value="escalation">🚨 Escalation</option>
          <option value="quote_approved">✅ Quote Approved</option>
          <option value="quote_rejected">❌ Quote Rejected</option>
          <option value="quote_submitted">📤 Quote Submitted</option>
          <option value="reassigned">🔄 Reassigned</option>
          <option value="pending_quote">📋 Pending Quote</option>
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
          title="Sync CBRE status updates from Gmail (Escalation, Quote Approval, etc.)"
        >
          {syncing ? '⏳ Syncing...' : '🔄 Sync CBRE'}
        </button>
		
        {exportDropdown}
      </div>

      {/* Active Tech/Staff Filter Indicator */}
      {techFilter && techFilter !== 'all' && (
        <div className="mt-3 bg-blue-900/50 border border-blue-600 rounded-lg p-2 flex justify-between items-center">
          <span className="text-blue-200 text-sm">
            <strong>👷 Staff Filter:</strong>{' '}
            {techFilter === 'unassigned' 
              ? 'Unassigned Work Orders' 
              : (() => {
                  const user = allUsers.find(u => u.user_id === techFilter);
                  return user 
                    ? `${user.first_name} ${user.last_name}` 
                    : techFilter;
                })()
            }
          </span>
          <button
            onClick={() => setTechFilter('all')}
            className="bg-blue-700 hover:bg-blue-600 px-2 py-1 rounded text-xs font-semibold"
          >
            Clear
          </button>
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
                      {update.submitted_quote && (
                        <span className="bg-yellow-700 px-2 py-0.5 rounded text-xs">
                          📤 Quote: ${update.submitted_quote.toFixed(2)}
                        </span>
                      )}
                      {update.notified && (
                        <span className="bg-blue-700 px-2 py-0.5 rounded text-xs">📱 Notified</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {syncResult.errors && syncResult.errors.length > 0 && (
                <div className="mt-2 text-yellow-300 text-xs">
                  <strong>⚠️ Notes:</strong>
                  <ul className="ml-4">
                    {syncResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                    {syncResult.errors.length > 5 && (
                      <li>...and {syncResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
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
