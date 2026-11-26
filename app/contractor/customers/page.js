'use client';
// Saved customers (other clients than EMF): pick them on a new invoice,
// estimate or timer instead of typing the address again. A customer that is
// already on invoices, estimates or time entries is archived, not deleted.
import { useEffect, useState } from 'react';
import { useLang } from '@/app/contractor/components/LangProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { readContractorSession } from '@/lib/contractorSession';
import { contractorApi } from '@/lib/contractorClient';

const input = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2';
const EMPTY = { name: '', address: '', city: '', state: '', zip: '', email: '', phone: '', hourly_rate: '', notes: '' };

export default function CustomersPage() {
  const { t } = useLang();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [list, setList] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState(null);      // null = closed, {…} = add/edit
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!readContractorSession()) { router.replace('/contractor'); return; }
    setReady(true);
  }, [router]);
  async function load() {
    try { setList(await contractorApi.customers(true)); } catch (e) { setError(e.message); }
  }
  useEffect(() => { if (ready) load(); }, [ready]);

  async function save(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const { customer_id, user_id, created_at, updated_at, archived, ...fields } = form;
      if (customer_id) await contractorApi.updateCustomer(customer_id, fields);
      else await contractorApi.addCustomer(fields);
      setForm(null); await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  async function remove(c) {
    if (!confirm(t('Remove {name}?', { name: c.name }))) return;
    try {
      const r = await contractorApi.deleteCustomer(c.customer_id);
      if (r.archived) alert(t('{name} is on invoices or time entries — archived instead of deleted.', { name: c.name }));
      setForm(null); await load();
    } catch (err) { setError(err.message); }
  }
  async function restore(c) {
    try { await contractorApi.updateCustomer(c.customer_id, { archived: false }); await load(); } catch (err) { setError(err.message); }
  }

  if (!ready) return null;
  const shown = list.filter(c => showArchived || !c.archived);
  const f = (k) => ({ value: form?.[k] ?? '', onChange: (e) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/contractor/invoices" className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">{t('← Invoices')}</Link>
            <h1 className="text-xl font-bold">{t('👥 Customers')}</h1>
          </div>
          {!form && <button onClick={() => setForm({ ...EMPTY })} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-bold">{t('+ Customer')}</button>}
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <p className="text-sm text-gray-400">{t('Your clients other than EMF. Pick them on invoices, estimates and the timer.')}</p>
        {error && <p className="text-sm text-red-400">{error}</p>}

        {form && (
          <form onSubmit={save} className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
            <h2 className="font-bold">{form.customer_id ? t('Edit customer') : t('New customer')}</h2>
            <input className={input} placeholder={t('Client/Company Name *')} {...f('name')} />
            <input className={input} placeholder={t('Street Address')} {...f('address')} />
            <div className="grid grid-cols-3 gap-3">
              <input className={input} placeholder={t('City')} {...f('city')} />
              <input className={input} placeholder={t('State')} {...f('state')} />
              <input className={input} placeholder={t('ZIP')} {...f('zip')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input type="email" className={input} placeholder={t('Email')} {...f('email')} />
              <input type="tel" className={input} placeholder={t('Phone')} {...f('phone')} />
            </div>
            <div>
              <input inputMode="decimal" className={input} placeholder={t('Hourly rate for this customer (optional)')} {...f('hourly_rate')} />
              <p className="text-xs text-gray-500 mt-1">{t('Used by the timer. Empty = your normal hourly rate.')}</p>
            </div>
            <textarea className={input} rows={2} placeholder={t('Notes')} {...f('notes')} />
            <div className="flex gap-2 flex-wrap">
              <button disabled={busy} className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold disabled:opacity-50">{busy ? t('Saving...') : t('Save')}</button>
              <button type="button" onClick={() => setForm(null)} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg">{t('Cancel')}</button>
              {form.customer_id && <button type="button" onClick={() => remove(form)} className="px-4 py-2 bg-red-700 hover:bg-red-600 rounded-lg ml-auto">{t('Delete')}</button>}
            </div>
          </form>
        )}

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {shown.length === 0 ? <p className="p-4 text-sm text-gray-500">{t('No customers yet.')}</p> : (
            <ul className="divide-y divide-gray-700">
              {shown.map(c => (
                <li key={c.customer_id} className={`p-4 flex items-center justify-between gap-3 ${c.archived ? 'opacity-60' : ''}`}>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.name}{c.archived ? ` · ${t('archived')}` : ''}</p>
                    <p className="text-sm text-gray-400 truncate">{[c.address, c.city, c.state].filter(Boolean).join(', ') || c.email || '—'}</p>
                    {c.hourly_rate != null && <p className="text-xs text-gray-500">${Number(c.hourly_rate).toFixed(2)}/h</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {c.archived
                      ? <button onClick={() => restore(c)} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">{t('Restore')}</button>
                      : <>
                          <Link href={`/contractor/invoices/new?customer=${c.customer_id}`} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">{t('Invoice')}</Link>
                          <button onClick={() => setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ''])) })} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">{t('Edit')}</button>
                        </>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {list.some(c => c.archived) && (
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> {t('Show archived')}
          </label>
        )}
      </div>
    </div>
  );
}
