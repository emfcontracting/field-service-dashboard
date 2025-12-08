'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ContractorInvoices() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [filter, setFilter] = useState('all'); // all, draft, sent, paid

  useEffect(() => {
    const userData = sessionStorage.getItem('contractor_user');
    if (!userData) {
      router.push('/contractor');
      return;
    }
    const parsed = JSON.parse(userData);
    setUser(parsed);
    loadInvoices(parsed.user_id);
  }, []);

  async function loadInvoices(userId) {
    try {
      const { data, error } = await supabase
        .from('subcontractor_invoices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredInvoices = invoices.filter(inv => 
    filter === 'all' || inv.status === filter
  );

  const totals = {
    all: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent').length,
    paid: invoices.filter(i => i.status === 'paid').length
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              href="/contractor/dashboard"
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              ← Back
            </Link>
            <div>
              <h1 className="text-xl font-bold">📋 Invoices</h1>
              <p className="text-sm text-gray-400">{invoices.length} total</p>
            </div>
          </div>
          <Link
            href="/contractor/invoices/new"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium"
          >
            + New Invoice
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { key: 'all', label: 'All', color: 'gray' },
            { key: 'draft', label: 'Draft', color: 'gray' },
            { key: 'sent', label: 'Sent', color: 'yellow' },
            { key: 'paid', label: 'Paid', color: 'green' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                filter === tab.key
                  ? tab.color === 'green' 
                    ? 'bg-green-600 text-white'
                    : tab.color === 'yellow'
                      ? 'bg-yellow-600 text-white'
                      : 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab.label} ({totals[tab.key]})
            </button>
          ))}
        </div>

        {/* Invoice List */}
        {filteredInvoices.length === 0 ? (
          <div className="bg-gray-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 mb-4">No invoices found</p>
            <Link
              href="/contractor/invoices/new"
              className="text-blue-400 hover:text-blue-300"
            >
              Create your first invoice →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map(invoice => (
              <Link
                key={invoice.invoice_id}
                href={`/contractor/invoices/${invoice.invoice_id}`}
                className="block bg-gray-800 rounded-xl border border-gray-700 p-4 hover:bg-gray-750 transition"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg">{invoice.invoice_number}</h3>
                    <p className="text-sm text-gray-400">
                      {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    invoice.status === 'paid'
                      ? 'bg-green-500/20 text-green-400'
                      : invoice.status === 'sent'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-gray-500/20 text-gray-400'
                  }`}>
                    {invoice.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm mt-3">
                  <div>
                    <p className="text-gray-500">Hours</p>
                    <p className="font-medium">
                      {(parseFloat(invoice.total_regular_hours || 0) + parseFloat(invoice.total_ot_hours || 0)).toFixed(1)}h
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Miles</p>
                    <p className="font-medium">{parseFloat(invoice.total_miles || 0).toFixed(0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500">Total</p>
                    <p className="font-bold text-green-400 text-lg">
                      ${parseFloat(invoice.grand_total || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {invoice.sent_at && (
                  <p className="text-xs text-gray-500 mt-3">
                    Sent: {new Date(invoice.sent_at).toLocaleString()}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
