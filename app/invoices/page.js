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
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchInvoices(),
      fetchCompletedWorkOrders()
    ]);
    setLoading(false);
  };

  const fetchInvoices = async () => {
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        work_order:work_orders(wo_number, building, work_order_description)
      `)
      .order('generated_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
    } else {
      setInvoices(data || []);
    }
  };

  const fetchCompletedWorkOrders = async () => {
    // Get all work order IDs that already have invoices
    const { data: allInvoices } = await supabase
      .from('invoices')
      .select('wo_id');

    const invoicedWOIds = allInvoices?.map(inv => inv.wo_id) || [];

    // Build query for completed WOs without invoices
    let query = supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!lead_tech_id(first_name, last_name)
      `)
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
      console.log('Completed WOs ready for invoice:', data?.length || 0);
      setCompletedWOs(data || []);
    }
  };

  const generateInvoice = async (woId) => {
    if (!confirm('Generate invoice for this work order?')) return;

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
        await fetchData(); // Refresh both lists
      } else {
        alert('❌ Error: ' + result.error);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('❌ Failed to generate invoice');
    } finally {
      setGenerating(false);
    }
  };

  const viewInvoice = async (invoice) => {
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

  const approveInvoice = async (invoiceId) => {
    if (!confirm('Approve this invoice?')) return;

    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString()
      })
      .eq('invoice_id', invoiceId);

    if (error) {
      alert('Error approving invoice: ' + error.message);
    } else {
      alert('✅ Invoice approved!');
      fetchInvoices();
      if (selectedInvoice?.invoice_id === invoiceId) {
        setSelectedInvoice({ ...selectedInvoice, status: 'approved' });
      }
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-yellow-600',
      approved: 'bg-green-600',
      synced: 'bg-blue-600',
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
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition"
          >
            ← Dashboard
          </button>
        </div>

        {loading && (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        )}

        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Work Orders & Invoices */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Completed Work Orders Ready for Invoice */}
              {completedWOs.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h2 className="text-xl font-bold mb-4">
                    ⏳ Ready to Invoice ({completedWOs.length})
                  </h2>
                  <div className="space-y-3">
                    {completedWOs.map(wo => (
                      <div
                        key={wo.wo_id}
                        className="bg-gray-700 p-4 rounded-lg flex justify-between items-center"
                      >
                        <div className="flex-1">
                          <div className="font-bold text-lg">{wo.wo_number}</div>
                          <div className="text-sm text-gray-400">
                            {wo.building}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            {wo.work_order_description.substring(0, 80)}...
                          </div>
                          {wo.lead_tech && (
                            <div className="text-xs text-gray-500 mt-1">
                              Lead: {wo.lead_tech.first_name} {wo.lead_tech.last_name}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => generateInvoice(wo.wo_id)}
                          disabled={generating}
                          className="ml-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-bold whitespace-nowrap transition"
                        >
                          {generating ? '⏳ Generating...' : '📄 Generate Invoice'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing Invoices */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-xl font-bold mb-4">📋 All Invoices ({invoices.length})</h2>

                {invoices.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No invoices yet. Complete a work order and generate an invoice!
                  </div>
                ) : (
                  <div className="space-y-2">
                    {invoices.map(invoice => (
                      <div
                        key={invoice.invoice_id}
                        onClick={() => viewInvoice(invoice)}
                        className={`bg-gray-700 p-4 rounded-lg cursor-pointer hover:bg-gray-600 transition ${
                          selectedInvoice?.invoice_id === invoice.invoice_id ? 'ring-2 ring-blue-500' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-bold text-lg">{invoice.invoice_number}</div>
                            <div className="text-sm text-gray-400">
                              {invoice.work_order?.wo_number} - {invoice.work_order?.building}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {new Date(invoice.generated_at).toLocaleString()}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-2xl font-bold text-green-400">
                              ${invoice.total.toFixed(2)}
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(invoice.status)}`}>
                              {invoice.status.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Invoice Details */}
            <div className="lg:col-span-1">
              {selectedInvoice ? (
                <div className="bg-gray-800 rounded-lg p-4 sticky top-6">
                  <h2 className="text-xl font-bold mb-4">Invoice Details</h2>

                  <div className="space-y-3 mb-4">
                    <div>
                      <div className="text-sm text-gray-400">Invoice #</div>
                      <div className="font-bold text-lg">{selectedInvoice.invoice_number}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-400">Work Order</div>
                      <div className="font-semibold">{selectedInvoice.work_order?.wo_number}</div>
                      <div className="text-sm">{selectedInvoice.work_order?.building}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-400">Description</div>
                      <div className="text-sm">{selectedInvoice.work_order?.work_order_description}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-400">Status</div>
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(selectedInvoice.status)}`}>
                        {selectedInvoice.status.toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <div className="text-sm text-gray-400">Generated</div>
                      <div className="text-sm">{new Date(selectedInvoice.generated_at).toLocaleString()}</div>
                    </div>
                  </div>

                  <hr className="border-gray-700 my-4" />

                  {/* Line Items */}
                  <div className="mb-4">
                    <div className="font-bold mb-2">Line Items</div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {lineItems.length === 0 ? (
                        <div className="text-sm text-gray-400">No line items</div>
                      ) : (
                        lineItems.map((item, idx) => (
                          <div key={idx} className="bg-gray-700 p-2 rounded text-sm">
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
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Labor</span>
                      <span>${selectedInvoice.labor_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Materials</span>
                      <span>${selectedInvoice.material_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Equipment</span>
                      <span>${selectedInvoice.equipment_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Trailer</span>
                      <span>${selectedInvoice.trailer_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Rental</span>
                      <span>${selectedInvoice.rental_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Mileage</span>
                      <span>${selectedInvoice.mileage_cost.toFixed(2)}</span>
                    </div>
                    <hr className="border-gray-700" />
                    <div className="flex justify-between font-semibold">
                      <span>Subtotal</span>
                      <span>${selectedInvoice.subtotal.toFixed(2)}</span>
                    </div>
                    {selectedInvoice.tax_amount > 0 && (
                      <div className="flex justify-between text-gray-400">
                        <span>Tax</span>
                        <span>${selectedInvoice.tax_amount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-xl text-green-400">
                      <span>Total</span>
                      <span>${selectedInvoice.total.toFixed(2)}</span>
                    </div>
                  </div>

                  <hr className="border-gray-700 my-4" />

                  {/* Actions */}
                  {selectedInvoice.status === 'draft' && (
                    <button
                      onClick={() => approveInvoice(selectedInvoice.invoice_id)}
                      className="w-full bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg font-bold transition"
                    >
                      ✅ Approve Invoice
                    </button>
                  )}

                  {selectedInvoice.status === 'approved' && (
                    <div className="bg-green-900 text-green-200 p-3 rounded-lg text-center font-semibold">
                      ✅ Invoice Approved
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400 sticky top-6">
                  <div className="text-4xl mb-3">📄</div>
                  <div>Select an invoice to view details</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}