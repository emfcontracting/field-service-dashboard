'use client';
// Customer, title, validity, lines and notes of an estimate — for New and Edit.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from './LangProvider';
import { contractorApi } from '@/lib/contractorClient';

const input = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2';
const blankClient = { name: '', address: '', city: '', state: '', zip: '', email: '' };

export default function EstimateForm({ initial, items, onSave, saving, submitLabel }) {
  const { t } = useLang();
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState(initial?.customer_id || '');
  const [client, setClient] = useState(initial ? {
    name: initial.client_name || '', address: initial.client_address || '', city: initial.client_city || '',
    state: initial.client_state || '', zip: initial.client_zip || '', email: initial.client_email || '',
  } : blankClient);
  const [title, setTitle] = useState(initial?.title || '');
  const [validUntil, setValidUntil] = useState(initial?.valid_until || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [lines, setLines] = useState((items?.length ? items : [{ description: '', quantity: 1, rate: '' }])
    .map((l, i) => ({ key: i + 1, description: l.description, quantity: String(l.quantity ?? 1), rate: String(l.rate ?? '') })));

  useEffect(() => {
    contractorApi.customers().then((list) => {
      setCustomers(list);
      const q = new URLSearchParams(window.location.search).get('customer');
      if (!initial && q) pick(q, list);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  function pick(id, list = customers) {
    setCustomerId(id);
    const c = list.find((x) => x.customer_id === id);
    setClient(c ? { name: c.name || '', address: c.address || '', city: c.city || '', state: c.state || '', zip: c.zip || '', email: c.email || '' } : blankClient);
  }
  const setLine = (key, k, v) => setLines(lines.map((l) => (l.key === key ? { ...l, [k]: v } : l)));
  const total = lines.reduce((s, l) => s + (parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0), 0);

  function submit(e) {
    e.preventDefault();
    onSave({
      customer_id: customerId || undefined, client, title, notes, valid_until: validUntil,
      line_items: lines.map((l) => ({ description: l.description, quantity: parseFloat(l.quantity) || 1, rate: parseFloat(l.rate) || 0 })),
    });
  }
  const c = (k) => ({ value: client[k], onChange: (e) => setClient({ ...client, [k]: e.target.value }) });

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="font-bold">{t('👤 Customer')}</h2>
          <Link href="/contractor/customers" className="text-xs text-blue-400">{t('Manage')}</Link>
        </div>
        <select className={input} value={customerId} onChange={(e) => pick(e.target.value)}>
          <option value="">{t('— New customer —')}</option>
          {customers.map((x) => <option key={x.customer_id} value={x.customer_id}>{x.name}</option>)}
        </select>
        <input className={input} placeholder={t('Client/Company Name *')} {...c('name')} />
        <input className={input} placeholder={t('Street Address')} {...c('address')} />
        <div className="grid grid-cols-3 gap-3">
          <input className={input} placeholder={t('City')} {...c('city')} />
          <input className={input} placeholder={t('State')} {...c('state')} />
          <input className={input} placeholder={t('ZIP')} {...c('zip')} />
        </div>
        <input type="email" className={input} placeholder={t('Email')} {...c('email')} />
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
        <input className={input} placeholder={t('Job / title (e.g. Panel upgrade, 2nd floor)')} value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="block text-sm text-gray-400">{t('Valid until')}
          <input type="date" className={input} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
        </label>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
        <h2 className="font-bold">{t('📋 Lines')}</h2>
        {lines.map((l) => (
          <div key={l.key} className="grid grid-cols-12 gap-2 items-center">
            <input className={`${input} col-span-12 sm:col-span-6`} placeholder={t('Description')} value={l.description} onChange={(e) => setLine(l.key, 'description', e.target.value)} />
            <input inputMode="decimal" className={`${input} col-span-3 sm:col-span-2`} placeholder={t('Qty')} value={l.quantity} onChange={(e) => setLine(l.key, 'quantity', e.target.value.replace(/[^\d.]/g, ''))} />
            <input inputMode="decimal" className={`${input} col-span-4 sm:col-span-2`} placeholder={t('Rate')} value={l.rate} onChange={(e) => setLine(l.key, 'rate', e.target.value.replace(/[^\d.]/g, ''))} />
            <span className="col-span-4 sm:col-span-1 text-right text-sm">${((parseFloat(l.quantity) || 0) * (parseFloat(l.rate) || 0)).toFixed(2)}</span>
            <button type="button" onClick={() => setLines(lines.filter((x) => x.key !== l.key))} className="col-span-1 text-red-400" title={t('Remove')}>✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setLines([...lines, { key: Date.now(), description: '', quantity: '1', rate: '' }])} className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">{t('+ Add Item')}</button>
        <p className="text-right text-xl font-bold">{t('Total')}: <span className="text-green-400">${total.toFixed(2)}</span></p>
      </div>

      <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
        <textarea className={input} rows={3} placeholder={t('Notes / terms (e.g. 50% deposit, materials may change)')} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button disabled={saving} className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-bold disabled:opacity-50">{saving ? t('Saving...') : submitLabel}</button>
    </form>
  );
}
