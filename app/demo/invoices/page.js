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
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 sm:px-4 py-2 sm:py-3 mb-3 sm:mb-4 rounded-lg">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-xl sm:text-2xl">🎯</span>
          <div>
            <span className="font-bold text-sm sm:text-base">Demo Mode</span>
            <span className="text-amber-100 text-xs sm:text-sm ml-2 hidden sm:inline">
              - Exploring with sample data. Changes are temporary.
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <Link
            href="/demo"
            className="bg-white/20 hover:bg-white/30 px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition"
          >
            ← Home
          </Link>
          <button
            onClick={onReset}
            className="bg-white/20 hover:bg-white/30 px-2 sm:px-3 py-1 rounded text-xs sm:text-sm transition"
          >
            🔄 Reset
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="hover:bg-white/20 p-1 rounded transition"
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
        <div className="text-lg sm:text-xl">Loading invoices...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <DemoBanner onReset={handleReset} />
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl sm:text-2xl">⚡</span>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">💰 Invoicing</h1>
              <p className="text-gray-400 text-xs sm:text-sm mt-0.5 sm:mt-1">Generate and manage invoices</p>
            </div>
          </div>
          <Link
            href="/demo/dashboard"
            className="bg-gray-700 hover:bg-gray-600 px-3 sm:px-4 py-2 rounded-lg text-sm"
          >
            ← Dashboard
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6 border-b border-gray-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab('ready')}
            className={`px-4 sm:px-6 py-2 sm:py-3 font-semibold transition whitespace-nowrap text-sm sm:text-base ${
              activeTab === 'ready'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Ready ({acknowledgedWOs.length})
          </button>
          <button
            onClick={() => setActiveTab('invoiced')}
            className={`px-4 sm:px-6 py-2 sm:py-3 font-semibold transition whitespace-nowrap text-sm sm:text-base ${
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
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Ready for Invoice</h2>
            
            {acknowledgedWOs.length === 0 ? (
              <div className="text-gray-400 text-center py-6 sm:py-8 text-sm sm:text-base">
                No work orders ready for invoicing.
                <br />
                <span className="text-xs sm:text-sm">Work orders must be completed first.</span>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm">WO #</th>
                        <th className="px-4 py-3 text-left text-sm">Building</th>
                        <th className="px-4 py-3 text-left text-sm">Lead Tech</th>
                        <th className="px-4 py-3 text-right text-sm">NTE</th>
                        <th className="px-4 py-3 text-center text-sm">Action</th>
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

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {acknowledgedWOs.map(wo => (
                    <div key={wo.wo_id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-sm">{wo.wo_number}</div>
                        <div className="text-yellow-400 font-bold text-sm">${(wo.nte || 0).toFixed(2)}</div>
                      </div>
                      <div className="text-gray-300 text-sm mb-1">{wo.building}</div>
                      <div className="text-gray-400 text-xs mb-3">
                        {wo.lead_tech ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}` : 'N/A'}
                      </div>
                      <button
                        onClick={() => alert('Invoice generation available in full version')}
                        className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold"
                      >
                        Generate Invoice
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'invoiced' && (
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Generated Invoices</h2>
            
            {invoices.length === 0 ? (
              <div className="text-gray-400 text-center py-6 sm:py-8 text-sm sm:text-base">
                No invoices generated yet.
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm">Invoice #</th>
                        <th className="px-4 py-3 text-left text-sm">Work Order</th>
                        <th className="px-4 py-3 text-left text-sm">Building</th>
                        <th className="px-4 py-3 text-left text-sm">Invoice Date</th>
                        <th className="px-4 py-3 text-right text-sm">Total</th>
                        <th className="px-4 py-3 text-left text-sm">Status</th>
                        <th className="px-4 py-3 text-center text-sm">View</th>
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

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {invoices.map(invoice => (
                    <div 
                      key={invoice.invoice_id} 
                      onClick={() => selectInvoice(invoice)}
                      className="bg-gray-700 rounded-lg p-4 cursor-pointer active:bg-gray-600"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-bold text-sm">{invoice.invoice_number}</div>
                          <div className="text-gray-400 text-xs">{invoice.work_order?.wo_number}</div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(invoice.status)}`}>
                          {invoice.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-gray-300 text-sm mb-1">{invoice.work_order?.building}</div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-600">
                        <div className="text-gray-400 text-xs">
                          {new Date(invoice.invoice_date).toLocaleDateString()}
                        </div>
                        <div className="text-green-400 font-bold">${invoice.total.toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedItem?.type === 'invoice' && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg max-w-4xl w-full my-4 sm:my-8 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] flex flex-col">
            <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-4 sm:p-6 flex justify-between items-start z-10 rounded-t-lg flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-2xl font-bold truncate">Invoice #{selectedItem.data.invoice_number}</h2>
                <p className="text-gray-400 text-xs sm:text-sm mt-0.5 sm:mt-1 truncate">
                  WO #{selectedItem.data.work_order?.wo_number} - {selectedItem.data.work_order?.building}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="text-gray-400 hover:text-white text-2xl sm:text-3xl leading-none ml-2 flex-shrink-0"
              >
                ×
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
              <div className="bg-gray-700 rounded-lg p-3 sm:p-4">
                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <span className="text-gray-400">Status:</span>
                    <span className={`ml-2 px-2 sm:px-3 py-1 rounded-lg text-[10px] sm:text-xs font-semibold ${getStatusColor(selectedItem.data.status)}`}>
                      {selectedItem.data.status.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Invoice Date:</span>
                    <span className="ml-1 sm:ml-2 font-semibold">
                      {new Date(selectedItem.data.invoice_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Due Date:</span>
                    <span className="ml-1 sm:ml-2 font-semibold">
                      {new Date(selectedItem.data.due_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Lead Tech:</span>
                    <span className="ml-1 sm:ml-2 font-semibold">
                      {selectedItem.data.work_order?.lead_tech 
                        ? `${selectedItem.data.work_order.lead_tech.first_name} ${selectedItem.data.work_order.lead_tech.last_name}`
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 rounded-lg p-3 sm:p-4">
                <h3 className="font-bold text-sm sm:text-lg mb-3 sm:mb-4">Line Items</h3>
                <div className="space-y-2">
                  {lineItems.map(item => (
                    <div 
                      key={item.line_item_id} 
                      className={`p-2 sm:p-3 rounded text-sm ${item.line_type === 'description' ? 'bg-gray-800' : 'bg-gray-600'}`}
                    >
                      {item.line_type === 'description' ? (
                        <div>
                          <div className="font-bold mb-1 sm:mb-2 text-xs sm:text-sm">Work Performed:</div>
                          <div className="text-xs sm:text-sm whitespace-pre-wrap">{item.description}</div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-xs sm:text-sm truncate">{item.description}</div>
                            <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
                              {item.line_type?.toUpperCase()}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-bold text-xs sm:text-sm">${item.amount.toFixed(2)}</div>
                            {item.quantity > 0 && item.unit_price > 0 && (
                              <div className="text-[10px] sm:text-xs text-gray-400">
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

              <div className="bg-gray-700 rounded-lg p-3 sm:p-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm sm:text-lg">
                    <span className="text-gray-400">Subtotal:</span>
                    <span className="font-semibold">${selectedItem.data.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedItem.data.tax > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Tax:</span>
                      <span className="font-semibold">${selectedItem.data.tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-600 pt-2 flex justify-between text-lg sm:text-2xl">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-green-400">${selectedItem.data.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="w-full bg-gray-600 hover:bg-gray-700 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold transition text-sm sm:text-base"
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
