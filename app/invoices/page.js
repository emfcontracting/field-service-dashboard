'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function InvoicingPage() {
  const [acknowledgedWOs, setAcknowledgedWOs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ready'); // 'ready' or 'invoiced'
  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchAcknowledgedWorkOrders(),
      fetchInvoices()
    ]);
    setLoading(false);
  };

  // Fetch work orders that are acknowledged but don't have invoices yet
  const fetchAcknowledgedWorkOrders = async () => {
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!lead_tech_id(first_name, last_name, email)
      `)
      .eq('acknowledged', true)
      .eq('is_locked', false)
      .order('acknowledged_at', { ascending: false });

    if (error) {
      console.error('Error fetching acknowledged work orders:', error);
    } else {
      setAcknowledgedWOs(data || []);
    }
  };

  // Fetch existing invoices
  const fetchInvoices = async () => {
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
  };

  const selectWorkOrder = async (wo) => {
    setSelectedItem({ type: 'work_order', data: wo });
  };

  const selectInvoice = async (invoice) => {
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
    
    setSelectedItem({ type: 'invoice', data: invoice });
  };

  const generateInvoice = async (woId) => {
    if (!confirm('Generate invoice for this work order?\n\nThis will:\n- Create a draft invoice\n- Lock the work order\n- Apply automatic markups\n\nContinue?')) {
      return;
    }

    setGeneratingInvoice(true);

    try {
      const response = await fetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wo_id: woId })
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ Invoice generated successfully!\n\nMarkups applied:\n' +
              `- Admin Hours: $${result.markups.admin_hours.toFixed(2)}\n` +
              `- Material Markup (25%): $${result.markups.material_markup.toFixed(2)}\n` +
              `- Equipment Markup (15%): $${result.markups.equipment_markup.toFixed(2)}\n` +
              `- Rental Markup (15%): $${result.markups.rental_markup.toFixed(2)}`);
        setSelectedItem(null);
        fetchData();
      } else {
        alert('❌ Error generating invoice:\n' + result.error);
      }
    } catch (error) {
      console.error('Error generating invoice:', error);
      alert('❌ Failed to generate invoice');
    } finally {
      setGeneratingInvoice(false);
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
      
      setSelectedItem(null);
      fetchData();
    } catch (err) {
      console.error('Error returning work order:', err);
      alert('Failed to return work order: ' + err.message);
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
      fetchData();
      if (selectedItem?.type === 'invoice' && selectedItem.data.invoice_id === invoiceId) {
        setSelectedItem({
          ...selectedItem,
          data: { ...selectedItem.data, status: newStatus }
        });
      }
    }
  };

  const printInvoice = (invoice) => {
    window.print();
  };

  const shareInvoice = (invoice) => {
    const shareUrl = `${window.location.origin}/invoices/${invoice.invoice_id}`;
    
    if (navigator.share) {
      navigator.share({
        title: `Invoice ${invoice.invoice_number}`,
        text: `Invoice for Work Order ${invoice.work_order?.wo_number}`,
        url: shareUrl
      }).catch(err => console.log('Share cancelled'));
    } else {
      // Fallback - copy to clipboard
      navigator.clipboard.writeText(shareUrl).then(() => {
        alert('📋 Invoice link copied to clipboard!');
      });
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

        {/* Tabs */}
        <div className="bg-gray-800 rounded-lg mb-6">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('ready')}
              className={`flex-1 px-6 py-4 font-semibold transition ${
                activeTab === 'ready' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Ready for Invoice ({acknowledgedWOs.length})
            </button>
            <button
              onClick={() => setActiveTab('invoiced')}
              className={`flex-1 px-6 py-4 font-semibold transition ${
                activeTab === 'invoiced' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Generated Invoices ({invoices.length})
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
            Loading...
          </div>
        ) : activeTab === 'ready' ? (
          /* Ready for Invoice Tab */
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            {acknowledgedWOs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No work orders ready for invoicing.
                <br />
                <span className="text-sm">Acknowledged work orders will appear here.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">WO #</th>
                      <th className="px-4 py-3 text-left">Building</th>
                      <th className="px-4 py-3 text-left">Lead Tech</th>
                      <th className="px-4 py-3 text-left">Acknowledged</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acknowledgedWOs.map(wo => (
                      <tr
                        key={wo.wo_id}
                        className="border-t border-gray-700 hover:bg-gray-700 transition"
                      >
                        <td className="px-4 py-3 font-semibold">{wo.wo_number}</td>
                        <td className="px-4 py-3">{wo.building}</td>
                        <td className="px-4 py-3">
                          {wo.lead_tech 
                            ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`
                            : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(wo.acknowledged_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-green-600">
                            READY
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => selectWorkOrder(wo)}
                            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition"
                          >
                            View & Generate Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Generated Invoices Tab */
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                No invoices generated yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">Invoice #</th>
                      <th className="px-4 py-3 text-left">Work Order</th>
                      <th className="px-4 py-3 text-left">Building</th>
                      <th className="px-4 py-3 text-left">Invoice Date</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-center">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(invoice => (
                      <tr
                        key={invoice.invoice_id}
                        onClick={() => selectInvoice(invoice)}
                        className="border-t border-gray-700 hover:bg-gray-700 transition cursor-pointer"
                      >
                        <td className="px-4 py-3 font-semibold">{invoice.invoice_number}</td>
                        <td className="px-4 py-3">{invoice.work_order?.wo_number}</td>
                        <td className="px-4 py-3">{invoice.work_order?.building}</td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(invoice.invoice_date).toLocaleDateString()}
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
        )}
      </div>

      {/* Work Order Detail Modal (Ready for Invoice) */}
      {selectedItem?.type === 'work_order' && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full my-8">
            
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-start z-10 rounded-t-lg">
              <div>
                <h2 className="text-2xl font-bold">Work Order #{selectedItem.data.wo_number}</h2>
                <p className="text-gray-400 text-sm mt-1">
                  {selectedItem.data.building} - Ready for Invoice
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-white text-3xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-bold mb-3">Work Order Details</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-400">Description:</span>
                    <div className="mt-1">{selectedItem.data.work_order_description}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Lead Tech:</span>
                    <span className="ml-2 font-semibold">
                      {selectedItem.data.lead_tech 
                        ? `${selectedItem.data.lead_tech.first_name} ${selectedItem.data.lead_tech.last_name}`
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Acknowledged:</span>
                    <span className="ml-2">{new Date(selectedItem.data.acknowledged_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-900 text-blue-200 p-4 rounded-lg">
                <div className="font-bold mb-2">✓ Ready to Generate Invoice</div>
                <div className="text-sm">
                  This work order has been completed and acknowledged. Click below to generate an invoice with automatic markups:
                  <ul className="list-disc list-inside mt-2 text-xs">
                    <li>2 Admin Hours will be added</li>
                    <li>25% markup on materials</li>
                    <li>15% markup on equipment</li>
                    <li>15% markup on rentals</li>
                    <li>Comments will be included as work performed</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={() => generateInvoice(selectedItem.data.wo_id)}
                disabled={generatingInvoice}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-4 rounded-lg font-bold text-lg transition"
              >
                {generatingInvoice ? '⏳ Generating Invoice...' : '📄 Generate Invoice'}
              </button>

            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedItem?.type === 'invoice' && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full my-8">
            
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 flex justify-between items-start z-10 rounded-t-lg">
              <div>
                <h2 className="text-2xl font-bold">Invoice #{selectedItem.data.invoice_number}</h2>
                <p className="text-gray-400 text-sm mt-1">
                  WO #{selectedItem.data.work_order?.wo_number} - {selectedItem.data.work_order?.building}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
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
                    <span className={`ml-2 px-3 py-1 rounded-lg text-xs font-semibold ${getStatusColor(selectedItem.data.status)}`}>
                      {selectedItem.data.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Invoice Date:</span>
                    <span className="ml-2 font-semibold">
                      {new Date(selectedItem.data.invoice_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Due Date:</span>
                    <span className="ml-2 font-semibold">
                      {new Date(selectedItem.data.due_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Lead Tech:</span>
                    <span className="ml-2 font-semibold">
                      {selectedItem.data.work_order?.lead_tech 
                        ? `${selectedItem.data.work_order.lead_tech.first_name} ${selectedItem.data.work_order.lead_tech.last_name}`
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
                    <span className="font-semibold">${selectedItem.data.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedItem.data.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tax:</span>
                      <span className="font-semibold">${selectedItem.data.tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-600 pt-2 flex justify-between text-2xl">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-green-400">${selectedItem.data.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                {/* Print & Share - Available for all invoices */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => printInvoice(selectedItem.data)}
                    className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition"
                  >
                    🖨️ Print
                  </button>
                  <button
                    onClick={() => shareInvoice(selectedItem.data)}
                    className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition"
                  >
                    📤 Share
                  </button>
                </div>

                {selectedItem.data.status === 'draft' && (
                  <>
                    <button
                      onClick={() => returnToTech(selectedItem.data.wo_id, selectedItem.data.invoice_id)}
                      className="w-full bg-orange-600 hover:bg-orange-700 px-6 py-3 rounded-lg font-bold text-lg transition"
                    >
                      🔄 Return to Tech for Review
                    </button>
                    
                    <button
                      onClick={() => updateInvoiceStatus(selectedItem.data.invoice_id, 'sent')}
                      className="w-full bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold text-lg transition"
                    >
                      📧 Mark as Sent
                    </button>
                  </>
                )}

                {selectedItem.data.status === 'sent' && (
                  <button
                    onClick={() => updateInvoiceStatus(selectedItem.data.invoice_id, 'paid')}
                    className="w-full bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg font-bold text-lg transition"
                  >
                    ✅ Mark as Paid
                  </button>
                )}

                <button
                  onClick={() => setSelectedItem(null)}
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