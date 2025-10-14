'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function InvoicePrintPage() {
  const params = useParams();
  const [invoice, setInvoice] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInvoiceData();
  }, []);

  const fetchInvoiceData = async () => {
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select(`
        *,
        work_order:work_orders(
          wo_number,
          building,
          work_order_description,
          requestor,
          date_entered,
          lead_tech:users!lead_tech_id(first_name, last_name)
        )
      `)
      .eq('invoice_id', params.id)
      .single();

    const { data: lineItemsData } = await supabase
      .from('invoice_line_items')
      .select('*')
      .eq('invoice_id', params.id)
      .order('line_item_id');

    setInvoice(invoiceData);
    setLineItems(lineItemsData || []);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl">Loading invoice...</div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-2xl">Invoice not found</div>
      </div>
    );
  }

  const workPerformedItem = lineItems.find(item => item.line_type === 'description');
  const costItems = lineItems.filter(item => item.line_type !== 'description');

  return (
    <>
      <style jsx global>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .page-break { page-break-after: always; }
        }
        @page { margin: 0.5in; }
      `}</style>

      <div className="max-w-4xl mx-auto p-8 bg-white text-black">
        {/* Print Button - Hidden when printing */}
        <div className="no-print mb-4 flex gap-3">
          <button
            onClick={() => window.print()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700"
          >
            🖨️ Print Invoice
          </button>
          <button
            onClick={() => window.close()}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-gray-700"
          >
            Close
          </button>
        </div>

        {/* Invoice Header */}
        <div className="flex justify-between items-start mb-8 border-b-4 border-orange-500 pb-6">
          <div className="flex items-center gap-4">
            <img 
              src="/emf-logo.png" 
              alt="EMF Contracting LLC" 
              className="h-20 w-auto"
            />
            <div>
              <h1 className="text-3xl font-bold text-orange-600">EMF CONTRACTING LLC</h1>
              <p className="text-sm text-gray-600">Electrical, Mechanical & Fabrication</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold mb-2">INVOICE</h2>
            <div className="text-sm space-y-1">
              <div><strong>Invoice #:</strong> {invoice.invoice_number}</div>
              <div><strong>Date:</strong> {new Date(invoice.invoice_date).toLocaleDateString()}</div>
              <div><strong>Due Date:</strong> {new Date(invoice.due_date).toLocaleDateString()}</div>
              <div><strong>Work Order:</strong> {invoice.work_order?.wo_number}</div>
            </div>
          </div>
        </div>

        {/* Company & Bill To */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-lg mb-2 text-gray-700">FROM:</h3>
            <div className="text-sm space-y-1">
              <div className="font-bold">EMF Contracting LLC</div>
              <div>565 Pine Plain Rd</div>
              <div>Gaston, SC 29053</div>
              <div>Email: emfcontractingsc@gmail.com</div>
              <div>Phone: (864) 376-4965</div>
            </div>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-2 text-gray-700">BILL TO:</h3>
            <div className="text-sm space-y-1">
              <div className="font-bold">{invoice.work_order?.building}</div>
              <div>Attention: {invoice.work_order?.requestor || 'Facilities Manager'}</div>
            </div>
          </div>
        </div>

        {/* Work Order Details */}
        <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6">
          <h3 className="font-bold text-lg mb-3">Work Order Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Building:</span>
              <span className="ml-2 font-semibold">{invoice.work_order?.building}</span>
            </div>
            <div>
              <span className="text-gray-600">Date Entered:</span>
              <span className="ml-2 font-semibold">
                {new Date(invoice.work_order?.date_entered).toLocaleDateString()}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">Lead Technician:</span>
              <span className="ml-2 font-semibold">
                {invoice.work_order?.lead_tech?.first_name} {invoice.work_order?.lead_tech?.last_name}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">Description:</span>
              <div className="mt-1 text-gray-800">{invoice.work_order?.work_order_description}</div>
            </div>
          </div>
        </div>

        {/* Work Performed */}
        {workPerformedItem && (
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-6">
            <h3 className="font-bold text-lg mb-3 text-blue-900">Work Performed</h3>
            <div className="text-sm whitespace-pre-wrap text-gray-800">
              {workPerformedItem.description}
            </div>
          </div>
        )}

        {/* Line Items Table */}
        <table className="w-full mb-6 border border-gray-300">
          <thead className="bg-gray-200">
            <tr>
              <th className="border border-gray-300 px-4 py-3 text-left font-bold">Description</th>
              <th className="border border-gray-300 px-4 py-3 text-right font-bold w-24">Qty</th>
              <th className="border border-gray-300 px-4 py-3 text-right font-bold w-32">Unit Price</th>
              <th className="border border-gray-300 px-4 py-3 text-right font-bold w-32">Amount</th>
            </tr>
          </thead>
          <tbody>
            {costItems.map(item => (
              <tr key={item.line_item_id} className="border-b border-gray-300">
                <td className="border border-gray-300 px-4 py-2">{item.description}</td>
                <td className="border border-gray-300 px-4 py-2 text-right">
                  {item.quantity > 0 ? item.quantity.toFixed(2) : '-'}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-right">
                  {item.unit_price > 0 ? `$${item.unit_price.toFixed(2)}` : '-'}
                </td>
                <td className="border border-gray-300 px-4 py-2 text-right font-semibold">
                  ${item.amount.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-8">
          <div className="w-80">
            <div className="flex justify-between py-2 border-b border-gray-300">
              <span className="font-semibold">Subtotal:</span>
              <span>${invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.tax > 0 && (
              <div className="flex justify-between py-2 border-b border-gray-300">
                <span className="font-semibold">Tax:</span>
                <span>${invoice.tax.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between py-3 bg-orange-100 px-4 font-bold text-lg border-2 border-orange-500 mt-2">
              <span>TOTAL:</span>
              <span className="text-orange-600">${invoice.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-gray-300 pt-4 text-center text-sm text-gray-600">
          <p className="mb-2">Thank you for your business!</p>
          <p>Please remit payment within 30 days of invoice date.</p>
          <p className="mt-4 text-xs">EMF Contracting LLC • 565 Pine Plain Rd, Gaston, SC 29053</p>
          <p className="text-xs">Email: emfcontractingsc@gmail.com • Phone: (864) 376-4965</p>
        </div>
      </div>
    </>
  );
}