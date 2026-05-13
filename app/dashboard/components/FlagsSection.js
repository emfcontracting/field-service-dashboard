// app/dashboard/components/FlagsSection.js
// ─────────────────────────────────────────────────────────────────────────────
// Per-WO flags display inside WorkOrderDetailModal.
// Shows open + resolved flags, inline add form, resolve/delete actions.
// Admin/office_staff only — non-eligible users see nothing.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect } from 'react';

const PRIORITY_META = {
  high:   { label: 'High',   colour: 'bg-red-500/15    text-red-400    border-red-500/30',    dot: 'bg-red-500' },
  medium: { label: 'Medium', colour: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dot: 'bg-orange-500' },
  low:    { label: 'Low',    colour: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', dot: 'bg-yellow-500' },
};

const fmtDateTime = (ts) => {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
  });
};

export default function FlagsSection({ workOrder, currentUser }) {
  const canFlag = currentUser?.role === 'admin' || currentUser?.role === 'office_staff';

  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newPriority, setNewPriority] = useState('medium');
  const [busy, setBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  // Load flags for this WO
  const load = async () => {
    if (!workOrder?.wo_id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/flags?wo_id=${workOrder.wo_id}`);
      const data = await res.json();
      setFlags(data.flags || []);
    } catch (e) {
      console.error('FlagsSection load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [workOrder?.wo_id]);

  // Sort: open first (high → medium → low → oldest first), then resolved (newest first)
  const sorted = (() => {
    const pri = { high: 0, medium: 1, low: 2 };
    const open = flags.filter(f => f.status === 'open').sort((a, b) => {
      const p = (pri[a.priority] ?? 9) - (pri[b.priority] ?? 9);
      if (p !== 0) return p;
      return new Date(a.flagged_at) - new Date(b.flagged_at);
    });
    const resolved = flags.filter(f => f.status === 'resolved')
      .sort((a, b) => new Date(b.resolved_at) - new Date(a.resolved_at));
    return { open, resolved };
  })();

  // Don't render the whole section for users without permission — and only if
  // there's nothing to show. If they DO have a (somehow existing) flag, we
  // still don't render because their role can't act on it anyway.
  if (!canFlag) return null;

  const handleAdd = async () => {
    if (!newComment.trim()) {
      alert('Please add a comment so the reviewer knows what to look at.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wo_id: workOrder.wo_id,
          user_id: currentUser.user_id,
          comment: newComment,
          priority: newPriority,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Flag failed: ${data.error || 'unknown error'}`);
        return;
      }
      // Reset form + reload
      setNewComment('');
      setNewPriority('medium');
      setShowAdd(false);
      await load();
    } catch (e) {
      alert(`Flag failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleResolve = async (flag) => {
    const note = window.prompt(
      `Resolve flag from ${flag.flagger?.first_name} ${flag.flagger?.last_name}?\n\n` +
      `"${flag.comment}"\n\n` +
      `Optional resolution note (what was checked / done):`
    );
    if (note === null) return;  // user cancelled
    setBusy(true);
    try {
      const res = await fetch(`/api/flags/${flag.flag_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: currentUser.user_id,
          resolution_note: note || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Resolve failed: ${data.error || 'unknown error'}`);
        return;
      }
      await load();
    } catch (e) {
      alert(`Resolve failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (flag) => {
    if (!confirm(`Delete this flag? This cannot be undone.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/flags/${flag.flag_id}?user_id=${currentUser.user_id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Delete failed: ${data.error || 'unknown error'}`);
        return;
      }
      await load();
    } catch (e) {
      alert(`Delete failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  // Can current user act on this specific flag? (resolve / delete)
  // Superadmin gets it via the API check, but we can also gate the buttons
  // visually so non-owners just don't see them. Front-end uses email match.
  const isSuperadmin = currentUser?.email === 'jones.emfcontracting@gmail.com';
  const canActOn = (flag) => isSuperadmin || flag.flagged_by === currentUser?.user_id;

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold text-sm text-amber-300 flex items-center gap-2">
          🚩 Review Flags
          {sorted.open.length > 0 && (
            <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
              {sorted.open.length} open
            </span>
          )}
        </h3>
        <div className="flex gap-2 items-center">
          {sorted.resolved.length > 0 && (
            <button
              onClick={() => setShowResolved(s => !s)}
              className="text-xs text-slate-500 hover:text-slate-300 transition"
            >
              {showResolved ? 'Hide' : 'Show'} resolved ({sorted.resolved.length})
            </button>
          )}
          <button
            onClick={() => setShowAdd(s => !s)}
            disabled={busy}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
          >
            {showAdd ? '× Cancel' : '+ Flag for review'}
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-[#0d0d14] border border-[#2d2d44] rounded-lg p-3 mb-3 space-y-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="What should be reviewed? (required)"
            rows={3}
            className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-amber-500/60"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 mr-1">Priority:</span>
              {Object.entries(PRIORITY_META).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => setNewPriority(key)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md border transition ${
                    newPriority === key
                      ? meta.colour
                      : 'bg-transparent text-slate-500 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {meta.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleAdd}
              disabled={busy || !newComment.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-1.5 rounded-lg transition"
            >
              {busy ? 'Submitting…' : '🚩 Submit flag'}
            </button>
          </div>
          <p className="text-[11px] text-slate-600">
            Daniel will be notified by email when this flag is created.
          </p>
        </div>
      )}

      {/* Flags list */}
      {loading ? (
        <div className="text-center py-4 text-slate-600 text-xs">Loading flags…</div>
      ) : sorted.open.length === 0 && (!showResolved || sorted.resolved.length === 0) ? (
        <div className="text-center py-3 text-slate-600 text-xs italic">
          {flags.length === 0 ? 'No flags raised on this work order' : 'No open flags'}
        </div>
      ) : (
        <div className="space-y-2">
          {/* Open flags */}
          {sorted.open.map(flag => {
            const meta = PRIORITY_META[flag.priority] || PRIORITY_META.medium;
            return (
              <div
                key={flag.flag_id}
                className={`border rounded-lg p-3 ${meta.colour.replace('text-', 'border-').split(' ').find(c => c.startsWith('border-'))} bg-[#0d0d14]`}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5 flex-wrap">
                  <div className="flex items-center gap-2 text-xs">
                    <span className={`inline-block w-2 h-2 rounded-full ${meta.dot}`} />
                    <span className={`font-semibold ${meta.colour.split(' ').find(c => c.startsWith('text-'))}`}>
                      {meta.label}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-300 font-medium">
                      {flag.flagger?.first_name} {flag.flagger?.last_name}
                    </span>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-500">{fmtDateTime(flag.flagged_at)}</span>
                  </div>
                  {canActOn(flag) && (
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => handleResolve(flag)}
                        disabled={busy}
                        className="bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-2.5 py-1 rounded-md transition"
                        title="Mark as resolved"
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
            );
          })}

          {/* Resolved flags (collapsed by default) */}
          {showResolved && sorted.resolved.map(flag => (
            <div key={flag.flag_id} className="border border-slate-700/40 bg-slate-900/30 rounded-lg p-3 opacity-70">
              <div className="flex items-start justify-between gap-3 mb-1 flex-wrap">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-500">✓</span>
                  <span className="text-slate-400 font-medium">
                    {flag.flagger?.first_name} {flag.flagger?.last_name}
                  </span>
                  <span className="text-slate-600">→ resolved by</span>
                  <span className="text-slate-400">
                    {flag.resolver?.first_name} {flag.resolver?.last_name}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span className="text-slate-600">{fmtDateTime(flag.resolved_at)}</span>
                </div>
                {canActOn(flag) && (
                  <button
                    onClick={() => handleDelete(flag)}
                    disabled={busy}
                    className="text-slate-600 hover:text-red-400 text-xs transition"
                    title="Delete this resolved flag from history"
                  >
                    🗑
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 whitespace-pre-wrap">{flag.comment}</p>
              {flag.resolution_note && (
                <p className="text-xs text-emerald-400/80 mt-1.5 pl-3 border-l-2 border-emerald-500/30 whitespace-pre-wrap">
                  <span className="text-emerald-500/70 font-semibold">Resolution: </span>
                  {flag.resolution_note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
