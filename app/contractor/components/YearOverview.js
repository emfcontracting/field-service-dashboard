'use client';
// Year overview on the Taxes page: what came in (by client), what is still
// open, how fast EMF pays, what EMF should report on the 1099-NEC, business
// expenses and mileage, and a rough self-employment tax estimate with the
// 1040-ES due dates. Planning numbers only — not tax advice.
import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/app/contractor/components/LangProvider';
import { apiFetch } from '@/lib/apiClient';
import { contractorApi } from '@/lib/contractorClient';
import { parseDate, fmtDate, fmtDateShort, daysBetweenET } from '@/lib/dates';
import { NEC_THRESHOLD, ESTIMATED_TAX_DUE } from '@/lib/taxEstimate';
import { yearFigures } from '@/lib/taxYear';

const money = (v) => '$' + (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const card = { backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '12px', padding: '16px' };
const muted = { color: '#9ca3af', fontSize: '12px' };

export default function YearOverview({ user, year }) {
  const { t } = useLang();
  const [invoices, setInvoices] = useState([]);
  const [records, setRecords] = useState([]);
  const [trips, setTrips] = useState({ trips: [], emf: [] });
  const [error, setError] = useState('');
  const [vehicle, setVehicle] = useState('standard');
  const [setAside, setSetAside] = useState('');

  const [setAsideLoaded, setSetAsideLoaded] = useState(false);
  useEffect(() => {
    let v = '';
    try { v = localStorage.getItem('pcs-tax-setaside') || ''; } catch { /* ignore */ }
    if (!v && user?.profile?.tax_set_aside_pct != null) v = String(user.profile.tax_set_aside_pct);
    setSetAside(v); setSetAsideLoaded(true);
  }, [user]);
  useEffect(() => {
    if (!setAsideLoaded) return;
    try { localStorage.setItem('pcs-tax-setaside', setAside); } catch { /* ignore */ }
    // On the profile too: the 1040-ES reminder uses the same %.
    const id = setTimeout(() => {
      const pct = setAside === '' ? null : Math.min(60, Math.max(0, parseFloat(setAside) || 0));
      if (pct !== (user?.profile?.tax_set_aside_pct ?? null)) contractorApi.updateProfile({ tax_set_aside_pct: pct }).catch(() => {});
    }, 1200);
    return () => clearTimeout(id);
  }, [setAside, setAsideLoaded]);

  useEffect(() => {
    if (!user) return;
    setError('');
    // Each source on its own: one failing (e.g. a table whose migration has
    // not run yet) must not blank out the others.
    Promise.allSettled([
      contractorApi.invoices(),
      apiFetch(`/api/contractor/tax-records?user_id=${user.user_id}&year=${year}&sync=1`).then(async r => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
        return d;
      }),
      contractorApi.trips(year),
    ]).then(([inv, rec, tr]) => {
      const errs = [];
      if (inv.status === 'fulfilled') setInvoices(inv.value.invoices || []); else errs.push(`Invoices: ${inv.reason?.message}`);
      if (rec.status === 'fulfilled') setRecords(rec.value.records || []); else { setRecords([]); errs.push(`${t('Expenses')}: ${rec.reason?.message}`); }
      if (tr.status === 'fulfilled') setTrips(tr.value || { trips: [], emf: [] }); else { setTrips({ trips: [], emf: [] }); errs.push(`${t('Mileage')}: ${tr.reason?.message}`); }
      setError(errs.join(' · '));
    });
  }, [user, year]);

  const o = useMemo(() => yearFigures({ invoices, records, trips, year, vehicle, setAsidePct: setAside }),
    [invoices, records, trips, year, vehicle, setAside]);

  const due = ESTIMATED_TAX_DUE[year] || null;
  const quarterly = o.quarterly;
  const threshold = NEC_THRESHOLD(year);

  async function downloadPackage() {
    try {
      const res = await apiFetch('/api/contractor/tax-export', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id, year, format: 'master-xlsx' }),
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || `TaxPackage_${year}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError(t('Download failed: ') + e.message); }
  }

  return (
    <div className="no-print" style={{ display: 'grid', gap: '16px', marginBottom: '24px' }}>
      {error && <p style={{ color: '#f87171', fontSize: '14px' }}>{error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <div style={card}>
          <p style={muted}>{t('Income {year} (by date paid)', { year })}</p>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }}>{money(o.income)}</p>
          {Object.entries(o.byClient).map(([k, v]) => <p key={k} style={muted}>{k}: {money(v)}</p>)}
        </div>
        <div style={card}>
          <p style={muted}>{t('Waiting for payment')}</p>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0', color: '#facc15' }}>{money(o.openTotal)}</p>
          <p style={muted}>{t(o.openCount === 1 ? '{n} invoice' : '{n} invoices', { n: o.openCount })}{o.avgDays != null ? ' · ' + t('paid on average {days} days after sending', { days: o.avgDays }) : ''}</p>
        </div>
        <div style={card}>
          <p style={muted}>{t('EMF payments recorded {year} (1099-NEC)', { year })}</p>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '4px 0' }}>{money(o.emf1099)}</p>
          <p style={muted}>
            {t('What EMF marked as paid. EMF issues a 1099-NEC when it pays you {amount} or more in {year}. Compare with the 1099 you receive.', { amount: money(threshold), year })}
          </p>
        </div>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <p style={{ fontWeight: 'bold', margin: 0 }}>{t('Estimate {year} — for planning, not tax advice', { year })}</p>
          <button onClick={downloadPackage} style={{ padding: '8px 14px', backgroundColor: '#059669', borderRadius: '8px', color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
            {t('📦 Download tax package (Excel)')}
          </button>
        </div>
        <table style={{ width: '100%', fontSize: '14px', marginTop: '12px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td style={{ padding: '4px 0' }}>{t('Income (marked paid)')}</td><td style={{ textAlign: 'right' }}>{money(o.income)}</td></tr>
            <tr><td style={{ padding: '4px 0' }}>{t('Business expenses (Schedule C, without vehicle)')}</td><td style={{ textAlign: 'right' }}>− {money(o.business)}</td></tr>
            <tr>
              <td style={{ padding: '4px 0' }}>
                {t('Vehicle:')}{' '}
                <select value={vehicle} onChange={e => setVehicle(e.target.value)} style={{ backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px', padding: '2px 6px' }}>
                  <option value="standard">{t('standard mileage ({n} mi)', { n: o.totalMiles.toFixed(0) })}</option>
                  <option value="actual">{t('actual expenses (gas, maintenance, …)')}</option>
                </select>
              </td>
              <td style={{ textAlign: 'right' }}>− {money(o.vehicleDeduction)}</td>
            </tr>
            <tr style={{ borderTop: '1px solid #374151' }}><td style={{ padding: '6px 0', fontWeight: 'bold' }}>{t('Estimated net profit')}</td><td style={{ textAlign: 'right', fontWeight: 'bold' }}>{money(o.profit)}</td></tr>
            <tr><td style={{ padding: '4px 0' }}>{t('Self-employment tax (15.3% on 92.35%, SS up to {amount})', { amount: money(o.se.base) })}</td><td style={{ textAlign: 'right' }}>{money(o.se.total)}</td></tr>
            <tr>
              <td style={{ padding: '4px 0' }}>
                {t('Income tax set-aside — your own %:')}{' '}
                <input inputMode="decimal" value={setAside} onChange={e => setSetAside(e.target.value.replace(/[^\d.]/g, ''))} placeholder={t('e.g. 12')}
                  style={{ width: '60px', backgroundColor: '#374151', color: 'white', border: '1px solid #4b5563', borderRadius: '6px', padding: '2px 6px' }} /> %
              </td>
              <td style={{ textAlign: 'right' }}>{money(o.incomeSetAside)}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ ...muted, marginTop: '8px' }}>
          {t('Personal items ({amount}: medical, home, charity) are not business expenses and are left out.', { amount: money(o.personal) })}{' '}
          {t('Income tax depends on your filing status and other income — the % is your own assumption; ask your tax preparer.')}
        </p>
        {due ? (
          <div style={{ marginTop: '12px' }}>
            <p style={{ fontWeight: 'bold', margin: '0 0 6px' }}>{t('Estimated tax payments (Form 1040-ES) — about {amount} each', { amount: money(quarterly) })}</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {due.map((d, i) => {
                const left = daysBetweenET(new Date(), d);
                return (
                  <span key={d} style={{ padding: '4px 10px', borderRadius: '9999px', fontSize: '13px',
                    backgroundColor: left < 0 ? '#374151' : left <= 30 ? 'rgba(234,179,8,0.2)' : 'rgba(59,130,246,0.15)',
                    color: left < 0 ? '#9ca3af' : left <= 30 ? '#facc15' : '#93c5fd' }}>
                    Q{i + 1}: {fmtDateShort(d)}{left >= 0 && left <= 30 ? ' · ' + t('in {n} days', { n: left }) : ''}{left < 0 ? ' · ' + t('past') : ''}
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          <p style={{ ...muted, marginTop: '12px' }}>{t('1040-ES due dates for {year} are not on file — see irs.gov/Form1040ES.', { year })}</p>
        )}
      </div>
    </div>
  );
}
