'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Helper function to format date without timezone shift
function formatDateLocal(dateString) {
  if (!dateString) return '-';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SubcontractorInvoiceReview() {
  const [invoices, setInvoices] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [emfData, setEmfData] = useState([]);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('subcontractor_invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (invoicesError) throw invoicesError;

      const { data: usersData } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, email');

      const usersMap = {};
      (usersData || []).forEach(u => {
        usersMap[u.user_id] = u;
      });

      setInvoices(invoicesData || []);
      setUsers(usersMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function selectInvoice(invoice) {
    setSelectedInvoice(invoice);
    setLoadingComparison(true);
    setInvoiceItems([]);
    setEmfData([]);

    try {
      const { data: itemsData } = await supabase
        .from('subcontractor_invoice_items')
        .select('*')
        .eq('invoice_id', invoice.invoice_id)
        .order('work_date', { ascending: true });

      setInvoiceItems(itemsData || []);

      // Get actual EMF data for this user and period (including tech_material_cost)
      const { data: emfHours } = await supabase
        .from('daily_hours_log')
        .select(`
          *,
          work_order:work_orders(wo_number, building, work_order_description)
        `)
        .eq('user_id', invoice.user_id)
        .gte('work_date', invoice.period_start)
        .lte('work_date', invoice.period_end)
        .order('work_date', { ascending: true });

      setEmfData(emfHours || []);
    } catch (error) {
      console.error('Error loading comparison:', error);
    } finally {
      setLoadingComparison(false);
    }
  }

  async function updateInvoiceStatus(invoiceId, status) {
    try {
      const { error } = await supabase
        .from('subcontractor_invoices')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('invoice_id', invoiceId);

      if (error) throw error;

      setInvoices(invoices.map(inv => 
        inv.invoice_id === invoiceId ? { ...inv, status } : inv
      ));

      if (selectedInvoice?.invoice_id === invoiceId) {
        setSelectedInvoice({ ...selectedInvoice, status });
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  // Calculate EMF totals including tech material
  const emfTotals = {
    regularHours: emfData.reduce((sum, e) => sum + parseFloat(e.hours_regular || 0), 0),
    otHours: emfData.reduce((sum, e) => sum + parseFloat(e.hours_overtime || 0), 0),
    miles: emfData.reduce((sum, e) => sum + parseFloat(e.miles || 0), 0),
    techMaterial: emfData.reduce((sum, e) => sum + parseFloat(e.tech_material_cost || 0), 0)
  };

  // Calculate invoice totals
  const invoiceTotals = selectedInvoice ? {
    regularHours: parseFloat(selectedInvoice.total_regular_hours || 0),
    otHours: parseFloat(selectedInvoice.total_ot_hours || 0),
    miles: parseFloat(selectedInvoice.total_miles || 0),
    techMaterial: parseFloat(selectedInvoice.total_tech_material || 0)
  } : { regularHours: 0, otHours: 0, miles: 0, techMaterial: 0 };

  // Check for discrepancies
  const discrepancies = {
    regularHours: Math.abs(invoiceTotals.regularHours - emfTotals.regularHours) > 0.1,
    otHours: Math.abs(invoiceTotals.otHours - emfTotals.otHours) > 0.1,
    miles: Math.abs(invoiceTotals.miles - emfTotals.miles) > 0.5,
    techMaterial: Math.abs(invoiceTotals.techMaterial - emfTotals.techMaterial) > 0.01
  };

  const hasDiscrepancy = discrepancies.regularHours || discrepancies.otHours || discrepancies.miles || discrepancies.techMaterial;

  const filteredInvoices = invoices.filter(inv => {
    const user = users[inv.user_id];
    const matchesSearch = searchTerm === '' || 
      inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user?.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user?.last_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = filter === 'all' || inv.status === filter;

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/settings"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-2xl font-bold">🔍 Subcontractor Invoice Review</h1>
              <p className="text-sm text-gray-400">Verify hours, mileage & materials against EMF records</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Invoice List */}
          <div className="lg:col-span-1 space-y-4">
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Search by name or invoice #..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm"
              />
              <div className="flex gap-2 flex-wrap">
                {['all', 'sent', 'paid'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1 rounded-lg text-sm ${
                      filter === f 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
              {filteredInvoices.length === 0 ? (
                <div className="bg-gray-800 rounded-lg p-4 text-center text-gray-500">
                  No invoices found
                </div>
              ) : (
                filteredInvoices.map(invoice => {
                  const user = users[invoice.user_id];
                  return (
                    <button
                      key={invoice.invoice_id}
                      onClick={() => selectInvoice(invoice)}
                      className={`w-full text-left p-4 rounded-lg border transition ${
                        selectedInvoice?.invoice_id === invoice.invoice_id
                          ? 'bg-blue-900/30 border-blue-500'
                          : 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold">{invoice.invoice_number}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          invoice.status === 'paid'
                            ? 'bg-green-500/20 text-green-400'
                            : invoice.status === 'sent'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">
                        {user ? `${user.first_name} ${user.last_name}` : 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDateLocal(invoice.period_start)} - {formatDateLocal(invoice.period_end)}
                      </p>
                      <p className="text-lg font-bold text-green-400 mt-1">
                        ${parseFloat(invoice.grand_total || 0).toFixed(2)}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Comparison Panel */}
          <div className="lg:col-span-2">
            {!selectedInvoice ? (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
                <p className="text-gray-500">Select an invoice to review</p>
              </div>
            ) : loadingComparison ? (
              <div className="bg-gray-800 rounded-xl border border-gray-700 p-8 text-center">
                <p className="text-gray-400">Loading comparison data...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Invoice Header */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold">{selectedInvoice.invoice_number}</h2>
                      <p className="text-gray-400">
                        {users[selectedInvoice.user_id]?.first_name} {users[selectedInvoice.user_id]?.last_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatDateLocal(selectedInvoice.period_start)} - {formatDateLocal(selectedInvoice.period_end)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {selectedInvoice.status === 'sent' && (
                        <button
                          onClick={() => updateInvoiceStatus(selectedInvoice.invoice_id, 'paid')}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium"
                        >
                          ✓ Mark Paid
                        </button>
                      )}
                      {selectedInvoice.status === 'paid' && (
                        <span className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium">
                          ✓ Paid
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Discrepancy Alert */}
                {hasDiscrepancy && (
                  <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4">
                    <h3 className="font-bold text-red-400 mb-2">⚠️ Discrepancy Detected</h3>
                    <p className="text-sm text-red-300">
                      The invoice totals don't match EMF records. Review the details below.
                    </p>
                  </div>
                )}

                {/* Comparison Summary */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                  <h3 className="font-bold mb-4">📊 Totals Comparison</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-400 border-b border-gray-700">
                          <th className="text-left py-2">Metric</th>
                          <th className="text-right py-2">Invoice Claims</th>
                          <th className="text-right py-2">EMF Records</th>
                          <th className="text-right py-2">Difference</th>
                          <th className="text-center py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className={discrepancies.regularHours ? 'bg-red-900/20' : ''}>
                          <td className="py-3">Regular Hours</td>
                          <td className="text-right font-mono">{invoiceTotals.regularHours.toFixed(1)}h</td>
                          <td className="text-right font-mono">{emfTotals.regularHours.toFixed(1)}h</td>
                          <td className={`text-right font-mono ${
                            discrepancies.regularHours ? 'text-red-400 font-bold' : 'text-green-400'
                          }`}>
                            {(invoiceTotals.regularHours - emfTotals.regularHours).toFixed(1)}h
                          </td>
                          <td className="text-center">
                            {discrepancies.regularHours ? '❌' : '✅'}
                          </td>
                        </tr>
                        <tr className={discrepancies.otHours ? 'bg-red-900/20' : ''}>
                          <td className="py-3">OT Hours</td>
                          <td className="text-right font-mono">{invoiceTotals.otHours.toFixed(1)}h</td>
                          <td className="text-right font-mono">{emfTotals.otHours.toFixed(1)}h</td>
                          <td className={`text-right font-mono ${
                            discrepancies.otHours ? 'text-red-400 font-bold' : 'text-green-400'
                          }`}>
                            {(invoiceTotals.otHours - emfTotals.otHours).toFixed(1)}h
                          </td>
                          <td className="text-center">
                            {discrepancies.otHours ? '❌' : '✅'}
                          </td>
                        </tr>
                        <tr className={discrepancies.miles ? 'bg-red-900/20' : ''}>
                          <td className="py-3">Mileage</td>
                          <td className="text-right font-mono">{invoiceTotals.miles.toFixed(0)} mi</td>
                          <td className="text-right font-mono">{emfTotals.miles.toFixed(0)} mi</td>
                          <td className={`text-right font-mono ${
                            discrepancies.miles ? 'text-red-400 font-bold' : 'text-green-400'
                          }`}>
                            {(invoiceTotals.miles - emfTotals.miles).toFixed(0)} mi
                          </td>
                          <td className="text-center">
                            {discrepancies.miles ? '❌' : '✅'}
                          </td>
                        </tr>
                        <tr className={discrepancies.techMaterial ? 'bg-red-900/20' : ''}>
                          <td className="py-3 text-orange-400">Tech Material</td>
                          <td className="text-right font-mono">${invoiceTotals.techMaterial.toFixed(2)}</td>
                          <td className="text-right font-mono">${emfTotals.techMaterial.toFixed(2)}</td>
                          <td className={`text-right font-mono ${
                            discrepancies.techMaterial ? 'text-red-400 font-bold' : 'text-green-400'
                          }`}>
                            ${(invoiceTotals.techMaterial - emfTotals.techMaterial).toFixed(2)}
                          </td>
                          <td className="text-center">
                            {discrepancies.techMaterial ? '❌' : '✅'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Side by Side Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Invoice Claims */}
                  <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                    <h3 className="font-bold mb-3 text-blue-400">📄 Invoice Claims</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {invoiceItems.filter(i => ['hours', 'mileage', 'material'].includes(i.item_type)).map((item, idx) => (
                        <div key={idx} className={`text-sm p-2 rounded ${item.item_type === 'material' ? 'bg-orange-900/30' : 'bg-gray-700/50'}`}>
                          <div className="flex justify-between">
                            <span className="text-gray-400">
                              {item.work_date ? formatDateLocal(item.work_date) : '-'}
                            </span>
                            <span className={`font-mono ${item.item_type === 'material' ? 'text-orange-400' : ''}`}>
                              {item.item_type === 'mileage' 
                                ? `${parseFloat(item.quantity).toFixed(0)} mi`
                                : item.item_type === 'material'
                                  ? `$${parseFloat(item.amount).toFixed(2)}`
                                  : `${parseFloat(item.quantity).toFixed(1)}h`
                              }
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 truncate">{item.description}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* EMF Records */}
                  <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                    <h3 className="font-bold mb-3 text-green-400">📋 EMF Records</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {emfData.map((entry, idx) => (
                        <div key={idx} className="text-sm p-2 bg-gray-700/50 rounded">
                          <div className="flex justify-between">
                            <span className="text-gray-400">
                              {formatDateLocal(entry.work_date)}
                            </span>
                            <span className="font-mono">
                              {parseFloat(entry.hours_regular || 0).toFixed(1)}h + {parseFloat(entry.hours_overtime || 0).toFixed(1)}h OT
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-gray-500">
                              {entry.work_order?.wo_number || 'N/A'} - {entry.work_order?.building || ''}
                            </span>
                            <span className="text-xs text-gray-400">
                              {parseFloat(entry.miles || 0).toFixed(0)} mi
                            </span>
                          </div>
                          {parseFloat(entry.tech_material_cost || 0) > 0 && (
                            <div className="text-xs text-orange-400 mt-1">
                              💰 Material: ${parseFloat(entry.tech_material_cost).toFixed(2)}
                            </div>
                          )}
                        </div>
                      ))}
                      {emfData.length === 0 && (
                        <p className="text-gray-500 text-center py-4">No EMF records found for this period</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Invoice Amounts */}
                <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
                  <h3 className="font-bold mb-3">💰 Invoice Amount</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
                    <div>
                      <p className="text-gray-400 text-sm">Labor</p>
                      <p className="text-xl font-bold">${parseFloat(selectedInvoice.total_hours_amount || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Mileage</p>
                      <p className="text-xl font-bold">${parseFloat(selectedInvoice.total_mileage_amount || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-orange-400 text-sm">Material</p>
                      <p className="text-xl font-bold text-orange-400">${parseFloat(selectedInvoice.total_tech_material || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Other</p>
                      <p className="text-xl font-bold">${parseFloat(selectedInvoice.total_line_items_amount || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Total</p>
                      <p className="text-2xl font-bold text-green-400">${parseFloat(selectedInvoice.grand_total || 0).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-700 text-sm text-gray-500">
                    Rates: ${parseFloat(selectedInvoice.hourly_rate_used || 0).toFixed(2)}/hr | 
                    ${parseFloat(selectedInvoice.ot_rate_used || 0).toFixed(2)}/hr OT | 
                    ${parseFloat(selectedInvoice.mileage_rate_used || 0).toFixed(4)}/mi
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
