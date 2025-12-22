// app/approval-analysis/page.js
// Standalone approval analysis dashboard - access via /approval-analysis
// NOT linked in main navigation - for testing/review purposes only

'use client';

import { useState, useEffect } from 'react';

export default function ApprovalAnalysisPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [selectedTech, setSelectedTech] = useState(null);
  const [showHeldOnly, setShowHeldOnly] = useState(false);

  useEffect(() => {
    fetchAnalysis();
  }, [days]);

  async function fetchAnalysis() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contractor/approval-analysis?days=${days}`);
      const result = await res.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analysis');
      }
      
      setData(result);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(amount || 0);
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.split('-');
    return `${month}/${day}/${year}`;
  }

  // Filter detailed items based on selections
  const filteredItems = data?.detailed_items?.filter(item => {
    if (selectedTech && item.tech_name !== selectedTech) return false;
    if (showHeldOnly && item.would_be_approved) return false;
    return true;
  }) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white text-lg">Analyzing subcontractor invoices...</p>
          <p className="text-gray-400 text-sm mt-2">Cross-referencing with work order completion status</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-red-900/50 border border-red-500 rounded-xl p-6 max-w-md">
          <h2 className="text-red-400 text-xl font-bold mb-2">⚠️ Error</h2>
          <p className="text-white">{error}</p>
          <button 
            onClick={fetchAnalysis}
            className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const totals = data?.overall_totals || {};
  const byTech = data?.by_tech || [];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">📊 Invoice Approval Analysis</h1>
              <p className="text-gray-400 text-sm mt-1">
                Dry run: What would happen if we required completed tickets for payment?
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400">Period:</label>
              <select 
                value={days} 
                onChange={(e) => setDays(parseInt(e.target.value))}
                className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
              </select>
              <button 
                onClick={fetchAnalysis}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        
        {/* Period Info */}
        <div className="text-sm text-gray-400">
          Analysis period: {formatDate(data?.analysis_period?.start_date)} - {formatDate(data?.analysis_period?.end_date)}
        </div>

        {/* Overall Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="text-gray-400 text-sm mb-1">Total Line Items</div>
            <div className="text-2xl font-bold">{totals.total_items || 0}</div>
            <div className="text-gray-500 text-sm">{formatCurrency(totals.total_amount)}</div>
          </div>
          
          <div className="bg-gray-800 rounded-xl border border-green-500/30 p-4">
            <div className="text-green-400 text-sm mb-1">✅ Would Be Approved</div>
            <div className="text-2xl font-bold text-green-400">{totals.approved_items || 0}</div>
            <div className="text-green-500/70 text-sm">{formatCurrency(totals.approved_amount)}</div>
          </div>
          
          <div className="bg-gray-800 rounded-xl border border-yellow-500/30 p-4">
            <div className="text-yellow-400 text-sm mb-1">⚠️ Would Be Held</div>
            <div className="text-2xl font-bold text-yellow-400">{totals.held_items || 0}</div>
            <div className="text-yellow-500/70 text-sm">{formatCurrency(totals.held_amount)}</div>
          </div>
          
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <div className="text-gray-400 text-sm mb-1">Approval Rate</div>
            <div className="text-2xl font-bold">
              <span className={parseFloat(totals.approval_rate) >= 80 ? 'text-green-400' : parseFloat(totals.approval_rate) >= 60 ? 'text-yellow-400' : 'text-red-400'}>
                {totals.approval_rate || 0}%
              </span>
            </div>
            <div className="text-gray-500 text-sm">{totals.held_rate || 0}% would be held</div>
          </div>
        </div>

        {/* Impact Summary */}
        {totals.held_amount > 0 && (
          <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4">
            <h3 className="text-yellow-400 font-bold mb-2">💰 Cash Flow Impact</h3>
            <p className="text-gray-300">
              If these rules were in place, <strong className="text-yellow-400">{formatCurrency(totals.held_amount)}</strong> would 
              have been held back until tickets were properly completed. This represents {totals.held_rate}% of total invoiced amounts.
            </p>
          </div>
        )}

        {/* By Tech Breakdown */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
            <h2 className="font-bold text-lg">👷 Breakdown by Technician</h2>
          </div>
          
          {byTech.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No invoice data found for this period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-700 bg-gray-800/30">
                    <th className="px-4 py-3">Technician</th>
                    <th className="px-4 py-3 text-right">Total Items</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                    <th className="px-4 py-3 text-right">Approved</th>
                    <th className="px-4 py-3 text-right">Held</th>
                    <th className="px-4 py-3 text-right">Held Amount</th>
                    <th className="px-4 py-3">Top Hold Reasons</th>
                    <th className="px-4 py-3 text-center">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {byTech.map((tech, idx) => {
                    const approvalRate = tech.total_items > 0 
                      ? ((tech.approved_items / tech.total_items) * 100).toFixed(0) 
                      : 100;
                    const topReasons = Object.entries(tech.hold_reasons || {})
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 2)
                      .map(([reason, count]) => `${reason} (${count})`);
                    
                    return (
                      <tr 
                        key={tech.user_id || idx} 
                        className={`border-b border-gray-700/50 hover:bg-gray-700/30 ${selectedTech === tech.tech_name ? 'bg-blue-900/20' : ''}`}
                      >
                        <td className="px-4 py-3 font-medium">{tech.tech_name}</td>
                        <td className="px-4 py-3 text-right">{tech.total_items}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(tech.total_amount)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-green-400">{tech.approved_items}</span>
                          <span className="text-gray-500 text-xs ml-1">({approvalRate}%)</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {tech.held_items > 0 ? (
                            <span className="text-yellow-400 font-medium">{tech.held_items}</span>
                          ) : (
                            <span className="text-gray-500">0</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {tech.held_amount > 0 ? (
                            <span className="text-yellow-400 font-medium">{formatCurrency(tech.held_amount)}</span>
                          ) : (
                            <span className="text-gray-500">$0.00</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {topReasons.length > 0 ? topReasons.join(', ') : '-'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setSelectedTech(selectedTech === tech.tech_name ? null : tech.tech_name)}
                            className={`px-3 py-1 rounded text-xs ${
                              selectedTech === tech.tech_name 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                            }`}
                          >
                            {selectedTech === tech.tech_name ? 'Clear' : 'View'}
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

        {/* Detailed Line Items */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <h2 className="font-bold text-lg">
              📋 Detailed Line Items
              {selectedTech && <span className="text-blue-400 font-normal ml-2">- {selectedTech}</span>}
            </h2>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showHeldOnly}
                  onChange={(e) => setShowHeldOnly(e.target.checked)}
                  className="rounded bg-gray-700 border-gray-600"
                />
                <span className="text-yellow-400">Show held only</span>
              </label>
              {selectedTech && (
                <button
                  onClick={() => setSelectedTech(null)}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
                >
                  Clear filter
                </button>
              )}
              <span className="text-gray-400 text-sm">
                {filteredItems.length} items
              </span>
            </div>
          </div>
          
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              {showHeldOnly ? 'No held items found' : 'No items found for this selection'}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-800">
                  <tr className="text-gray-400 text-left border-b border-gray-700">
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Invoice</th>
                    <th className="px-4 py-3">Tech</th>
                    <th className="px-4 py-3">WO #</th>
                    <th className="px-4 py-3">Building</th>
                    <th className="px-4 py-3">Work Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3">WO Status</th>
                    <th className="px-4 py-3">Photos</th>
                    <th className="px-4 py-3">Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, idx) => (
                    <tr 
                      key={idx} 
                      className={`border-b border-gray-700/50 ${
                        item.would_be_approved 
                          ? 'hover:bg-gray-700/30' 
                          : 'bg-yellow-900/10 hover:bg-yellow-900/20'
                      }`}
                    >
                      <td className="px-4 py-2">
                        {item.would_be_approved ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-900/50 text-green-400">
                            ✅ Approved
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-900/50 text-yellow-400">
                            ⚠️ Held
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{item.invoice_number}</td>
                      <td className="px-4 py-2">{item.tech_name}</td>
                      <td className="px-4 py-2 font-mono">
                        {item.wo_number || '-'}
                        {item.is_pm && <span className="ml-1 text-purple-400 text-xs">(PM)</span>}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400 max-w-[150px] truncate" title={item.building}>
                        {item.building || '-'}
                      </td>
                      <td className="px-4 py-2 text-xs">{formatDate(item.work_date)}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{item.item_type}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.amount)}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          item.wo_status === 'Completed' || item.wo_status === 'Invoiced' 
                            ? 'bg-green-900/50 text-green-400'
                            : item.wo_status === 'In Progress'
                            ? 'bg-blue-900/50 text-blue-400'
                            : 'bg-gray-700 text-gray-400'
                        }`}>
                          {item.wo_status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        {item.photos_received ? (
                          <span className="text-green-400">✓</span>
                        ) : (
                          <span className="text-red-400">✗</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {item.issues?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.issues.map((issue, i) => (
                              <span key={i} className="text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-400">
                                {issue}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend / Help */}
        <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4">
          <h3 className="font-bold mb-3">ℹ️ How This Analysis Works</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-400">
            <div>
              <h4 className="text-white font-medium mb-2">Approval Rules Applied:</h4>
              <ul className="space-y-1">
                <li>• Work order status must be: Completed, Invoiced, or Closed</li>
                <li>• Photos must be received (verified via email)</li>
                <li>• Line items without a WO link are auto-approved</li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-medium mb-2">What This Means:</h4>
              <ul className="space-y-1">
                <li>• <span className="text-green-400">Approved</span> = Would be paid immediately</li>
                <li>• <span className="text-yellow-400">Held</span> = Payment pending until ticket complete</li>
                <li>• Held amount = Your potential cash flow protection</li>
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
