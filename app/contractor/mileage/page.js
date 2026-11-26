'use client';
// Mileage log for the tax year: miles EMF logged on the sub's work orders
// (already reimbursed on EMF invoices) plus trips he logs himself, each valued
// at the IRS business rate of its date (lib/irsMileage). A summary for the tax
// preparer — not tax advice.
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/app/contractor/components/LangProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { readContractorSession } from '@/lib/contractorSession';
import { contractorApi } from '@/lib/contractorClient';
import { irsRateOn, irsRatesForYear } from '@/lib/irsMileage';
import { fmtDate, dateKeyET } from '@/lib/dates';

const input = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2';

export default function MileagePage() {
  const { t } = useLang();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [year, setYear] = useState(Number(dateKeyET().slice(0, 4)));
  const [trips, setTrips] = useState([]);
  const [emf, setEmf] = useState([]);
  const [form, setForm] = useState({ trip_date: dateKeyET(), miles: '', purpose: '', from_place: '', to_place: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!readContractorSession()) { router.replace('/contractor'); return; }
    setReady(true);
  }, [router]);

  async function load() {
    try {
      const d = await contractorApi.trips(year);
      setTrips(d.trips || []);
      setEmf(d.emf || []);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { if (ready) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ready, year]);

  const sum = useMemo(() => {
    const value = (rows, dateKey) => rows.reduce((s, r) => s + (parseFloat(r.miles) || 0) * (irsRateOn(r[dateKey]) || 0), 0);
    const emfMiles = emf.reduce((s, r) => s + r.miles, 0);
    const ownMiles = trips.reduce((s, r) => s + (parseFloat(r.miles) || 0), 0);
    const missingRate = [...emf.map(r => r.work_date), ...trips.map(r => r.trip_date)].some(d => irsRateOn(d) == null);
    return { emfMiles, ownMiles, emfValue: value(emf, 'work_date'), ownValue: value(trips, 'trip_date'), missingRate };
  }, [emf, trips]);

  async function add(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await contractorApi.addTrip(form);
      setForm({ ...form, miles: '', purpose: '', from_place: '', to_place: '' });
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  async function remove(id) {
    if (!confirm(t('Delete this trip?'))) return;
    try { await contractorApi.deleteTrip(id); await load(); } catch (err) { setError(err.message); }
  }

  if (!ready) return null;
  const rates = irsRatesForYear(year);
  const years = []; for (let y = Number(dateKeyET().slice(0, 4)); y >= 2024; y--) years.push(y);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/contractor/tax-report" className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">{t('← Taxes')}</Link>
            <h1 className="text-xl font-bold">{t('🚗 Mileage Log')}</h1>
          </div>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-sm text-gray-400">{t('EMF work orders')}</p>
            <p className="text-2xl font-bold">{sum.emfMiles.toFixed(0)} mi</p>
            <p className="text-xs text-gray-500">{t('≈ {amount} at IRS rate · reimbursed on your EMF invoices', { amount: '$' + sum.emfValue.toFixed(2) })}</p>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-sm text-gray-400">{t('Your own trips')}</p>
            <p className="text-2xl font-bold">{sum.ownMiles.toFixed(0)} mi</p>
            <p className="text-xs text-gray-500">{t('≈ {amount} at IRS rate', { amount: '$' + sum.ownValue.toFixed(2) })}</p>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="text-sm text-gray-400">{t('IRS business rate {year}', { year })}</p>
            <p className="text-lg font-bold">{rates.length ? rates.map(r => `${(r.rate * 100).toFixed(1).replace('.0', '')}¢`).join(' / ') : t('not on file')}</p>
            <p className="text-xs text-gray-500">{rates.length > 1 ? rates.map(r => t('{rate} from {date}', { rate: `${(r.rate * 100).toFixed(1).replace('.0', '')}¢`, date: fmtDate(r.from) })).join(' · ') : ''}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          {t("A summary for your tax preparer, not tax advice. Commuting (home to your regular workplace) is not deductible; standard mileage and actual vehicle expenses can't both be claimed.")}
          {sum.missingRate && t(' Some dates have no IRS rate on file yet — those count as $0.')}
        </p>

        <form onSubmit={add} className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-3">
          <h2 className="font-bold">{t('➕ Log a trip')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className={input} value={form.trip_date} onChange={e => setForm({ ...form, trip_date: e.target.value })} />
            <input inputMode="decimal" className={input} placeholder={t('Miles')} value={form.miles} onChange={e => setForm({ ...form, miles: e.target.value })} />
          </div>
          <input className={input} placeholder={t('Purpose (e.g. parts run for job at Acme)')} value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className={input} placeholder={t('From (optional)')} value={form.from_place} onChange={e => setForm({ ...form, from_place: e.target.value })} />
            <input className={input} placeholder={t('To (optional)')} value={form.to_place} onChange={e => setForm({ ...form, to_place: e.target.value })} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button disabled={busy} className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-lg font-bold disabled:opacity-50">{busy ? t('Saving…') : t('Add trip')}</button>
        </form>

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <h2 className="font-bold p-4 border-b border-gray-700">{t('Your trips {year}', { year })}</h2>
          {trips.length === 0 ? <p className="p-4 text-sm text-gray-500">{t('No trips logged.')}</p> : (
            <ul className="divide-y divide-gray-700">
              {trips.map(trip => (
                <li key={trip.trip_id} className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{fmtDate(trip.trip_date)} · {parseFloat(trip.miles).toFixed(1)} mi</p>
                    <p className="text-sm text-gray-400">{trip.purpose}{trip.from_place || trip.to_place ? ` — ${trip.from_place || '?'} → ${trip.to_place || '?'}` : ''}</p>
                  </div>
                  <button onClick={() => remove(trip.trip_id)} className="text-red-400 hover:text-red-300 text-sm">{t('Delete')}</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <h2 className="font-bold p-4 border-b border-gray-700">{t('Miles on EMF work orders {year}', { year })}</h2>
          {emf.length === 0 ? <p className="p-4 text-sm text-gray-500">{t('None.')}</p> : (
            <ul className="divide-y divide-gray-700 max-h-80 overflow-y-auto">
              {emf.map((r, i) => (
                <li key={i} className="px-4 py-2 flex justify-between text-sm">
                  <span>{fmtDate(r.work_date)} · {r.wo_number || 'WO'}</span>
                  <span className="text-gray-300">{r.miles.toFixed(1)} mi</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
