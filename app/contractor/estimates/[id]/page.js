'use client';
// One estimate: view, edit (until invoiced), PDF, send, accepted/declined,
// turn into an invoice.
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/app/contractor/components/LangProvider';
import EstimateForm from '@/app/contractor/components/EstimateForm';
import { EstimatePill } from '@/app/contractor/components/EstimatePill';
import { readContractorSession } from '@/lib/contractorSession';
import { contractorApi } from '@/lib/contractorClient';
import { apiFetch } from '@/lib/apiClient';
import { fmtDate } from '@/lib/dates';

const btn = (bg) => `px-4 py-2 rounded-lg font-bold text-sm ${bg} disabled:opacity-50`;

export default function EstimatePage() {
  const { t } = useLang();
  const router = useRouter();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!readContractorSession()) { router.replace('/contractor'); return; }
    contractorApi.estimate(id).then(setData).catch((e) => setMsg({ type: 'error', text: e.message }));
  }, [id, router]);

  async function act(body, okText) {
    setBusy(true); setMsg(null);
    try {
      const r = await contractorApi.estimateAction(id, body);
      setData({ estimate: r.estimate, items: r.items });
      if (r.invoice) { router.push(`/contractor/invoices/${r.invoice.invoice_id}`); return; }
      setEditing(false);
      if (okText) setMsg({ type: 'success', text: okText });
    } catch (e) { setMsg({ type: 'error', text: e.message }); } finally { setBusy(false); }
  }
  async function pdf() {
    try {
      const res = await apiFetch(`/api/contractor/estimates/${id}/pdf`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = `${data.estimate.estimate_number}.pdf`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch (e) { setMsg({ type: 'error', text: e.message }); }
  }
  async function remove() {
    if (!confirm(t('Delete this estimate?'))) return;
    try { await contractorApi.deleteEstimate(id); router.push('/contractor/estimates'); } catch (e) { setMsg({ type: 'error', text: e.message }); }
  }

  if (!data) return <div className="min-h-screen bg-gray-900 text-white p-4">{msg?.text || t('Loading...')}</div>;
  const { estimate: e, items } = data;
  const done = e.status === 'invoiced';

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/contractor/estimates" className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm">{t('← Estimates')}</Link>
            <h1 className="text-xl font-bold">{e.estimate_number}</h1>
          </div>
          <EstimatePill estimate={e} />
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {msg && <p className={`text-sm ${msg.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>{msg.text}</p>}

        {editing ? (
          <EstimateForm initial={e} items={items} saving={busy} submitLabel={t('Save')} onSave={(body) => act({ action: 'edit', ...body }, t('Saved'))} />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {!done && e.client_email && <button disabled={busy} onClick={() => confirm(t('Send the estimate to {email}?', { email: e.client_email })) && act({ action: 'send' }, t('Sent to {email}', { email: e.client_email }))} className={btn('bg-blue-600 hover:bg-blue-700')}>{e.sent_at ? t('📧 Send again') : t('📧 Send')}</button>}
              {!done && !e.sent_at && <button disabled={busy} onClick={() => act({ action: 'sent' })} className={btn('bg-gray-700 hover:bg-gray-600')}>{t('📤 Mark as Sent')}</button>}
              <button onClick={pdf} className={btn('bg-gray-700 hover:bg-gray-600')}>{t('📄 PDF')}</button>
              {!done && e.status !== 'accepted' && <button disabled={busy} onClick={() => act({ action: 'accepted' })} className={btn('bg-green-700 hover:bg-green-600')}>{t('✅ Accepted')}</button>}
              {!done && e.status !== 'declined' && <button disabled={busy} onClick={() => act({ action: 'declined' })} className={btn('bg-gray-700 hover:bg-gray-600')}>{t('✕ Declined')}</button>}
              {!done && ['accepted', 'declined'].includes(e.status) && <button disabled={busy} onClick={() => act({ action: 'reopen' })} className={btn('bg-gray-700 hover:bg-gray-600')}>{t('↩ Reopen')}</button>}
              {!done && e.status !== 'declined' && <button disabled={busy} onClick={() => act({ action: 'invoice' })} className={btn('bg-green-600 hover:bg-green-700')}>{t('🧾 Create invoice')}</button>}
              {done && e.invoice_id && <Link href={`/contractor/invoices/${e.invoice_id}`} className={btn('bg-green-600 hover:bg-green-700')}>{t('🧾 Open invoice')}</Link>}
              {!done && <button onClick={() => setEditing(true)} className={btn('bg-gray-700 hover:bg-gray-600')}>{t('✏️ Edit')}</button>}
              {!done && <button onClick={remove} className={btn('bg-red-700 hover:bg-red-600')}>{t('🗑️ Delete')}</button>}
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 p-4 space-y-1">
              <p className="font-bold">{e.client_name}</p>
              <p className="text-sm text-gray-400">{[e.client_address, e.client_city, [e.client_state, e.client_zip].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</p>
              {e.client_email && <p className="text-sm text-gray-400">{e.client_email}</p>}
              <p className="text-sm text-gray-400 pt-2">
                {e.title ? `${e.title} · ` : ''}{t('Created {date}', { date: fmtDate(e.created_at) })}
                {e.valid_until ? ` · ${t('valid until {date}', { date: fmtDate(e.valid_until + 'T12:00:00') })}` : ''}
                {e.sent_at ? ` · ${t('sent {date}', { date: fmtDate(e.sent_at) })}` : ''}
              </p>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <ul className="divide-y divide-gray-700">
                {items.map((i) => (
                  <li key={i.item_id} className="p-3 flex justify-between gap-3 text-sm">
                    <span>{i.description} <span className="text-gray-500">· {Number(i.quantity)} × ${Number(i.rate).toFixed(2)}</span></span>
                    <span className="font-medium">${Number(i.amount).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
              <p className="p-4 text-right text-xl font-bold border-t border-gray-700">{t('Total')}: <span className="text-green-400">${Number(e.total).toFixed(2)}</span></p>
            </div>
            {e.notes && <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-800 rounded-xl border border-gray-700 p-4">{e.notes}</p>}
          </>
        )}
      </div>
    </div>
  );
}
