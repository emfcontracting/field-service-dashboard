'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [completedWOs, setCompletedWOs] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('draft');
  const [generating, setGenerating] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchInvoices();
    fetchCompletedWorkOrders();
  }, [filter]);

  const fetchInvoices = async () => {
    setLoading(true);
    let query = supabase
      .from('invoices')
      .select(`
        *,
        work_order:work_orders(wo_number, building, work_order_description, requestor),
        approver:users!approved_by(first_name, last_name)
      `)
      .order('generated_at', { ascending: false });

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching invoices:', error);
    } else {
      setInvoices(data || []);
    }
    setLoading(false);
  };

  const fetchCompletedWorkOrders = async () => {
    // Get all WO IDs that already have invoices
    const { data: allInvoices } = await supabase
      .from('invoices')
      .select('wo_id');

    const invoicedWOIds = allInvoices?.map(inv => inv.wo_id) || [];

    // Build the NOT IN clause
    let query = supabase
      .from('work_orders')
      .select('*, lead_tech:users!lead_tech_id(first_name, last_name)')
      .eq('status', 'completed')
      .order('date_entered', { ascending: false });

    // Only add NOT IN if there are invoiced WOs
    if (invoicedWOIds.length > 0) {
      query = query.not('wo_id', 'in', `(${invoicedWOIds.join(',')})`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching completed WOs:', error);
    } else {
      setCompletedWOs(data || []);
    }
  };

  const generateInvoice = async (woId) => {
    if (!confirm('Generate invoice for this work order?\n\nThis will lock the work order and send it for review.')) {
      return;
    }

    setGenerating(true);

    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wo_id: woId })
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Invoice generated successfully!');
        fetchInvoices();
        fetchCompletedWorkOrders();
      } else {
        alert('❌ Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert('❌ Failed to generate invoice');
    } finally {
      setGenerating(false);
    }
  };

  const viewInvoiceDetails = async (invoice) => {
    setSelectedInvoice(invoice);

    const { data, error } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.invoice_id)
      .order('category');

    if (error) {
      console.error('Error fetching line items:', error);
    } else {
      setLineItems(data || []);
    }
  };

  const updateInvoice = async (invoiceId, updates) => {
    const { error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('invoice_id', invoiceId);

    if (error) {
      console.error('Error updating invoice:', error);
      alert('Failed to update invoice');
      return false;
    } else {
      fetchInvoices();
      if (selectedInvoice?.invoice_id === invoiceId) {
        setSelectedInvoice({ ...selectedInvoice, ...updates });
      }
      return true;
    }
  };

  const approveInvoice = async (invoiceId) => {
    if (!confirm('Approve this invoice?\n\nThe work order will be permanently locked for technicians and ready for QuickBooks sync.')) {
      return;
    }

    const success = await updateInvoice(invoiceId, {
      status: 'approved',
      approved_at: new Date().toISOString(),
      can_edit: false
    });

    if (success) {
      alert('✅ Invoice approved! Ready for QuickBooks sync.');
    }
  };

  const rejectInvoice = async (invoiceId) => {
    const reason = prompt('Enter reason for rejection:');
    if (!reason) return;

    const success = await updateInvoice(invoiceId, {
      status: 'rejected',
      admin_notes: `REJECTED: ${reason}`
    });

    if (success) {
      alert('❌ Invoice rejected');
    }
  };

  const syncToQuickBooks = async (invoiceId) => {
    if (!confirm('Sync this invoice to QuickBooks?')) return;

    setSyncing(true);

    try {
      const response = await fetch('/api/invoices/sync-qb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId })
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Invoice synced to QuickBooks!');
        fetchInvoices();
      } else {
        alert('❌ Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error syncing to QB:', error);
      alert('❌ Failed to sync to QuickBooks');
    } finally {
      setSyncing(false);
    }
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      draft: 'bg-yellow-600',
      approved: 'bg-blue-600',
      synced: 'bg-green-600',
      rejected: 'bg-red-600'
    };
    return colors[status] || 'bg-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
<div className="flex justify-between items-center mb-6">
  <h1 className="text-3xl font-bold">💰 Invoice Management</h1>
  <div className="flex gap-3">
    <button
      onClick={() => window.location.href = '/'}
      className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition"
    >
      ← Dashboard
    </button>
  </div>
</div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['draft', 'approved', 'synced', 'rejected', 'all'].map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Work Orders & Invoice List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Completed WOs Ready for Invoice */}
            {completedWOs.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-xl font-bold mb-4">
                  ⏳ Ready to Invoice ({completedWOs.length})
                </h2>
                <div className="space-y-2">
                  {completedWOs.map(wo => (
                    <div
                      key={wo.wo_id}
                      className="bg-gray-700 p-3 rounded-lg flex justify-between items-center"
                    >
                      <div className="flex-1">
                        <div className="font-bold">{wo.wo_number}</div>
                        <div className="text-sm text-gray-400">
                          {wo.building} - {wo.work_order_description.substring(0, 50)}...
                        </div>
                        <div className="text-sm text-gray-400">
                          Lead: {wo.lead_tech?.first_name} {wo.lead_tech?.last_name}
                        </div>
                      </div>
                      <button
                        onClick={() => generateInvoice(wo.wo_id)}
                        disabled={generating}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg font-semibold whitespace-nowrap transition"
                      >
                        {generating ? '⏳ Generating...' : 'Generate Invoice'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invoice List */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-xl font-bold mb-4">📋 Invoices</h2>
              {loading ? (
                <div className="text-center py-8 text-gray-400">Loading invoices...</div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  {filter === 'all' ? 'No invoices found' : `No ${filter} invoices`}
                </div>
              ) : (
                <div className="space-y-2">
                  {invoices.map(invoice => (
                    <div
                      key={invoice.invoice_id}
                      onClick={() => viewInvoiceDetails(invoice)}
                      className={`bg-gray-700 p-3 rounded-lg cursor-pointer hover:bg-gray-600 transition ${
                        selectedInvoice?.invoice_id === invoice.invoice_id ? 'ring-2 ring-blue-500' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-bold">{invoice.invoice_number}</div>
                          <div className="text-sm text-gray-400">
                            {invoice.work_order?.wo_number} - {invoice.work_order?.building}
                          </div>
                          <div className="text-sm text-gray-400">
                            {invoice.work_order?.work_order_description.substring(0, 60)}...
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            Generated: {new Date(invoice.generated_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          <div className="text-xl font-bold text-green-400">
                            ${invoice.total.toFixed(2)}
                          </div>
                          <div
                            className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${getStatusBadgeColor(
                              invoice.status
                            )}`}
                          >
                            {invoice.status.toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Invoice Details */}
          <div className="lg:col-span-1">
            {selectedInvoice ? (
              <div className="bg-gray-800 rounded-lg p-4 sticky top-6">
                <h2 className="text-xl font-bold mb-4">Invoice Details</h2>

                <div className="space-y-3 mb-4">
                  <div>
                    <div className="text-sm text-gray-400">Invoice Number</div>
                    <div className="font-bold text-lg">{selectedInvoice.invoice_number}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-400">Work Order</div>
                    <div className="font-bold">{selectedInvoice.work_order?.wo_number}</div>
                    <div className="text-sm">{selectedInvoice.work_order?.building}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-400">Description</div>
                    <div className="text-sm">{selectedInvoice.work_order?.work_order_description}</div>
                  </div>

                  {selectedInvoice.work_order?.requestor && (
                    <div>
                      <div className="text-sm text-gray-400">Requestor</div>
                      <div>{selectedInvoice.work_order.requestor}</div>
                    </div>
                  )}

                  <div>
                    <div className="text-sm text-gray-400">Status</div>
                    <div
                      className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeColor(
                        selectedInvoice.status
                      )}`}
                    >
                      {selectedInvoice.status.toUpperCase()}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-400">Generated</div>
                    <div className="text-sm">{new Date(selectedInvoice.generated_at).toLocaleString()}</div>
                  </div>

                  {selectedInvoice.approved_at && (
                    <div>
                      <div className="text-sm text-gray-400">Approved</div>
                      <div className="text-sm">{new Date(selectedInvoice.approved_at).toLocaleString()}</div>
                      {selectedInvoice.approver && (
                        <div className="text-xs text-gray-500">
                          by {selectedInvoice.approver.first_name} {selectedInvoice.approver.last_name}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedInvoice.synced_to_qb_at && (
                    <div>
                      <div className="text-sm text-gray-400">Synced to QB</div>
                      <div className="text-sm">{new Date(selectedInvoice.synced_to_qb_at).toLocaleString()}</div>
                      {selectedInvoice.qb_invoice_id && (
                        <div className="text-xs text-gray-500">QB ID: {selectedInvoice.qb_invoice_id}</div>
                      )}
                    </div>
                  )}
                </div>

                <hr className="border-gray-700 my-4" />

                {/* Line Items */}
                <div className="mb-4">
                  <div className="text-sm font-bold mb-2">Line Items</div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {lineItems.length === 0 ? (
                      <div className="text-sm text-gray-400">No line items</div>
                    ) : (
                      lineItems.map((item, index) => (
                        <div key={index} className="text-sm bg-gray-700 p-2 rounded">
                          <div className="flex justify-between">
                            <span className="flex-1">{item.description}</span>
                            <span className="font-semibold ml-2">${item.amount.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-gray-400">
                            {item.quantity} × ${item.unit_price.toFixed(2)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <hr className="border-gray-700 my-4" />

                {/* Cost Breakdown */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Labor</span>
                    <span>${selectedInvoice.labor_cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Materials</span>
                    <span>${selectedInvoice.material_cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Equipment</span>
                    <span>${selectedInvoice.equipment_cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Trailer</span>
                    <span>${selectedInvoice.trailer_cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Rental</span>
                    <span>${selectedInvoice.rental_cost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Mileage</span>
                    <span>${selectedInvoice.mileage_cost.toFixed(2)}</span>
                  </div>
                  <hr className="border-gray-700" />
                  <div className="flex justify-between font-semibold">
                    <span>Subtotal</span>
                    <span>${selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedInvoice.tax_amount > 0 && (
                    <div className="flex justify-between text-sm text-gray-400">
                      <span>Tax ({(selectedInvoice.tax_rate * 100).toFixed(2)}%)</span>
                      <span>${selectedInvoice.tax_amount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xl font-bold text-green-400">
                    <span>Total</span>
                    <span>${selectedInvoice.total.toFixed(2)}</span>
                  </div>
                </div>

                <hr className="border-gray-700 my-4" />

                {/* Admin Notes */}
                <div className="mb-4">
                  <label className="block text-sm text-gray-400 mb-1">Admin Notes</label>
                  <textarea
                    value={selectedInvoice.admin_notes || ''}
                    onChange={(e) => setSelectedInvoice({ ...selectedInvoice, admin_notes: e.target.value })}
                    onBlur={() =>
                      updateInvoice(selectedInvoice.invoice_id, { admin_notes: selectedInvoice.admin_notes })
                    }
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
                    rows="3"
                    placeholder="Add notes about this invoice..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  {selectedInvoice.status === 'draft' && (
                    <>
                      <button
                        onClick={() => approveInvoice(selectedInvoice.invoice_id)}
                        className="w-full bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg font-semibold transition"
                      >
                        ✅ Approve Invoice
                      </button>
                      <button
                        onClick={() => rejectInvoice(selectedInvoice.invoice_id)}
                        className="w-full bg-red-600 hover:bg-red-700 px-4 py-3 rounded-lg font-semibold transition"
                      >
                        ❌ Reject Invoice
                      </button>
                    </>
                  )}

                  {selectedInvoice.status === 'approved' && (
                    <button
                      onClick={() => syncToQuickBooks(selectedInvoice.invoice_id)}
                      disabled={syncing}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-3 rounded-lg font-semibold transition"
                    >
                      {syncing ? '⏳ Syncing...' : '🔄 Sync to QuickBooks'}
                    </button>
                  )}

                  {selectedInvoice.status === 'synced' && (
                    <div className="bg-green-900 text-green-200 p-3 rounded-lg text-center">
                      <div className="font-bold">✅ Synced to QuickBooks</div>
                      {selectedInvoice.qb_invoice_id && (
                        <div className="text-sm mt-1">QB Invoice ID: {selectedInvoice.qb_invoice_id}</div>
                      )}
                      {selectedInvoice.synced_to_qb_at && (
                        <div className="text-xs mt-1 opacity-75">
                          {new Date(selectedInvoice.synced_to_qb_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedInvoice.status === 'rejected' && (
                    <div className="bg-red-900 text-red-200 p-3 rounded-lg text-center">
                      <div className="font-bold">❌ Invoice Rejected</div>
                      <div className="text-sm mt-1">{selectedInvoice.admin_notes}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400 sticky top-6">
                <div className="text-4xl mb-3">📄</div>
                <div>Select an invoice to view details</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}