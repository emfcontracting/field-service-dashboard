'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ViewInvoice() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id;

  const [user, setUser] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const userData = sessionStorage.getItem('contractor_user');
    if (!userData) {
      router.push('/contractor');
      return;
    }
    
    try {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      loadInvoice(invoiceId);
    } catch (e) {
      console.error('Error parsing user data:', e);
      router.push('/contractor');
    }
  }, [router, invoiceId]);

  async function loadInvoice(id) {
    try {
      // Get invoice
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('subcontractor_invoices')
        .select('*')
        .eq('invoice_id', id)
        .single();

      if (invoiceError) throw invoiceError;
      setInvoice(invoiceData);

      // Get line items
      const { data: itemsData, error: itemsError } = await supabase
        .from('subcontractor_invoice_items')
        .select(`
          *,
          work_order:work_orders(wo_number, building)
        `)
        .eq('invoice_id', id)
        .order('work_date', { ascending: true });

      if (itemsError) {
        console.error('Error loading line items:', itemsError);
      }
      setLineItems(itemsData || []);

    } catch (error) {
      console.error('Error loading invoice:', error);
      setMessage({ type: 'error', text: 'Failed to load invoice' });
    } finally {
      setLoading(false);
    }
  }

  async function sendInvoice() {
    if (!invoice || invoice.status === 'sent' || invoice.status === 'paid') {
      return;
    }

    setSending(true);
    setMessage(null);

    try {
      // Group line items by type for the email
      const hoursItems = lineItems.filter(i => i.item_type === 'hours');
      const mileageItems = lineItems.filter(i => i.item_type === 'mileage');
      const customItems = lineItems.filter(i => i.item_type === 'custom');

      // Build hoursData format for email
      const hoursData = [];
      const dateGroups = {};
      
      lineItems.forEach(item => {
        if (item.work_date) {
          const dateKey = item.work_date;
          if (!dateGroups[dateKey]) {
            dateGroups[dateKey] = {
              work_date: dateKey,
              wo_id: item.wo_id,
              work_order: item.work_order,
              hours_regular: 0,
              hours_overtime: 0,
              miles: 0
            };
          }
          if (item.item_type === 'hours' && item.description?.includes('Regular')) {
            dateGroups[dateKey].hours_regular += parseFloat(item.quantity || 0);
          } else if (item.item_type === 'hours' && item.description?.includes('OT')) {
            dateGroups[dateKey].hours_overtime += parseFloat(item.quantity || 0);
          } else if (item.item_type === 'mileage') {
            dateGroups[dateKey].miles += parseFloat(item.quantity || 0);
          }
        }
      });

      Object.values(dateGroups).forEach(group => hoursData.push(group));

      const rates = {
        hourly: parseFloat(invoice.hourly_rate_used || 35),
        ot: parseFloat(invoice.ot_rate_used || 52.50),
        mileage: parseFloat(invoice.mileage_rate_used || 0.67)
      };

      const totals = {
        totalRegularHours: parseFloat(invoice.total_regular_hours || 0),
        totalOTHours: parseFloat(invoice.total_ot_hours || 0),
        totalMiles: parseFloat(invoice.total_miles || 0),
        hoursAmount: parseFloat(invoice.total_hours_amount || 0),
        mileageAmount: parseFloat(invoice.total_mileage_amount || 0),
        lineItemsAmount: parseFloat(invoice.total_line_items_amount || 0),
        grandTotal: parseFloat(invoice.grand_total || 0)
      };

      // Send email
      const emailResult = await fetch('/api/contractor/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice,
          user,
          hoursData,
          lineItems: customItems,
          rates,
          totals
        })
      });

      if (!emailResult.ok) {
        throw new Error('Email send failed');
      }

      // Update invoice status
      const { error: updateError } = await supabase
        .from('subcontractor_invoices')
        .update({
          status: 'sent',
          sent_to_email: 'emfcontractingsc2@gmail.com',
          sent_at: new Date().toISOString()
        })
        .eq('invoice_id', invoice.invoice_id);

      if (updateError) throw updateError;

      setInvoice({ ...invoice, status: 'sent', sent_at: new Date().toISOString() });
      setMessage({ type: 'success', text: 'Invoice sent to emfcontractingsc2@gmail.com!' });

    } catch (error) {
      console.error('Error sending invoice:', error);
      setMessage({ type: 'error', text: 'Failed to send invoice' });
    } finally {
      setSending(false);
    }
  }

  async function deleteInvoice() {
    if (!confirm('Are you sure you want to delete this invoice? This cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('subcontractor_invoices')
        .delete()
        .eq('invoice_id', invoice.invoice_id);

      if (error) throw error;

      router.push('/contractor/invoices');
    } catch (error) {
      console.error('Error deleting invoice:', error);
      setMessage({ type: 'error', text: 'Failed to delete invoice' });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user || !invoice) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Invoice not found</div>
      </div>
    );
  }

  // Group items by type
  const hoursItems = lineItems.filter(i => i.item_type === 'hours');
  const mileageItems = lineItems.filter(i => i.item_type === 'mileage');
  const customItems = lineItems.filter(i => i.item_type === 'custom');

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              href="/contractor/invoices"
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-xl font-bold">{invoice.invoice_number}</h1>
              <span className={`text-xs px-2 py-1 rounded-full ${
                invoice.status === 'paid'
                  ? 'bg-green-500/20 text-green-400'
                  : invoice.status === 'sent'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-gray-500/20 text-gray-400'
              }`}>
                {invoice.status.toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {invoice.status === 'draft' && (
              <>
                <button
                  onClick={deleteInvoice}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
                >
                  🗑️ Delete
                </button>
                <button
                  onClick={sendInvoice}
                  disabled={sending}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {sending ? '📧 Sending...' : '📧 Send Invoice'}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div className={`fixed top-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg shadow-lg z-50 ${
          message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {message.text}
        </div>
      )}

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        
        {/* Invoice Preview */}
        <div className="bg-white text-gray-900 rounded-xl overflow-hidden shadow-xl">
          
          {/* Invoice Header */}
          <div className="bg-gray-800 text-white p-6">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-bold">INVOICE</h2>
                <p className="text-gray-300">{invoice.invoice_number}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Period</p>
                <p className="font-medium">
                  {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* From / To */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold mb-2">From</p>
                <p className="font-bold text-lg">
                  {user.profile?.business_name || `${user.first_name} ${user.last_name}`}
                </p>
                {user.profile?.business_address && (
                  <p className="text-gray-600 text-sm whitespace-pre-line">{user.profile.business_address}</p>
                )}
                <p className="text-gray-600 text-sm">{user.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase font-bold mb-2">To</p>
                <p className="font-bold text-lg">EMF Contracting LLC</p>
                <p className="text-gray-600 text-sm">emfcontractingsc2@gmail.com</p>
              </div>
            </div>

            {/* Rates Used */}
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600">
                <strong>Rates:</strong> ${parseFloat(invoice.hourly_rate_used || 0).toFixed(2)}/hr regular | 
                ${parseFloat(invoice.ot_rate_used || 0).toFixed(2)}/hr OT | 
                ${parseFloat(invoice.mileage_rate_used || 0).toFixed(4)}/mile
              </p>
            </div>

            {/* Labor Section */}
            {hoursItems.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-gray-700 mb-3 border-b pb-2">Labor</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-left">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2 text-right">Hours</th>
                      <th className="pb-2 text-right">Rate</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoursItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2">{item.work_date ? new Date(item.work_date).toLocaleDateString() : '-'}</td>
                        <td className="py-2">{item.description}</td>
                        <td className="py-2 text-right">{parseFloat(item.quantity || 0).toFixed(1)}</td>
                        <td className="py-2 text-right">${parseFloat(item.rate || 0).toFixed(2)}</td>
                        <td className="py-2 text-right font-medium">${parseFloat(item.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Mileage Section */}
            {mileageItems.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-gray-700 mb-3 border-b pb-2">Mileage</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-left">
                      <th className="pb-2">Date</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2 text-right">Miles</th>
                      <th className="pb-2 text-right">Rate</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mileageItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2">{item.work_date ? new Date(item.work_date).toLocaleDateString() : '-'}</td>
                        <td className="py-2">{item.description}</td>
                        <td className="py-2 text-right">{parseFloat(item.quantity || 0).toFixed(0)}</td>
                        <td className="py-2 text-right">${parseFloat(item.rate || 0).toFixed(4)}</td>
                        <td className="py-2 text-right font-medium">${parseFloat(item.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Custom Items Section */}
            {customItems.length > 0 && (
              <div className="mb-6">
                <h3 className="font-bold text-gray-700 mb-3 border-b pb-2">Additional Items</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-left">
                      <th className="pb-2">Description</th>
                      <th className="pb-2 text-right">Qty</th>
                      <th className="pb-2 text-right">Rate</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customItems.map((item, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="py-2">{item.description}</td>
                        <td className="py-2 text-right">{parseFloat(item.quantity || 0).toFixed(1)}</td>
                        <td className="py-2 text-right">${parseFloat(item.rate || 0).toFixed(2)}</td>
                        <td className="py-2 text-right font-medium">${parseFloat(item.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div className="bg-gray-50 rounded-lg p-4 mt-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Labor ({parseFloat(invoice.total_regular_hours || 0).toFixed(1)}h reg + {parseFloat(invoice.total_ot_hours || 0).toFixed(1)}h OT)</span>
                  <span>${parseFloat(invoice.total_hours_amount || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Mileage ({parseFloat(invoice.total_miles || 0).toFixed(0)} miles)</span>
                  <span>${parseFloat(invoice.total_mileage_amount || 0).toFixed(2)}</span>
                </div>
                {parseFloat(invoice.total_line_items_amount || 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Additional Items</span>
                    <span>${parseFloat(invoice.total_line_items_amount || 0).toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-300 pt-3 mt-3">
                  <div className="flex justify-between text-xl font-bold">
                    <span>TOTAL DUE</span>
                    <span className="text-green-600">${parseFloat(invoice.grand_total || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sent info */}
            {invoice.sent_at && (
              <div className="mt-6 text-center text-sm text-gray-500">
                Sent to {invoice.sent_to_email} on {new Date(invoice.sent_at).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
