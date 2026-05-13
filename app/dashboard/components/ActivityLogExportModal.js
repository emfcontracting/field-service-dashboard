// app/dashboard/components/ActivityLogExportModal.js
// ─────────────────────────────────────────────────────────────────────────────
// Reusable modal — pick which event types and which format to export.
// Used by:
//   • WorkOrderDetailModal  (single WO → passes one wo_id)
//   • UpsEscalationView     (bulk → passes all selected wo_ids)
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import { EVENT_CATEGORIES } from '@/lib/activityLog';
import { exportActivityForWorkOrders } from '@/lib/activityLogExport';

export default function ActivityLogExportModal({
  woIds,            // array — even for single WO pass [woId]
  supabase,
  onClose,
  title,            // optional override; default depends on count
}) {
  // All categories on by default
  const [enabled, setEnabled] = useState(() => new Set(EVENT_CATEGORIES.map(c => c.id)));
  const [busy, setBusy] = useState(false);
  const [busyKind, setBusyKind] = useState(null);  // 'excel' | 'pdf' | null

  const toggle = (id) => {
    setEnabled(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll  = () => setEnabled(new Set(EVENT_CATEGORIES.map(c => c.id)));
  const selectNone = () => setEnabled(new Set());

  const isBulk  = (woIds?.length || 0) > 1;
  const heading = title || (isBulk
    ? `📥 Activity Log Export — ${woIds.length} work orders`
    : `📥 Activity Log Export`);

  const handleExport = async (format) => {
    if (enabled.size === 0) {
      alert('Pick at least one event type to include.');
      return;
    }
    setBusy(true);
    setBusyKind(format);
    try {
      const filename = await exportActivityForWorkOrders(supabase, woIds, {
        enabledCategories: enabled,
        format,
      });
      // Slight delay so the browser download finishes before closing
      setTimeout(() => onClose?.(filename), 300);
    } catch (e) {
      console.error('Activity log export failed:', e);
      alert(`Export failed: ${e.message || e}`);
      setBusy(false);
      setBusyKind(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
      <div className="bg-[#0d0d14] border border-[#2d2d44] rounded-2xl max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-[#2d2d44] flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-100">{heading}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Choose which event types to include, then pick a format.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-slate-500 hover:text-slate-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Categories */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Event types
            </span>
            <div className="flex gap-2 text-xs">
              <button
                onClick={selectAll}
                disabled={busy}
                className="text-blue-400 hover:text-blue-300 transition"
              >
                Select all
              </button>
              <span className="text-slate-700">·</span>
              <button
                onClick={selectNone}
                disabled={busy}
                className="text-slate-500 hover:text-slate-300 transition"
              >
                None
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            {EVENT_CATEGORIES.map(cat => (
              <label
                key={cat.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition cursor-pointer ${
                  enabled.has(cat.id)
                    ? 'bg-blue-500/5 border-blue-500/30 text-slate-200'
                    : 'bg-[#0a0a0f] border-[#1e1e2e] text-slate-500 hover:border-[#2d2d44]'
                }`}
              >
                <input
                  type="checkbox"
                  checked={enabled.has(cat.id)}
                  onChange={() => toggle(cat.id)}
                  disabled={busy}
                  className="w-4 h-4 accent-blue-500"
                />
                <span className="text-sm">{cat.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Footer with format buttons */}
        <div className="p-5 border-t border-[#2d2d44] flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => handleExport('excel')}
            disabled={busy || enabled.size === 0}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-2.5 rounded-lg transition"
          >
            {busyKind === 'excel' ? '⏳ Generating…' : '📊 Export Excel'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={busy || enabled.size === 0}
            className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-2.5 rounded-lg transition"
          >
            {busyKind === 'pdf' ? '⏳ Generating…' : '📄 Export PDF'}
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="bg-[#1e1e2e] hover:bg-[#2d2d44] disabled:opacity-50 text-slate-300 font-medium px-4 py-2.5 rounded-lg transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
