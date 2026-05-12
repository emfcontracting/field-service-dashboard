// app/components/MarkDisputedModal.js
// ─────────────────────────────────────────────────────────────────────────────
// Reusable modal to mark a Work Order (and its invoice if any) as disputed.
// Used from: Invoice Detail Modal, WO Detail Modal, UPS Escalation page.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { DISPUTE_REASONS } from '@/lib/disputeStatus';

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function MarkDisputedModal({
  workOrder,        // { wo_id, wo_number, building, nte, ... }
  invoice,          // optional { invoice_id, invoice_number, total }
  onClose,
  onSaved,
}) {
  const [reason, setReason] = useState('cbre_cancelled');
  const [notes, setNotes]   = useState('');
  // Default amount: invoice total if exists, otherwise WO's NTE, otherwise 0
  const defaultAmount = parseFloat(invoice?.total) || parseFloat(workOrder?.nte) || 0;
  const [amount, setAmount] = useState(defaultAmount.toString());
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!workOrder?.wo_id) {
      alert('Missing work order');
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabaseClient
        .from('work_orders')
        .update({
          dispute_status: 'open',
          dispute_reason: reason,
          dispute_notes: notes || null,
          dispute_amount: parseFloat(amount) || 0,
          dispute_opened_at: now,
        })
        .eq('wo_id', workOrder.wo_id);

      if (error) throw error;

      onSaved?.();
      onClose();
    } catch (e) {
      alert('Failed to mark as disputed: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl max-w-lg w-full shadow-2xl">
        <div className="px-6 py-5 border-b border-[#1e1e2e] flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              🔴 Mark as CBRE Disputed
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">
              WO #{workOrder?.wo_number} {workOrder?.building && `— ${workOrder.building}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-xs text-yellow-300">
            <strong>This will:</strong>
            <ul className="mt-1 list-disc list-inside space-y-0.5 text-yellow-300/80">
              <li>Open a new dispute (Status: Open)</li>
              <li>Remove this WO/Invoice from Cash Flow forecasts</li>
              <li>Add it to the UPS Escalation tab for follow-up</li>
            </ul>
          </div>

          {/* Reason dropdown */}
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/60">
              {Object.entries(DISPUTE_REASONS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <p className="text-slate-600 text-xs mt-1">{DISPUTE_REASONS[reason]?.description}</p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">
              Amount at Risk ($)
            </label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/60 font-mono" />
            <p className="text-slate-600 text-xs mt-1">
              Default: {invoice?.total ? `Invoice total ($${parseFloat(invoice.total).toFixed(2)})` : workOrder?.nte ? `WO NTE ($${parseFloat(workOrder.nte).toFixed(2)})` : 'enter manually'}
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">
              Notes <span className="text-slate-700 font-normal normal-case">(initial context)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={4}
              placeholder="e.g. CBRE closed due to inactivity on 5/10. Work was completed, parts purchased. Will escalate to Deontye..."
              className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/60 resize-none" />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[#1e1e2e] flex justify-end gap-2">
          <button onClick={onClose} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:bg-[#2d2d44] disabled:opacity-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-500 text-white disabled:opacity-50">
            {saving ? 'Saving...' : '🔴 Mark Disputed'}
          </button>
        </div>
      </div>
    </div>
  );
}
