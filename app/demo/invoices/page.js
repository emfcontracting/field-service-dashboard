// app/demo/invoices/page.js
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getMockSupabase, resetMockSupabase } from '../mockSupabase';

// Demo Banner Component
function DemoBanner({ onReset }) {
  const [isVisible, setIsVisible] = useState(true);
  
  if (!isVisible) return null;
  
  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 mb-4 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎯</span>
          <div>
            <span className="font-bold">Demo Mode</span>
            <span className="text-amber-100 text-sm ml-2 hidden sm:inline">
              - Exploring with sample data. Changes are temporary.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/demo"
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm transition"
          >
            ← Back to Demo Home
          </Link>
          <button
            onClick={onReset}
            className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded text-sm transition"
          >
            🔄 Reset Data
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="hover:bg-white/20 p-1 rounded transition ml-2"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DemoInvoicingPage() {
  const supabase = getMockSupabase();
  
  const [acknowledgedWOs, setAcknowledgedWOs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ready');

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

  const fetchAcknowledgedWorkOrders = async () => {
    // In demo, show completed work orders as "ready to invoice"
    const { data } = await supabase
      .from('work_orders')
      .select('*')
      .order('date_entered', { ascending: false });

    // Filter for completed ones that aren't invoiced yet
    const completed = (data || []).filter(wo => 
      wo.status === 'completed' && 
      !supabase.invoices?.some(inv => inv.wo_id === wo.wo_id)
    );
    
    setAcknowledgedWOs(completed.slice(0, 5)); // Show up to 5
  };

  const fetchInvoices = async () => {
    const { data } = await supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false });

    setInvoices(data || []);
  };

  const selectInvoice = async (invoice) => {
    const { data } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', invoice.invoice_id)
      .order('line_item_id', { ascending: true });

    setLineItems(data || []);
    setSelectedItem({ type: 'invoice', data: invoice });
  };

  const handleReset = () => {
    resetMockSupabase();
    fetchData();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-yellow-600';
      case 'approved': return 'bg-blue-600';
      case 'synced': return 'bg-green-600';
      case 'paid': return 'bg-green-600';
      default: return 'bg-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <DemoBanner onReset={handleReset} />
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-2xl">⚡</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold">💰 Invoicing</h1>
              <p className="text-gray-400 mt-1">Generate and manage invoices for completed work orders</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              href="/demo/dashboard"
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('ready')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'ready'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Ready to Invoice ({acknowledgedWOs.length})
          </button>
          <button
            onClick={() => setActiveTab('invoiced')}
            className={`px-6 py-3 font-semibold transition ${
              activeTab === 'invoiced'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Invoices ({invoices.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === 'ready' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Completed Work Orders - Ready for Invoice</h2>
            
            {acknowledgedWOs.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
                No work orders ready for invoicing.
                <br />
                <span className="text-sm">Work orders must be completed first.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left">WO #</th>
                      <th className="px-4 py-3 text-left">Building</th>
                      <th className="px-4 py-3 text-left">Lead Tech</th>
                      <th className="px-4 py-3 text-right">NTE</th>
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
                          {wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-yellow-400">
                          ${(wo.nte || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => alert('Invoice generation available in full version')}
                            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold"
                          >
                            Generate Invoice
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoiced' && (
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Generated Invoices</h2>
            
            {invoices.length === 0 ? (
              <div className="text-gray-400 text-center py-8">
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

              <button
                onClick={() => setSelectedItem(null)}
                className="w-full bg-gray-600 hover:bg-gray-700 px-6 py-3 rounded-lg font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
