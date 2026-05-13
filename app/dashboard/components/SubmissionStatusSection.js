// app/dashboard/components/SubmissionStatusSection.js
// ─────────────────────────────────────────────────────────────────────────────
// Shows the submission status (Photos / Receipts / PMI Write-ups) for a single
// work order in the dashboard detail modal. Each row has:
//   • icon + label
//   • status pill (Received / Missing / Not Checked / Not Required)
//   • verified_at timestamp (when available)
//   • Refresh button → re-hits /api/verify-{photos|receipts|writeups}/{wo_number}
//   • Override link (admin/office only) → manually mark as received/not received
//
// All three endpoints follow the same shape (GET to check, POST to override),
// so this component drives them with a single config table.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import { getSubmissionStatus, SUBMISSION_META, isPMWorkOrder, needsReceipts } from '@/lib/submissionStatus';

const TYPES = ['photos', 'receipts', 'writeups'];

const STATUS_LABEL = {
  received:     '✓ Received',
  missing:      '✗ Missing',
  not_checked:  '⏳ Not checked',
  not_required: '— Not required',
};

const STATUS_CLASS = {
  received:     'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  missing:      'bg-red-500/20    text-red-400    border-red-500/30',
  not_checked:  'bg-slate-700/30  text-slate-400  border-slate-600/30',
  not_required: 'bg-slate-800/50  text-slate-600  border-slate-700/30',
};

const fmtTs = (ts) => {
  if (!ts) return null;
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
    });
  } catch { return null; }
};

export default function SubmissionStatusSection({ workOrder, currentUser, onUpdated }) {
  const [busy, setBusy] = useState({ photos: false, receipts: false, writeups: false });

  const canOverride = currentUser?.role === 'admin' || currentUser?.role === 'office_staff';
  const status = getSubmissionStatus(workOrder);
  const woNumber = workOrder?.wo_number;

  // Re-check via IMAP search (server-side hits emfcbre@gmail.com).
  const handleRefresh = async (type) => {
    if (!woNumber) return;
    setBusy(s => ({ ...s, [type]: true }));
    try {
      const res = await fetch(`/api/verify-${type}/${encodeURIComponent(woNumber)}`);
      const data = await res.json();
      if (!data.success && data.search_error) {
        alert(`Search failed: ${data.search_error}`);
      }
      // Inbox state changed (or just timestamp) — reload parent.
      onUpdated?.();
    } catch (e) {
      alert(`Refresh failed: ${e.message}`);
    } finally {
      setBusy(s => ({ ...s, [type]: false }));
    }
  };

  // Manual override for admin / office. Useful when receipts came in via
  // text message, photo handed over in person, etc.
  const handleOverride = async (type, received) => {
    if (!woNumber) return;
    const meta = SUBMISSION_META[type];
    const reason = window.prompt(
      received
        ? `Mark ${meta.verb} as RECEIVED for ${woNumber}?\n\nOptionally note the reason (e.g. "handed in person", "text message", etc):`
        : `Mark ${meta.verb} as NOT received for ${woNumber}?\n\nReason:`
    );
    // null = user clicked Cancel
    if (reason === null) return;
    setBusy(s => ({ ...s, [type]: true }));
    try {
      const res = await fetch(`/api/verify-${type}/${encodeURIComponent(woNumber)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ received, override_reason: reason || null }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(`Override failed: ${data.error || 'unknown error'}`);
        return;
      }
      onUpdated?.();
    } catch (e) {
      alert(`Override failed: ${e.message}`);
    } finally {
      setBusy(s => ({ ...s, [type]: false }));
    }
  };

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          📤 Tech Submissions
          <span className="text-xs text-slate-500 font-normal">
            (emfcbre@gmail.com)
          </span>
        </h3>
      </div>

      <div className="space-y-2">
        {TYPES.map(type => {
          const st = status[type];
          const meta = SUBMISSION_META[type];
          const verifiedAt = workOrder?.[`${type}_verified_at`];
          const emailSubject = workOrder?.[`${type}_email_subject`];
          const isBusy = busy[type];

          return (
            <div
              key={type}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                st === 'received'    ? 'bg-emerald-500/5 border-emerald-500/15' :
                st === 'missing'     ? 'bg-red-500/5     border-red-500/15'    :
                st === 'not_required'? 'bg-slate-900/30  border-slate-800/40 opacity-60' :
                                       'bg-slate-800/20  border-slate-700/30'
              }`}
            >
              {/* Icon + Label */}
              <div className="flex items-center gap-2 min-w-[140px]">
                <span className="text-lg leading-none">{meta.icon}</span>
                <span className="text-sm font-medium text-slate-300">{meta.label}</span>
              </div>

              {/* Status pill */}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLASS[st]}`}>
                {STATUS_LABEL[st]}
              </span>

              {/* Verified at / email subject */}
              <div className="flex-1 min-w-0 text-xs text-slate-500 truncate">
                {st === 'received' && emailSubject && (
                  <span title={emailSubject}>
                    “{emailSubject}”
                  </span>
                )}
                {st !== 'received' && verifiedAt && (
                  <span title={`Last checked ${fmtTs(verifiedAt)}`}>
                    Last checked: {fmtTs(verifiedAt)}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              {st !== 'not_required' && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleRefresh(type)}
                    disabled={isBusy}
                    className="bg-[#1e1e2e] hover:bg-[#2d2d44] disabled:opacity-50 text-slate-300 text-xs font-medium px-2.5 py-1 rounded-md transition"
                    title="Re-check inbox now"
                  >
                    {isBusy ? '…' : '🔄'}
                  </button>
                  {canOverride && (
                    st === 'received' ? (
                      <button
                        onClick={() => handleOverride(type, false)}
                        disabled={isBusy}
                        className="bg-red-500/15 hover:bg-red-500/30 text-red-400 text-xs font-medium px-2.5 py-1 rounded-md transition border border-red-500/30"
                        title="Manually unmark (override)"
                      >
                        Undo
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOverride(type, true)}
                        disabled={isBusy}
                        className="bg-emerald-500/15 hover:bg-emerald-500/30 text-emerald-400 text-xs font-medium px-2.5 py-1 rounded-md transition border border-emerald-500/30"
                        title="Manually mark as received"
                      >
                        Mark ✓
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Help footer — only show context that's relevant for this WO */}
      <div className="mt-3 pt-3 border-t border-[#1e1e2e] text-[11px] text-slate-600 space-y-0.5">
        <div>📷 Photos — required for every work order</div>
        {needsReceipts(workOrder) && (
          <div>🧾 Receipts — required because materials were billed</div>
        )}
        {isPMWorkOrder(woNumber) && (
          <div>📝 PMI Write-ups — required for PM work orders</div>
        )}
      </div>
    </div>
  );
}
