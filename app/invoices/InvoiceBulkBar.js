// app/invoices/InvoiceBulkBar.js
// ─────────────────────────────────────────────────────────────────────────────
// The bar that appears when invoices are selected.
//
// Every action says up front how much of the selection it will actually reach,
// and the ones it will not are named with a reason. The office should never
// have to guess what a click covers — the previous single button said
// "Mark 695 as Paid" while quietly meaning "and overwrite the payment date on
// the 351 that already have one".
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useMemo, useState } from 'react';
import { BULK_ACTIONS, planBulkAction, planSummary } from '@/lib/invoiceBulkActions';

const todayISO = () => new Date().toISOString().slice(0, 10);

const VARIANT = {
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  primary: 'bg-blue-600 hover:bg-blue-500 text-white',
  danger:  'bg-red-600 hover:bg-red-500 text-white',
  ghost:   'bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:bg-[#2d2d44]',
};

export default function InvoiceBulkBar({
  selected,          // the selected invoice objects
  total,             // their summed value
  busy,
  onClear,
  onRun,             // (actionKey, plan, inputs) => Promise
  onPushToQB,        // (invoices) => Promise
  onExport,          // (invoices) => void
}) {
  const [openAction, setOpenAction] = useState(null);
  const [inputs, setInputs] = useState({ paid_on: todayISO(), approved_on: todayISO(), reference: '', reason: '', note: '' });

  const plans = useMemo(() => {
    const out = {};
    for (const key of Object.keys(BULK_ACTIONS)) out[key] = planBulkAction(key, selected);
    return out;
  }, [selected]);

  if (!selected.length) return null;

  const set = (k, v) => setInputs((p) => ({ ...p, [k]: v }));

  const run = async (key) => {
    const plan = plans[key];
    const action = BULK_ACTIONS[key];
    if (!plan?.apply.length) return;
    const detail = Object.entries(plan.bySkipReason)
      .map(([reason, n]) => `  · ${n} ${reason}`).join('\n');
    const msg = [
      action.describe(plan.apply.length, inputs),
      '',
      `Selected: ${plan.total}   ·   this touches: ${plan.apply.length}`,
      detail ? `Skipped:\n${detail}` : '',
    ].filter(Boolean).join('\n');
    if (!confirm(msg)) return;
    await onRun(key, plan, inputs);
    setOpenAction(null);
  };

  const ActionButton = ({ k }) => {
    const a = BULK_ACTIONS[k];
    const plan = plans[k];
    const n = plan?.apply.length || 0;
    const needsInput = (a.needs || []).length > 0;
    return (
      <button
        onClick={() => (needsInput ? setOpenAction(openAction === k ? null : k) : run(k))}
        disabled={busy || !n}
        title={n ? planSummary(plan) : `Nothing in this selection ${a.label.toLowerCase()} applies to`}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-35 disabled:cursor-not-allowed ${VARIANT[a.variant] || VARIANT.ghost}`}
      >
        {a.emoji} {a.label}
        <span className="ml-1.5 opacity-70 font-mono">{n}</span>
      </button>
    );
  };

  const openCfg = openAction ? BULK_ACTIONS[openAction] : null;

  return (
    <div className="sticky top-0 z-10 bg-blue-600/20 border-y border-blue-500/40 backdrop-blur-sm px-6 py-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-200">
          <strong className="text-blue-300">{selected.length}</strong> selected
          <span className="text-slate-500 ml-2">
            · Total: <span className="text-emerald-400 font-mono font-bold">${total.toFixed(2)}</span>
          </span>
        </div>
        <button onClick={onClear} className="text-xs text-slate-400 hover:text-slate-200">Clear</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ActionButton k="mark_paid" />
        <ActionButton k="mark_accepted" />
        <ActionButton k="approved_to_pay" />
        <ActionButton k="mark_rejected" />
        <ActionButton k="add_note" />
        <ActionButton k="unmark_paid" />

        <span className="w-px h-5 bg-blue-500/30 mx-1" />

        <button
          onClick={() => onPushToQB(selected)}
          disabled={busy}
          title="Create these in QuickBooks — real invoices, one call each"
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-35 ${VARIANT.ghost}`}
        >
          📗 Push to QuickBooks <span className="ml-1.5 opacity-70 font-mono">{selected.filter(i => !i.qb_invoice_number).length}</span>
        </button>
        <button
          onClick={() => onExport(selected)}
          disabled={busy}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-35 ${VARIANT.ghost}`}
        >
          📊 Export selection
        </button>
      </div>

      {/* Actions that need something typed open a small row rather than a modal —
          the numbers above stay visible while you fill it in. */}
      {openCfg && (
        <div className="flex flex-wrap items-end gap-2 bg-[#0a0a0f]/60 border border-[#2d2d44] rounded-lg p-3">
          {openCfg.needs.includes('paid_on') && (
            <Field label="Paid on">
              <input type="date" value={inputs.paid_on} onChange={(e) => set('paid_on', e.target.value)} className={INPUT} />
            </Field>
          )}
          {openAction === 'mark_paid' && (
            <Field label="Cheque / reference (optional)">
              <input value={inputs.reference} onChange={(e) => set('reference', e.target.value)} placeholder="20085534" className={`${INPUT} font-mono w-40`} />
            </Field>
          )}
          {openCfg.needs.includes('approved_on') && (
            <Field label="Approved to pay on">
              <input type="date" value={inputs.approved_on} onChange={(e) => set('approved_on', e.target.value)} className={INPUT} />
            </Field>
          )}
          {openCfg.needs.includes('reason') && (
            <Field label="Reason CBRE gave">
              <input value={inputs.reason} onChange={(e) => set('reason', e.target.value)} placeholder="e.g. wrong cost centre" className={`${INPUT} w-72`} />
            </Field>
          )}
          {openCfg.needs.includes('note') && (
            <Field label="Note (appended, nothing is replaced)">
              <input value={inputs.note} onChange={(e) => set('note', e.target.value)} placeholder="e.g. chased with Corpay ticket #123" className={`${INPUT} w-96`} />
            </Field>
          )}
          <button
            onClick={() => run(openAction)}
            disabled={busy
              || (openCfg.needs.includes('reason') && !inputs.reason.trim())
              || (openCfg.needs.includes('note') && !inputs.note.trim())}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-35 ${VARIANT[openCfg.variant] || VARIANT.primary}`}
          >
            {busy ? 'Working…' : `Apply to ${plans[openAction]?.apply.length || 0}`}
          </button>
          <button onClick={() => setOpenAction(null)} className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200">Cancel</button>
          <span className="text-[11px] text-slate-500 ml-1">{planSummary(plans[openAction])}</span>
        </div>
      )}
    </div>
  );
}

const INPUT = 'bg-[#0d0d14] border border-[#2d2d44] text-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500/60';

const Field = ({ label, children }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
    {children}
  </label>
);
