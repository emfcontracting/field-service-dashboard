'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function CompletedWorkOrdersPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [completedWOs, setCompletedWOs] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [lineItems, setLineItems] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get current user from session
    const savedSession = localStorage.getItem('mobile_session');
    if (savedSession) {
      const user = JSON.parse(savedSession);
      setCurrentUser(user);
      fetchCompletedWorkOrders(user.user_id);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCompletedWorkOrders = async (userId) => {
    setLoading(true);

    // Get work orders where:
    // 1. User was lead tech OR
    // 2. User was a team member
    // AND invoice is approved
    
    // Get WOs where user was lead tech
    const { data: leadWOs } = await supabase
      .from('work_orders')
      .select(`
        *,
        lead_tech:users!lead_tech_id(first_name, last_name)
      `)
      .eq('lead_tech_id', userId)
      .eq('is_locked', true);

    // Get WOs where user was team member
    const { data: assignments } = await supabase
      .from('work_order_assignments')
      .select('wo_id')
      .eq('user_id', userId);

    const assignedWOIds = assignments?.map(a => a.wo_id) || [];

    let memberWOs = [];
    if (assignedWOIds.length > 0) {
      const { data } = await supabase
        .from('work_orders')
        .select(`
          *,
          lead_tech:users!lead_tech_id(first_name, last_name)
        `)
        .in('wo_id', assignedWOIds)
        .eq('is_locked', true);
      
      memberWOs = data || [];
    }

    // Combine and deduplicate
    const allWOs = [...(leadWOs || []), ...memberWOs];
    const uniqueWOs = Array.from(new Map(allWOs.map(wo => [wo.wo_id, wo])).values());

    // Get invoices for these WOs
    const woIds = uniqueWOs.map(wo => wo.wo_id);
    
    if (woIds.length > 0) {
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select('*')
        .in('wo_id', woIds)
        .eq('status', 'approved');

      // Match invoices with work orders
      const wosWithInvoices = uniqueWOs
        .map(wo => {
          const matchingInvoice = invoicesData?.find(inv => inv.wo_id === wo.wo_id);
          return matchingInvoice ? { ...wo, invoice: matchingInvoice } : null;
        })
        .filter(wo => wo !== null)
        .sort((a, b) => new Date(b.invoice.approved_at) - new Date(a.invoice.approved_at));

      setCompletedWOs(wosWithInvoices);
    } else {
      setCompletedWOs([]);
    }

    setLoading(false);
  };

  const viewWorkOrder = async (wo) => {
    setSelectedWO(wo);
    setInvoice(wo.invoice);

    // Fetch line items
    const { data } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', wo.invoice.invoice_id)
      .order('category');

    setLineItems(data || []);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">🔒 Login Required</h1>
          <p className="text-gray-400 mb-6">Please login to view completed work orders</p>
          <button
            onClick={() => window.location.href = '/mobile'}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-bold"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">✅ Completed Work Orders</h1>
            <p className="text-gray-400 mt-1">
              Approved invoices for work orders you participated in
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.href = '/mobile'}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold"
            >
              ← Mobile App
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold"
            >
              Dashboard
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Work Orders List */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800 rounded-lg p-4">
                <h2 className="text-xl font-bold mb-4">
                  Your Completed Work Orders ({completedWOs.length})
                </h2>

                {completedWOs.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <div className="text-4xl mb-4">📋</div>
                    <div>No completed work orders with approved invoices yet</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {completedWOs.map(wo => (
                      <div
                        key={wo.wo_id}
                        onClick={() => viewWorkOrder(wo)}
                        className={`bg-gray-700 p-4 rounded-lg cursor-pointer hover:bg-gray-600 transition ${
                          selectedWO?.wo_id === wo.wo_id ? 'ring-2 ring-green-500' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-bold text-lg">{wo.wo_number}</div>
                            <div className="text-sm text-gray-400">{wo.building}</div>
                            <div className="text-sm text-gray-400 mt-1">
                              {wo.work_order_description.substring(0, 80)}...
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                              Lead: {wo.lead_tech?.first_name} {wo.lead_tech?.last_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              Completed: {new Date(wo.invoice.approved_at).toLocaleDateString()}
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-2xl font-bold text-green-400">
                              ${wo.invoice.total.toFixed(2)}
                            </div>
                            <div className="bg-green-600 text-xs px-2 py-1 rounded-full mt-1">
                              APPROVED
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Work Order Details */}
            <div className="lg:col-span-1">
              {selectedWO && invoice ? (
                <div className="bg-gray-800 rounded-lg p-4 sticky top-6">
                  <h2 className="text-xl font-bold mb-4">Work Order Details</h2>

                  <div className="space-y-3 mb-4">
                    <div>
                      <div className="text-sm text-gray-400">Work Order #</div>
                      <div className="font-bold text-lg">{selectedWO.wo_number}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-400">Building</div>
                      <div>{selectedWO.building}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-400">Description</div>
                      <div className="text-sm">{selectedWO.work_order_description}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-400">Lead Technician</div>
                      <div>{selectedWO.lead_tech?.first_name} {selectedWO.lead_tech?.last_name}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-400">Invoice #</div>
                      <div className="font-semibold">{invoice.invoice_number}</div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-400">Approved Date</div>
                      <div className="text-sm">{new Date(invoice.approved_at).toLocaleString()}</div>
                    </div>
                  </div>

                  <hr className="border-gray-700 my-4" />

                  {/* Line Items */}
                  {lineItems && lineItems.length > 0 && (
                    <>
                      <div className="mb-4">
                        <div className="font-bold mb-2">Invoice Line Items</div>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {lineItems.map((item, idx) => (
                            <div key={idx} className="bg-gray-700 p-2 rounded text-sm">
                              <div className="flex justify-between">
                                <span className="flex-1">{item.description}</span>
                                <span className="font-semibold ml-2">${item.amount.toFixed(2)}</span>
                              </div>
                              <div className="text-xs text-gray-400">
                                {item.quantity} × ${item.unit_price.toFixed(2)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <hr className="border-gray-700 my-4" />
                    </>
                  )}

                  {/* Cost Summary */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Labor</span>
                      <span>${invoice.labor_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Materials</span>
                      <span>${invoice.material_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Equipment</span>
                      <span>${invoice.equipment_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Trailer</span>
                      <span>${invoice.trailer_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Rental</span>
                      <span>${invoice.rental_cost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Mileage</span>
                      <span>${invoice.mileage_cost.toFixed(2)}</span>
                    </div>
                    <hr className="border-gray-700" />
                    <div className="flex justify-between font-bold text-xl text-green-400">
                      <span>Total</span>
                      <span>${invoice.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400 sticky top-6">
                  <div className="text-4xl mb-3">📄</div>
                  <div>Select a work order to view details</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}