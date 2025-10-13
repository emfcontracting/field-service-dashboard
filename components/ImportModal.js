'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vbhkdoouhnaevbvuslup.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiaGtkb291aG5hZXZidnVzbHVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTUwNDEsImV4cCI6MjA3NTUzMTA0MX0.qoC8tyZXNEMPN_S1NwdzrMV6uax15D1TmLNT_LBmVlo';

// Google Sheet configuration
const GOOGLE_SHEET_ID = '1sm7HjR4PdZLCNbaCQkswktGKEZX61fiVdTUaA5Rg6IE';
const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/export?format=xlsx`;

export default function ImportModal({ isOpen, onClose, onImportComplete }) {
  const [mode, setMode] = useState(null);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState([]);
  const [preview, setPreview] = useState(null);
  const [parsedData, setParsedData] = useState([]);

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const addLog = (message, type = 'info') => {
    setLog(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  };

  const mapPriority = (excelPriority) => {
    if (!excelPriority) return 'medium';
    const p = excelPriority.toLowerCase();
    if (p.includes('p1') || p.includes('emergency')) return 'emergency';
    if (p.includes('p2') || p.includes('urgent')) return 'high';
    if (p.includes('p3')) return 'medium';
    if (p.includes('p4') || p.includes('p5')) return 'low';
    return 'medium';
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      addLog(`File selected: ${selectedFile.name}`, 'success');
    }
  };

  const parseExcel = async (fileToRead) => {
    setLoading(true);
    setLog([]);
    addLog('📂 Reading Excel file...', 'info');

    try {
      const XLSX = await import('xlsx');
      
      const data = await fileToRead.arrayBuffer();
      const workbook = XLSX.read(data);

      addLog(`Found ${workbook.SheetNames.length} sheets`, 'info');

      if (!workbook.SheetNames.includes('OPEN WO')) {
        addLog('❌ ERROR: "OPEN WO" sheet not found!', 'error');
        setLoading(false);
        return;
      }

      const sheet = workbook.Sheets['OPEN WO'];
      const jsonData = XLSX.utils.sheet_to_json(sheet);

      addLog(`📋 Found ${jsonData.length} rows in OPEN WO sheet`, 'info');

      addLog('🔍 Checking existing work orders...', 'info');
      const { data: existingWOs, error: fetchError } = await supabase
        .from('work_orders')
        .select('wo_number');

      if (fetchError) {
        addLog(`❌ Error: ${fetchError.message}`, 'error');
        setLoading(false);
        return;
      }

      const existingWONumbers = new Set(existingWOs.map(wo => wo.wo_number));
      addLog(`Found ${existingWONumbers.size} existing work orders`, 'info');

      const processed = [];
      let newCount = 0;
      let existingCount = 0;

      for (const row of jsonData) {
        const woNumber = row['WO#'];
        if (!woNumber) continue;

        const exists = existingWONumbers.has(woNumber);
        const workOrder = {
          wo_number: woNumber,
          date_entered: row['Date entered'] ? new Date(row['Date entered']).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          building: row['Building'] || '',
          priority: mapPriority(row['Priority']),
          work_order_description: row['Work Order Description'] || '',
          nte: row['NTE'] ? parseFloat(row['NTE']) : null,
          requestor: row['CONTACT'] || '',
          status: 'pending',
          lead_tech_id: null,
          hours_regular: 0,
          hours_overtime: 0,
          miles: 0,
          material_cost: 0,
          emf_equipment_cost: 0,
          trailer_cost: 0,
          rental_cost: 0,
          comments: '',
          acknowledged: false,
          is_locked: false,
          _exists: exists
        };

        processed.push(workOrder);
        if (exists) existingCount++;
        else newCount++;
      }

      setParsedData(processed);
      setPreview({
        total: processed.length,
        new: newCount,
        existing: existingCount
      });

      addLog(`✅ Parse complete! ${newCount} new work orders ready`, 'success');
      if (existingCount > 0) {
        addLog(`⏭️ ${existingCount} already exist (will skip)`, 'warning');
      }
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleManualUpload = async () => {
    if (!file) {
      alert('Please select a file first');
      return;
    }
    await parseExcel(file);
  };

  const handleAutoImport = async () => {
    setLoading(true);
    setLog([]);
    addLog('⚡ Fetching data from Google Sheet...', 'info');

    try {
      const response = await fetch(GOOGLE_SHEET_URL);
      
      if (!response.ok) {
        throw new Error('Failed to fetch Google Sheet. Make sure it is set to "Anyone with the link can view".');
      }

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer]);
      const file = new File([blob], 'google-sheet-export.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      addLog('✅ Successfully fetched Google Sheet', 'success');
      
      await parseExcel(file);
    } catch (error) {
      addLog(`❌ Error fetching Google Sheet: ${error.message}`, 'error');
      console.error(error);
      setLoading(false);
    }
  };

  const executeImport = async () => {
    if (parsedData.length === 0) {
      alert('No data to import');
      return;
    }

    const newItems = parsedData.filter(wo => !wo._exists);
    if (newItems.length === 0) {
      alert('No new work orders to import');
      return;
    }

    if (!confirm(`Import ${newItems.length} new work orders?`)) {
      return;
    }

    setLoading(true);
    addLog('🚀 Starting import...', 'info');

    let imported = 0;
    let errors = 0;

    for (const workOrder of parsedData) {
      if (workOrder._exists) continue;

      const { _exists, ...woData } = workOrder;

      const { error } = await supabase
        .from('work_orders')
        .insert(woData);

      if (error) {
        addLog(`❌ Error: ${woData.wo_number} - ${error.message}`, 'error');
        console.error('Import error details:', error);
        errors++;
      } else {
        addLog(`✅ Imported: ${woData.wo_number}`, 'success');
        imported++;
      }
    }

    addLog('═══════════════════════', 'info');
    addLog(`✅ Imported: ${imported}`, 'success');
    addLog(`❌ Errors: ${errors}`, 'error');
    addLog('═══════════════════════', 'info');

    setLoading(false);

    if (imported > 0) {
      alert(`✅ Successfully imported ${imported} work orders!`);
      if (onImportComplete) onImportComplete();
      handleClose();
    }
  };

  const handleClose = () => {
    setMode(null);
    setFile(null);
    setLog([]);
    setPreview(null);
    setParsedData([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gray-700 px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">📥 Import Work Orders</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {!mode ? (
            <div className="space-y-4">
              <p className="text-gray-300 mb-6">Choose how you want to import work orders:</p>
              
              <button
                onClick={() => setMode('manual')}
                className="w-full bg-blue-600 hover:bg-blue-700 p-6 rounded-lg text-left transition group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">📁 Manual Upload</h3>
                    <p className="text-blue-200">Select an Excel file from your computer to import</p>
                  </div>
                  <span className="text-3xl group-hover:translate-x-2 transition-transform">→</span>
                </div>
              </button>

              <button
                onClick={() => setMode('auto')}
                className="w-full bg-green-600 hover:bg-green-700 p-6 rounded-lg text-left transition group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">⚡ Auto-Fetch from Google Sheets</h3>
                    <p className="text-green-200">Automatically fetch and parse from your configured Google Sheet</p>
                  </div>
                  <span className="text-3xl group-hover:translate-x-2 transition-transform">→</span>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">
                  {mode === 'manual' ? '📁 Manual Upload' : '⚡ Auto-Fetch from Google Sheets'}
                </h3>
                <button
                  onClick={() => setMode(null)}
                  className="text-blue-400 hover:text-blue-300"
                >
                  ← Back
                </button>
              </div>

              {mode === 'manual' && (
                <div className="bg-gray-700 p-4 rounded-lg">
                  <label className="block text-white font-semibold mb-2">Select Excel File:</label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileSelect}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded border border-gray-500"
                  />
                  {file && (
                    <button
                      onClick={handleManualUpload}
                      disabled={loading}
                      className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-bold transition"
                    >
                      {loading ? '⏳ Parsing...' : '📋 Parse File'}
                    </button>
                  )}
                </div>
              )}

              {mode === 'auto' && (
                <div className="bg-gray-700 p-4 rounded-lg">
                  <div className="bg-green-900 bg-opacity-50 border border-green-600 rounded-lg p-4 mb-4">
                    <p className="text-green-200 text-sm">
                      <strong>📊 Connected to:</strong><br />
                      Google Sheet ID: {GOOGLE_SHEET_ID.substring(0, 20)}...
                    </p>
                  </div>
                  <p className="text-gray-300 mb-4">
                    Click below to automatically fetch and parse work orders from your Google Sheet.
                  </p>
                  <button
                    onClick={handleAutoImport}
                    disabled={loading}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-bold transition"
                  >
                    {loading ? '⏳ Fetching & Processing...' : '⚡ Fetch & Auto-Parse from Google Sheets'}
                  </button>
                </div>
              )}

              {preview && (
                <div className="bg-blue-900 bg-opacity-30 border border-blue-600 rounded-lg p-4">
                  <h4 className="text-lg font-bold text-white mb-3">📊 Preview</h4>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-700 p-3 rounded text-center">
                      <div className="text-3xl font-bold text-blue-400">{preview.total}</div>
                      <div className="text-sm text-gray-300">Total Rows</div>
                    </div>
                    <div className="bg-gray-700 p-3 rounded text-center">
                      <div className="text-3xl font-bold text-green-400">{preview.new}</div>
                      <div className="text-sm text-gray-300">New</div>
                    </div>
                    <div className="bg-gray-700 p-3 rounded text-center">
                      <div className="text-3xl font-bold text-orange-400">{preview.existing}</div>
                      <div className="text-sm text-gray-300">Existing</div>
                    </div>
                  </div>
                  <button
                    onClick={executeImport}
                    disabled={loading || preview.new === 0}
                    className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-bold transition"
                  >
                    {loading ? '⏳ Importing...' : `📥 Import ${preview.new} Work Orders`}
                  </button>
                </div>
              )}

              {log.length > 0 && (
                <div className="bg-gray-900 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h4 className="text-white font-bold mb-2">📋 Log</h4>
                  {log.map((entry, idx) => (
                    <div
                      key={idx}
                      className={`text-sm mb-1 ${
                        entry.type === 'error' ? 'text-red-400' :
                        entry.type === 'success' ? 'text-green-400' :
                        entry.type === 'warning' ? 'text-orange-400' :
                        'text-blue-400'
                      }`}
                    >
                      [{entry.time}] {entry.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}