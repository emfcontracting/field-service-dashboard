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

  const adminPassword = 'admin123'; // ⚠️ Change this in production!

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
    const { data: allInvoices } = await supabase
      .from('invoices')
      .select('wo_id');

    const invoicedWOIds = allInvoices?.map(inv => inv.wo_id) || [];

    let query = supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!lead_tech_id(first_name, last_name)
      `)
      .eq('status', 'completed')
      .eq('acknowledged', true)
      .order('date_entered', { ascending: false });

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
        await fetchData();
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
        setSelectedInvoice({ ...selectedInvoice, status: 'approved', approved_at: new Date().toISOString() });
      }
    }
  };

  const reopenInvoice = async (invoiceId) => {
    const password = prompt('Enter admin password to reopen invoice:');
    if (password !== adminPassword) {
      alert('❌ Incorrect password');
      return;
    }

    if (!confirm('⚠️ WARNING: This will reopen the invoice and set it back to DRAFT status.\n\nContinue?')) {
      return;
    }

    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'draft',
        approved_at: null,
        approved_by: null
      })
      .eq('invoice_id', invoiceId);

    if (error) {
      alert('❌ Error reopening invoice: ' + error.message);
    } else {
      alert('✅ Invoice reopened! Status set to DRAFT.');
      fetchInvoices();
      if (selectedInvoice?.invoice_id === invoiceId) {
        setSelectedInvoice({ 
          ...selectedInvoice, 
          status: 'draft', 
          approved_at: null, 
          approved_by: null 
        });
      }
    }
  };

  const printInvoice = () => {
    if (!selectedInvoice) return;

    const printWindow = window.open('', '_blank');
    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${selectedInvoice.invoice_number}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #333;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
            }
            .company-name {
              font-size: 24px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .invoice-number {
              font-size: 18px;
              color: #666;
            }
            .info-section {
              margin: 20px 0;
            }
            .info-label {
              font-weight: bold;
              display: inline-block;
              width: 150px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 12px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .totals {
              margin-top: 20px;
              text-align: right;
            }
            .totals div {
              margin: 5px 0;
            }
            .grand-total {
              font-size: 20px;
              font-weight: bold;
              margin-top: 10px;
              padding-top: 10px;
              border-top: 2px solid #333;
            }
            @media print {
              body {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">EMF Contracting</div>
            <div class="invoice-number">Invoice: ${selectedInvoice.invoice_number}</div>
          </div>

          <div class="info-section">
            <div><span class="info-label">Work Order:</span> ${selectedInvoice.work_order?.wo_number}</div>
            <div><span class="info-label">Building:</span> ${selectedInvoice.work_order?.building}</div>
            <div><span class="info-label">Date Generated:</span> ${new Date(selectedInvoice.generated_at).toLocaleDateString()}</div>
            <div><span class="info-label">Status:</span> ${selectedInvoice.status.toUpperCase()}</div>
            ${selectedInvoice.approved_at ? `<div><span class="info-label">Approved Date:</span> ${new Date(selectedInvoice.approved_at).toLocaleDateString()}</div>` : ''}
          </div>

          <div class="info-section">
            <div><strong>Description:</strong></div>
            <div>${selectedInvoice.work_order?.work_order_description}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${lineItems.map(item => `
                <tr>
                  <td>${item.description}</td>
                  <td>${item.quantity}</td>
                  <td>$${item.unit_price.toFixed(2)}</td>
                  <td>$${item.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div><strong>Labor:</strong> $${selectedInvoice.labor_cost.toFixed(2)}</div>
            <div><strong>Materials:</strong> $${selectedInvoice.material_cost.toFixed(2)}</div>
            <div><strong>Equipment:</strong> $${selectedInvoice.equipment_cost.toFixed(2)}</div>
            <div><strong>Trailer:</strong> $${selectedInvoice.trailer_cost.toFixed(2)}</div>
            <div><strong>Rental:</strong> $${selectedInvoice.rental_cost.toFixed(2)}</div>
            <div><strong>Mileage:</strong> $${selectedInvoice.mileage_cost.toFixed(2)}</div>
            <div style="margin-top: 10px;"><strong>Subtotal:</strong> $${selectedInvoice.subtotal.toFixed(2)}</div>
            ${selectedInvoice.tax_amount > 0 ? `<div><strong>Tax:</strong> $${selectedInvoice.tax_amount.toFixed(2)}</div>` : ''}
            <div class="grand-total">TOTAL: $${selectedInvoice.total.toFixed(2)}</div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    printWindow.print();
  };

  const shareInvoice = () => {
    if (!selectedInvoice) return;

    const shareText = `Invoice ${selectedInvoice.invoice_number}\nWork Order: ${selectedInvoice.work_order?.wo_number}\nBuilding: ${selectedInvoice.work_order?.building}\nTotal: $${selectedInvoice.total.toFixed(2)}\nStatus: ${selectedInvoice.status.toUpperCase()}`;

    if (navigator.share) {
      navigator.share({
        title: `Invoice ${selectedInvoice.invoice_number}`,
        text: shareText
      }).catch(err => console.log('Error sharing:', err));
    } else {
      navigator.clipboard.writeText(shareText).then(() => {
        alert('✅ Invoice details copied to clipboard!');
      }).catch(() => {
        alert('❌ Unable to copy to clipboard');
      });
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
            <div className="lg:col-span-2 space-y-6">
              
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

                    {selectedInvoice.approved_at && (
                      <div>
                        <div className="text-sm text-gray-400">Approved</div>
                        <div className="text-sm">{new Date(selectedInvoice.approved_at).toLocaleString()}</div>
                      </div>
                    )}
                  </div>

                  <hr className="border-gray-700 my-4" />

                  <div className="mb-4">
                    <div className="font-bold mb-2">Line Items</div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
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

                  <div className="space-y-2">
                    {/* Print & Share Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={printInvoice}
                        className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold text-sm transition"
                      >
                        🖨️ Print
                      </button>
                      <button
                        onClick={shareInvoice}
                        className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold text-sm transition"
                      >
                        📤 Share
                      </button>
                    </div>

                    {/* Approve Button */}
                    {selectedInvoice.status === 'draft' && (
                      <button
                        onClick={() => approveInvoice(selectedInvoice.invoice_id)}
                        className="w-full bg-green-600 hover:bg-green-700 px-4 py-3 rounded-lg font-bold transition"
                      >
                        ✅ Approve Invoice
                      </button>
                    )}

                    {/* Approved Status */}
                    {selectedInvoice.status === 'approved' && (
                      <div className="bg-green-900 text-green-200 p-3 rounded-lg text-center font-semibold">
                        ✅ Invoice Approved
                      </div>
                    )}

                    {/* Reopen Button (Admin Only) */}
                    {selectedInvoice.status === 'approved' && (
                      <button
                        onClick={() => reopenInvoice(selectedInvoice.invoice_id)}
                        className="w-full bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg font-semibold text-sm transition"
                      >
                        🔄 Reopen Invoice (Admin)
                      </button>
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
        )}
      </div>
    </div>
  );
}