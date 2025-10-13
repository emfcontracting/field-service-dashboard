'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function InvoicingPage() {
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        *,
        work_order:work_orders(
          wo_number,
          building,
          work_order_description,
          lead_tech:users!lead_tech_id(first_name, last_name)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
    } else {
      setInvoices(data || []);
    }
    setLoading(false);
  };

  const selectInvoice = async (invoice) => {
    setSelectedInvoice(invoice);
    
    // Fetch line items
    const { data, error } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.invoice_id)
      .order('line_item_id', { ascending: true });

    if (error) {
      console.error('Error fetching line items:', error);
    } else {
      setLineItems(data || []);
    }
  };

  const updateInvoiceStatus = async (invoiceId, newStatus) => {
    if (!confirm(`Change invoice status to "${newStatus.toUpperCase()}"?`)) {
      return;
    }

    const { error } = await supabase
      .from('invoices')
      .update({ status: newStatus })
      .eq('invoice_id', invoiceId);

    if (error) {
      alert('Failed to update invoice status');
      console.error(error);
    } else {
      alert('✅ Invoice status updated!');
      fetchInvoices();
      if (selectedInvoice?.invoice_id === invoiceId) {
        setSelectedInvoice({ ...selectedInvoice, status: newStatus });
      }
    }
  };

  const returnToTech = async (woId, invoiceId) => {
    const reason = prompt('Enter reason for returning to tech (optional):');
    
    if (!confirm('Return this work order to the lead tech for review?\n\nThis will:\n- Delete the draft invoice\n- Unlock the work order\n- Remove acknowledgment\n- Change status to "needs_return"\n\nThe tech can make changes and mark as completed again.')) {
      return;
    }

    try {
      // Delete the draft invoice and its line items
      const { error: lineItemsError } = await supabase
        .from('invoice_line_items')
        .delete()
        .eq('invoice_id', invoiceId);

      if (lineItemsError) {
        alert('Error deleting invoice line items: ' + lineItemsError.message);
        return;
      }

      const { error: invoiceError } = await supabase
        .from('invoices')
        .delete()
        .eq('invoice_id', invoiceId);

      if (invoiceError) {
        alert('Error deleting invoice: ' + invoiceError.message);
        return;
      }

      // Add return reason as a comment if provided
      if (reason && reason.trim()) {
        await supabase
          .from('work_order_comments')
          .insert({
            wo_id: woId,
            user_id: null,
            comment: `RETURNED FROM INVOICING:\n${reason}`,
            comment_type: 'admin_note'
          });
      }

      // Unlock and unacknowledge the work order
      const { error: updateError } = await supabase
        .from('work_orders')
        .update({
          is_locked: false,
          locked_at: null,
          locked_by: null,
          acknowledged: false,
          acknowledged_at: null,
          acknowledged_by: null,
          status: 'needs_return'
        })
        .eq('wo_id', woId);

      if (updateError) {
        alert('Error updating work order: ' + updateError.message);
        return;
      }

      alert('✅ Work order returned to tech for review!\n\nStatus changed to "Needs Return" and will appear in their mobile app.');
      
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (err) {
      console.error('Error returning work order:', err);
      alert('Failed to return work order: ' + err.message);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-yellow-600',
      sent: 'bg-blue-600',
      paid: 'bg-green-600',
      cancelled: 'bg-red-600'
    };
    return colors[status] || 'bg-gray-600';
  };

  const filteredInvoices = statusFilter === 'all' 
    ? invoices 
    : invoices.filter(inv => inv.status === statusFilter);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">💰 Invoicing</h1>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition"
          >
            ← Back to Dashboard
          </button>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex gap-3 items-center">
            <label className="text-gray-400">Filter by Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-gray-700 text-white px-4 py-2 rounded-lg"
            >
              <option value="all">All Invoices</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <div className="ml-auto text-gray-400">
              Total: {filteredInvoices.length} invoice(s)
            </div>
          </div>
        </div>

        {/* Invoices List */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading invoices...</div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {statusFilter === 'all' 
                ? 'No invoices yet. Acknowledged work orders will appear here.'
                : `No ${statusFilter} invoices found.`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left">Invoice #</th>
                    <th className="px-4 py-3 text-left">Work Order</th>
                    <th className="px-4 py-3 text-left">Building</th>
                    <th className="px-4 py-3 text-left">Lead Tech</th>
                    <th className="px-4 py-3 text-left">Invoice Date</th>
                    <th className="px-4 py-3 text-left">Due Date</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-center">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map(invoice => (
                    <tr
                      key={invoice.invoice_id}
                      onClick={() => selectInvoice(invoice)}
                      className="border-t border-gray-700 hover:bg-gray-700 transition cursor-pointer"
                    >
                      <td className="px-4 py-3 font-semibold">{invoice.invoice_number}</td>
                      <td className="px-4 py-3">{invoice.work_order?.wo_number}</td>
                      <td className="px-4 py-3">{invoice.work_order?.building}</td>
                      <td className="px-4 py-3">
                        {invoice.work_order?.lead_tech 
                          ? `${invoice.work_order.lead_tech.first_name} ${invoice.work_order.lead_tech.last_name}`
                          : 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(invoice.invoice_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(invoice.due_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-400">
                        ${invoice.total.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                          {invoice.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-400">
                        →
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full my-8">
            
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-start z-10 rounded-t-lg">
              <div>
                <h2 className="text-2xl font-bold">Invoice #{selectedInvoice.invoice_number}</h2>
                <p className="text-gray-400 text-sm mt-1">
                  WO #{selectedInvoice.work_order?.wo_number} - {selectedInvoice.work_order?.building}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
              
              {/* Invoice Info */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Status:</span>
                    <span className={`ml-2 px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(selectedInvoice.status)}`}>
                      {selectedInvoice.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Invoice Date:</span>
                    <span className="ml-2 font-semibold">
                      {new Date(selectedInvoice.invoice_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Due Date:</span>
                    <span className="ml-2 font-semibold">
                      {new Date(selectedInvoice.due_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Lead Tech:</span>
                    <span className="ml-2 font-semibold">
                      {selectedInvoice.work_order?.lead_tech 
                        ? `${selectedInvoice.work_order.lead_tech.first_name} ${selectedInvoice.work_order.lead_tech.last_name}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold text-lg mb-4">Line Items</h3>
                <div className="space-y-2">
                  {lineItems.map(item => (
                    <div 
                      key={item.line_item_id} 
                      className={`p-3 rounded ${item.line_type === 'description' ? 'bg-gray-800' : 'bg-gray-600'}`}
                    >
                      {item.line_type === 'description' ? (
                        <div>
                          <div className="font-bold mb-2">Work Performed:</div>
                          <div className="text-sm whitespace-pre-wrap">{item.description}</div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-semibold">{item.description}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {item.line_type?.toUpperCase()}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="font-bold">${item.amount.toFixed(2)}</div>
                            {item.quantity > 0 && item.unit_price > 0 && (
                              <div className="text-xs text-gray-400">
                                {item.quantity} × ${item.unit_price.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-lg">
                    <span className="text-gray-400">Subtotal:</span>
                    <span className="font-semibold">${selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedInvoice.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tax:</span>
                      <span className="font-semibold">${selectedInvoice.tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-600 pt-2 flex justify-between text-2xl">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-green-400">${selectedInvoice.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedInvoice.notes && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-bold mb-2">Notes:</h3>
                  <p className="text-sm text-gray-300">{selectedInvoice.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {selectedInvoice.status === 'draft' && (
                  <>
                    <button
                      onClick={() => returnToTech(selectedInvoice.wo_id, selectedInvoice.invoice_id)}
                      className="w-full bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg font-bold text-lg transition"
                    >
                      🔄 Return to Tech for Review
                    </button>
                    
                    <button
                      onClick={() => updateInvoiceStatus(selectedInvoice.invoice_id, 'sent')}
                      className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold text-lg transition"
                    >
                      📧 Mark as Sent
                    </button>
                  </>
                )}

                {selectedInvoice.status === 'sent' && (
                  <button
                    onClick={() => updateInvoiceStatus(selectedInvoice.invoice_id, 'paid')}
                    className="w-full bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold text-lg transition"
                  >
                    ✅ Mark as Paid
                  </button>
                )}

                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="w-full bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition"
                >
                  Close
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}