'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function InvoiceVerification() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef(null);
  
  // Invoice entry form
  const [selectedUser, setSelectedUser] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [claimedRegularHours, setClaimedRegularHours] = useState('');
  const [claimedOTHours, setClaimedOTHours] = useState('');
  const [claimedMiles, setClaimedMiles] = useState('');
  const [claimedTotal, setClaimedTotal] = useState('');
  
  // Imported line items
  const [importedItems, setImportedItems] = useState([]);
  const [showImportedItems, setShowImportedItems] = useState(false);
  const [importedText, setImportedText] = useState('');
  const [processingFile, setProcessingFile] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  
  // Comparison results
  const [emfData, setEmfData] = useState([]);
  const [comparing, setComparing] = useState(false);
  const [comparisonDone, setComparisonDone] = useState(false);

  // Saved verifications
  const [savedVerifications, setSavedVerifications] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  
  // View mode: 'manual', 'import'
  const [entryMode, setEntryMode] = useState('manual');

  useEffect(() => {
    loadUsers();
    loadSavedVerifications();
  }, []);

  async function loadUsers() {
    try {
      const { data } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, email, role')
        .in('role', ['lead_tech', 'tech', 'helper'])
        .eq('is_active', true)
        .order('first_name');

      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadSavedVerifications() {
    try {
      const { data } = await supabase
        .from('invoice_verifications')
        .select('*, user:users(first_name, last_name)')
        .order('created_at', { ascending: false })
        .limit(50);

      setSavedVerifications(data || []);
    } catch (error) {
      console.error('Error loading verifications:', error);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    setProcessingFile(true);
    setImportedText('');
    setFilePreview(null);

    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    try {
      if (fileName.endsWith('.csv') || fileType === 'text/csv') {
        // CSV file
        const text = await file.text();
        parseCSV(text);
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || 
                 fileType.includes('spreadsheet') || fileType.includes('excel')) {
        // Excel file
        await parseExcel(file);
      } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        // PDF file - extract text or use AI
        await processPDFOrImage(file, 'pdf');
      } else if (fileType.startsWith('image/') || 
                 fileName.endsWith('.jpg') || fileName.endsWith('.jpeg') || 
                 fileName.endsWith('.png') || fileName.endsWith('.heic')) {
        // Image file - show preview and use AI
        const imageUrl = URL.createObjectURL(file);
        setFilePreview({ type: 'image', url: imageUrl, name: file.name });
        await processPDFOrImage(file, 'image');
      } else {
        // Try as text
        const text = await file.text();
        parseCSV(text);
      }
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file: ' + error.message);
    } finally {
      setProcessingFile(false);
    }
  }

  async function parseExcel(file) {
    // Dynamic import of xlsx library
    const XLSX = await import('xlsx');
    
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to CSV then parse
    const csv = XLSX.utils.sheet_to_csv(sheet);
    parseCSV(csv);
  }

  async function processPDFOrImage(file, type) {
    // Convert file to base64
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });

    // Send to our API to extract data
    try {
      const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          fileType: type,
          mimeType: file.type
        })
      });

      if (!response.ok) {
        throw new Error('Failed to process file');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      // Set extracted text for reference
      if (data.rawText) {
        setImportedText(data.rawText);
      }

      // Set extracted values
      if (data.invoiceNumber) setInvoiceNumber(data.invoiceNumber);
      if (data.periodStart) setPeriodStart(data.periodStart);
      if (data.periodEnd) setPeriodEnd(data.periodEnd);
      if (data.regularHours) setClaimedRegularHours(data.regularHours.toString());
      if (data.otHours) setClaimedOTHours(data.otHours.toString());
      if (data.miles) setClaimedMiles(data.miles.toString());
      if (data.total) setClaimedTotal(data.total.toString());
      
      if (data.lineItems && data.lineItems.length > 0) {
        setImportedItems(data.lineItems);
        setShowImportedItems(true);
      }

      alert(`Extracted from ${type.toUpperCase()}!\nRegular: ${data.regularHours || 0}h, OT: ${data.otHours || 0}h, Miles: ${data.miles || 0}`);
    } catch (error) {
      console.error('Error extracting from file:', error);
      // Fall back to manual entry
      setImportedText(`Could not automatically extract data from ${type.toUpperCase()}. Please enter values manually.`);
      alert(`Could not automatically extract data. Please enter the values manually.\n\nError: ${error.message}`);
    }
  }

  function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      alert('CSV file appears to be empty');
      return;
    }

    // Parse header to find columns
    const header = lines[0].toLowerCase().split(',').map(h => h.trim());
    
    // Find column indices (flexible matching)
    const dateIdx = header.findIndex(h => h.includes('date'));
    const descIdx = header.findIndex(h => h.includes('desc') || h.includes('work') || h.includes('wo'));
    const regHoursIdx = header.findIndex(h => (h.includes('reg') && h.includes('hour')) || h === 'regular' || h === 'reg hrs' || h === 'reg');
    const otHoursIdx = header.findIndex(h => (h.includes('ot') || h.includes('overtime')) && (h.includes('hour') || h.includes('hrs') || h === 'ot'));
    const milesIdx = header.findIndex(h => h.includes('mile') || h.includes('mileage'));
    const amountIdx = header.findIndex(h => h.includes('amount') || h.includes('total') || h.includes('$'));
    const hoursIdx = header.findIndex(h => h === 'hours' || h === 'hrs');

    const items = [];
    let totalRegHours = 0;
    let totalOTHours = 0;
    let totalMiles = 0;
    let totalAmount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/['"$]/g, ''));
      
      const item = {
        date: dateIdx >= 0 ? values[dateIdx] : '',
        description: descIdx >= 0 ? values[descIdx] : '',
        regularHours: regHoursIdx >= 0 ? parseFloat(values[regHoursIdx]) || 0 : (hoursIdx >= 0 ? parseFloat(values[hoursIdx]) || 0 : 0),
        otHours: otHoursIdx >= 0 ? parseFloat(values[otHoursIdx]) || 0 : 0,
        miles: milesIdx >= 0 ? parseFloat(values[milesIdx]) || 0 : 0,
        amount: amountIdx >= 0 ? parseFloat(values[amountIdx]) || 0 : 0
      };

      if (!item.date && !item.description && item.regularHours === 0 && item.otHours === 0 && item.miles === 0) {
        continue;
      }

      items.push(item);
      totalRegHours += item.regularHours;
      totalOTHours += item.otHours;
      totalMiles += item.miles;
      totalAmount += item.amount;
    }

    setImportedItems(items);
    setClaimedRegularHours(totalRegHours.toString());
    setClaimedOTHours(totalOTHours.toString());
    setClaimedMiles(totalMiles.toString());
    setClaimedTotal(totalAmount.toString());
    setShowImportedItems(true);

    // Try to detect date range
    const dates = items.map(i => i.date).filter(d => d).sort();
    if (dates.length > 0) {
      const parseDate = (dateStr) => {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return d.toISOString().split('T')[0];
        }
        return null;
      };
      
      const startDate = parseDate(dates[0]);
      const endDate = parseDate(dates[dates.length - 1]);
      
      if (startDate) setPeriodStart(startDate);
      if (endDate) setPeriodEnd(endDate);
    }

    alert(`Imported ${items.length} line items!\nTotal: ${totalRegHours}h reg, ${totalOTHours}h OT, ${totalMiles} miles`);
  }

  async function runComparison() {
    if (!selectedUser || !periodStart || !periodEnd) {
      alert('Please select a contractor and date range');
      return;
    }

    setComparing(true);
    setComparisonDone(false);

    try {
      const { data, error } = await supabase
        .from('daily_hours_log')
        .select(`
          *,
          work_order:work_orders(wo_number, building, work_order_description)
        `)
        .eq('user_id', selectedUser)
        .gte('work_date', periodStart)
        .lte('work_date', periodEnd)
        .order('work_date', { ascending: true });

      if (error) throw error;

      setEmfData(data || []);
      setComparisonDone(true);
    } catch (error) {
      console.error('Error running comparison:', error);
      alert('Failed to fetch EMF data');
    } finally {
      setComparing(false);
    }
  }

  async function saveVerification() {
    if (!selectedUser || !periodStart || !periodEnd) return;

    const emfTotals = {
      regularHours: emfData.reduce((sum, e) => sum + parseFloat(e.hours_regular || 0), 0),
      otHours: emfData.reduce((sum, e) => sum + parseFloat(e.hours_overtime || 0), 0),
      miles: emfData.reduce((sum, e) => sum + parseFloat(e.miles || 0), 0)
    };

    const claimed = {
      regularHours: parseFloat(claimedRegularHours) || 0,
      otHours: parseFloat(claimedOTHours) || 0,
      miles: parseFloat(claimedMiles) || 0,
      total: parseFloat(claimedTotal) || 0
    };

    const hasDiscrepancy = 
      Math.abs(claimed.regularHours - emfTotals.regularHours) > 0.1 ||
      Math.abs(claimed.otHours - emfTotals.otHours) > 0.1 ||
      Math.abs(claimed.miles - emfTotals.miles) > 0.5;

    try {
      const { error } = await supabase
        .from('invoice_verifications')
        .insert({
          user_id: selectedUser,
          invoice_number: invoiceNumber || null,
          period_start: periodStart,
          period_end: periodEnd,
          claimed_regular_hours: claimed.regularHours,
          claimed_ot_hours: claimed.otHours,
          claimed_miles: claimed.miles,
          claimed_total: claimed.total,
          emf_regular_hours: emfTotals.regularHours,
          emf_ot_hours: emfTotals.otHours,
          emf_miles: emfTotals.miles,
          has_discrepancy: hasDiscrepancy,
          status: hasDiscrepancy ? 'flagged' : 'verified'
        });

      if (error) throw error;

      alert('Verification saved!');
      loadSavedVerifications();
      resetForm();
    } catch (error) {
      console.error('Error saving verification:', error);
      alert('Failed to save verification');
    }
  }

  function resetForm() {
    setSelectedUser('');
    setPeriodStart('');
    setPeriodEnd('');
    setInvoiceNumber('');
    setClaimedRegularHours('');
    setClaimedOTHours('');
    setClaimedMiles('');
    setClaimedTotal('');
    setEmfData([]);
    setComparisonDone(false);
    setImportedItems([]);
    setShowImportedItems(false);
    setImportedText('');
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // Calculate EMF totals
  const emfTotals = {
    regularHours: emfData.reduce((sum, e) => sum + parseFloat(e.hours_regular || 0), 0),
    otHours: emfData.reduce((sum, e) => sum + parseFloat(e.hours_overtime || 0), 0),
    miles: emfData.reduce((sum, e) => sum + parseFloat(e.miles || 0), 0)
  };

  // Calculate differences
  const claimed = {
    regularHours: parseFloat(claimedRegularHours) || 0,
    otHours: parseFloat(claimedOTHours) || 0,
    miles: parseFloat(claimedMiles) || 0
  };

  const diff = {
    regularHours: claimed.regularHours - emfTotals.regularHours,
    otHours: claimed.otHours - emfTotals.otHours,
    miles: claimed.miles - emfTotals.miles
  };

  const hasDiscrepancy = comparisonDone && (
    Math.abs(diff.regularHours) > 0.1 ||
    Math.abs(diff.otHours) > 0.1 ||
    Math.abs(diff.miles) > 0.5
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-2xl font-bold">🧾 External Invoice Verification</h1>
              <p className="text-sm text-gray-400">Compare external contractor invoices against EMF records</p>
            </div>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            {showHistory ? '📝 New Check' : '📋 History'}
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {showHistory ? (
          /* History View */
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Verification History</h2>
            {savedVerifications.length === 0 ? (
              <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-500">
                No verifications saved yet
              </div>
            ) : (
              <div className="space-y-3">
                {savedVerifications.map(v => (
                  <div
                    key={v.id}
                    className={`bg-gray-800 rounded-xl border p-4 ${
                      v.has_discrepancy ? 'border-red-500/50' : 'border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold">
                          {v.user?.first_name} {v.user?.last_name}
                          {v.invoice_number && <span className="text-gray-400 ml-2">#{v.invoice_number}</span>}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {new Date(v.period_start).toLocaleDateString()} - {new Date(v.period_end).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        v.has_discrepancy
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {v.has_discrepancy ? '⚠️ DISCREPANCY' : '✅ VERIFIED'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-gray-500">Regular Hours</p>
                        <p>Claimed: {v.claimed_regular_hours}h | EMF: {v.emf_regular_hours}h</p>
                      </div>
                      <div>
                        <p className="text-gray-500">OT Hours</p>
                        <p>Claimed: {v.claimed_ot_hours}h | EMF: {v.emf_ot_hours}h</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Mileage</p>
                        <p>Claimed: {v.claimed_miles} mi | EMF: {v.emf_miles} mi</p>
                      </div>
                    </div>
                    {v.claimed_total > 0 && (
                      <p className="text-sm text-gray-400 mt-2">
                        Claimed Total: ${parseFloat(v.claimed_total).toFixed(2)}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Verified: {new Date(v.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* New Verification Form */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Invoice Entry */}
            <div className="space-y-4">
              {/* Entry Mode Toggle */}
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setEntryMode('manual')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                      entryMode === 'manual' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    ✏️ Manual Entry
                  </button>
                  <button
                    onClick={() => setEntryMode('import')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                      entryMode === 'import' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    📥 Import File
                  </button>
                </div>

                {entryMode === 'import' && (
                  <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">Upload Invoice File</label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png,.heic"
                      onChange={handleFileUpload}
                      disabled={processingFile}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer disabled:opacity-50"
                    />
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded">CSV</span>
                      <span className="text-xs px-2 py-1 bg-green-900/30 text-green-400 rounded">Excel</span>
                      <span className="text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded">PDF</span>
                      <span className="text-xs px-2 py-1 bg-blue-900/30 text-blue-400 rounded">Image</span>
                    </div>
                    {processingFile && (
                      <div className="mt-2 text-sm text-yellow-400">
                        ⏳ Processing file...
                      </div>
                    )}
                  </div>
                )}

                {/* File Preview */}
                {filePreview && filePreview.type === 'image' && (
                  <div className="mb-4">
                    <p className="text-sm text-gray-400 mb-2">Preview: {filePreview.name}</p>
                    <img 
                      src={filePreview.url} 
                      alt="Invoice preview" 
                      className="max-h-48 rounded-lg border border-gray-600"
                    />
                  </div>
                )}

                {/* Extracted Text */}
                {importedText && (
                  <div className="mb-4 p-3 bg-gray-700/50 rounded-lg">
                    <p className="text-xs text-gray-400 mb-1">Extracted/Notes:</p>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
                      {importedText}
                    </p>
                  </div>
                )}

                <h2 className="font-bold mb-4">📄 Invoice Details</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Contractor *</label>
                    <select
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                    >
                      <option value="">Select contractor...</option>
                      {users.map(u => (
                        <option key={u.user_id} value={u.user_id}>
                          {u.first_name} {u.last_name} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Invoice # (optional)</label>
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                      placeholder="e.g., INV-2024-001"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Period Start *</label>
                      <input
                        type="date"
                        value={periodStart}
                        onChange={(e) => setPeriodStart(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Period End *</label>
                      <input
                        type="date"
                        value={periodEnd}
                        onChange={(e) => setPeriodEnd(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                      />
                    </div>
                  </div>

                  <hr className="border-gray-700" />

                  <p className="text-sm text-gray-400">
                    {entryMode === 'import' && importedItems.length > 0 
                      ? `Totals from imported file (${importedItems.length} items):` 
                      : 'Enter hours/miles from their invoice:'}
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Regular Hours</label>
                      <input
                        type="number"
                        step="0.1"
                        value={claimedRegularHours}
                        onChange={(e) => setClaimedRegularHours(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                        placeholder="0.0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">OT Hours</label>
                      <input
                        type="number"
                        step="0.1"
                        value={claimedOTHours}
                        onChange={(e) => setClaimedOTHours(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                        placeholder="0.0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Miles</label>
                      <input
                        type="number"
                        step="1"
                        value={claimedMiles}
                        onChange={(e) => setClaimedMiles(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Total $</label>
                      <input
                        type="number"
                        step="0.01"
                        value={claimedTotal}
                        onChange={(e) => setClaimedTotal(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <button
                    onClick={runComparison}
                    disabled={comparing || !selectedUser || !periodStart || !periodEnd}
                    className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-medium disabled:opacity-50"
                  >
                    {comparing ? '⏳ Fetching EMF Data...' : '🔍 Compare Against EMF Records'}
                  </button>
                </div>
              </div>

              {/* Imported Items Detail */}
              {showImportedItems && importedItems.length > 0 && (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold">📋 Imported Line Items ({importedItems.length})</h3>
                    <button
                      onClick={() => setShowImportedItems(!showImportedItems)}
                      className="text-sm text-gray-400 hover:text-white"
                    >
                      Hide
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {importedItems.map((item, idx) => (
                      <div key={idx} className="text-xs p-2 bg-gray-700/50 rounded flex justify-between">
                        <span className="text-gray-400">{item.date || '-'}</span>
                        <span className="truncate max-w-[150px]">{item.description || '-'}</span>
                        <span className="font-mono">
                          {item.regularHours}h + {item.otHours}h OT | {item.miles}mi
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Comparison Results */}
            <div className="space-y-4">
              {!comparisonDone ? (
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center text-gray-500">
                  <p className="text-4xl mb-4">🔍</p>
                  <p>Enter invoice details and click Compare to see EMF records</p>
                </div>
              ) : (
                <>
                  {/* Discrepancy Alert */}
                  {hasDiscrepancy ? (
                    <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4">
                      <h3 className="font-bold text-red-400 mb-2">⚠️ Discrepancy Detected!</h3>
                      <p className="text-sm text-red-300">
                        The claimed hours/miles don't match EMF records. Review carefully before paying.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-green-900/30 border border-green-500/50 rounded-xl p-4">
                      <h3 className="font-bold text-green-400 mb-2">✅ Records Match</h3>
                      <p className="text-sm text-green-300">
                        The claimed hours/miles match EMF records within acceptable tolerance.
                      </p>
                    </div>
                  )}

                  {/* Comparison Table */}
                  <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                    <h3 className="font-bold mb-4">📊 Comparison</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th className="text-left py-2">Metric</th>
                          <th className="text-right py-2">Invoice Claims</th>
                          <th className="text-right py-2">EMF Records</th>
                          <th className="text-right py-2">Difference</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className={Math.abs(diff.regularHours) > 0.1 ? 'bg-red-900/20' : ''}>
                          <td className="py-3">Regular Hours</td>
                          <td className="text-right font-mono">{claimed.regularHours.toFixed(1)}h</td>
                          <td className="text-right font-mono">{emfTotals.regularHours.toFixed(1)}h</td>
                          <td className={`text-right font-mono font-bold ${
                            Math.abs(diff.regularHours) > 0.1 ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {diff.regularHours >= 0 ? '+' : ''}{diff.regularHours.toFixed(1)}h
                          </td>
                        </tr>
                        <tr className={Math.abs(diff.otHours) > 0.1 ? 'bg-red-900/20' : ''}>
                          <td className="py-3">OT Hours</td>
                          <td className="text-right font-mono">{claimed.otHours.toFixed(1)}h</td>
                          <td className="text-right font-mono">{emfTotals.otHours.toFixed(1)}h</td>
                          <td className={`text-right font-mono font-bold ${
                            Math.abs(diff.otHours) > 0.1 ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {diff.otHours >= 0 ? '+' : ''}{diff.otHours.toFixed(1)}h
                          </td>
                        </tr>
                        <tr className={Math.abs(diff.miles) > 0.5 ? 'bg-red-900/20' : ''}>
                          <td className="py-3">Mileage</td>
                          <td className="text-right font-mono">{claimed.miles.toFixed(0)} mi</td>
                          <td className="text-right font-mono">{emfTotals.miles.toFixed(0)} mi</td>
                          <td className={`text-right font-mono font-bold ${
                            Math.abs(diff.miles) > 0.5 ? 'text-red-400' : 'text-green-400'
                          }`}>
                            {diff.miles >= 0 ? '+' : ''}{diff.miles.toFixed(0)} mi
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* EMF Detail */}
                  <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                    <h3 className="font-bold mb-3">📋 EMF Daily Log ({emfData.length} entries)</h3>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {emfData.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No EMF records found for this period</p>
                      ) : (
                        emfData.map((entry, idx) => (
                          <div key={idx} className="text-sm p-2 bg-gray-700/50 rounded">
                            <div className="flex justify-between">
                              <span className="text-gray-400">
                                {new Date(entry.work_date).toLocaleDateString()}
                              </span>
                              <span className="font-mono">
                                {parseFloat(entry.hours_regular || 0).toFixed(1)}h + {parseFloat(entry.hours_overtime || 0).toFixed(1)}h OT | {parseFloat(entry.miles || 0).toFixed(0)} mi
                              </span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {entry.work_order?.wo_number || 'N/A'} - {entry.work_order?.building || ''}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={saveVerification}
                    className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-medium"
                  >
                    💾 Save Verification
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
