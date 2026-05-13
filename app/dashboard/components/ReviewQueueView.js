// app/dashboard/components/ReviewQueueView.js
// ─────────────────────────────────────────────────────────────────────────────
// Review Queue — all open flags across all WOs, grouped by priority.
// Lets admins/office:
//   • see what needs Daniel's attention at a glance
//   • click through to the flagged WO (opens the detail modal)
//   • resolve from here without opening the WO (with optional note)
//
// Recently resolved flags are shown collapsed at the bottom — Daniel can scan
// what's been cleared in the last week or so.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useMemo } from 'react';

const PRIORITY_META = {
  high:   { label: '🔴 High',   colour: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    dot: 'bg-red-500' },
  medium: { label: '🟠 Medium', colour: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-500' },
  low:    { label: '🟡 Low',    colour: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
};

const PRIORITY_ORDER = ['high', 'medium', 'low'];

const fmtDateTime = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

// Relative time ("3h ago", "2d ago") — keeps the queue glanceable.
const timeAgo = (ts) => {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export default function ReviewQueueView({ currentUser, onSelectWorkOrder, refreshWorkOrders }) {
  const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'office_staff';
  const isSuperadmin = currentUser?.email === 'jones.emfcontracting@gmail.com';

  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all'); // all | high | medium | low
  const [showResolved, setShowResolved] = useState(false);

  // ── Load all flags ─────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/flags');
      const data = await res.json();
      setFlags(data.flags || []);
    } catch (e) {
      console.error('ReviewQueue load:', e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (isAuthorized) load(); /* eslint-disable-next-line */ }, [isAuthorized]);

  // ── Resolve / delete ───────────────────────────────────────────────────
  const handleResolve = async (flag) => {
    const note = window.prompt(
      `Resolve flag from ${flag.flagger?.first_name} ${flag.flagger?.last_name} on ${flag.work_order?.wo_number}?\n\n` +
      `"${flag.comment}"\n\n` +
      `Optional note about what was done:`
    );
    if (note === null) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/flags/${flag.flag_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.user_id, resolution_note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) { alert(`Resolve failed: ${data.error}`); return; }
      await load();
      refreshWorkOrders?.();
    } catch (e) {
      alert(`Resolve failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (flag) => {
    if (!confirm(`Delete this flag? Cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/flags/${flag.flag_id}?user_id=${currentUser.user_id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { alert(`Delete failed: ${data.error}`); return; }
      await load();
      refreshWorkOrders?.();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const canActOn = (flag) => isSuperadmin || flag.flagged_by === currentUser?.user_id;

  // ── Group & filter ─────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const s = search.trim().toLowerCase();
    const filtered = flags.filter(f => {
      if (priorityFilter !== 'all' && f.priority !== priorityFilter) return false;
      if (s) {
        const hay = `${f.work_order?.wo_number} ${f.work_order?.building} ${f.comment} ${f.flagger?.first_name} ${f.flagger?.last_name}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
    const open = filtered.filter(f => f.status === 'open');
    const resolved = filtered.filter(f => f.status === 'resolved');

    const byPriority = { high: [], medium: [], low: [] };
    open.forEach(f => { (byPriority[f.priority] || byPriority.medium).push(f); });
    // Within each priority, oldest first so nothing rots
    Object.values(byPriority).forEach(arr =>
      arr.sort((a, b) => new Date(a.flagged_at) - new Date(b.flagged_at))
    );
    // Resolved: newest first
    resolved.sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at));

    return { open, byPriority, resolved };
  }, [flags, search, priorityFilter]);

  // ── Authorization gate ────────────────────────────────────────────────
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
          <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
          <p className="text-slate-500 text-sm">Loading review queue…</p>
        </div>
      </div>
    );
  }

  const openCount = grouped.open.length;

  return (
    <div className="space-y-5">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              🚩 Review Queue
              {openCount > 0 && (
                <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-sm font-bold px-2.5 py-0.5 rounded-full">
                  {openCount} open
                </span>
              )}
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Work orders flagged by admin/office for review
              {isSuperadmin && <span className="text-amber-400/70"> · you can resolve any flag</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Priority filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-[#0a0a0f] border border-[#2d2d44] text-slate-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-amber-500/60"
            >
              <option value="all">All priorities</option>
              <option value="high">🔴 High only</option>
              <option value="medium">🟠 Medium+</option>
              <option value="low">🟡 Low only</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
              <input type="checkbox" checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
                className="w-4 h-4 accent-amber-500" />
              Show resolved
            </label>
            <button
              onClick={load}
              className="bg-[#1e1e2e] border border-[#2d2d44] hover:bg-[#2d2d44] text-slate-300 px-3 py-2 rounded-lg text-sm transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
        <div className="mt-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search WO#, building, comment, or flagger…"
            className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600 px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-amber-500/60"
          />
        </div>
      </div>

      {/* ── Open Flags grouped by priority ───────────────────────────── */}
      {openCount === 0 ? (
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-12 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <p className="text-slate-300 font-semibold">All clear!</p>
          <p className="text-slate-500 text-sm mt-1">No open flags right now.</p>
        </div>
      ) : (
        PRIORITY_ORDER.map(priority => {
          const items = grouped.byPriority[priority];
          if (!items?.length) return null;
          const meta = PRIORITY_META[priority];

          return (
            <div key={priority} className={`${meta.bg} border ${meta.border} rounded-xl overflow-hidden`}>
              <div className="px-4 py-2 border-b border-[#2d2d44]/30 flex items-center gap-2">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                <span className={`text-sm font-bold ${meta.colour} uppercase tracking-wide`}>
                  {meta.label}
                </span>
                <span className="text-xs text-slate-500">· {items.length}</span>
              </div>
              <div className="divide-y divide-[#1e1e2e]">
                {items.map(flag => (
                  <div key={flag.flag_id} className="px-4 py-3 hover:bg-[#1e1e2e]/30 transition">
                    <div className="flex items-start justify-between gap-3 flex-wrap mb-1.5">
                      <div className="flex items-center gap-2 text-sm flex-wrap">
                        {/* Clickable WO# — opens detail modal */}
                        <button
                          onClick={() => onSelectWorkOrder?.(flag.work_order)}
                          className="font-mono font-bold text-blue-400 hover:text-blue-300 hover:underline transition"
                          title="Open work order"
                        >
                          {flag.work_order?.wo_number}
                        </button>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-300">{flag.work_order?.building || '—'}</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-400">
                          {flag.flagger?.first_name} {flag.flagger?.last_name}
                        </span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-500" title={fmtDateTime(flag.flagged_at)}>
                          {timeAgo(flag.flagged_at)}
                        </span>
                      </div>
                      {canActOn(flag) && (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleResolve(flag)}
                            disabled={busy}
                            className="bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-2.5 py-1 rounded-md transition"
                          >
                            ✓ Resolve
                          </button>
                          <button
                            onClick={() => handleDelete(flag)}
                            disabled={busy}
                            className="bg-red-500/15 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-xs font-semibold px-2.5 py-1 rounded-md transition"
                            title="Delete this flag"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-slate-200 whitespace-pre-wrap">{flag.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* ── Resolved (collapsible) ───────────────────────────────────── */}
      {showResolved && grouped.resolved.length > 0 && (
        <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
            <span className="text-emerald-500">✓</span>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-wide">Resolved</span>
            <span className="text-xs text-slate-600">· {grouped.resolved.length}</span>
          </div>
          <div className="divide-y divide-slate-800 max-h-[40vh] overflow-y-auto">
            {grouped.resolved.map(flag => (
              <div key={flag.flag_id} className="px-4 py-2.5 opacity-70">
                <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                  <div className="flex items-center gap-2 text-xs flex-wrap">
                    <button
                      onClick={() => onSelectWorkOrder?.(flag.work_order)}
                      className="font-mono font-semibold text-blue-400/70 hover:text-blue-300 hover:underline transition"
                    >
                      {flag.work_order?.wo_number}
                    </button>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-500">
                      {flag.flagger?.first_name} {flag.flagger?.last_name}
                    </span>
                    <span className="text-slate-600">→ resolved by</span>
                    <span className="text-slate-500">
                      {flag.resolver?.first_name} {flag.resolver?.last_name}
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-slate-600">{timeAgo(flag.resolved_at)}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 whitespace-pre-wrap">{flag.comment}</p>
                {flag.resolution_note && (
                  <p className="text-xs text-emerald-400/70 mt-1 pl-2 border-l-2 border-emerald-500/20 whitespace-pre-wrap">
                    {flag.resolution_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
