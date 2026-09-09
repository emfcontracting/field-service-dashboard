// app/dashboard/components/CBREGridSyncView.js
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-ONLY: import the CBRE open-orders export ("grid") and compare it with
// FSM in both directions.
//
// CBRE → us: a work order in the grid that FSM has never seen is a dispatch
// e-mail we missed. Thirteen of those turned up when this was done by hand on
// 2026-08-27, and they can be created straight from the export.
//
// us → CBRE: a work order FSM still has open that is no longer in the grid is
// the aging pattern — CBRE closes at 60 days and the money then only comes back
// on a sub work order. Those are reported, never changed automatically: leaving
// the grid can also mean the work order was simply finished.
//
// The one trap: a work order sitting in a quote status appears in NEITHER the
// open nor the closed CBRE list, so its absence here means nothing. Those are
// counted apart instead of being raised as gone.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { getSupabase } from '@/lib/supabase';
import { fetchAll } from '@/lib/fetchAll';
import { CBRE_WO_PATTERN } from '@/lib/cbreEmailParser';
import { ACTIVE_DISPUTE_STATUSES } from '@/lib/disputeStatus';
import {
  parseGridExport, reconcileGrid, gridSummary,
  GRID_OUTCOME, GRID_REFRESHABLE, GRID_CREATABLE,
  gridStampPatch, gridNewWorkOrder, GRID_APPROVES,
} from '@/lib/cbreGridReport';

const supabase = getSupabase();

