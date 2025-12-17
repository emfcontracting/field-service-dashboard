// app/components/GlobalWOSearch.js
// Global Work Order Search - searches across ALL work orders regardless of status
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function GlobalWOSearch({ onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      alert('Please enter a WO# to search');
      return;
    }

    setSearching(true);
    setSearched(true);

    try {
      // Search by WO number (partial match) or building
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!lead_tech_id(first_name, last_name)
        `)
        .or(`wo_number.ilike.%${searchTerm}%,building.ilike.%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Search error:', error);
        alert('Search failed: ' + error.message);
        return;
      }

      // For each WO, check if it has an invoice
      const resultsWithInvoice = await Promise.all(
        (data || []).map(async (wo) => {
          const { data: invoice } = await supabase
            .from('invoices')
            .select('invoice_id, invoice_number, status, total')
            .eq('wo_id', wo.wo_id)
            .single();

          return {
            ...wo,
            invoice: invoice || null
          };
        })
      );

      setResults(resultsWithInvoice);
    } catch (err) {
      console.error('Search error:', err);
      alert('Search failed: ' + err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getWorkflowStage = (wo) => {
    // Determine current workflow stage
    if (wo.invoice) {
      switch (wo.invoice.status) {
        case 'paid':
        case 'synced':
          return { stage: 'Paid/Synced', color: 'bg-green-600', icon: '💰' };
        case 'approved':
          return { stage: 'Invoice Approved', color: 'bg-blue-600', icon: '✅' };
        case 'draft':
          return { stage: 'Invoice Draft', color: 'bg-yellow-600', icon: '📄' };
        default:
          return { stage: 'Invoiced', color: 'bg-purple-600', icon: '📋' };
      }
    }

    if (wo.is_locked) {
      return { stage: 'Locked (Invoicing)', color: 'bg-orange-600', icon: '🔒' };
    }

    if (wo.acknowledged) {
      return { stage: 'Ready for Invoice', color: 'bg-green-500', icon: '✓' };
    }

    switch (wo.status) {
      case 'completed':
        return { stage: 'Completed (Awaiting Acknowledgment)', color: 'bg-teal-600', icon: '🏁' };
      case 'in_progress':
        return { stage: 'In Progress', color: 'bg-yellow-500', icon: '🔧' };
      case 'assigned':
        return { stage: 'Assigned', color: 'bg-blue-500', icon: '👷' };
      case 'tech_review':
        return { stage: 'Tech Review', color: 'bg-purple-500', icon: '🔍' };
      case 'pending':
      default:
        return { stage: 'Pending', color: 'bg-gray-500', icon: '⏳' };
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'emergency': return { bg: 'bg-red-600', text: 'EMERGENCY' };
      case 'high': return { bg: 'bg-orange-500', text: 'HIGH' };
      case 'medium': return { bg: 'bg-yellow-500 text-black', text: 'MEDIUM' };
      case 'low': return { bg: 'bg-blue-500', text: 'LOW' };
      default: return { bg: 'bg-gray-500', text: priority?.toUpperCase() || 'N/A' };
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-700 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">🔍 Global Work Order Search</h2>
            <p className="text-gray-400 text-sm mt-1">
              Search across ALL work orders - any status, including invoiced
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex gap-3">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter WO# or Building name..."
              className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg text-lg"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-bold"
            >
              {searching ? '⏳' : '🔍'} Search
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          {!searched && (
            <div className="text-center text-gray-400 py-12">
              <div className="text-6xl mb-4">🔍</div>
              <p>Enter a WO# or building name to search</p>
            </div>
          )}

          {searched && results.length === 0 && !searching && (
            <div className="text-center text-gray-400 py-12">
              <div className="text-6xl mb-4">📭</div>
              <p>No work orders found matching "{searchTerm}"</p>
            </div>
          )}

          {searching && (
            <div className="text-center text-gray-400 py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p>Searching...</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-4">
              <div className="text-sm text-gray-400 mb-4">
                Found {results.length} work order(s) matching "{searchTerm}"
              </div>

              {results.map((wo) => {
                const workflow = getWorkflowStage(wo);
                const priority = getPriorityBadge(wo.priority);

                return (
                  <div
                    key={wo.wo_id}
                    className="bg-gray-700 rounded-lg p-4 hover:bg-gray-650 transition"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-xl font-bold">{wo.wo_number}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${priority.bg}`}>
                            {priority.text}
                          </span>
                        </div>
                        <div className="text-gray-300 mt-1">{wo.building}</div>
                      </div>
                      <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${workflow.color} flex items-center gap-2`}>
                        <span>{workflow.icon}</span>
                        <span>{workflow.stage}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Status:</span>
                        <span className="ml-2 capitalize">{wo.status?.replace('_', ' ')}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Lead Tech:</span>
                        <span className="ml-2">
                          {wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">NTE:</span>
                        <span className="ml-2 font-semibold text-yellow-400">${(wo.nte || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Created:</span>
                        <span className="ml-2">{new Date(wo.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {wo.invoice && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-400">Invoice:</span>
                            <span className="font-semibold">{wo.invoice.invoice_number}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              wo.invoice.status === 'paid' || wo.invoice.status === 'synced' ? 'bg-green-600' :
                              wo.invoice.status === 'approved' ? 'bg-blue-600' : 'bg-yellow-600'
                            }`}>
                              {wo.invoice.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-green-400 font-bold">
                            ${wo.invoice.total?.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="mt-3 pt-3 border-t border-gray-600 flex gap-2">
                      <a
                        href={`/dashboard`}
                        className="bg-gray-600 hover:bg-gray-500 px-3 py-1.5 rounded text-sm"
                      >
                        📋 Dashboard
                      </a>
                      {wo.invoice && (
                        <a
                          href={`/invoices/${wo.invoice.invoice_id}/print`}
                          target="_blank"
                          className="bg-purple-600 hover:bg-purple-500 px-3 py-1.5 rounded text-sm"
                        >
                          🖨️ View Invoice
                        </a>
                      )}
                      {wo.acknowledged && !wo.invoice && (
                        <a
                          href={`/invoices`}
                          className="bg-green-600 hover:bg-green-500 px-3 py-1.5 rounded text-sm"
                        >
                          💰 Generate Invoice
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
