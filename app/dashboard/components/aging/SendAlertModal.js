// app/dashboard/components/aging/SendAlertModal.js
'use client';

import { useState, useMemo } from 'react';

export default function SendAlertModal({ 
  stats, 
  agingWorkOrders, 
  leadTechs,
  users,
  preselectedTechId,
  onClose, 
  onAlertSent 
}) {
  const [selectedTechs, setSelectedTechs] = useState(
    preselectedTechId ? [preselectedTechId] : []
  );
  const [sendToAll, setSendToAll] = useState(!preselectedTechId);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null);

  // Get techs with aging work orders
  const techsWithAging = useMemo(() => {
    return Object.entries(stats.byTech)
      .filter(([techId, data]) => techId !== 'unassigned' && data.total > 0)
      .map(([techId, data]) => {
        // Find tech email from users
        const techUser = users.find(u => u.user_id === techId);
        return {
          techId,
          name: data.name,
          email: techUser?.email || 'No email',
          critical: data.critical,
          warning: data.warning,
          stale: data.stale,
          total: data.total,
          workOrders: data.workOrders
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [stats.byTech, users]);

  // Toggle tech selection
  const toggleTech = (techId) => {
    if (sendToAll) {
      setSendToAll(false);
      setSelectedTechs([techId]);
    } else {
      setSelectedTechs(prev => 
        prev.includes(techId) 
          ? prev.filter(id => id !== techId)
          : [...prev, techId]
      );
    }
  };

  // Select all techs
  const handleSelectAll = () => {
    setSendToAll(true);
    setSelectedTechs([]);
  };

  // Get work orders for selected techs
  const selectedWorkOrders = useMemo(() => {
    if (sendToAll) {
      return agingWorkOrders;
    }
    return agingWorkOrders.filter(wo => selectedTechs.includes(wo.lead_tech_id));
  }, [sendToAll, selectedTechs, agingWorkOrders]);

  // Get selected tech count
  const selectedCount = sendToAll ? techsWithAging.length : selectedTechs.length;

  // Send alerts
  const handleSend = async () => {
    if (selectedCount === 0) {
      alert('Please select at least one technician');
      return;
    }

    const techNames = sendToAll 
      ? 'ALL technicians' 
      : techsWithAging
          .filter(t => selectedTechs.includes(t.techId))
          .map(t => t.name)
          .join(', ');

    if (!confirm(`Send aging alert emails to ${techNames}?`)) {
      return;
    }

    setSending(true);
    setResults(null);

    try {
      // Filter work orders based on selection
      const workOrdersToSend = sendToAll 
        ? agingWorkOrders 
        : agingWorkOrders.filter(wo => selectedTechs.includes(wo.lead_tech_id));

      // If sending to specific techs, pass that info
      const response = await fetch('/api/aging/send-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          workOrders: workOrdersToSend,
          targetTechIds: sendToAll ? null : selectedTechs
        })
      });

      const result = await response.json();
      
      setResults(result);

      if (result.success) {
        onAlertSent();
      }
    } catch (err) {
      console.error('Error sending alerts:', err);
      setResults({ success: false, error: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold flex items-center gap-2">
              📧 Send Aging Alert Emails
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Select which technicians should receive aging alerts
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Results Display */}
          {results && (
            <div className={`mb-4 p-4 rounded-lg ${results.success ? 'bg-green-900/50 border border-green-600' : 'bg-red-900/50 border border-red-600'}`}>
              {results.success ? (
                <>
                  <div className="font-bold text-green-400 mb-2">
                    ✅ Sent {results.emailsSent} alert email(s)!
                  </div>
                  {results.results && (
                    <div className="text-sm space-y-1">
                      {results.results.map((r, i) => (
                        <div key={i} className={r.status === 'sent' ? 'text-green-300' : 'text-red-300'}>
                          {r.status === 'sent' ? '✓' : '✗'} {r.tech} ({r.email})
                          {r.error && <span className="text-red-400 ml-2">- {r.error}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-red-400">
                  ❌ Failed to send alerts: {results.error}
                </div>
              )}
            </div>
          )}

          {/* Select All Option */}
          <div className="mb-4">
            <button
              onClick={handleSelectAll}
              className={`w-full p-4 rounded-lg border-2 transition text-left ${
                sendToAll 
                  ? 'border-blue-500 bg-blue-900/30' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                    sendToAll ? 'bg-blue-500 border-blue-500' : 'border-gray-500'
                  }`}>
                    {sendToAll && <span className="text-white text-sm">✓</span>}
                  </div>
                  <div>
                    <div className="font-semibold">Send to All Technicians</div>
                    <div className="text-sm text-gray-400">
                      {techsWithAging.length} techs with {agingWorkOrders.length} aging work orders
                    </div>
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 border-t border-gray-600"></div>
            <span className="text-gray-500 text-sm">OR select individual techs</span>
            <div className="flex-1 border-t border-gray-600"></div>
          </div>

          {/* Individual Tech Selection */}
          <div className="space-y-2">
            {techsWithAging.length === 0 ? (
              <div className="text-center text-gray-500 py-4">
                No technicians have aging work orders
              </div>
            ) : (
              techsWithAging.map(tech => {
                const isSelected = !sendToAll && selectedTechs.includes(tech.techId);
                
                return (
                  <button
                    key={tech.techId}
                    onClick={() => toggleTech(tech.techId)}
                    className={`w-full p-4 rounded-lg border-2 transition text-left ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-900/30' 
                        : sendToAll 
                          ? 'border-gray-700 bg-gray-700/30 opacity-50'
                          : 'border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                          isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-500'
                        }`}>
                          {isSelected && <span className="text-white text-sm">✓</span>}
                        </div>
                        <div>
                          <div className="font-semibold">{tech.name}</div>
                          <div className="text-sm text-gray-400">{tech.email}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {tech.critical > 0 && (
                          <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">
                            🔴 {tech.critical}
                          </span>
                        )}
                        {tech.warning > 0 && (
                          <span className="bg-orange-600 text-white text-xs px-2 py-1 rounded">
                            🟠 {tech.warning}
                          </span>
                        )}
                        {tech.stale > 0 && (
                          <span className="bg-yellow-600 text-white text-xs px-2 py-1 rounded">
                            🟡 {tech.stale}
                          </span>
                        )}
                        <span className="text-gray-400 text-sm ml-2">
                          {tech.total} WO{tech.total !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 bg-gray-900/50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-400">
              {sendToAll ? (
                <>Sending to <span className="text-white font-semibold">{techsWithAging.length}</span> technicians</>
              ) : selectedTechs.length > 0 ? (
                <>Sending to <span className="text-white font-semibold">{selectedTechs.length}</span> selected technician{selectedTechs.length !== 1 ? 's' : ''}</>
              ) : (
                <>Select technicians to send alerts</>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition"
              >
                {results?.success ? 'Close' : 'Cancel'}
              </button>
              
              {!results?.success && (
                <button
                  onClick={handleSend}
                  disabled={sending || selectedCount === 0}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition flex items-center gap-2"
                >
                  {sending ? (
                    <>⏳ Sending...</>
                  ) : (
                    <>📧 Send Alerts</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
