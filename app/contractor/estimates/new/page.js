'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/app/contractor/components/LangProvider';
import EstimateForm from '@/app/contractor/components/EstimateForm';
import { readContractorSession } from '@/lib/contractorSession';
import { contractorApi } from '@/lib/contractorClient';

export default function NewEstimatePage() {
  const { t } = useLang();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!readContractorSession()) { router.replace('/contractor'); return; }
    setReady(true);
  }, [router]);
  async function save(body) {
    setSaving(true); setError('');
    try { const est = await contractorApi.createEstimate(body); router.push(`/contractor/estimates/${est.estimate_id}`); }
    catch (e) { setError(e.message); setSaving(false); }
  }
  if (!ready) return null;
  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/contractor/estimates" className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">{t('← Cancel')}</Link>
          <h1 className="text-xl font-bold">{t('📝 New estimate')}</h1>
        </div>
      </header>
      <div className="max-w-3xl mx-auto p-4">
        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
        <EstimateForm onSave={save} saving={saving} submitLabel={t('Save estimate')} />
      </div>
    </div>
  );
}
