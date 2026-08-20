// app/dashboard/components/ApprovalsView.js
// ─────────────────────────────────────────────────────────────────────────────
// APPROVALS — everything waiting on a yes before it leaves the building.
//
// Generic on purpose: it renders whatever is in approval_requests, grouped by
// `kind`. Adding CBRE acknowledgements, NTE submissions or ETA updates needs a
// new producer writing rows — not a new tab and not a change here.
//
// Nothing in this component talks to CBRE. Approving sets status='approved';
// a separate sender is responsible for acting on approved rows and setting
// 'sent'. That separation is the point: the decision and the transmission are
// different steps, so a bug in one cannot silently cause the other.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

const KIND_META = {
  cbre_acknowledge: { label: 'Acknowledge Work', tone: 'sky',    hint: 'Tells CBRE we have accepted the work order.' },
  cbre_nte:         { label: 'NTE Request',      tone: 'amber',  hint: 'Submits an NTE increase. Carries a dollar amount.' },
  cbre_eta:         { label: 'Arrival Time',     tone: 'violet', hint: 'Updates the next arrival time on the work order.' },
  cbre_comment:     { label: 'Comment',          tone: 'slate',  hint: 'Adds a comment to the work order.' },
  other:            { label: 'Other',            tone: 'slate',  hint: '' },
};

const TONE = {
  sky:    'bg-sky-500/20 text-sky-400 border-sky-500/30',
  amber:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  violet: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  slate:  'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

const STATUS_TONE = {
  pending:  'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  sent:     'bg-blue-500/20 text-blue-400 border-blue-500/30',
  rejected: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  failed:   'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled:'bg-slate-500/20 text-slate-500 border-slate-500/30',
};

const money = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n)
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;
};

const ago = (iso) => {
  if (!iso) return '';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

export default function ApprovalsView({ userInfo }) {
  const [rows, setRows]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [tab, setTab]             = useState('pending');
  const [selected, setSelected]   = useState(() => new Set());
  const [busy, setBusy]           = useState(false);
  const [expanded, setExpanded]   = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('approval_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (err) throw err;
      setRows(data || []);
    } catch (e) {
      // The table may not exist yet if the migration has not been run.
      setError(
        /approval_requests/i.test(e.message || '')
          ? 'The approval_requests table is missing — run add_approval_requests.sql in Supabase first.'
          : e.message
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const shown = useMemo(
    () => rows.filter((r) => (tab === 'pending' ? r.status === 'pending' : r.status !== 'pending')),
    [rows, tab]
  );

  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'pending').length, [rows]);

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.approval_id));

  async function decide(ids, decision, reason = null) {
    if (!ids.length) return;
    setBusy(true);
    try {
      const patch = {
        status: decision,
        decided_at: new Date().toISOString(),
        decided_by: userInfo?.user_id ?? null,
      };
      if (decision === 'rejected') patch.reject_reason = reason;

      const { error: err } = await supabase
        .from('approval_requests')
        .update(patch)
        .in('approval_id', ids)
        .eq('status', 'pending');       // never re-decide something already decided
      if (err) throw err;

      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function rejectSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    const reason = window.prompt(`Reject ${ids.length} request(s). Reason (optional):`, '');
    if (reason === null) return;        // cancelled the prompt
    decide(ids, 'rejected', reason || null);
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Approvals</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Nothing here has been sent. Approving marks it ready; a separate step transmits it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['pending', 'history'].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected(new Set()); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                tab === t
                  ? 'bg-slate-700/60 text-slate-100 border-slate-600'
                  : 'bg-transparent text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              {t === 'pending' ? `Pending${pendingCount ? ` (${pendingCount})` : ''}` : 'History'}
            </button>
          ))}
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-400 hover:text-slate-200"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {tab === 'pending' && shown.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={allShownSelected}
              onChange={() =>
                setSelected(allShownSelected ? new Set() : new Set(shown.map((r) => r.approval_id)))
              }
            />
            Select all {shown.length}
          </label>
          <span className="text-slate-500 text-sm">{selected.size} selected</span>
          <div className="flex-1" />
          <button
            disabled={!selected.size || busy}
            onClick={() => decide([...selected], 'approved')}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 text-white disabled:opacity-40"
          >
            Approve selected
          </button>
          <button
            disabled={!selected.size || busy}
            onClick={rejectSelected}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-slate-600 text-slate-300 disabled:opacity-40"
          >
            Reject
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800/30 px-4 py-10 text-center">
          <p className="text-slate-300 font-medium">
            {tab === 'pending' ? 'Nothing waiting on you' : 'No history yet'}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {tab === 'pending'
              ? 'Requests appear here as soon as something needs a decision.'
              : 'Approved and rejected requests will be listed here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((r) => {
            const meta = KIND_META[r.kind] || KIND_META.other;
            const amount = money(r.payload?.amount ?? r.payload?.nte);
            const open = expanded === r.approval_id;
            return (
              <div
                key={r.approval_id}
                className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2.5"
              >
                <div className="flex items-start gap-3">
                  {tab === 'pending' && (
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selected.has(r.approval_id)}
                      onChange={() => toggle(r.approval_id)}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${TONE[meta.tone]}`}>
                        {meta.label}
                      </span>
                      {r.wo_number && (
                        <span className="text-slate-200 font-semibold text-sm">{r.wo_number}</span>
                      )}
                      {amount && (
                        <span className="text-amber-300 font-semibold text-sm tabular-nums">{amount}</span>
                      )}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${STATUS_TONE[r.status]}`}>
                        {r.status}
                      </span>
                      <span className="text-slate-500 text-xs">{ago(r.created_at)} ago</span>
                    </div>
                    <p className="text-slate-300 text-sm mt-1">{r.title}</p>
                    {r.summary && <p className="text-slate-500 text-xs mt-0.5">{r.summary}</p>}
                    {r.send_error && (
                      <p className="text-red-400 text-xs mt-1">Send failed: {r.send_error}</p>
                    )}
                    {r.reject_reason && (
                      <p className="text-slate-500 text-xs mt-1">Rejected: {r.reject_reason}</p>
                    )}

                    <button
                      onClick={() => setExpanded(open ? null : r.approval_id)}
                      className="text-xs text-slate-400 hover:text-slate-200 mt-1.5"
                    >
                      {open ? 'Hide exact values' : 'Show exact values'}
                    </button>
                    {open && (
                      <pre className="mt-2 text-[11px] leading-relaxed text-slate-300 bg-slate-900/70 border border-slate-700 rounded p-2 overflow-x-auto">
{JSON.stringify(r.payload, null, 2)}
                      </pre>
                    )}
                  </div>

                  {tab === 'pending' && (
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        disabled={busy}
                        onClick={() => decide([r.approval_id], 'approved')}
                        className="px-3 py-1 rounded-md text-xs font-semibold bg-emerald-600 text-white disabled:opacity-40"
                      >
                        Approve
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt('Reason (optional):', '');
                          if (reason === null) return;
                          decide([r.approval_id], 'rejected', reason || null);
                        }}
                        className="px-3 py-1 rounded-md text-xs font-semibold border border-slate-600 text-slate-300 disabled:opacity-40"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
