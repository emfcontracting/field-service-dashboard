'use client';
// Time tracking for customers other than EMF (EMF hours come from the hours
// log). Start/stop timer or log time by hand; unbilled time per customer goes
// onto an invoice with one click (New Invoice picks it up).
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/app/contractor/components/LangProvider';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { readContractorSession } from '@/lib/contractorSession';
import { contractorApi } from '@/lib/contractorClient';
import { fmtDate, fmtTime, dateKeyET } from '@/lib/dates';

const input = 'w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2';
const hrs = (min) => (Math.round((min / 60) * 100) / 100).toFixed(2);
const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function TimePage() {
  const { t } = useLang();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [open, setOpen] = useState([]);     // all unbilled, any age
  const [running, setRunning] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [pick, setPick] = useState('');
  const [desc, setDesc] = useState('');
  const [manual, setManual] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!readContractorSession()) { router.replace('/contractor'); return; }
    setReady(true);
  }, [router]);
  async function load() {
    try {
      const [cs, d, ub] = await Promise.all([contractorApi.customers(), contractorApi.time({ days: 90 }), contractorApi.time({ unbilled: 1 })]);
      setCustomers(cs);
      setEntries(d.entries || []);
      setOpen(ub.entries || []);
      setRunning(d.running);
      if (d.running) { setPick(d.running.customer_id); setDesc(d.running.description || ''); }
      else if (!pick && cs.length) setPick(cs[0].customer_id);
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { if (ready) load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [ready]);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  async function act(body) {
    setBusy(true); setError('');
    try {
      const r = await contractorApi.timeAction(body);
      if (r.capped) alert(t('The timer ran more than 24 hours — saved as 24 h. Please correct it.'));
      if (body.action === 'stop' || body.action === 'manual') setDesc('');
      setManual(null);
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function saveEdit() {
    setBusy(true); setError('');
    try {
      await contractorApi.updateTime(edit.entry_id, { description: edit.description, minutes: Math.round(parseFloat(edit.hours) * 60), rate: edit.rate });
      setEdit(null); await load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function remove(e) {
    if (!confirm(t('Delete this time entry?'))) return;
    try { await contractorApi.deleteTime(e.entry_id); setEdit(null); await load(); } catch (err) { setError(err.message); }
  }

  const unbilled = useMemo(() => {
    const by = {};
    for (const e of open) {
      const k = e.customer_id;
      by[k] ||= { customer_id: k, name: e.customer?.name || '?', minutes: 0, amount: 0, n: 0 };
      by[k].minutes += e.minutes || 0;
      by[k].amount += ((e.minutes || 0) / 60) * (Number(e.rate) || 0);
      by[k].n += 1;
    }
    return Object.values(by);
  }, [open]);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/contractor/dashboard" className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">{t('← Back')}</Link>
            <h1 className="text-xl font-bold">{t('⏱️ Time tracking')}</h1>
          </div>
          <Link href="/contractor/customers" className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">{t('👥 Customers')}</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        <p className="text-sm text-gray-400">{t('For your other customers. Hours for EMF come from the work orders as before.')}</p>
        {error && <p className="text-sm text-red-400">{error}</p>}

        {customers.length === 0 && !running ? (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
            <p className="mb-3">{t('Add a customer first, then start the timer for them.')}</p>
            <Link href="/contractor/customers" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-bold">{t('+ Customer')}</Link>
          </div>
        ) : (
          <div className={`rounded-xl border p-4 space-y-3 ${running ? 'bg-green-900/30 border-green-700' : 'bg-gray-800 border-gray-700'}`}>
            <select className={input} value={pick} disabled={!!running} onChange={e => setPick(e.target.value)}>
              {customers.map(c => <option key={c.customer_id} value={c.customer_id}>{c.name}</option>)}
              {running && !customers.some(c => c.customer_id === running.customer_id) && <option value={running.customer_id}>{running.customer?.name}</option>}
            </select>
            <input className={input} placeholder={t('What are you working on? (optional)')} value={desc} onChange={e => setDesc(e.target.value)} />
            {running ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-3xl font-mono font-bold">{clock(now - new Date(running.started_at).getTime())}</p>
                  <p className="text-xs text-gray-400">{t('since {time}', { time: fmtTime(running.started_at) })}</p>
                </div>
                <button disabled={busy} onClick={() => act({ action: 'stop', description: desc })} className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg font-bold text-lg disabled:opacity-50">{t('■ Stop')}</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button disabled={busy || !pick} onClick={() => act({ action: 'start', customer_id: pick, description: desc })} className="flex-1 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-bold text-lg disabled:opacity-50">{t('▶ Start')}</button>
                <button onClick={() => setManual({ date: dateKeyET(), hours: '', rate: '' })} className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg">{t('+ By hand')}</button>
              </div>
            )}
            {manual && (
              <div className="grid grid-cols-3 gap-2">
                <input type="date" className={input} value={manual.date} max={dateKeyET()} onChange={e => setManual({ ...manual, date: e.target.value })} />
                <input inputMode="decimal" className={input} placeholder={t('Hours')} value={manual.hours} onChange={e => setManual({ ...manual, hours: e.target.value.replace(/[^\d.]/g, '') })} />
                <button disabled={busy} onClick={() => act({ action: 'manual', customer_id: pick, date: manual.date, minutes: Math.round((parseFloat(manual.hours) || 0) * 60), description: desc })} className="bg-green-600 hover:bg-green-700 rounded-lg font-bold disabled:opacity-50">{t('Save')}</button>
              </div>
            )}
          </div>
        )}

        {unbilled.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-2">
            <h2 className="font-bold">{t('Not invoiced yet')}</h2>
            {unbilled.map(u => (
              <div key={u.customer_id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{u.name}</p>
                  <p className="text-sm text-gray-400">{t('{h} h · {n} entries · ≈ {amount}', { h: hrs(u.minutes), n: u.n, amount: '$' + u.amount.toFixed(2) })}</p>
                </div>
                <Link href={`/contractor/invoices/new?customer=${u.customer_id}&time=1`} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-bold">{t('Invoice')}</Link>
              </div>
            ))}
          </div>
        )}

        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <h2 className="font-bold p-4 border-b border-gray-700">{t('Last 90 days')}</h2>
          {entries.length === 0 ? <p className="p-4 text-sm text-gray-500">{t('No time logged.')}</p> : (
            <ul className="divide-y divide-gray-700">
              {entries.map(e => (
                <li key={e.entry_id} className="p-4">
                  {edit?.entry_id === e.entry_id ? (
                    <div className="space-y-2">
                      <input className={input} value={edit.description} placeholder={t('Description')} onChange={ev => setEdit({ ...edit, description: ev.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-xs text-gray-400">{t('Hours')}<input inputMode="decimal" className={input} value={edit.hours} onChange={ev => setEdit({ ...edit, hours: ev.target.value.replace(/[^\d.]/g, '') })} /></label>
                        <label className="text-xs text-gray-400">{t('Rate')}<input inputMode="decimal" className={input} value={edit.rate} onChange={ev => setEdit({ ...edit, rate: ev.target.value.replace(/[^\d.]/g, '') })} /></label>
                      </div>
                      <div className="flex gap-2">
                        <button disabled={busy} onClick={saveEdit} className="px-4 py-2 bg-green-600 rounded-lg font-bold">{t('Save')}</button>
                        <button onClick={() => setEdit(null)} className="px-4 py-2 bg-gray-700 rounded-lg">{t('Cancel')}</button>
                        <button onClick={() => remove(e)} className="px-4 py-2 bg-red-700 rounded-lg ml-auto">{t('Delete')}</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{fmtDate(e.started_at)} · {hrs(e.minutes || 0)} h · {e.customer?.name}</p>
                        <p className="text-sm text-gray-400 truncate">{e.description || '—'}{e.rate != null ? ` · $${Number(e.rate).toFixed(2)}/h` : ''}</p>
                      </div>
                      {e.invoice_id
                        ? <Link href={`/contractor/invoices/${e.invoice_id}`} className="text-xs text-green-400 shrink-0">{t('invoiced')}</Link>
                        : <button onClick={() => setEdit({ entry_id: e.entry_id, description: e.description || '', hours: hrs(e.minutes || 0), rate: e.rate ?? '' })} className="text-sm text-blue-400 shrink-0">{t('Edit')}</button>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
