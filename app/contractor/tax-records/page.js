'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';
import {
  DEFAULT_TAX_CATEGORIES,
  TAX_CATEGORY_GROUPS,
  mergeCategories,
  groupCategories,
} from '@/lib/taxRecordCategories';

const supabase = getSupabase();

export default function TaxRecordsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [records, setRecords] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [filterGroup, setFilterGroup] = useState('all');
  const [exporting, setExporting] = useState(false);

  // Add record modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  // Manage categories modal
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  const availableYears = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= 2024; y--) availableYears.push(y);

  // Auth
  useEffect(() => {
    const userData = sessionStorage.getItem('contractor_user');
    if (!userData) {
      router.push('/contractor');
      return;
    }
    try {
      setUser(JSON.parse(userData));
    } catch {
      router.push('/contractor');
    }
  }, [router]);

  // Load data when user or year changes
  useEffect(() => {
    if (user) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, year]);

  async function loadData() {
    setLoading(true);
    try {
      const [recordsRes, catsRes] = await Promise.all([
        fetch(`/api/contractor/tax-records?user_id=${user.user_id}&year=${year}`),
        fetch(`/api/contractor/tax-categories?user_id=${user.user_id}`),
      ]);
      const recordsData = await recordsRes.json();
      const catsData    = await catsRes.json();
      setRecords(recordsData.records || []);
      setCustomCategories(catsData.categories || []);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  const allCategories = useMemo(
    () => mergeCategories(customCategories),
    [customCategories]
  );

  const groupedCategories = useMemo(
    () => groupCategories(allCategories),
    [allCategories]
  );

  // Filter records by group
  const filteredRecords = useMemo(() => {
    if (filterGroup === 'all') return records;
    const namesInGroup = allCategories
      .filter(c => c.group === filterGroup)
      .map(c => c.name);
    return records.filter(r => namesInGroup.includes(r.category_name));
  }, [records, filterGroup, allCategories]);

  // Totals by category
  const totalsByCategory = useMemo(() => {
    const map = {};
    for (const rec of records) {
      map[rec.category_name] = (map[rec.category_name] || 0) + parseFloat(rec.amount);
    }
    return map;
  }, [records]);

  // Totals by group
  const totalsByGroup = useMemo(() => {
    const map = {};
    for (const rec of records) {
      const cat = allCategories.find(c => c.name === rec.category_name);
      const group = cat ? cat.group : 'custom';
      map[group] = (map[group] || 0) + parseFloat(rec.amount);
    }
    return map;
  }, [records, allCategories]);

  const grandTotal = useMemo(
    () => records.reduce((s, r) => s + parseFloat(r.amount), 0),
    [records]
  );

  async function handleExport(format) {
    setExporting(true);
    try {
      if (format === 'pdf') {
        // Open print page in new window
        window.open(`/contractor/tax-records/print?year=${year}`, '_blank');
      } else {
        const res = await fetch('/api/contractor/tax-export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.user_id, year, format }),
        });
        if (!res.ok) throw new Error(await res.text());

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
                  || `TaxRecords_${year}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete(recordId) {
    if (!confirm('Delete this record?')) return;
    try {
      await fetch(`/api/contractor/tax-records/${recordId}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center flex-wrap gap-2">
          <div>
            <Link href="/contractor/dashboard" className="text-sm text-blue-400 hover:text-blue-300">
              ← Dashboard
            </Link>
            <h1 className="text-xl font-bold mt-1">💰 Tax Records</h1>
            <p className="text-sm text-gray-400">Personal & business expense tracking for tax prep</p>
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setEditingRecord(null); setShowAddModal(true); }}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium"
          >
            ➕ Add Receipt
          </button>
          <button
            onClick={() => setShowCategoriesModal(true)}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-medium"
          >
            🏷️ Manage Categories
          </button>
          <div className="flex-grow" />
          <button
            onClick={() => handleExport('xlsx')}
            disabled={exporting || records.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium"
          >
            📊 Excel Export
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting || records.length === 0}
            className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium"
          >
            📄 PDF Export
          </button>
          <button
            onClick={() => handleExport('master-xlsx')}
            disabled={exporting || records.length === 0}
            className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 px-4 py-2 rounded-lg font-medium"
            title="Combined Personal Expenses + EMF Income"
          >
            🏆 Master Report
          </button>
        </div>

        {/* Summary Cards by Group */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <div
            className={`p-3 rounded-lg cursor-pointer border-2 transition ${
              filterGroup === 'all' ? 'border-white bg-gray-700' : 'border-transparent bg-gray-800 hover:bg-gray-700'
            }`}
            onClick={() => setFilterGroup('all')}
          >
            <div className="text-xs text-gray-400">📦 All</div>
            <div className="text-lg font-bold">${grandTotal.toFixed(2)}</div>
          </div>
          {TAX_CATEGORY_GROUPS.map(grp => (
            <div
              key={grp.key}
              className={`p-3 rounded-lg cursor-pointer border-2 transition ${
                filterGroup === grp.key ? 'border-white' : 'border-transparent hover:opacity-80'
              }`}
              style={{ backgroundColor: grp.color + '30' }}
              onClick={() => setFilterGroup(grp.key)}
            >
              <div className="text-xs flex items-center gap-1">
                <span>{grp.icon}</span>
                <span>{grp.label}</span>
              </div>
              <div className="text-lg font-bold">${(totalsByGroup[grp.key] || 0).toFixed(2)}</div>
            </div>
          ))}
        </div>

        {/* Category Totals Grid */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="font-bold mb-3">📈 Category Totals — {year}</h2>
          {Object.entries(groupedCategories).map(([groupKey, cats]) => {
            const groupInfo = TAX_CATEGORY_GROUPS.find(g => g.key === groupKey);
            if (!groupInfo) return null;
            return (
              <div key={groupKey} className="mb-4 last:mb-0">
                <div
                  className="text-sm font-semibold mb-2 px-2 py-1 rounded"
                  style={{ backgroundColor: groupInfo.color + '30' }}
                >
                  {groupInfo.icon} {groupInfo.label}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {cats.map(cat => {
                    const total = totalsByCategory[cat.name] || 0;
                    return (
                      <div
                        key={cat.category_id}
                        className="p-2 rounded text-sm"
                        style={{ backgroundColor: cat.color + '15' }}
                      >
                        <div className="text-xs text-gray-400 truncate">{cat.name}</div>
                        <div className={`font-bold ${total > 0 ? 'text-white' : 'text-gray-600'}`}>
                          ${total.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Records Table */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h2 className="font-bold">📋 Records ({filteredRecords.length})</h2>
            {filterGroup !== 'all' && (
              <button
                onClick={() => setFilterGroup('all')}
                className="text-sm text-blue-400 hover:text-blue-300"
              >
                Clear filter ✕
              </button>
            )}
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : filteredRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="mb-2">No records yet for {year}</p>
              <button
                onClick={() => { setEditingRecord(null); setShowAddModal(true); }}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                Add your first receipt →
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900 text-gray-400">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">INV #</th>
                    <th className="px-4 py-2 text-left">Category</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-left">Notes</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredRecords.map(rec => {
                    const cat = allCategories.find(c => c.name === rec.category_name);
                    return (
                      <tr key={rec.record_id} className="hover:bg-gray-700/50">
                        <td className="px-4 py-2">{rec.entry_date}</td>
                        <td className="px-4 py-2 text-gray-400">{rec.invoice_ref || '—'}</td>
                        <td className="px-4 py-2">
                          <span
                            className="px-2 py-1 rounded text-xs"
                            style={{ backgroundColor: (cat?.color || '#9CA3AF') + '40' }}
                          >
                            {rec.category_name}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-bold">
                          ${parseFloat(rec.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-gray-400 max-w-xs truncate">
                          {rec.notes || ''}
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          <button
                            onClick={() => { setEditingRecord(rec); setShowAddModal(true); }}
                            className="text-blue-400 hover:text-blue-300 mr-2"
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handleDelete(rec.record_id)}
                            className="text-red-400 hover:text-red-300"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-900 font-bold">
                  <tr>
                    <td colSpan="3" className="px-4 py-2 text-right">Total:</td>
                    <td className="px-4 py-2 text-right">
                      ${filteredRecords.reduce((s, r) => s + parseFloat(r.amount), 0).toFixed(2)}
                    </td>
                    <td colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Record Modal */}
      {showAddModal && (
        <RecordModal
          user={user}
          year={year}
          categories={allCategories}
          groupedCategories={groupedCategories}
          record={editingRecord}
          onClose={() => { setShowAddModal(false); setEditingRecord(null); }}
          onSaved={() => { setShowAddModal(false); setEditingRecord(null); loadData(); }}
        />
      )}

      {/* Manage Categories Modal */}
      {showCategoriesModal && (
        <CategoriesModal
          user={user}
          customCategories={customCategories}
          onClose={() => setShowCategoriesModal(false)}
          onChanged={loadData}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Record Modal — add or edit a single tax record
// ─────────────────────────────────────────────────────────────────────────────
function RecordModal({ user, year, categories, groupedCategories, record, onClose, onSaved }) {
  const isEdit = !!record;
  const [entryDate, setEntryDate]     = useState(record?.entry_date || new Date().toISOString().slice(0, 10));
  const [invoiceRef, setInvoiceRef]   = useState(record?.invoice_ref || '');
  const [categoryName, setCategoryName] = useState(record?.category_name || categories[0]?.name || '');
  const [amount, setAmount]           = useState(record?.amount?.toString() || '');
  const [notes, setNotes]             = useState(record?.notes || '');
  const [receiptUrl, setReceiptUrl]   = useState(record?.receipt_url || '');
  const [saving, setSaving]           = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [error, setError]             = useState('');

  async function handleSave() {
    setError('');
    if (!categoryName || !amount || parseFloat(amount) <= 0) {
      setError('Category and a positive amount are required');
      return;
    }
    setSaving(true);
    try {
      const body = {
        user_id: user.user_id,
        tax_year: year,
        entry_date: entryDate,
        invoice_ref: invoiceRef || null,
        category_name: categoryName,
        amount: parseFloat(amount),
        notes: notes || null,
        receipt_url: receiptUrl || null,
      };

      const url = isEdit
        ? `/api/contractor/tax-records/${record.record_id}`
        : `/api/contractor/tax-records`;
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleReceiptUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingReceipt(true);
    setError('');
    try {
      const supabase = (await import('@/lib/supabase')).getSupabase();
      const ext = file.name.split('.').pop();
      const fileName = `${user.user_id}/${Date.now()}.${ext}`;

      const { data, error: uploadError } = await supabase.storage
        .from('tax-receipts')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('tax-receipts')
        .getPublicUrl(fileName);

      setReceiptUrl(urlData.publicUrl);
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploadingReceipt(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold">{isEdit ? 'Edit Receipt' : 'Add Receipt'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Receipt / INV #</label>
            <input
              type="text"
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
              placeholder="e.g., HD-12345 (optional)"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Category</label>
            <select
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
            >
              {Object.entries(groupedCategories).map(([groupKey, cats]) => {
                const groupInfo = TAX_CATEGORY_GROUPS.find(g => g.key === groupKey);
                return (
                  <optgroup key={groupKey} label={groupInfo ? `${groupInfo.icon} ${groupInfo.label}` : groupKey}>
                    {cats.map(c => (
                      <option key={c.category_id} value={c.name}>{c.name}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount ($)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-lg font-bold"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Receipt Photo (optional)</label>
            {receiptUrl ? (
              <div className="flex items-center gap-2">
                <a href={receiptUrl} target="_blank" rel="noopener noreferrer"
                   className="text-blue-400 hover:text-blue-300 text-sm flex-grow truncate">
                  📷 View receipt
                </a>
                <button
                  onClick={() => setReceiptUrl('')}
                  className="text-red-400 text-xs"
                >
                  Remove
                </button>
              </div>
            ) : (
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleReceiptUpload}
                disabled={uploadingReceipt}
                className="w-full text-sm text-gray-400"
              />
            )}
            {uploadingReceipt && <div className="text-xs text-gray-500 mt-1">Uploading...</div>}
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-2 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-grow bg-gray-700 hover:bg-gray-600 py-2 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-grow bg-green-600 hover:bg-green-700 disabled:opacity-50 py-2 rounded-lg font-bold"
            >
              {saving ? 'Saving...' : isEdit ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Categories Modal — manage custom categories
// ─────────────────────────────────────────────────────────────────────────────
function CategoriesModal({ user, customCategories, onClose, onChanged }) {
  const [newName, setNewName]   = useState('');
  const [newColor, setNewColor] = useState('#9CA3AF');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/contractor/tax-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.user_id,
          category_name: newName.trim(),
          color_hex: newColor,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add');
      setNewName('');
      setNewColor('#9CA3AF');
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(catId) {
    if (!confirm('Delete this custom category? Existing records will keep the category name but it will no longer be selectable for new entries.')) return;
    try {
      await fetch(`/api/contractor/tax-categories/${catId}`, { method: 'DELETE' });
      onChanged();
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-xl border border-gray-700 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-bold">🏷️ Manage Custom Categories</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-400">
            The 25 default categories from the standard template are always available.
            Add your own here for anything not covered.
          </p>

          {/* Add new */}
          <div className="bg-gray-900 rounded-lg p-3 space-y-2">
            <div className="text-sm font-semibold">Add New Category</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Category name"
                className="flex-grow bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-12 h-10 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer"
              />
              <button
                onClick={handleAdd}
                disabled={saving || !newName.trim()}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-medium"
              >
                Add
              </button>
            </div>
            {error && <div className="text-red-400 text-xs">{error}</div>}
          </div>

          {/* Existing customs */}
          <div>
            <div className="text-sm font-semibold mb-2">Your Custom Categories</div>
            {customCategories.length === 0 ? (
              <div className="text-sm text-gray-500 italic">No custom categories yet</div>
            ) : (
              <div className="space-y-1">
                {customCategories.map(cat => (
                  <div key={cat.category_id} className="flex items-center gap-2 p-2 bg-gray-900 rounded-lg">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: cat.color_hex }}
                    />
                    <span className="flex-grow">{cat.category_name}</span>
                    <button
                      onClick={() => handleDelete(cat.category_id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Defaults reference */}
          <div>
            <div className="text-sm font-semibold mb-2">Default Categories (always available)</div>
            <div className="flex flex-wrap gap-1">
              {DEFAULT_TAX_CATEGORIES.map(c => (
                <span
                  key={c.name}
                  className="text-xs px-2 py-1 rounded"
                  style={{ backgroundColor: c.color + '30' }}
                >
                  {c.name}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
