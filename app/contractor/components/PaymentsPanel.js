'use client';
// Payments received on one invoice — the sub's own record, part payments too.
// Shown on sent and paid invoices. Full amount reached → invoice is "Paid".
import { useState } from 'react';
import { useLang } from './LangProvider';
import { contractorApi } from '@/lib/contractorClient';
import { fmtDate, dateKeyET } from '@/lib/dates';

const money = (v) => '$' + (Number(v) || 0).toFixed(2);
const METHODS = ['check', 'zelle', 'ach', 'cash', 'card', 'other'];
const METHOD_LABEL = { check: 'Check', zelle: 'Zelle', ach: 'Bank transfer (ACH)', cash: 'Cash', card: 'Card', other: 'Other' };
const box = { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px', padding: '16px', marginBottom: '24px' };
const input = { width: '100%', backgroundColor: '#374151', border: '1px solid #4b5563', borderRadius: '8px', padding: '8px 10px', color: 'white' };

export default function PaymentsPanel({ invoice, onChange }) {
  const { t } = useLang();
  const pays = invoice?.payments || [];
  const total = Number(invoice?.grand_total) || 0;
  const paid = Number(invoice?.amount_paid) || 0;
  const open = Math.max(0, Math.round((total - paid) * 100) / 100);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!invoice || invoice.status === 'draft') return null;

  async function save() {
    setBusy(true); setErr('');
    try { onChange(await contractorApi.addPayment(invoice.invoice_id, form)); setForm(null); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }
  async function remove(p) {
    if (!confirm(t('Delete this payment?'))) return;
    setBusy(true); setErr('');
    try { onChange(await contractorApi.deletePayment(invoice.invoice_id, p.payment_id)); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="no-print" style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{t('💵 Payments received')}</p>
          <p style={{ color: '#9ca3af', fontSize: '13px', margin: '4px 0 0' }}>
            {t('{paid} of {total} received · {open} open', { paid: money(paid), total: money(total), open: money(open) })}
          </p>
        </div>
        {open > 0 && !form && (
          <button onClick={() => setForm({ amount: open.toFixed(2), paid_on: dateKeyET(), method: 'check', reference: '' })}
            style={{ padding: '8px 14px', backgroundColor: '#059669', borderRadius: '8px', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
            {t('+ Record payment')}
          </button>
        )}
      </div>

      {pays.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0' }}>
          {pays.map((p) => (
            <li key={p.payment_id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '6px 0', borderTop: '1px solid #374151', fontSize: '14px' }}>
              <span>
                {fmtDate(p.paid_on + 'T12:00:00')} · <strong>{money(p.amount)}</strong>
                {p.method ? ` · ${t(METHOD_LABEL[p.method] || p.method)}` : ''}{p.reference ? ` #${p.reference}` : ''}
                {p.auto ? <span style={{ color: '#6b7280' }}> · {t('marked paid')}</span> : null}
              </span>
              <button onClick={() => remove(p)} disabled={busy} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }} title={t('Delete')}>✕</button>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginTop: '12px' }}>
          <label style={{ fontSize: '12px', color: '#9ca3af' }}>{t('Amount')}
            <input inputMode="decimal" style={input} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, '') })} />
          </label>
          <label style={{ fontSize: '12px', color: '#9ca3af' }}>{t('Date received')}
            <input type="date" style={input} value={form.paid_on} max={dateKeyET()} onChange={(e) => setForm({ ...form, paid_on: e.target.value })} />
          </label>
          <label style={{ fontSize: '12px', color: '#9ca3af' }}>{t('Method')}
            <select style={input} value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              {METHODS.map((m) => <option key={m} value={m}>{t(METHOD_LABEL[m])}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '12px', color: '#9ca3af' }}>{t('Reference (check no., …)')}
            <input style={input} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
          </label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'end' }}>
            <button onClick={save} disabled={busy} style={{ padding: '8px 14px', backgroundColor: '#059669', borderRadius: '8px', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
              {busy ? t('Saving...') : t('Save')}
            </button>
            <button onClick={() => setForm(null)} style={{ padding: '8px 14px', backgroundColor: '#374151', borderRadius: '8px', color: 'white', border: 'none', cursor: 'pointer' }}>{t('Cancel')}</button>
          </div>
        </div>
      )}
      {err && <p style={{ color: '#f87171', fontSize: '13px', marginTop: '8px' }}>{err}</p>}
    </div>
  );
}
