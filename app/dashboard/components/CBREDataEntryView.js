// app/dashboard/components/CBREDataEntryView.js
// ─────────────────────────────────────────────────────────────────────────────
// CBRE Data Entry — Admin/Office only. COMPLETIONS ONLY (2026-09-06).
//
// What CBRE needs from us when a work order is done is the Vendor App action
// "Complete A Work Order" with Start (first check-in) and End (last check-out).
// The daily check-out queue that used to live here was never what the portal
// asked for and is gone; the check-in/out stamps are shown here instead.
//
// Flow:
//   tech completes WO ──► completed + ready (lib/completionReadiness.js)
//        │                    │
//        │                    ▼  every 15 min: /api/cbre/queue-completions
//        │                       (or "Queue now" here) → approval_requests
//        │                                                    │
//        │                                                    ▼  Approvals tab
//        │                          approve → prefilled Smartsheet form → Submit
//        │                          "Mark submitted" stamps cbre_completion_submitted_at
//        │                          + completion_transferred → leaves this view
//        ▼
//   not ready (NTE at CBRE, quote pending, over NTE, no times) → "Waiting"
//   here with the reason. No times → "Send manually" (Send-to-CBRE dialog).
//
// "Mark transferred" stays as the by-hand exit (someone did it in the portal
// directly). Nothing here contacts CBRE.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useMemo } from 'react';
import { getSupabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/apiClient';
import { parseTs } from '@/lib/cbreVendorForm';
import {
  COMPLETION_SELECT, READINESS_LABEL,
  completionReadinessCheck, completionWindow, completionActualTotal,
  buildCompletionApprovalRow, isActiveWo,
} from '@/lib/completionReadiness';
import SendToCbreModal from './SendToCbreModal';

const supabase = getSupabase();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const safeUuid = (v) => (typeof v === 'string' && UUID_REGEX.test(v) ? v : null);

const EST = { timeZone: 'America/New_York' };
const fmtDate = (d) => {
  const dt = parseTs(d);
  return dt ? dt.toLocaleDateString('en-US', { ...EST, month: 'short', day: 'numeric', year: 'numeric' }) : '—';
};
const fmtDateTime = (d) => {
  const dt = parseTs(d);
  return dt ? dt.toLocaleString('en-US', { ...EST, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '—';
};
const money = (n) => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LIVE = ['pending', 'approved'];

// Which bucket a completion belongs to.
//   queued   — a live Complete request sits in the Approvals tab
//   rejected — the office rejected the last request (producer skips it)
//   ready    — the producer will queue it within 15 min (or "Queue now")
//   waiting  — not ready; reason from completionReadinessCheck
//   done     — reported (only shown with "Show transferred")
function classify(wo, approval) {
  if (wo.completion_transferred || wo.cbre_completion_submitted_at) return { bucket: 'done' };
  if (approval && LIVE.includes(approval.status)) return { bucket: 'queued', approval };
  const r = completionReadinessCheck(wo);
  if (approval && approval.status === 'rejected') return { bucket: 'rejected', approval, readiness: r };
  if (!r.ready) return { bucket: 'waiting', readiness: r };
  return { bucket: 'ready' };
}

function reasonText(r) {
  if (!r || r.ready) return '';
  switch (r.reason) {
    case 'cbre_status':   return `${READINESS_LABEL.cbre_status} (${r.detail})`;
    case 'pending_quote': return `${READINESS_LABEL.pending_quote} (${r.detail})`;
    case 'over_nte':      return `${READINESS_LABEL.over_nte}: ${money(r.detail.actual)} vs NTE ${money(r.detail.nte)}`;
    case 'no_times':      return `${READINESS_LABEL.no_times}${r.detail.hasStart ? ' (end missing)' : r.detail.hasEnd ? ' (check-in missing)' : ''}`;
    case 'not_cbre':      return `${READINESS_LABEL.not_cbre} — nothing to send to CBRE; mark transferred to clear it`;
    default:              return r.reason;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
export default function CBREDataEntryView({ currentUser, onSelectWorkOrder }) {
  const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'office_staff';

  const [loading, setLoading]                 = useState(true);
  const [rows, setRows]                       = useState([]);      // work orders (completed, active)
  const [approvals, setApprovals]             = useState(new Map()); // wo_id → latest cbre_complete request
  const [search, setSearch]                   = useState('');
  const [dayWindow, setDayWindow]             = useState(30);      // 14 | 30 | 90 | 0 (=all)
  const [showTransferred, setShowTransferred] = useState(false);
  const [busy, setBusy]                       = useState(false);
  const [notice, setNotice]                   = useState(null);
  const [manualFor, setManualFor]             = useState(null);    // WO for the Send-to-CBRE dialog

  useEffect(() => { if (isAuthorized) loadData(); /* eslint-disable-next-line */ }, [isAuthorized, showTransferred]);

  const loadData = async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('work_orders')
        .select(COMPLETION_SELECT)
        .eq('status', 'completed')
        .eq('acknowledged', false)
        .eq('is_locked', false)
        .order('date_completed', { ascending: false, nullsFirst: false });
      if (!showTransferred) q = q.eq('completion_transferred', false).is('cbre_completion_submitted_at', null);
      const { data, error } = await q;
      if (error) throw error;
      const active = (data || []).filter(isActiveWo);

      // Latest Complete request per WO (live → "queued", rejected → "rejected").
      const ids = active.map((w) => w.wo_id);
      const map = new Map();
      if (ids.length) {
        const { data: ar, error: aErr } = await supabase
          .from('approval_requests')
          .select('approval_id, wo_id, status, created_at, reject_reason')
          .eq('kind', 'cbre_complete')
          .in('wo_id', ids)
          .order('created_at', { ascending: false });
        if (aErr) throw aErr;
        for (const a of ar || []) if (!map.has(a.wo_id)) map.set(a.wo_id, a);
      }
      setRows(active);
      setApprovals(map);
    } catch (e) {
      console.error('Error loading CBRE data entry queue:', e);
      alert('Error loading data:\n' + (e?.message || e?.details || e?.hint || JSON.stringify(e)));
    } finally {
      setLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────
  const items = useMemo(() => {
    const cutoff = dayWindow > 0 ? Date.now() - dayWindow * 86400000 : 0;
    const s = search.trim().toLowerCase();
    return rows
      .filter((wo) => {
        if (cutoff) {
          // date_completed is often empty on completed WOs — fall back to the
          // last check-out / first check-in / last change.
          const basis = parseTs(wo.date_completed) || parseTs(wo.time_out) || parseTs(wo.time_in) || parseTs(wo.updated_at);
          if (basis && basis.getTime() < cutoff) return false;
        }
        if (s && !(wo.wo_number?.toLowerCase().includes(s) || wo.building?.toLowerCase().includes(s)
          || `${wo.lead_tech?.first_name || ''} ${wo.lead_tech?.last_name || ''}`.toLowerCase().includes(s))) return false;
        return true;
      })
      .map((wo) => ({ wo, ...classify(wo, approvals.get(wo.wo_id)) }));
  }, [rows, approvals, dayWindow, search]);

  const by = (b) => items.filter((i) => i.bucket === b);
  const ready = by('ready'), queued = by('queued'), waiting = by('waiting'), rejected = by('rejected'), done = by('done');

  // ── Mutations ──────────────────────────────────────────────────────────
  const flash = (msg) => { setNotice(msg); setTimeout(() => setNotice(null), 6000); };

  const queueOne = async (wo) => {
    const { row, problems } = buildCompletionApprovalRow(wo, { createdBy: safeUuid(currentUser?.user_id) });
    if (!row) { alert('Cannot build the CBRE form for this work order:\n' + problems.join('\n')); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('approval_requests').insert(row);
      if (error) {
        if (error.code === '23505') flash(`${wo.wo_number} is already queued in Approvals.`);
        else throw error;
      } else flash(`${wo.wo_number} queued — approve and submit it in the Approvals tab.`);
      await loadData();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // Runs the producer once for everything ready (same rows the cron would make).
  const queueAll = async () => {
    setBusy(true);
    try {
      const res = await apiFetch('/api/cbre/queue-completions?limit=50', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      flash(`Queued ${j.queued} completion(s)${j.skipped ? `, ${j.skipped} already queued` : ''}. Approve them in the Approvals tab.`);
      await loadData();
    } catch (e) {
      alert('Queue failed: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const markTransferred = async (woId, transferred = true) => {
    setBusy(true);
    try {
      const update = transferred
        ? { completion_transferred: true,  completion_transferred_at: new Date().toISOString(), completion_transferred_by: currentUser.user_id }
        : { completion_transferred: false, completion_transferred_at: null, completion_transferred_by: null, cbre_completion_submitted_at: null, cbre_completion_submitted_by: null };
      const { error } = await supabase.from('work_orders').update(update).eq('wo_id', woId);
      if (error) throw error;
      await loadData();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const buildSummary = (c) => {
    const { startAt, endAt } = completionWindow(c);
    return [
      `=== CBRE Work Order COMPLETED ===`,
      `WO #: ${c.wo_number}`,
      `Building: ${c.ups_building_code || c.building || '—'}`,
      `Lead Tech: ${c.lead_tech ? `${c.lead_tech.first_name} ${c.lead_tech.last_name}` : '—'}`,
      `Start (first check-in): ${startAt ? fmtDateTime(startAt) : '(not logged)'}`,
      `End (last check-out):   ${endAt ? fmtDateTime(endAt) : '(not logged)'}`,
      `Completion Date: ${fmtDate(c.date_completed)}`,
      c.customer_signature ? `Customer Signed: YES (${c.customer_name || 'name on file'})` : `Customer Signed: NO`,
      ``,
      `--- Work Performed ---`,
      c.work_order_description || '(no description)',
    ].filter(Boolean).join('\n');
  };

  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); flash('✓ Copied to clipboard'); }
    catch { alert('Copy failed — please select the text manually.'); }
  };

  // ── Gates ──────────────────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-[#0d0d14] border border-[#2d2d44] rounded-xl p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-slate-200 mb-2">🔒 Access Restricted</h2>
          <p className="text-slate-400 text-sm">This view is available only to Admin and Office Staff.</p>
        </div>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
          <p className="text-slate-500 text-sm">Loading CBRE completions...</p>
        </div>
      </div>
    );
  }

  // ── Card ───────────────────────────────────────────────────────────────
  const Card = ({ item }) => {
    const { wo, bucket, approval, readiness } = item;
    const { startAt, endAt, source } = completionWindow(wo);
    const actual = completionActualTotal(wo);
    const border = {
      ready: 'border-emerald-500/25', queued: 'border-sky-500/25', waiting: 'border-amber-500/20',
      rejected: 'border-rose-500/25', done: 'border-[#1e1e2e] opacity-60',
    }[bucket];
    return (
      <div className={`bg-[#0d0d14] border rounded-xl overflow-hidden transition ${border}`}>
        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <button onClick={() => onSelectWorkOrder?.(wo)} title="Open work order"
                  className="font-mono font-bold text-blue-400 hover:text-blue-300 hover:underline text-lg transition cursor-pointer">
                  {wo.wo_number}
                </button>
                <span className="text-slate-400 text-sm">{wo.ups_building_code || wo.building || '—'}</span>
                {bucket === 'ready' && <Pill tone="emerald">Ready — queues automatically</Pill>}
                {bucket === 'queued' && <Pill tone="sky">In Approvals ({approval.status})</Pill>}
                {bucket === 'waiting' && <Pill tone="amber">⏳ Waiting</Pill>}
                {bucket === 'rejected' && <Pill tone="rose">Rejected in Approvals</Pill>}
                {bucket === 'done' && <Pill tone="slate">✓ Reported</Pill>}
                {wo.customer_signature && <Pill tone="blue">✍️ Signed</Pill>}
              </div>
              <div className="text-xs text-slate-500 mt-1.5 flex gap-3 flex-wrap">
                <span>Completed: <span className="text-slate-300">{fmtDate(wo.date_completed)}</span></span>
                {wo.lead_tech && <span>Lead: <span className="text-slate-300">{wo.lead_tech.first_name} {wo.lead_tech.last_name}</span></span>}
                <span>Cost: <span className="text-slate-300">{money(actual)}</span> / NTE <span className="text-slate-300">{money(wo.nte)}</span></span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => copyToClipboard(buildSummary(wo))}
                className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                📋 Copy
              </button>
              {bucket === 'ready' && (
                <button onClick={() => queueOne(wo)} disabled={busy}
                  className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                  📤 Queue now
                </button>
              )}
              {(bucket === 'ready' || bucket === 'waiting' || bucket === 'rejected') && readiness?.reason !== 'not_cbre' && (
                <button onClick={() => setManualFor(wo)} disabled={busy}
                  className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  title="Open the Send-to-CBRE dialog with editable start/end (queues a Complete request with your times)">
                  ✏️ Edit & send
                </button>
              )}
              {bucket === 'done' ? (
                <button onClick={() => markTransferred(wo.wo_id, false)} disabled={busy}
                  className="bg-[#1e1e2e] hover:bg-[#2d2d44] text-slate-400 hover:text-slate-200 border border-[#2d2d44] text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                  ↶ Untick
                </button>
              ) : (
                <button onClick={() => markTransferred(wo.wo_id, true)} disabled={busy}
                  title="Already reported in the portal by hand — remove from this list"
                  className="bg-[#1e1e2e] hover:bg-[#2d2d44] text-slate-400 hover:text-slate-200 border border-[#2d2d44] text-xs font-semibold px-3 py-1.5 rounded-lg transition">
                  ✓ Mark transferred
                </button>
              )}
            </div>
          </div>

          {/* Start / End — what goes into the CBRE form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
            <TimeBox label="Start · first check-in" value={startAt ? fmtDateTime(startAt) : null} />
            <TimeBox label={`End · ${source === 'check-in + completion date' ? 'completion date (no check-out)' : 'last check-out'}`} value={endAt ? fmtDateTime(endAt) : null} />
          </div>

          {(bucket === 'waiting' || bucket === 'rejected') && (
            <div className="text-xs text-amber-300/90 bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2 mb-2">
              {bucket === 'rejected'
                ? <>Rejected {fmtDateTime(approval.created_at)}{approval.reject_reason ? ` — ${approval.reject_reason}` : ''}. Not re-queued automatically; fix and send manually, or mark transferred.</>
                : reasonText(readiness)}
            </div>
          )}

          {wo.work_order_description && (
            <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 text-sm text-slate-400 line-clamp-2">
              {wo.work_order_description}
            </div>
          )}
          {bucket === 'done' && (
            <div className="text-xs text-emerald-500 mt-2">
              ✓ Reported {fmtDateTime(wo.cbre_completion_submitted_at || wo.completion_transferred_at)}
            </div>
          )}
        </div>
      </div>
    );
  };

  const Section = ({ title, hint, list }) => list.length === 0 ? null : (
    <div className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wide">{title}</h2>
        <span className="text-xs text-slate-500">{list.length}</span>
        {hint && <span className="text-xs text-slate-600">· {hint}</span>}
      </div>
      {list.map((item) => <Card key={item.wo.wo_id} item={item} />)}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">📤 CBRE Data Entry</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Completed work orders to report to CBRE (“Complete A Work Order”, start/end from check-in/out)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={dayWindow} onChange={(e) => setDayWindow(parseInt(e.target.value))}
              className="bg-[#0a0a0f] border border-[#2d2d44] text-slate-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500/60">
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="0">All time</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={showTransferred} onChange={(e) => setShowTransferred(e.target.checked)} className="w-4 h-4 accent-blue-500" />
              Show reported
            </label>
            <button onClick={loadData}
              className="bg-[#1e1e2e] border border-[#2d2d44] hover:bg-[#2d2d44] text-slate-300 px-3 py-2 rounded-lg text-sm transition">
              🔄 Refresh
            </button>
            <button onClick={queueAll} disabled={busy || ready.length === 0}
              title="Queue every ready completion into the Approvals tab now (the cron does this every 15 min)"
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white px-3 py-2 rounded-lg text-sm font-semibold transition">
              📤 Queue all ready ({ready.length})
            </button>
          </div>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          <Stat label="Ready" n={ready.length} tone="emerald" hint="queued automatically" />
          <Stat label="In Approvals" n={queued.length} tone="sky" hint="approve & submit there" />
          <Stat label="Waiting" n={waiting.length} tone="amber" hint="blocked at CBRE / NTE / times" />
          <Stat label="Rejected" n={rejected.length} tone="rose" hint="needs a manual decision" />
        </div>

        <div className="mt-3">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search WO#, building, or lead tech..."
            className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600 px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500/60" />
        </div>
        {notice && <div className="mt-3 text-sm text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">{notice}</div>}
      </div>

      {items.length === 0 ? (
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-slate-300 font-semibold">Nothing to report</p>
          <p className="text-slate-500 text-sm mt-1">{showTransferred ? 'No entries match your filter.' : 'CBRE has been told about every completion.'}</p>
        </div>
      ) : (
        <>
          <Section title="✅ Ready" hint="the producer queues these into Approvals every 15 min" list={ready} />
          <Section title="📨 In Approvals" hint="approve, open the prefilled form, submit, Mark submitted" list={queued} />
          <Section title="🚫 Rejected" list={rejected} />
          <Section title="⏳ Waiting" hint="becomes ready by itself once the blocker clears" list={waiting} />
          <Section title="✓ Reported" list={done} />
        </>
      )}

      {manualFor && (
        <SendToCbreModal
          workOrder={manualFor}
          supabase={supabase}
          currentUser={currentUser}
          onClose={() => { setManualFor(null); loadData(); }}
        />
      )}
    </div>
  );
}

function Pill({ tone, children }) {
  const cls = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    sky:     'bg-sky-500/15 text-sky-300 border-sky-500/30',
    amber:   'bg-amber-500/15 text-amber-300 border-amber-500/30',
    rose:    'bg-rose-500/15 text-rose-300 border-rose-500/30',
    blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
    slate:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
  }[tone] || '';
  return <span className={`border text-xs font-bold px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}

function Stat({ label, n, tone, hint }) {
  const color = { emerald: 'text-emerald-400', sky: 'text-sky-300', amber: 'text-amber-300', rose: 'text-rose-300' }[tone];
  return (
    <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className={`text-xl font-bold ${color}`}>{n}</span>
        <span className="text-sm text-slate-300">{label}</span>
      </div>
      <div className="text-[11px] text-slate-600">{hint}</div>
    </div>
  );
}

function TimeBox({ label, value }) {
  return (
    <div className={`rounded-lg border px-3 py-2 ${value ? 'bg-[#0a0a0f] border-[#1e1e2e]' : 'bg-rose-500/5 border-rose-500/20'}`}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-sm font-semibold ${value ? 'text-slate-200' : 'text-rose-300'}`}>{value || 'not logged'}</div>
    </div>
  );
}
