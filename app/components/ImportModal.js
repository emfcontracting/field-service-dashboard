// app/components/ImportModal.js
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ImportModal({ isOpen, onClose, onImportComplete }) {
  const [importMethod, setImportMethod] = useState('');
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [importing, setImporting] = useState(false);
  
  // Gmail fetch states
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailEmails, setGmailEmails] = useState([]);
  const [gmailDuplicates, setGmailDuplicates] = useState([]);
  const [selectedEmails, setSelectedEmails] = useState({});
  const [gmailError, setGmailError] = useState('');
  const [gmailMessage, setGmailMessage] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [includeRead, setIncludeRead] = useState(false);
  
  // Manual entry states
  const [manualWO, setManualWO] = useState({
    wo_number: '',
    building: '',
    work_order_description: '',
    requestor: '',
    priority: 'P4',
    nte: 0
  });

  if (!isOpen) return null;

  // ============== GMAIL FETCH FUNCTIONS ==============
  const fetchGmailEmails = async (includeReadEmails = false) => {
    setGmailLoading(true);
    setGmailError('');
    setGmailMessage('');
    setGmailEmails([]);
    setGmailDuplicates([]);
    setSelectedEmails({});
    setImportResult(null);

    try {
      const url = includeReadEmails 
        ? '/api/email-import?includeRead=true&days=3' 
        : '/api/email-import';
      const response = await fetch(url);
      const data = await response.json();

      if (!data.success) {
        setGmailError(data.error || 'Failed to fetch emails');
        return;
      }

      setGmailEmails(data.emails || []);
      setGmailDuplicates(data.duplicates || []);
      setGmailMessage(data.message || '');
      
      // Select all by default
      const selected = {};
      (data.emails || []).forEach((_, idx) => {
        selected[idx] = true;
      });
      setSelectedEmails(selected);

    } catch (err) {
      setGmailError('Failed to connect: ' + err.message);
    } finally {
      setGmailLoading(false);
    }
  };

  const toggleEmailSelect = (idx) => {
    setSelectedEmails(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const updateEmailField = (idx, field, value) => {
    setGmailEmails(prev => {
      const updated = [...prev];
      updated[idx] = {
        ...updated[idx],
        parsedData: { ...updated[idx].parsedData, [field]: value }
      };
      return updated;
    });
  };

  const handleGmailImport = async () => {
    const selectedIndexes = Object.keys(selectedEmails).filter(k => selectedEmails[k]).map(Number);
    
    if (selectedIndexes.length === 0) {
      alert('Please select at least one email to import');
      return;
    }

    setImporting(true);
    setGmailError('');

    try {
      const emailIds = selectedIndexes.map(idx => gmailEmails[idx].emailId);
      const workOrders = selectedIndexes.map(idx => gmailEmails[idx].parsedData);

      const response = await fetch('/api/email-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailIds, workOrders, markAsRead: true })
      });

      const result = await response.json();
      setImportResult(result);

      if (result.success && result.imported > 0) {
        onImportComplete();
      }

    } catch (err) {
      setGmailError('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'emergency': return { bg: 'bg-red-600', text: '🔴 EMERGENCY' };
      case 'high': return { bg: 'bg-orange-500', text: '🟠 HIGH' };
      case 'medium': return { bg: 'bg-yellow-500 text-black', text: '🟡 MEDIUM' };
      case 'low': return { bg: 'bg-blue-500', text: '🔵 LOW' };
      default: return { bg: 'bg-gray-500', text: priority?.toUpperCase() || 'N/A' };
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  };

  // ============== GOOGLE SHEETS IMPORT ==============
  const importFromSheets = async () => {
    const defaultSheetUrl = 'https://docs.google.com/spreadsheets/d/1sm7HjR4PdZLCNbaCQkswktGKEZX61fiVdTUaA5Rg6IE/edit?gid=1945903606#gid=1945903606';
    const urlToUse = sheetsUrl || defaultSheetUrl;
    
    setImporting(true);

    try {
      const match = urlToUse.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        alert('Invalid Google Sheets URL');
        setImporting(false);
        return;
      }

      const spreadsheetId = match[1];
      let gid = null;
      const gidMatch = urlToUse.match(/[#&?]gid=([0-9]+)/);
      if (gidMatch) gid = gidMatch[1];
      
      const csvUrl = gid 
        ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`
        : `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

      const response = await fetch(csvUrl);
      const csvText = await response.text();

      const { data: existingWOs } = await supabase
        .from('work_orders')
        .select('wo_number');
      
      const existingWONumbers = new Set((existingWOs || []).map(wo => wo.wo_number));

      const lines = csvText.split('\n');
      const dataRows = [];
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          const nextChar = line[j + 1];
          
          if (char === '"' && nextChar === '"') {
            current += '"';
            j++;
          } else if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        
        const woNumber = result[0]?.trim();
        const isValidWO = woNumber && 
                         /^[A-Z0-9]/.test(woNumber) &&
                         !woNumber.toLowerCase().includes('assignment') &&
                         !woNumber.toLowerCase().includes('open') &&
                         woNumber.length > 2;
        
        if (isValidWO && !existingWONumbers.has(woNumber)) {
          dataRows.push(result);
        }
      }

      if (dataRows.length === 0) {
        alert('No new work orders to import.');
        setImporting(false);
        return;
      }

      const workOrdersToImport = dataRows.map((row) => {
        let dateEntered = new Date().toISOString();
        const dateStr = String(row[3] || '').trim();
        if (dateStr) {
          const parsed = new Date(dateStr);
          if (!isNaN(parsed.getTime())) dateEntered = parsed.toISOString();
        }

        let priority = 'P4';
        const priorityStr = String(row[2] || '').toUpperCase().trim();
        if (['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P10', 'P11', 'P23'].includes(priorityStr)) {
          priority = priorityStr;
        }

        return {
          wo_number: String(row[0] || '').trim(),
          building: String(row[1] || '').trim(),
          priority,
          date_entered: dateEntered,
          work_order_description: String(row[4] || '').trim(),
          nte: parseFloat(String(row[5] || '').replace(/[^0-9.]/g, '')) || 0,
          requestor: String(row[6] || '').trim(),
          status: 'pending',
          comments: `Imported from Google Sheets on ${new Date().toLocaleDateString()}`
        };
      });

      const { data, error } = await supabase
        .from('work_orders')
        .insert(workOrdersToImport)
        .select();

      if (error) {
        alert('❌ Import error: ' + error.message);
      } else {
        alert(`✅ Imported ${data.length} work orders!`);
        setSheetsUrl('');
        setImportMethod('');
        onImportComplete();
        onClose();
      }
    } catch (error) {
      alert('❌ Failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  // ============== MANUAL ENTRY ==============
  const handleManualSubmit = async () => {
    if (!manualWO.wo_number || !manualWO.building || !manualWO.work_order_description) {
      alert('Please fill in WO#, Building, and Description');
      return;
    }

    setImporting(true);

    try {
      const { data, error } = await supabase
        .from('work_orders')
        .insert([{
          ...manualWO,
          date_entered: new Date().toISOString(),
          status: 'pending',
          comments: ''
        }])
        .select();

      if (error) {
        alert('Error: ' + error.message);
      } else {
        alert('✅ Work order created!');
        setManualWO({ wo_number: '', building: '', work_order_description: '', requestor: '', priority: 'P4', nte: 0 });
        setImportMethod('');
        onImportComplete();
        onClose();
      }
    } catch (error) {
      alert('Failed: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  // ============== METHOD SELECTION ==============
  if (!importMethod) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Import Work Orders</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-3xl">×</button>
          </div>
          
          <p className="text-gray-300 mb-6">Choose how you want to import:</p>
          
          <div className="space-y-3">
            <button
              onClick={() => { setImportMethod('gmail'); fetchGmailEmails(); }}
              className="w-full bg-purple-600 hover:bg-purple-700 px-6 py-4 rounded-lg text-white text-left transition"
            >
              <div className="font-bold text-lg mb-1">📧 Fetch from Gmail</div>
              <div className="text-sm opacity-90">Auto-fetch CBRE dispatch emails from wo.emfcontractingsc@gmail.com</div>
            </button>
            
            <button
              onClick={() => setImportMethod('sheets')}
              className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-4 rounded-lg text-white text-left transition"
            >
              <div className="font-bold text-lg mb-1">📊 Import from Google Sheets</div>
              <div className="text-sm opacity-90">Bulk import from spreadsheet</div>
            </button>
            
            <button
              onClick={() => setImportMethod('manual')}
              className="w-full bg-green-600 hover:bg-green-700 px-6 py-4 rounded-lg text-white text-left transition"
            >
              <div className="font-bold text-lg mb-1">✏️ Manual Entry</div>
              <div className="text-sm opacity-90">Type in work order details</div>
            </button>
          </div>
          
          <button
            onClick={onClose}
            className="w-full mt-6 bg-gray-600 hover:bg-gray-700 px-4 py-3 rounded-lg text-white font-bold"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ============== GMAIL FETCH SCREEN ==============
  if (importMethod === 'gmail') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="border-b border-gray-700 p-6 flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">📧 CBRE Email Import</h2>
              <p className="text-gray-400 text-sm mt-1">Fetching from wo.emfcontractingsc@gmail.com</p>
            </div>
            <button
              onClick={() => { setImportMethod(''); setGmailEmails([]); setGmailError(''); setImportResult(null); }}
              className="text-gray-400 hover:text-white text-3xl"
            >←</button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Error */}
            {gmailError && (
              <div className="bg-red-900 text-red-200 p-4 rounded-lg">
                ⚠️ {gmailError}
              </div>
            )}

            {/* Import Result */}
            {importResult && (
              <div className={`p-4 rounded-lg ${importResult.success ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'}`}>
                <strong>{importResult.success ? '✅' : '❌'} {importResult.message}</strong>
                {importResult.errors?.length > 0 && (
                  <ul className="mt-2 text-sm">
                    {importResult.errors.map((err, i) => <li key={i}>• {err}</li>)}
                  </ul>
                )}
              </div>
            )}

            {/* Loading */}
            {gmailLoading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Fetching emails from Gmail...</p>
              </div>
            )}

            {/* Status Message */}
            {!gmailLoading && gmailMessage && (
              <div className="bg-blue-900/50 text-blue-200 p-4 rounded-lg">
                ℹ️ {gmailMessage}
              </div>
            )}

            {/* Duplicates Info */}
            {!gmailLoading && gmailDuplicates.length > 0 && (
              <div className="bg-yellow-900/50 text-yellow-200 p-4 rounded-lg">
                <div className="font-semibold mb-2">⚠️ {gmailDuplicates.length} duplicate(s) skipped (already in system):</div>
                <ul className="text-sm space-y-1">
                  {gmailDuplicates.map((dup, i) => (
                    <li key={i}>• {dup.wo_number} - {dup.building}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* No Emails */}
            {!gmailLoading && gmailEmails.length === 0 && !gmailError && (
              <div className="text-center py-12 text-gray-400">
                <div className="text-6xl mb-4">📭</div>
                <p className="text-xl font-semibold mb-2">No New Work Order Emails</p>
                <p className="text-sm mb-4">All CBRE dispatch emails have been imported or marked as read.</p>
                
                <div className="flex flex-col items-center gap-3">
                  <button
                    onClick={() => fetchGmailEmails(false)}
                    className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg"
                  >
                    🔄 Check Again (Unread Only)
                  </button>
                  
                  <button
                    onClick={() => fetchGmailEmails(true)}
                    className="bg-orange-600 hover:bg-orange-700 px-4 py-2 rounded-lg"
                  >
                    📥 Include Read Emails (Last 3 Days)
                  </button>
                  <p className="text-xs text-gray-500 mt-2">Use "Include Read" if a new WO was already opened in Gmail</p>
                  <p className="text-xs text-gray-500">💡 Auto-import runs every 15 min and may have processed new emails</p>
                </div>
              </div>
            )}

            {/* Email List */}
            {!gmailLoading && gmailEmails.length > 0 && (
              <>
                {/* Selection Controls */}
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm text-gray-400">
                    {Object.values(selectedEmails).filter(Boolean).length} of {gmailEmails.length} selected
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const all = {};
                        gmailEmails.forEach((_, idx) => { all[idx] = true; });
                        setSelectedEmails(all);
                      }}
                      className="text-purple-400 hover:text-purple-300 text-sm"
                    >Select All</button>
                    <span className="text-gray-600">|</span>
                    <button
                      onClick={() => setSelectedEmails({})}
                      className="text-purple-400 hover:text-purple-300 text-sm"
                    >Select None</button>
                    <span className="text-gray-600">|</span>
                    <button
                      onClick={() => fetchGmailEmails(false)}
                      className="text-purple-400 hover:text-purple-300 text-sm"
                    >🔄 Refresh</button>
                    <span className="text-gray-600">|</span>
                    <button
                      onClick={() => fetchGmailEmails(true)}
                      className="text-orange-400 hover:text-orange-300 text-sm"
                    >📥 Include Read</button>
                  </div>
                </div>

                {/* Email Cards */}
                <div className="space-y-4">
                  {gmailEmails.map((email, idx) => {
                    const badge = getPriorityBadge(email.parsedData.priority);
                    
                    return (
                      <div
                        key={idx}
                        className={`border rounded-lg p-4 transition ${
                          selectedEmails[idx] ? 'border-purple-500 bg-gray-700' : 'border-gray-600 bg-gray-750 opacity-60'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={!!selectedEmails[idx]}
                            onChange={() => toggleEmailSelect(idx)}
                            className="mt-1 h-5 w-5 rounded"
                          />
                          <div className="flex-1">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-lg text-white">
                                  {email.parsedData.wo_number || 'Unknown WO#'}
                                </span>
                                <span className={`ml-2 px-2 py-0.5 rounded text-xs font-semibold ${badge.bg}`}>
                                  {badge.text}
                                </span>
                              </div>
                              <span className="text-xs text-gray-400">
                                {formatDate(email.receivedAt)}
                              </span>
                            </div>
                            <p className="text-gray-300 mt-1">
                              📍 {email.parsedData.building || 'No building specified'}
                            </p>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {selectedEmails[idx] && (
                          <div className="mt-4 pl-8 space-y-3">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Work Order #</label>
                                <input
                                  type="text"
                                  value={email.parsedData.wo_number || ''}
                                  onChange={(e) => updateEmailField(idx, 'wo_number', e.target.value)}
                                  className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Building</label>
                                <input
                                  type="text"
                                  value={email.parsedData.building || ''}
                                  onChange={(e) => updateEmailField(idx, 'building', e.target.value)}
                                  className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">Priority</label>
                                <select
                                  value={email.parsedData.priority || 'medium'}
                                  onChange={(e) => updateEmailField(idx, 'priority', e.target.value)}
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
                                  onChange={(e) => updateEmailField(idx, 'requestor', e.target.value)}
                                  className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-400 mb-1">NTE ($)</label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={email.parsedData.nte || ''}
                                  onChange={(e) => updateEmailField(idx, 'nte', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm"
                                  placeholder="Enter NTE"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs text-gray-400 mb-1">Description</label>
                              <textarea
                                value={email.parsedData.work_order_description || ''}
                                onChange={(e) => updateEmailField(idx, 'work_order_description', e.target.value)}
                                className="w-full bg-gray-600 text-white px-3 py-2 rounded text-sm"
                                rows="3"
                              />
                            </div>

                            {email.parsedData.comments && (
                              <div className="bg-gray-800 rounded p-3 text-xs text-gray-400">
                                <pre className="whitespace-pre-wrap">{email.parsedData.comments}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-700 p-4 flex justify-between">
            <button
              onClick={() => { setImportMethod(''); setGmailEmails([]); setGmailError(''); setImportResult(null); }}
              className="bg-gray-600 hover:bg-gray-700 px-6 py-2 rounded-lg font-semibold"
            >
              Back
            </button>
            <button
              onClick={handleGmailImport}
              disabled={importing || Object.values(selectedEmails).filter(Boolean).length === 0}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-8 py-2 rounded-lg font-bold"
            >
              {importing ? '⏳ Importing...' : `✅ Import ${Object.values(selectedEmails).filter(Boolean).length} Work Order(s)`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============== GOOGLE SHEETS SCREEN ==============
  if (importMethod === 'sheets') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">📊 Import from Google Sheets</h2>
            <button onClick={() => { setImportMethod(''); setSheetsUrl(''); }} className="text-gray-400 hover:text-white text-3xl">←</button>
          </div>

          <div className="mb-6">
            <label className="block text-sm text-gray-300 mb-2">Google Sheets URL (optional)</label>
            <input
              type="text"
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              placeholder="Leave empty for default EMF sheet..."
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg"
              disabled={importing}
            />
          </div>

          <div className="bg-green-900/50 rounded-lg p-4 mb-6">
            <p className="text-green-200 text-sm">✨ Automatically skips existing work orders</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={importFromSheets}
              disabled={importing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-bold"
            >
              {importing ? 'Importing...' : '🔄 Import'}
            </button>
            <button
              onClick={() => { setImportMethod(''); setSheetsUrl(''); }}
              className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============== MANUAL ENTRY SCREEN ==============
  if (importMethod === 'manual') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">✏️ Manual Entry</h2>
            <button onClick={() => setImportMethod('')} className="text-gray-400 hover:text-white text-3xl">←</button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Work Order # *</label>
                <input
                  type="text"
                  value={manualWO.wo_number}
                  onChange={(e) => setManualWO({ ...manualWO, wo_number: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="C1234567"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Building *</label>
                <input
                  type="text"
                  value={manualWO.building}
                  onChange={(e) => setManualWO({ ...manualWO, building: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Description *</label>
              <textarea
                value={manualWO.work_order_description}
                onChange={(e) => setManualWO({ ...manualWO, work_order_description: e.target.value })}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                rows="3"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Requestor</label>
                <input
                  type="text"
                  value={manualWO.requestor}
                  onChange={(e) => setManualWO({ ...manualWO, requestor: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Priority</label>
                <select
                  value={manualWO.priority}
                  onChange={(e) => setManualWO({ ...manualWO, priority: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="P1">🔴 P1 - Emergency</option>
                  <option value="P2">🟠 P2 - Urgent</option>
                  <option value="P3">🟡 P3</option>
                  <option value="P4">🔵 P4</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">NTE ($)</label>
                <input
                  type="number"
                  value={manualWO.nte}
                  onChange={(e) => setManualWO({ ...manualWO, nte: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleManualSubmit}
              disabled={importing}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-bold"
            >
              {importing ? 'Creating...' : 'Create Work Order'}
            </button>
            <button
              onClick={() => setImportMethod('')}
              className="bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
