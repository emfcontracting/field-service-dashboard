// app/dashboard/components/UPSPaymentsSyncView.js
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-ONLY: import the UPS/Corpay payment report and mark invoices paid.
//
// UPS BaSE (Angie Noll) pulls "Payment Search.xlsx" out of the UPS procurement
// tool. It is the only complete source for what UPS has actually paid: Coupa
// only reports what it happens to mark, and the Oracle remittance mails arrive
// sporadically. Before this, 292 invoices worth $825,626.49 sat at 'accepted'
// although the cheques had cleared months earlier.
//
// Same shape as the CBRE status sync next to it: upload → reconcile → look at
// what would change → apply. Nothing is written before the office presses
// Apply, and rows we could not resolve are never written at all.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { getSupabase } from '@/lib/supabase';
import {
  parsePaymentReport, reconcilePayments, paymentSummary,
  PAYMENT_OUTCOME, APPLICABLE_OUTCOMES, isBackfillOnly,
} from '@/lib/upsPaymentReport';

const supabase = getSupabase();

const fmt = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const TONE = {
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  amber:   'bg-amber-500/10 border-amber-500/30 text-amber-400',
  slate:   'bg-slate-500/10 border-slate-600/30 text-slate-400',
  sky:     'bg-sky-500/10 border-sky-500/30 text-sky-400',
  red:     'bg-red-500/10 border-red-500/30 text-red-400',
};

