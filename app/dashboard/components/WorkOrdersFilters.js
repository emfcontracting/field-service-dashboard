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
  billingStatusFilter,
  setBillingStatusFilter,
  cbreStatusFilter,
  setCbreStatusFilter,
  onNewWorkOrder,
  onImport,     
  exportDropdown
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);

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
        }, 2000);
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

        {/* CBRE Status Filter */}
        {setCbreStatusFilter && (
          <select
            value={cbreStatusFilter || 'all'}
            onChange={(e) => setCbreStatusFilter(e.target.value)}
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
          </select>
        )}

        <select
          value={billingStatusFilter || 'all'}
          onChange={(e) => setBillingStatusFilter && setBillingStatusFilter(e.target.value)}
          className={`px-4 py-2 rounded-lg ${
            billingStatusFilter && billingStatusFilter !== 'all' 
              ? 'bg-orange-700 text-white' 
              : 'bg-gray-700 text-white'
          }`}
        >
          <option value="all">All Billing Status</option>
          <option value="none">No Billing Flag</option>
          <option value="pending_cbre_quote">📋 Needs CBRE Quote</option>
          <option value="quoted">📤 Quote Submitted</option>
          <option value="quote_approved">✅ Quote Approved</option>
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

      {/* Sync Result Message */}
      {syncResult && (
        <div className={`mt-3 p-3 rounded-lg ${
          syncResult.success ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'
        }`}>
          {syncResult.success ? (
            <>
              <strong>✅ {syncResult.message}</strong>
              {syncResult.updates && syncResult.updates.length > 0 && (
                <ul className="mt-2 text-sm">
                  {syncResult.updates.map((update, i) => (
                    <li key={i}>
                      • {update.wo_number} → {update.new_status.toUpperCase()}
                      {update.notified && ' (notified)'}
                    </li>
                  ))}
                </ul>
              )}
              {syncResult.updated > 0 && (
                <p className="text-xs mt-2">Refreshing page...</p>
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
