'use client';
// Estimates to your own customers: draft → sent → accepted/declined → invoice.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/app/contractor/components/LangProvider';
import { EstimatePill } from '@/app/contractor/components/EstimatePill';
import { readContractorSession } from '@/lib/contractorSession';
import { contractorApi } from '@/lib/contractorClient';
import { fmtDate } from '@/lib/dates';

export default function EstimatesPage() {
  const { t } = useLang();
  const router = useRouter();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!readContractorSession()) { router.replace('/contractor'); return; }
    contractorApi.estimates().then(setList).catch((e) => { setError(e.message); setList([]); });
  }, [router]);
  if (!list) return null;
  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/contractor/invoices" className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">{t('← Invoices')}</Link>
            <h1 className="text-xl font-bold">{t('📄 Estimates')}</h1>
          </div>
          <Link href="/contractor/estimates/new" className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-bold">{t('+ Estimate')}</Link>
        </div>
      </header>
      <div className="max-w-3xl mx-auto p-4 space-y-3">
        <p className="text-sm text-gray-400">{t('Send an estimate to a customer; once accepted, turn it into an invoice with one click.')}</p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {list.length === 0 ? <p className="p-4 text-sm text-gray-500">{t('No estimates yet.')}</p> : (
            <ul className="divide-y divide-gray-700">
              {list.map((e) => (
                <li key={e.estimate_id}>
                  <Link href={`/contractor/estimates/${e.estimate_id}`} className="p-4 flex items-center justify-between gap-3 hover:bg-gray-700/50">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{e.estimate_number} · {e.client_name}</p>
                      <p className="text-sm text-gray-400 truncate">{e.title || '—'} · {fmtDate(e.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">${Number(e.total).toFixed(2)}</p>
                      <EstimatePill estimate={e} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
