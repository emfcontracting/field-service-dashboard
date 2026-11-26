'use client';

import { useState, useEffect } from 'react';
import { useLang } from '@/app/contractor/components/LangProvider';
import StatusPill from '../components/StatusPill';
import { readContractorSession } from '@/lib/contractorSession';
import { fmtDate, fmtDateTime, parseDate, dateKeyET } from '@/lib/dates';
import { useRouter } from 'next/navigation';
import { contractorApi } from '@/lib/contractorClient';
import Link from 'next/link';


export default function ContractorInvoices() {
  const { t } = useLang();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [filter, setFilter] = useState('all'); // all, draft, sent, paid
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    const userData = readContractorSession();
    if (!userData) {
      router.push('/contractor');
      return;
    }
    
    try {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      loadInvoices(parsed.user_id);
    } catch (e) {
      console.error('Error parsing user data:', e);
      router.push('/contractor');
    }
  }, [router]);

  async function loadInvoices(userId) {
    try {
      const { invoices: data } = await contractorApi.invoices();
      setInvoices(data || []);
    } catch (error) {
      console.error('Error loading invoices:', error);
    } finally {
      setLoading(false);
    }
  }

  async function deleteInvoice(invoiceId, invoiceNumber) {
    if (!confirm(t('Are you sure you want to delete invoice {inv}? This cannot be undone.', { inv: invoiceNumber }))) {
      return;
    }

    setDeleting(invoiceId);

    try {
      await contractorApi.deleteInvoice(invoiceId);

      // Remove from state
      setInvoices(invoices.filter(inv => inv.invoice_id !== invoiceId));
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert(error.message || t('Failed to delete invoice'));
    } finally {
      setDeleting(null);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">{t('Loading...')}</div>
      </div>
    );
  }

  if (!user) {
    return null;
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
              {t('← Back')}
            </Link>
            <div>
              <h1 className="text-xl font-bold">{t('📋 Invoices')}</h1>
              <p className="text-sm text-gray-400">{invoices.length} total</p>
            </div>
          </div>
          <Link
            href="/contractor/invoices/new"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium"
          >
            {t('+ New Invoice')}
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {[
            { key: 'all', label: t('All'), color: 'gray' },
            { key: 'draft', label: t('Draft'), color: 'gray' },
            { key: 'sent', label: t('Sent'), color: 'yellow' },
            { key: 'paid', label: t('Paid'), color: 'green' }
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
            <p className="text-gray-500 mb-4">{t('No invoices found')}</p>
            <Link
              href="/contractor/invoices/new"
              className="text-blue-400 hover:text-blue-300"
            >
              {t('Create your first invoice →')}
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredInvoices.map(invoice => (
              <div
                key={invoice.invoice_id}
                className="bg-gray-800 rounded-xl border border-gray-700 p-4"
              >
                <div className="flex justify-between items-start mb-2">
                  <Link href={`/contractor/invoices/${invoice.invoice_id}`}>
                    <h3 className="font-bold text-lg hover:text-blue-400 transition">{invoice.invoice_number}</h3>
                    <p className="text-xs text-gray-500">{invoice.client_type === 'other' ? t('To: {name}', { name: invoice.client_name }) : t('To: EMF Contracting')}</p>
                    <p className="text-sm text-gray-400">
                      {fmtDate(invoice.period_start)} - {fmtDate(invoice.period_end)}
                    </p>
                  </Link>
                  <div className="flex items-center gap-2">
                    <StatusPill invoice={invoice} />
                    
                    {(invoice.status === 'draft' || invoice.emf_review_status === 'rejected') && (
                    <button
                      onClick={() => deleteInvoice(invoice.invoice_id, invoice.invoice_number)}
                      disabled={deleting === invoice.invoice_id}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition disabled:opacity-50"
                      title={t('Delete invoice')}
                    >
                      {deleting === invoice.invoice_id ? '...' : '🗑️'}
                    </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm mt-3">
                  <div>
                    <p className="text-gray-500">{t('Hours')}</p>
                    <p className="font-medium">
                      {(parseFloat(invoice.total_regular_hours || 0) + parseFloat(invoice.total_ot_hours || 0)).toFixed(1)}h
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">{t('Miles')}</p>
                    <p className="font-medium">{parseFloat(invoice.total_miles || 0).toFixed(0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500">{t('Total')}</p>
                    <p className="font-bold text-green-400 text-lg">
                      ${parseFloat(invoice.grand_total || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {invoice.sent_at && (
                  <p className="text-xs text-gray-500 mt-3">
                    Sent to {invoice.sent_to_email}: {fmtDateTime(invoice.sent_at)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
