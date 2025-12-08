// app/dashboard/components/EmailImportModal.js
'use client';

import { useState, useEffect } from 'react';

export default function EmailImportModal({ onClose, onImportComplete }) {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [emails, setEmails] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState({});
  const [editingWO, setEditingWO] = useState(null);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState(null);

  // Fetch emails on mount
  useEffect(() => {
    checkForEmails();
  }, []);

  const checkForEmails = async () => {
    setChecking(true);
    setError('');
    setEmails([]);
    setSelectedEmails({});

    try {
      const response = await fetch('/api/email-import');
      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch emails');
        return;
      }

      setEmails(data.emails || []);
      
      // Select all by default
      const selected = {};
      (data.emails || []).forEach((email, idx) => {
        selected[idx] = true;
      });
      setSelectedEmails(selected);

    } catch (err) {
      setError('Failed to connect to email server: ' + err.message);
    } finally {
      setChecking(false);
    }
  };

  const toggleSelect = (idx) => {
    setSelectedEmails(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const selectAll = () => {
    const selected = {};
    emails.forEach((_, idx) => { selected[idx] = true; });
    setSelectedEmails(selected);
  };

  const selectNone = () => {
    setSelectedEmails({});
  };

  const updateParsedField = (idx, field, value) => {
    setEmails(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        parsedData: {
          ...updated[idx].parsedData,
          [field]: value
        }
      };
      return updated;
    });
  };

  const handleImport = async () => {
    const selectedIndexes = Object.keys(selectedEmails).filter(k => selectedEmails[k]).map(Number);
    
    if (selectedIndexes.length === 0) {
      alert('Please select at least one email to import');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const emailIds = selectedIndexes.map(idx => emails[idx].emailId);
      const workOrders = selectedIndexes.map(idx => emails[idx].parsedData);

      const response = await fetch('/api/email-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailIds, workOrders, markAsRead: true })
      });

      const result = await response.json();
      setImportResult(result);

      if (result.success && result.imported > 0) {
        // Refresh the work orders list
        if (onImportComplete) {
          onImportComplete();
        }
      }

    } catch (err) {
      setError('Import failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'emergency': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              📧 Import Work Orders from Email
            </h2>
            <p className="text-gray-400 text-sm mt-1">
              Fetch CBRE dispatch emails and create work orders automatically
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Error Display */}
          {error && (
            <div className="bg-red-900 text-red-200 p-4 rounded-lg mb-4">
              <strong>⚠️ Error:</strong> {error}
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className={`p-4 rounded-lg mb-4 ${
              importResult.success ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
            }`}>
              <strong>{importResult.success ? '✅' : '❌'} {importResult.message}</strong>
              {importResult.errors && importResult.errors.length > 0 && (
                <ul className="mt-2 text-sm">
                  {importResult.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Loading State */}
          {checking && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-400">Checking for new work order emails...</p>
            </div>
          )}

          {/* No Emails */}
          {!checking && emails.length === 0 && !error && (
            <div className="text-center py-12 text-gray-400">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-xl font-semibold mb-2">No New Work Order Emails</p>
              <p className="text-sm">All CBRE dispatch emails have been processed.</p>
              <button
                onClick={checkForEmails}
                className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
              >
                🔄 Check Again
              </button>
            </div>
          )}

          {/* Email List */}
          {!checking && emails.length > 0 && (
            <>
              {/* Selection Controls */}
              <div className="flex justify-between items-center mb-4">
                <div className="text-sm text-gray-400">
                  {Object.values(selectedEmails).filter(Boolean).length} of {emails.length} selected
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Select All
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    onClick={selectNone}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    Select None
                  </button>
                  <span className="text-gray-600">|</span>
                  <button
                    onClick={checkForEmails}
                    className="text-blue-400 hover:text-blue-300 text-sm"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>

              {/* Email Cards */}
              <div className="space-y-4">
                {emails.map((email, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-lg p-4 transition ${
                      selectedEmails[idx]
                        ? 'border-blue-500 bg-gray-700'
                        : 'border-gray-600 bg-gray-750 opacity-60'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={!!selectedEmails[idx]}
                        onChange={() => toggleSelect(idx)}
                        className="mt-1 h-5 w-5 rounded"
                      />
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-bold text-lg text-white">
                              {email.parsedData.wo_number || 'Unknown WO#'}
                            </span>
                            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${
                              getPriorityColor(email.parsedData.priority)
                            }`}>
                              {email.parsedData.priority?.toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs text-gray-400">
                            Received: {formatDate(email.receivedAt)}
                          </span>
                        </div>
                        <p className="text-gray-300 mt-1">
                          📍 {email.parsedData.building || 'No building specified'}
                        </p>
                      </div>
                    </div>

                    {/* Expandable Details */}
                    {selectedEmails[idx] && (
                      <div className="mt-4 pl-8 space-y-3">
                        {/* Editable Fields */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Work Order #</label>
                            <input
                              type="text"
                              value={email.parsedData.wo_number || ''}
                              onChange={(e) => updateParsedField(idx, 'wo_number', e.target.value)}
                              className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Building</label>
                            <input
                              type="text"
                              value={email.parsedData.building || ''}
                              onChange={(e) => updateParsedField(idx, 'building', e.target.value)}
                              className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Priority</label>
                            <select
                              value={email.parsedData.priority || 'medium'}
                              onChange={(e) => updateParsedField(idx, 'priority', e.target.value)}
                              className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm"
                            >
                              <option value="emergency">🔴 Emergency</option>
                              <option value="high">🟠 High</option>
                              <option value="medium">🟡 Medium</option>
                              <option value="low">🔵 Low</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">Requestor</label>
                            <input
                              type="text"
                              value={email.parsedData.requestor || ''}
                              onChange={(e) => updateParsedField(idx, 'requestor', e.target.value)}
                              className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-400 mb-1">NTE ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              value={email.parsedData.nte || ''}
                              onChange={(e) => updateParsedField(idx, 'nte', parseFloat(e.target.value) || 0)}
                              className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm"
                              placeholder="Enter NTE"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Description</label>
                          <textarea
                            value={email.parsedData.work_order_description || ''}
                            onChange={(e) => updateParsedField(idx, 'work_order_description', e.target.value)}
                            className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm"
                            rows="3"
                          />
                        </div>

                        {/* Info Display */}
                        <div className="bg-gray-800 rounded p-3 text-xs text-gray-400">
                          <div className="grid grid-cols-2 gap-2">
                            <div>Date Entered: {formatDate(email.parsedData.date_entered)}</div>
                            <div>Requestor Phone: {email.parsedData.requestor_phone || 'N/A'}</div>
                            <div>Target Response: {formatDate(email.parsedData.target_response)}</div>
                            <div>Target Completion: {formatDate(email.parsedData.target_completion)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-4 flex justify-between items-center">
          <div className="text-sm text-gray-400">
            💡 Emails will be marked as read after import
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-700 px-6 py-2 rounded-lg font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={loading || Object.values(selectedEmails).filter(Boolean).length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-bold"
            >
              {loading ? '⏳ Importing...' : `📥 Import ${Object.values(selectedEmails).filter(Boolean).length} Work Order(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