export default function UPSPaymentsSyncView({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';
  const fileRef = useRef(null);

  const [fileName, setFileName] = useState('');
  const [parsing, setParsing]   = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError]       = useState('');
  const [checks, setChecks]     = useState([]);
  const [rows, setRows]         = useState(null);      // reconciled
  const [applied, setApplied]   = useState(null);
  const [tab, setTab]           = useState('to_mark');

  const summary = useMemo(() => rows ? paymentSummary(rows) : {}, [rows]);
  const applicable = useMemo(
    () => (rows || []).filter(r => APPLICABLE_OUTCOMES.includes(r.outcome)),
    [rows]
  );

  const reset = () => {
    setRows(null); setChecks([]); setApplied(null); setError(''); setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null });
      const { payments, problems, checks: chk } = parsePaymentReport(raw);
      if (problems.length) { setError(problems.join(' · ')); setParsing(false); return; }
      if (!payments.length) { setError('No payment rows in this file.'); setParsing(false); return; }

      // What FSM has for those work orders. A work order present without an
      // invoice maps to null; one that is missing stays out of the map, and the
      // two cases are told apart in the reconciliation.
      const numbers = [...new Set(payments.map(p => p.wo_number).filter(Boolean))];
      const invoiceByWo = {};
      for (let i = 0; i < numbers.length; i += 100) {
        const { data, error: qErr } = await supabase
          .from('work_orders')
          .select('wo_number, invoices(invoice_id, invoice_number, total, status, paid_at, paid_amount)')
          .in('wo_number', numbers.slice(i, i + 100));
        if (qErr) throw qErr;
        (data || []).forEach(w => { invoiceByWo[w.wo_number] = (w.invoices || [])[0] || null; });
      }

      setChecks(chk);
      setRows(reconcilePayments(payments, invoiceByWo));
      setTab('to_mark');
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setParsing(false);
    }
  };

  const apply = async () => {
    if (!applicable.length) return;
    const shorts = applicable.filter(r => r.outcome === 'short_pay');
    const lines = [
      `Write ${applicable.length} invoice(s) — ${fmt(applicable.reduce((s, r) => s + (r.amount || 0), 0))}?`,
      '',
      'Each one records the amount that actually arrived and the cheque number.',
    ];
    const backfills = applicable.filter(r => isBackfillOnly(r.outcome));
    if (backfills.length) lines.push('', `${backfills.length} of them are already marked paid — those only get the cheque number, their status and payment date stay as they are.`);
    if (shorts.length) lines.push('', `${shorts.length} of them arrived short by ${fmt(Math.abs(shorts.reduce((s, r) => s + r.diff, 0)))} in total — they are marked paid with the amount received, so the difference stays visible.`);
    if (!confirm(lines.join('\n'))) return;

    setApplying(true);
    let ok = 0; const failed = [];
    try {
      const source = `ups_corpay_report_${new Date().toISOString().slice(0, 10)}`;
      for (const r of applicable) {
        // A backfill only adds the cheque detail — an invoice already marked
        // paid keeps the status and the payment date it was given.
        const patch = isBackfillOnly(r.outcome)
          ? { paid_amount: r.amount, payment_reference: r.check_number, payment_source: source }
          : { status: 'paid', paid_at: r.invoice.paid_at || r.check_date,
              paid_amount: r.amount, payment_reference: r.check_number, payment_source: source };
        const { error: uErr } = await supabase.from('invoices').update(patch).eq('invoice_id', r.invoice.invoice_id);
        if (uErr) failed.push(`${r.wo_number}: ${uErr.message}`); else ok += 1;
      }
      setApplied({ ok, failed });
      // Re-reconcile so the screen reflects what is now stored.
      setRows(prev => (prev || []).map(r =>
        APPLICABLE_OUTCOMES.includes(r.outcome) && !failed.some(f => f.startsWith(r.wo_number + ':'))
          ? { ...r, outcome: 'already', detail: `${r.invoice.invoice_number} recorded` }
          : r));
    } finally {
      setApplying(false);
    }
  };

  if (!isAdmin) return (
    <div className="flex items-center justify-center min-h-[40vh] text-red-400">🔒 Admin access required</div>
  );

  const shown = (rows || []).filter(r => r.outcome === tab);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-100">💵 UPS Payments</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Import the payment report from UPS BaSE (Angie Noll runs it out of the UPS procurement tool)
          and mark the invoices it covers as paid.
        </p>
      </div>

      {/* Upload */}
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="text-sm text-slate-400 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-semibold file:cursor-pointer hover:file:bg-blue-500"
          />
          {fileName && <span className="text-xs text-slate-500 font-mono">{fileName}</span>}
          {parsing && <span className="text-xs text-blue-400">Reading…</span>}
          {rows && (
            <button onClick={reset} className="ml-auto text-xs text-slate-500 hover:text-slate-300">Start over</button>
          )}
        </div>
        {error && (
          <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
        )}
        {!rows && !error && (
          <p className="text-xs text-slate-600 mt-3">
            The report has no work order column — the number is read out of <span className="font-mono">Invoice Description</span>.
            Nothing is written until you press Apply.
          </p>
        )}
      </div>

      {rows && (
        <>
          {/* Cheques in the file */}
          <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-2">Cheques in this file</div>
            <div className="flex flex-wrap gap-2">
              {checks.map(c => (
                <div key={`${c.check_number}-${c.check_date}`} className="bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2">
                  <div className="font-mono text-sm text-slate-200">{c.check_number}</div>
                  <div className="text-[11px] text-slate-500">{fmtDate(c.check_date)} · {c.rows} row{c.rows !== 1 ? 's' : ''}</div>
                  <div className="text-sm font-semibold text-emerald-400">{fmt(c.total)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Outcome tabs */}
          <div className="flex flex-wrap gap-2 border-b border-[#1e1e2e]">
            {Object.entries(PAYMENT_OUTCOME).map(([key, cfg]) => {
              const s = summary[key];
              if (!s) return null;
              return (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
                    tab === key ? 'text-slate-100 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                  {cfg.label} <span className="text-xs text-slate-600">({s.count})</span>
                  <div className="text-[11px] font-normal text-slate-600">{fmt(s.total)}</div>
                </button>
              );
            })}
          </div>

          {/* Apply */}
          <div className="flex flex-wrap items-center gap-3 bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4">
            <div className="text-sm text-slate-400">
              <span className="text-slate-100 font-semibold">{applicable.length}</span> invoice{applicable.length !== 1 ? 's' : ''} would be written
              {' · '}<span className="text-emerald-400 font-semibold">{fmt(applicable.reduce((s, r) => s + (r.amount || 0), 0))}</span>
            </div>
            <button onClick={apply} disabled={applying || !applicable.length}
              className="ml-auto px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed">
              {applying ? 'Applying…' : `✓ Apply (${applicable.length})`}
            </button>
          </div>

          {applied && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${applied.failed.length ? TONE.amber : TONE.emerald}`}>
              {applied.ok} invoice{applied.ok !== 1 ? 's' : ''} marked paid.
              {applied.failed.length > 0 && (
                <div className="mt-1 text-xs text-red-400">
                  {applied.failed.length} failed: {applied.failed.slice(0, 5).join(' · ')}
                </div>
              )}
            </div>
          )}

          {/* Rows */}
          <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
            <div className={`px-4 py-2 text-xs border-b border-[#1e1e2e] ${TONE[PAYMENT_OUTCOME[tab]?.tone] || ''}`}>
              {PAYMENT_OUTCOME[tab]?.label} — {PAYMENT_OUTCOME[tab]?.hint}
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0a0a0f] sticky top-0">
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                    <th className="px-4 py-2">Work Order</th>
                    <th className="px-4 py-2">Invoice</th>
                    <th className="px-4 py-2 text-right">Billed</th>
                    <th className="px-4 py-2 text-right">Paid</th>
                    <th className="px-4 py-2 text-right">Difference</th>
                    <th className="px-4 py-2">Cheque</th>
                    <th className="px-4 py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr key={`${r.row}-${i}`} className="border-t border-[#1e1e2e] hover:bg-[#12121c]">
                      <td className="px-4 py-2 font-mono text-blue-400">{r.wo_number || '—'}</td>
                      <td className="px-4 py-2 font-mono text-slate-300">{r.invoice?.invoice_number || '—'}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-400">{r.billed != null ? fmt(r.billed) : '—'}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-200">{fmt(r.amount)}</td>
                      <td className={`px-4 py-2 text-right font-mono ${!r.diff ? 'text-slate-600' : r.diff < 0 ? 'text-red-400' : 'text-amber-400'}`}>
                        {r.diff ? fmt(r.diff) : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500 font-mono">{r.check_number}<div className="text-slate-600">{fmtDate(r.check_date)}</div></td>
                      <td className="px-4 py-2 text-xs text-slate-500">{r.detail}</td>
                    </tr>
                  ))}
                  {!shown.length && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-600 text-sm">Nothing in this group.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
