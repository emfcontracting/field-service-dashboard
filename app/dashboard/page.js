// app/dashboard/page.js
'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import DashboardHeader from './components/DashboardHeader';
import WorkOrdersView from './components/WorkOrdersView';
import AvailabilityView from './components/AvailabilityView';
import WorkOrderDetailModal from './components/WorkOrderDetailModal';
import NewWorkOrderModal from './components/NewWorkOrderModal';
// // import ImportModal from '../components/ImportModal';
import { fetchWorkOrders, fetchUsers } from './utils/dataFetchers';

// ImportModal with full functionality from original code
function ImportModal({ isOpen, onClose, onImportComplete }) {
  const [importMethod, setImportMethod] = useState(''); // 'sheets' or 'manual'
  const [sheetsUrl, setSheetsUrl] = useState('');
  const [importing, setImporting] = useState(false);
  
  // Manual entry states
  const [manualWO, setManualWO] = useState({
    wo_number: '',
    building: '',
    work_order_description: '',
    requestor: '',
    priority: 'medium',
    status: 'pending',
    lead_tech_id: '',
    nte: 0,
    comments: ''
  });

  if (!isOpen) return null;

  // Import from Google Sheets - your original working function
  const importFromSheets = async () => {
    // Use default spreadsheet URL if none provided
    const defaultSheetUrl = 'https://docs.google.com/spreadsheets/d/1sm7HjR4PdZLCNbaCQkswktGKEZX61fiVdTUaA5Rg6IE/edit?usp=sharing';
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
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

      console.log('Fetching from:', csvUrl);

      const response = await fetch(csvUrl);
      const csvText = await response.text();

      console.log('Raw CSV (first 500 chars):', csvText.substring(0, 500));

      // First, get existing WO numbers to avoid duplicates
      const { data: existingWOs, error: fetchError } = await supabase
        .from('work_orders')
        .select('wo_number');
      
      if (fetchError) {
        console.error('Error fetching existing work orders:', fetchError);
      }
      
      const existingWONumbers = new Set((existingWOs || []).map(wo => wo.wo_number));
      console.log('Existing WO numbers:', existingWONumbers.size);

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
        
        // Only add if has WO# and is NOT already in database
        const woNumber = result[0]?.trim();
        if (woNumber && !existingWONumbers.has(woNumber)) {
          dataRows.push(result);
        } else if (woNumber && existingWONumbers.has(woNumber)) {
          console.log(`Skipping existing WO: ${woNumber}`);
        }
      }

      console.log(`Found ${dataRows.length} NEW work orders to import (after filtering existing)`);

      if (dataRows.length === 0) {
        alert('No new work orders to import. All work orders in the spreadsheet already exist in the database.');
        setImporting(false);
        setSheetsUrl('');
        return;
      }

      const workOrdersToImport = dataRows.map((row, idx) => {
        // Based on your spreadsheet structure:
        // Column 0: WO#
        // Column 1: Building
        // Column 2: Priority  
        // Column 3: Date entered (format: "11/19/2024 11:57:29")
        // Column 4: Work Order Description
        // Column 5: NTE
        // Column 6: CONTACT
        
        console.log(`Processing row ${idx + 2}:`, {
          wo: row[0],
          building: row[1],
          priority: row[2],
          date: row[3]
        });
        
        // Parse date - handle format like "11/19/2024 11:57:29"
        let dateEntered;
        const dateStr = String(row[3] || '').trim();
        
        if (dateStr) {
          // Try to parse the date string
          const parsed = new Date(dateStr);
          
          if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000) {
            dateEntered = parsed.toISOString();
            console.log(`  ✓ Parsed date: "${dateStr}" → ${dateEntered}`);
          } else {
            console.warn(`  ✗ Failed to parse date: "${dateStr}"`);
            dateEntered = new Date().toISOString();
          }
        } else {
          console.warn(`  ✗ No date in row ${idx + 2}`);
          dateEntered = new Date().toISOString();
        }

        // Parse priority - based on your spreadsheet values
        let priority = 'medium';
        const priorityStr = String(row[2] || '').toUpperCase().trim();
        
        // Check for exact matches first
        if (priorityStr === 'P1' || priorityStr.includes('EMERGENCY')) {
          priority = 'emergency';
        } else if (priorityStr === 'P2' || priorityStr.includes('URGENT')) {
          priority = 'high';
        } else if (priorityStr === 'P3' || priorityStr === 'P4') {
          priority = 'medium';
        } else if (priorityStr === 'P5') {
          priority = 'low';
        } else {
          // Default to medium if not recognized
          priority = 'medium';
        }
        
        console.log(`  Priority: "${priorityStr}" → ${priority}`);

        return {
          wo_number: String(row[0] || '').trim(),
          building: String(row[1] || '').trim(),
          priority: priority,
          date_entered: dateEntered,
          work_order_description: String(row[4] || '').trim(),
          nte: parseFloat(String(row[5] || '').replace(/[^0-9.]/g, '')) || 0,
          requestor: String(row[6] || '').trim(),
          status: 'pending',
          comments: `Imported from Google Sheets on ${new Date().toLocaleDateString()}`
        };
      });

      console.log('Sample work order to import:', workOrdersToImport[0]);
      console.log(`Importing ${workOrdersToImport.length} new work orders...`);

      const { data, error } = await supabase
        .from('work_orders')
        .insert(workOrdersToImport)
        .select();

      if (error) {
        console.error('Import error:', error);
        alert('❌ Import error: ' + error.message);
      } else {
        console.log(`✅ Imported ${data.length} work orders`);
        alert(`✅ Successfully imported ${data.length} NEW work orders!\n\nSkipped ${existingWOs?.length || 0} existing work orders.`);
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
          date_entered: new Date().toISOString()
        }])
        .select();

      if (error) {
        console.error('Error creating work order:', error);
        alert('Error creating work order: ' + error.message);
      } else {
        alert('✅ Work order created successfully!');
        setManualWO({
          wo_number: '',
          building: '',
          work_order_description: '',
          requestor: '',
          priority: 'medium',
          status: 'pending',
          lead_tech_id: '',
          nte: 0,
          comments: ''
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
              onClick={() => {
                setImportMethod('');
                setSheetsUrl('');
              }}
              className="text-gray-400 hover:text-white text-3xl leading-none"
            >
              ←
            </button>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Google Sheets URL (Optional - Leave blank to use default sheet)
            </label>
            <input
              type="text"
              value={sheetsUrl}
              onChange={(e) => setSheetsUrl(e.target.value)}
              placeholder="Leave empty to use default EMF sheet or paste custom URL..."
              className="w-full px-4 py-3 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
              disabled={importing}
            />
            <p className="mt-2 text-sm text-gray-400">
              {sheetsUrl ? 
                'Using custom spreadsheet URL' : 
                '📊 Will import from default EMF Work Orders sheet'}
            </p>
          </div>

          <div className="bg-green-900 bg-opacity-50 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-green-300 mb-2">✨ Smart Import Features:</h3>
            <ul className="text-sm text-green-200 space-y-1">
              <li>• Automatically skips existing work orders</li>
              <li>• Only imports NEW work orders not in database</li>
              <li>• Shows count of new vs skipped items</li>
            </ul>
          </div>

          <div className="bg-blue-900 bg-opacity-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-300 mb-2">Expected Column Format:</h3>
            <ul className="text-sm text-blue-200 space-y-1">
              <li>• Column A: WO Number</li>
              <li>• Column B: Building</li>
              <li>• Column C: Priority (P1-P5)</li>
              <li>• Column D: Date Entered</li>
              <li>• Column E: Description</li>
              <li>• Column F: NTE Amount</li>
              <li>• Column G: Requestor/Contact</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={importFromSheets}
              disabled={importing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg font-bold text-white transition"
            >
              {importing ? 'Importing...' : '🔄 Import New Work Orders'}
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
              onClick={() => {
                setImportMethod('');
                setManualWO({
                  wo_number: '',
                  building: '',
                  work_order_description: '',
                  requestor: '',
                  priority: 'medium',
                  status: 'pending',
                  lead_tech_id: '',
                  nte: 0,
                  comments: ''
                });
              }}
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
                  status: 'pending',
                  lead_tech_id: '',
                  nte: 0,
                  comments: ''
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
import { calculateStats } from './utils/calculations';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Dashboard() {
  // State Management
  const [workOrders, setWorkOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [showNewWOModal, setShowNewWOModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('workorders');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
    needs_return: 0
  });

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    const workOrdersData = await fetchWorkOrders(supabase);
    const usersData = await fetchUsers(supabase);
    
    setWorkOrders(workOrdersData);
    setUsers(usersData);
    setStats(calculateStats(workOrdersData));
    setLoading(false);
  };

  const refreshWorkOrders = async () => {
    const workOrdersData = await fetchWorkOrders(supabase);
    setWorkOrders(workOrdersData);
    setStats(calculateStats(workOrdersData));
  };

  // Import Handler
  const handleImportClick = () => {
    setShowImportModal(true);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <DashboardHeader 
          activeView={activeView}
          setActiveView={setActiveView}
        />

        {activeView === 'availability' ? (
          <AvailabilityView 
            supabase={supabase}
            users={users}
          />
        ) : (
          <WorkOrdersView
            workOrders={workOrders}
            stats={stats}
            loading={loading}
            users={users}
            supabase={supabase}
            onSelectWorkOrder={setSelectedWO}
            onNewWorkOrder={() => setShowNewWOModal(true)}
            onImport={handleImportClick}
            refreshWorkOrders={refreshWorkOrders}
          />
        )}

        {/* Modals */}
        {selectedWO && (
          <WorkOrderDetailModal
            workOrder={selectedWO}
            users={users}
            supabase={supabase}
            onClose={() => setSelectedWO(null)}
            refreshWorkOrders={refreshWorkOrders}
          />
        )}

        {showNewWOModal && (
          <NewWorkOrderModal
            users={users}
            supabase={supabase}
            onClose={() => setShowNewWOModal(false)}
            refreshWorkOrders={refreshWorkOrders}
          />
        )}

        {/* Import Modal */}
        {showImportModal && (
          <ImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            onImportComplete={refreshWorkOrders}
          />
        )}
      </div>
    </div>
  );
}