const fmtDate = (d) => d ? new Date(String(d).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

const TONE = {
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
  slate: 'bg-slate-500/10 border-slate-600/30 text-slate-400',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  red:   'bg-red-500/10 border-red-500/30 text-red-400',
};

export default function CBREGridSyncView({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';
  const fileRef = useRef(null);

  const [fileName, setFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState(null);
  const [applied, setApplied] = useState(null);
  const [tab, setTab] = useState('open_both');
  const [createSelected, setCreateSelected] = useState(() => new Set());

  const summary = useMemo(() => rows ? gridSummary(rows) : {}, [rows]);
  const refreshable = useMemo(() => (rows || []).filter(r => GRID_REFRESHABLE.includes(r.outcome)), [rows]);
  const creatable   = useMemo(() => (rows || []).filter(r => GRID_CREATABLE.includes(r.outcome)), [rows]);
  const approvals   = useMemo(() => (rows || []).filter(r => GRID_APPROVES.includes(r.outcome)), [rows]);

  const reset = () => {
    setRows(null); setApplied(null); setError(''); setFileName(''); setCreateSelected(new Set());
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file) => {
    if (!file) return;
    reset();
    setFileName(file.name);
    setParsing(true);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: null });
      const { orders, problems } = parseGridExport(raw);
      if (problems.length) { setError(problems.join(' · ')); return; }
      if (!orders.length)  { setError('No work orders in this file.'); return; }

      const numbers = [...new Set(orders.map(o => o.wo_number))];
      const woByNumber = {};
      for (let i = 0; i < numbers.length; i += 100) {
        const { data, error: qErr } = await supabase
          .from('work_orders')
          .select('wo_id, wo_number, status, cbre_status, acknowledged, is_locked, dispute_status, date_entered, building, invoices(invoice_number)')
          .in('wo_number', numbers.slice(i, i + 100));
        if (qErr) throw qErr;
        (data || []).forEach(w => { woByNumber[w.wo_number] = w; });
      }

      // The other direction needs everything FSM still has open. Escalated work
      // orders are left out — they are being worked in the Escalations tab and
      // their absence from the grid is already known and accounted for.
      const openRows = await fetchAll(() => supabase
        .from('work_orders')
        .select('wo_id, wo_number, status, cbre_status, acknowledged, is_locked, dispute_status, date_entered, building')
        .or('acknowledged.is.null,acknowledged.eq.false')
        .or('is_locked.is.null,is_locked.eq.false')
        .order('wo_id'));
      const fsmOpen = (openRows || []).filter(w =>
        CBRE_WO_PATTERN.test(String(w.wo_number || '').trim()) &&
        !w.acknowledged && !w.is_locked &&
        !ACTIVE_DISPUTE_STATUSES.includes(w.dispute_status));

      const rec = reconcileGrid(orders, woByNumber, fsmOpen);
      setRows(rec);
      setCreateSelected(new Set(rec.filter(r => r.outcome === 'missing_fsm').map(r => r.wo_number)));
      setTab(rec.some(r => r.outcome === 'nte_approved') ? 'nte_approved'
           : rec.some(r => r.outcome === 'missing_fsm') ? 'missing_fsm' : 'open_both');
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setParsing(false);
    }
  };

  const apply = async () => {
    const toCreate = creatable.filter(r => createSelected.has(r.wo_number));
    const lines = [
      `Refresh the CBRE grid detail on ${refreshable.length} work order(s)?`,
      '',
      'That records the grid status, how many days past target, and that CBRE listed it as open today.',
    ];
    if (approvals.length) lines.push('', `${approvals.length} of them also move to "quote approved" — CBRE has decided the NTE and FSM still shows it waiting. Nothing else about the CBRE status is touched.`);
    if (toCreate.length) lines.push('', `${toCreate.length} work order(s) CBRE dispatched but FSM never received will be created as pending — without an NTE, because the grid export does not carry one.`);
    if (!confirm(lines.join('\n'))) return;

    setApplying(true);
    const seenAt = new Date().toISOString();
    let stamped = 0, created = 0; const failed = [];
    try {
      for (const r of refreshable) {
        const { error: uErr } = await supabase.from('work_orders')
          .update(gridStampPatch(r, seenAt)).eq('wo_id', r.wo.wo_id);
        if (uErr) failed.push(`${r.wo_number}: ${uErr.message}`); else stamped += 1;
      }
      if (toCreate.length) {
        const payload = toCreate.map(r => ({ ...gridNewWorkOrder(r, fileName), cbre_grid_seen_at: seenAt }));
        const { error: iErr } = await supabase.from('work_orders').insert(payload);
        if (iErr) failed.push(`creating ${toCreate.length}: ${iErr.message}`); else created = toCreate.length;
      }
      setApplied({ stamped, created, approved: approvals.length, failed });
    } finally {
      setApplying(false);
    }
  };

  if (!isAdmin) return (
    <div className="flex items-center justify-center min-h-[40vh] text-red-400">🔒 Admin access required</div>
  );

  const shown = (rows || []).filter(r => r.outcome === tab);
  const gone = summary.gone_cbre?.count || 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-100">📋 CBRE Open Orders</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Everything CBRE still has open on their side. Compared with FSM in both directions:
          what they dispatched and we never received, and what we still have open that they no longer list.
        </p>
      </div>

      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-5">
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFile(e.target.files?.[0])}
            className="text-sm text-slate-400 file:mr-3 file:px-4 file:py-2 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:font-semibold file:cursor-pointer hover:file:bg-blue-500" />
          {fileName && <span className="text-xs text-slate-500 font-mono">{fileName}</span>}
          {parsing && <span className="text-xs text-blue-400">Comparing…</span>}
          {rows && <button onClick={reset} className="ml-auto text-xs text-slate-500 hover:text-slate-300">Start over</button>}
        </div>
        {error && <div className="mt-3 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}
        {!rows && !error && (
          <p className="text-xs text-slate-600 mt-3">Nothing is written until you press Apply.</p>
        )}
      </div>

      {rows && (
        <>
          {approvals.length > 0 && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              <strong>{approvals.length} NTE request{approvals.length !== 1 ? 's have' : ' has'} been approved at CBRE</strong> while FSM still shows them waiting.
              Applying moves them to &quot;quote approved&quot;, which is what lets the completion be reported and the work billed.
            </div>
          )}

          {gone > 0 && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              <strong>{gone} work order{gone !== 1 ? 's' : ''} open here that CBRE no longer lists.</strong> CBRE closes at 60 days;
              after that the money only comes back on a sub work order. Worth checking each one in the portal — nothing is changed automatically,
              because a work order can also leave the list simply by being finished.
            </div>
          )}

          <div className="flex flex-wrap gap-2 border-b border-[#1e1e2e]">
            {Object.entries(GRID_OUTCOME).map(([key, cfg]) => {
              const s = summary[key];
              if (!s) return null;
              return (
                <button key={key} onClick={() => setTab(key)}
                  className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
                    tab === key ? 'text-slate-100 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}>
                  {cfg.label} <span className="text-xs text-slate-600">({s.count})</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4">
            <div className="text-sm text-slate-400">
              <span className="text-slate-100 font-semibold">{refreshable.length}</span> get today&apos;s grid detail
              {approvals.length > 0 && <> · <span className="text-emerald-400 font-semibold">{approvals.length}</span> move to quote approved</>}
              {creatable.length > 0 && <> · <span className="text-slate-100 font-semibold">{createSelected.size}</span> of {creatable.length} missing would be created</>}
            </div>
            <button onClick={apply} disabled={applying || (!refreshable.length && !createSelected.size)}
              className="ml-auto px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed">
              {applying ? 'Applying…' : '✓ Apply'}
            </button>
          </div>

          {applied && (
            <div className={`rounded-lg border px-4 py-3 text-sm ${applied.failed.length ? TONE.amber : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
              {applied.stamped} work order{applied.stamped !== 1 ? 's' : ''} refreshed{applied.approved ? `, ${applied.approved} moved to quote approved` : ''}{applied.created ? `, ${applied.created} created` : ''}.
              {applied.failed.length > 0 && <div className="mt-1 text-xs text-red-400">{applied.failed.slice(0, 5).join(' · ')}</div>}
            </div>
          )}

          <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
            <div className={`px-4 py-2 text-xs border-b border-[#1e1e2e] ${TONE[GRID_OUTCOME[tab]?.tone] || ''}`}>
              {GRID_OUTCOME[tab]?.label} — {GRID_OUTCOME[tab]?.hint}
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0a0a0f] sticky top-0">
                  <tr className="text-left text-xs text-slate-500 uppercase tracking-wider">
                    {tab === 'missing_fsm' && <th className="px-4 py-2 w-8"></th>}
                    <th className="px-4 py-2">Work Order</th>
                    <th className="px-4 py-2">Building</th>
                    <th className="px-4 py-2">Entered</th>
                    <th className="px-4 py-2">CBRE status</th>
                    <th className="px-4 py-2 text-right">Past target</th>
                    <th className="px-4 py-2">In FSM</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr key={`${r.wo_number}-${i}`} className="border-t border-[#1e1e2e] hover:bg-[#12121c]">
                      {tab === 'missing_fsm' && (
                        <td className="px-4 py-2">
                          <input type="checkbox" checked={createSelected.has(r.wo_number)}
                            onChange={() => setCreateSelected(prev => {
                              const n = new Set(prev);
                              n.has(r.wo_number) ? n.delete(r.wo_number) : n.add(r.wo_number);
                              return n;
                            })} />
                        </td>
                      )}
                      <td className="px-4 py-2 font-mono text-blue-400">{r.wo_number}</td>
                      <td className="px-4 py-2 text-slate-400 text-xs">{r.building || '—'}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{fmtDate(r.date_entered)}</td>
                      <td className="px-4 py-2 text-slate-300 text-xs">{r.grid_status || '—'}</td>
                      <td className={`px-4 py-2 text-right font-mono text-xs ${r.past_target_days > 60 ? 'text-red-400' : r.past_target_days > 0 ? 'text-amber-400' : 'text-slate-600'}`}>
                        {r.past_target_days ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">{r.detail}</td>
                    </tr>
                  ))}
                  {!shown.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-600 text-sm">Nothing in this group.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
