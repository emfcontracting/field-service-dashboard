// app/dashboard/components/ArchiveView.js
// ─────────────────────────────────────────────────────────────────────────────
// Where work orders go instead of being deleted. Admin-only in the nav.
//
// The main dashboard hides anything with archived_at set; this is the one
// place that shows exactly those, with who archived it, when and why.
// Restore puts a work order straight back. Deleting for good lives here and
// nowhere else — Daniel's decision of 2026-11-03: it takes two deliberate
// steps now, archive first and delete from here, and only the superuser sees
// the second one.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ARCHIVE_REASONS, archiveReasonLabel, restoreWorkOrders } from '@/lib/workOrderArchive';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const fmtDate = (v) => {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-US');
};

// "cbre_cancelled: note" → the label plus the note
function reasonText(raw) {
  if (!raw) return '—';
  const [head, ...rest] = String(raw).split(':');
  const known = ARCHIVE_REASONS.some((r) => r.value === head);
  if (!known) return raw;
  const note = rest.join(':').trim();
  return note ? `${archiveReasonLabel(head)} — ${note}` : archiveReasonLabel(head);
}

export default function ArchiveView({ currentUser, isSuperuser = false, onSelectWorkOrder }) {
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [{ data, error: err }, { data: us }] = await Promise.all([
        supabase
          .from('work_orders')
          .select('wo_id, wo_number, building, work_order_description, priority, status, cbre_status, nte, date_entered, qb_invoice_number, archived_at, archived_by, archive_reason')
          .not('archived_at', 'is', null)
          .order('archived_at', { ascending: false }),
        supabase.from('users').select('user_id, first_name, last_name'),
      ]);
      if (err) throw err;
      setRows(data || []);
      setUsers(Object.fromEntries((us || []).map((u) => [u.user_id, `${u.first_name || ''} ${u.last_name || ''}`.trim()])));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (reasonFilter !== 'all' && !String(r.archive_reason || '').startsWith(reasonFilter)) return false;
      if (!q) return true;
      return [r.wo_number, r.building, r.work_order_description, r.archive_reason]
        .some((v) => String(v || '').toLowerCase().includes(q));
    });
  }, [rows, search, reasonFilter]);

  const toggle = (id) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.wo_id));
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map((r) => r.wo_id)));

  async function handleRestore() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBusy(true); setError(null);
    const { error: err } = await restoreWorkOrders(supabase, ids);
    if (err) setError(err.message);
    else {
      setNotice(`${ids.length} work order${ids.length === 1 ? '' : 's'} restored to the dashboard.`);
      setSelected(new Set());
      await load();
    }
    setBusy(false);
  }

  // The only delete left in the app. Same cascade the old dashboard button had.
  async function handleDelete() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBusy(true); setError(null);
    try {
      await supabase.from('work_order_assignments').delete().in('wo_id', ids);
      await supabase.from('daily_hours_log').delete().in('wo_id', ids);
      const { error: err } = await supabase.from('work_orders').delete().in('wo_id', ids);
      if (err) throw err;
      setNotice(`${ids.length} work order${ids.length === 1 ? '' : 's'} permanently deleted.`);
      setSelected(new Set());
      setConfirmDelete(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Archive</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Work orders taken out of the dashboard. Nothing here is deleted — every one can be restored.
          </p>
        </div>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700 text-slate-400 hover:text-slate-200"
        >
          Refresh
        </button>
      </div>

      {error &&  <div className="rounded-lg border border-red-500/50 bg-red-900/30 px-3 py-2 text-sm text-red-200">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-500/50 bg-emerald-900/20 px-3 py-2 text-sm text-emerald-200">{notice}</div>}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search WO #, building, reason…"
          className="bg-[#14141f] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 w-64"
        />
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="bg-[#14141f] border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200"
        >
          <option value="all">All reasons</option>
          {ARCHIVE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <span className="text-sm text-slate-500">{shown.length} of {rows.length}</span>
      </div>

      {selected.size > 0 && (
        <div className="bg-slate-800/70 border border-slate-600 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-slate-100 font-semibold">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="text-slate-400 hover:text-slate-200 text-sm underline"
            >Clear</button>
            <button
              onClick={handleRestore}
              disabled={busy}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-900 px-4 py-2 rounded font-bold text-white"
            >↩️ Restore to dashboard</button>
            {isSuperuser && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="bg-red-600 hover:bg-red-500 disabled:bg-red-900 px-4 py-2 rounded font-bold text-white"
              >🗑️ Delete permanently</button>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-[#14141f] text-slate-400">
            <tr>
              <th className="p-2 w-8"><input type="checkbox" checked={allShownSelected} onChange={toggleAll} /></th>
              <th className="p-2 text-left">WO #</th>
              <th className="p-2 text-left">Building</th>
              <th className="p-2 text-left">Entered</th>
              <th className="p-2 text-left">Reason</th>
              <th className="p-2 text-left">Archived</th>
              <th className="p-2 text-left">By</th>
              <th className="p-2 text-right">NTE</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="p-6 text-center text-slate-500">Loading…</td></tr>}
            {!loading && shown.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-slate-500">Nothing archived.</td></tr>
            )}
            {shown.map((r) => (
              <tr key={r.wo_id} className="border-t border-slate-800 hover:bg-slate-800/40">
                <td className="p-2"><input type="checkbox" checked={selected.has(r.wo_id)} onChange={() => toggle(r.wo_id)} /></td>
                <td className="p-2">
                  <button
                    onClick={() => onSelectWorkOrder && onSelectWorkOrder(r)}
                    className="text-blue-400 hover:text-blue-300 font-semibold"
                  >{r.wo_number}</button>
                  {r.qb_invoice_number && (
                    <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300">
                      inv {r.qb_invoice_number}
                    </span>
                  )}
                </td>
                <td className="p-2 text-slate-300">{r.building || '—'}</td>
                <td className="p-2 text-slate-400">{fmtDate(r.date_entered)}</td>
                <td className="p-2 text-slate-300">{reasonText(r.archive_reason)}</td>
                <td className="p-2 text-slate-400">{fmtDate(r.archived_at)}</td>
                <td className="p-2 text-slate-400">{users[r.archived_by] || '—'}</td>
                <td className="p-2 text-right text-slate-300">{r.nte != null ? Number(r.nte).toFixed(2) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-[#0d0d14] rounded-lg p-6 max-w-md w-full mx-4 border border-red-500">
            <h3 className="text-xl font-bold text-red-400 mb-4">⚠️ Delete permanently</h3>
            <p className="text-slate-300 mb-4">
              Delete <strong className="text-white">{selected.size} work order(s)</strong> for good?
            </p>
            <p className="text-red-400 text-sm mb-6">
              This also removes their assignments and daily hours. Nothing is recoverable afterwards —
              restoring from the archive will no longer be possible.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDelete(false)} disabled={busy}
                className="bg-[#2d2d44] hover:bg-[#3d3d5e] px-4 py-2 rounded font-semibold">Cancel</button>
              <button onClick={handleDelete} disabled={busy}
                className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold">
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
