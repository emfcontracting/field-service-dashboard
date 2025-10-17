// app/components/ImportModal.js
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ImportModal({ isOpen, onClose, onImportComplete }) {
  const [importMethod, setImportMethod] = useState(''); // 'sheets', 'manual', 'csv'
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [importing, setImporting] = useState(false);
  }
  
  // Manual entry states
  const [manualWO, setManualWO] = useState({
    wo_number: '',
    building: '',
    work_order_description: '',
    requestor: '',
    priority: 'medium',
    nte: 0
  });

  if (!isOpen) return null;

  // Import from Google Sheets
  const importFromSheets = async () => {
    if (!sheetsUrl) {
      alert('Please enter a Google Sheets URL');
      return;
    }

    setImporting(true);

    try {
      const match = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        alert('Invalid Google Sheets URL');
        setImporting(false);
        return;
      }

      const spreadsheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

      console.log('Fetching from:', csvUrl);

      const response = await fetch(csvUrl);
      const csvText = await response.text();

      console.log('Raw CSV (first 500 chars):', csvText.substring(0, 500));

      // Split into lines
      const lines = csvText.split('\n');
      const header = lines[0];
      console.log('Header:', header);
      
      const dataRows = [];
      
      // Parse each line properly handling quotes
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Better CSV parsing that handles quoted commas
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          const nextChar = line[j + 1];
          
          if (char === '"' && nextChar === '"') {
            // Escaped quote
            current += '"';
            j++; // Skip next quote
          } else if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim()); // Don't forget last column
        
        if (result[0]) { // Has WO#
          dataRows.push(result);
        }
      }

      console.log(`Found ${dataRows.length} rows to import`);

      const workOrdersToImport = dataRows.map((row, idx) => {
        // Column mapping based on your original code:
        // Column 0: WO#
        // Column 1: Building
        // Column 2: Priority  
        // Column 3: Date entered
        // Column 4: Work Order Description
        // Column 5: NTE
        // Column 6: CONTACT
        
        // Parse date
        let dateEntered;
        const dateStr = String(row[3] || '').trim();
        
        if (dateStr) {
          const parsed = new Date(dateStr);
          
          if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000) {
            dateEntered = parsed.toISOString();
          } else {
            dateEntered = new Date().toISOString();
          }
        } else {
          dateEntered = new Date().toISOString();
        }

        // Parse priority
        let priority = 'medium';
        const priorityStr = String(row[2] || '').toLowerCase();
        if (priorityStr.includes('emergency') || priorityStr.includes('p1')) {
          priority = 'emergency';
        } else if (priorityStr.includes('urgent') || priorityStr.includes('p2')) {
          priority = 'high';
        } else if (priorityStr.includes('p3') || priorityStr.includes('p4')) {
          priority = 'medium';
        } else if (priorityStr.includes('p5')) {
          priority = 'low';
        }

        return {
          wo_number: String(row[0] || '').trim(),
          building: String(row[1] || '').trim(),
          priority: priority,
          date_entered: dateEntered,
          work_order_description: String(row[4] || '').trim(),
          nte: parseFloat(String(row[5] || '').replace(/[^0-9.]/g, '')) || 0,
          requestor: String(row[6] || '').trim(),
          status: 'pending',
          comments: ''
        };
      });

      console.log('Sample work order to import:', workOrdersToImport[0]);

      const { data, error } = await supabase
        .from('work_orders')
        .insert(workOrdersToImport)
        .select();

      if (error) {
        console.error('Import error:', error);
        alert('❌ Import error: ' + error.message);
      } else {
        console.log(`✅ Imported ${data.length} work orders`);
        alert(`✅ Successfully imported ${data.length} work orders!`);
        setSheetsUrl('');
        setImportMethod('');
        onImportComplete();
        onClose();
      }
    } catch (error) {
      console.error('Import exception:', error);
      alert('❌ Failed to import: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  // Manual entry submission
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
        alert('Error creating work order: ' + error.message);
      } else {
        alert('✅ Work order created successfully!');
        setManualWO({
          wo_number: '',
          building: '',
          work_order_description: '',
          requestor: '',
          priority: 'medium',
          nte: 0
        });
        setImportMethod('');
        onImportComplete();
        onClose();
      }
    } catch (error) {
      alert('Failed to create work order: ' + error.message);
    } finally {
      setImporting(false);
    }
  };

  // Method selection screen
  if (!importMethod) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Import Work Orders</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-3xl leading-none"
            >
              ×
            </button>
          </div>
          
          <p className="text-gray-300 mb-6">
            Choose how you want to import work orders:
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => setImportMethod('sheets')}
              className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-4 rounded-lg text-white text-left transition"
            >
              <div className="font-bold text-lg mb-1">📊 Import from Google Sheets</div>
              <div className="text-sm opacity-90">Bulk import from a spreadsheet URL</div>
            </button>
            
            <button
              onClick={() => setImportMethod('manual')}
              className="w-full bg-green-600 hover:bg-green-700 px-6 py-4 rounded-lg text-white text-left transition"
            >
              <div className="font-bold text-lg mb-1">✏️ Manual Entry</div>
              <div className="text-sm opacity-90">Create a single work order manually</div>
            </button>
            
            <button
              onClick={() => alert('CSV upload coming soon!')}
              className="w-full bg-purple-600 hover:bg-purple-700 px-6 py-4 rounded-lg text-white text-left transition opacity-75"
            >
              <div className="font-bold text-lg mb-1">📁 Upload CSV File</div>
              <div className="text-sm opacity-90">Coming soon...</div>
            </button>
          </div>
          
          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full bg-gray-600 hover:bg-gray-700 px-4 py-3 rounded-lg text-white font-bold"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Google Sheets import screen
  if (importMethod === 'sheets') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Import from Google Sheets</h2>
            <button
              onClick={() => setImportMethod('')}
              className="text-gray-400 hover:text-white text-3xl leading-none"
            >
              ←
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Google Sheets URL
            </label>
            <input
              type="text"
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
              disabled={importing}
            />
            <p className="mt-2 text-sm text-gray-400">
              Make sure the spreadsheet is publicly accessible
            </p>
          </div>

          <div className="bg-blue-900 bg-opacity-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-300 mb-2">Expected Column Format:</h3>
            <ul className="text-sm text-blue-200 space-y-1">
              <li>• Column A: WO Number</li>
              <li>• Column B: Building</li>
              <li>• Column C: Priority (P1-P5, Emergency, etc.)</li>
              <li>• Column D: Date Entered</li>
              <li>• Column E: Description</li>
              <li>• Column F: NTE Amount</li>
              <li>• Column G: Requestor/Contact</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={importFromSheets}
              disabled={importing || !sheetsUrl}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-bold text-white transition"
            >
              {importing ? 'Importing...' : 'Import from Sheets'}
            </button>
            <button
              onClick={() => {
                setImportMethod('');
                setSheetsUrl('');
              }}
              disabled={importing}
              className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold text-white transition"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Manual entry screen
  if (importMethod === 'manual') {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Manual Work Order Entry</h2>
            <button
              onClick={() => setImportMethod('')}
              className="text-gray-400 hover:text-white text-3xl leading-none"
            >
              ←
            </button>
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
                  placeholder="WO-2025-001"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Building *</label>
                <input
                  type="text"
                  value={manualWO.building}
                  onChange={(e) => setManualWO({ ...manualWO, building: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="Building A"
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
                placeholder="Describe the work to be done..."
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Requestor</label>
              <input
                type="text"
                value={manualWO.requestor}
                onChange={(e) => setManualWO({ ...manualWO, requestor: e.target.value })}
                className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                placeholder="John Smith"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Priority</label>
                <select
                  value={manualWO.priority}
                  onChange={(e) => setManualWO({ ...manualWO, priority: e.target.value })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="emergency">Emergency</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">NTE Budget ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={manualWO.nte}
                  onChange={(e) => setManualWO({ ...manualWO, nte: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg"
                  placeholder="5000.00"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleManualSubmit}
              disabled={importing}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-bold text-white transition"
            >
              {importing ? 'Creating...' : 'Create Work Order'}
            </button>
            <button
              onClick={() => {
                setImportMethod('');
                setManualWO({
                  wo_number: '',
                  building: '',
                  work_order_description: '',
                  requestor: '',
                  priority: 'medium',
                  nte: 0
                });
              }}
              disabled={importing}
              className="bg-gray-600 hover:bg-gray-700 disabled:opacity-50 px-6 py-3 rounded-lg font-semibold text-white transition"
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