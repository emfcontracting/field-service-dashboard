// app/dashboard/components/MissingDataModal.js
'use client';

import { useState, useEffect } from 'react';

/**
 * Strukturierte Missing-Data Erfassung für Office/Admin.
 *
 * Modes:
 *   - 'create' : neue Markierung. Speichert previous_status, setzt status='missing_data'.
 *   - 'edit'   : bestehende Markierung editieren. Ändert nur items + comment.
 *
 * Props:
 *   - workOrder: das WO objekt (muss wo_id, status, comments enthalten)
 *   - currentUser: { user_id, first_name, last_name } – wer flaggt
 *   - supabase: Supabase client
 *   - mode: 'create' | 'edit'
 *   - onClose: () => void
 *   - onSaved: (updatedWO) => void – Parent updated state
 */

const MISSING_DATA_ITEMS = [
  { id: 'photos',           icon: '📷', label: 'Photos missing' },
  { id: 'writeup',          icon: '✍️', label: 'Write-up missing' },
  { id: 'daily_hours',      icon: '⏱️', label: 'Daily Hours incomplete' },
  { id: 'material_costs',   icon: '💲', label: 'Material costs missing' },
  { id: 'signature',        icon: '✒️', label: 'Customer signature missing' },
  { id: 'checkin_checkout', icon: '🚪', label: 'Check-in / Check-out missing' },
  { id: 'other',            icon: '❓', label: 'Other (must specify in comment)' }
];

const MIN_COMMENT_LENGTH = 15;
const MIN_COMMENT_LENGTH_WITH_OTHER = 30;

// UUID v4-ish validation. Returns the value if it looks like a UUID, otherwise null.
// Prevents 400 errors from PostgREST when currentUser.user_id is missing or in a
// different shape (e.g. auth ID vs users.user_id mapping).
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeUuid(val) {
  if (typeof val !== 'string') return null;
  return UUID_REGEX.test(val) ? val : null;
}

export default function MissingDataModal({
  workOrder,
  currentUser,
  supabase,
  mode = 'create',
  onClose,
  onSaved
}) {
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  // Prefill when editing
  useEffect(() => {
    if (mode === 'edit' && workOrder) {
      const items = Array.isArray(workOrder.missing_data_items)
        ? workOrder.missing_data_items
        : [];
      setSelectedItems(new Set(items));
      setComment(workOrder.missing_data_comment || '');
    } else {
      setSelectedItems(new Set());
      setComment('');
    }
  }, [mode, workOrder]);

  const toggleItem = (id) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasOther = selectedItems.has('other');
  const requiredCommentLength = hasOther ? MIN_COMMENT_LENGTH_WITH_OTHER : MIN_COMMENT_LENGTH;
  const commentLengthOK = comment.trim().length >= requiredCommentLength;
  const hasItems = selectedItems.size > 0;
  const canSave = hasItems && commentLengthOK && !saving;

  const handleSave = async () => {
    if (!canSave) return;

    try {
      setSaving(true);

      const itemsArray = Array.from(selectedItems);
      const nowISO = new Date().toISOString();
      const flaggerName =
        `${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`.trim() ||
        'Office';

      let updatePayload;
      let commentLogEntry;

      if (mode === 'create') {
        // Save the previous status so we can restore it on resolve.
        // Defensive: if WO is already missing_data, do NOT overwrite previous_status.
        const previousStatus =
          workOrder.status === 'missing_data'
            ? (workOrder.previous_status || 'in_progress')
            : workOrder.status;

        updatePayload = {
          status: 'missing_data',
          previous_status: previousStatus,
          missing_data_items: itemsArray,
          missing_data_comment: comment.trim(),
          missing_data_flagged_by: safeUuid(currentUser?.user_id),
          missing_data_flagged_at: nowISO,
          // Clear any leftover snooze from a previous flag cycle
          missing_data_snoozed_until: null,
          missing_data_snooze_reason: null
        };

        commentLogEntry =
          `[${new Date().toLocaleString()}] ${flaggerName} — 🚩 FLAGGED MISSING DATA\n` +
          `Items: ${itemsArray.join(', ')}\n` +
          `Note: ${comment.trim()}`;
      } else {
        // edit mode — keep flagged_by / flagged_at, only update items + comment
        updatePayload = {
          missing_data_items: itemsArray,
          missing_data_comment: comment.trim()
        };

        commentLogEntry =
          `[${new Date().toLocaleString()}] ${flaggerName} — ✏️ UPDATED MISSING DATA FLAG\n` +
          `Items: ${itemsArray.join(', ')}\n` +
          `Note: ${comment.trim()}`;
      }

      // Append to comments log (fetch fresh, then append — same pattern as checkIn/checkOut)
      const { data: freshWO, error: fetchErr } = await supabase
        .from('work_orders')
        .select('comments')
        .eq('wo_id', workOrder.wo_id)
        .single();

      if (fetchErr) throw fetchErr;

      const existingComments = freshWO?.comments || '';
      updatePayload.comments = existingComments
        ? `${existingComments}\n\n${commentLogEntry}`
        : commentLogEntry;

      // Persist
      const { data: updated, error: updateErr } = await supabase
        .from('work_orders')
        .update(updatePayload)
        .eq('wo_id', workOrder.wo_id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      if (onSaved) {
        onSaved(updated);
      }
      onClose();
    } catch (err) {
      // Surface Supabase error details so we can actually see what went wrong.
      // Supabase errors carry message/details/hint/code separately.
      console.error('Error saving missing data flag:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        raw: err
      });
      const detail = err?.details || err?.hint || err?.code || '';
      alert(
        'Failed to save missing data flag.\n\n' +
        (err?.message || 'Unknown error') +
        (detail ? `\n\nDetails: ${detail}` : '')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4 overflow-y-auto">
      <div className="bg-[#0d0d14] border border-red-500/40 rounded-2xl max-w-2xl w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="border-b border-[#2d2d44] p-6 flex justify-between items-start rounded-t-2xl bg-red-500/5">
          <div>
            <h2 className="text-2xl font-bold text-red-300 flex items-center gap-2">
              🚩 {mode === 'create' ? 'Flag Missing Data' : 'Edit Missing Data Flag'}
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              WO <span className="font-mono text-slate-200">{workOrder.wo_number}</span>
              {workOrder.building && <> · {workOrder.building}</>}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="text-slate-500 hover:text-slate-200 text-3xl leading-none w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#2d2d44] transition disabled:opacity-30"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Warning Box - only for create mode */}
          {mode === 'create' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-200">
              <div className="font-semibold mb-1">⚠️ This will block the tech's workflow.</div>
              <p className="text-xs text-red-300/80 leading-relaxed">
                The tech will see a full-screen pulsing alert on their next app open. They can
                fix the data or snooze for 4 hours, but the banner stays visible until you resolve it.
              </p>
            </div>
          )}

          {/* Checkbox list */}
          <div>
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
              What's missing? <span className="text-red-400">*</span>
            </label>
            <div className="space-y-1.5">
              {MISSING_DATA_ITEMS.map(item => {
                const checked = selectedItems.has(item.id);
                const isOther = item.id === 'other';
                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition select-none ${
                      checked
                        ? isOther
                          ? 'bg-purple-500/10 border-purple-500/50'
                          : 'bg-red-500/10 border-red-500/50'
                        : 'bg-[#0a0a0f] border-[#2d2d44] hover:border-[#3d3d5c]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(item.id)}
                      disabled={saving}
                      className="w-4 h-4 accent-red-500 cursor-pointer"
                    />
                    <span className="text-base">{item.icon}</span>
                    <span className={`text-sm font-medium ${checked ? 'text-white' : 'text-slate-300'}`}>
                      {item.label}
                    </span>
                  </label>
                );
              })}
            </div>
            {!hasItems && (
              <p className="text-xs text-slate-500 mt-2">
                Select at least one item.
              </p>
            )}
          </div>

          {/* Comment field */}
          <div>
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
              Comment for the tech <span className="text-red-400">*</span>
              <span className="ml-2 text-slate-500 normal-case tracking-normal text-[10px]">
                (min {requiredCommentLength} chars{hasOther ? ' because "Other" is checked' : ''})
              </span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={saving}
              rows={4}
              placeholder={
                hasOther
                  ? "Explain exactly what's missing — the tech will see this prominently."
                  : "e.g. Photos der Pumpe vor Einbau fehlen — brauchen wir für CBRE Rechnung."
              }
              className={`w-full bg-[#0a0a0f] border text-slate-200 px-4 py-3 rounded-lg focus:outline-none transition text-sm leading-relaxed ${
                comment.length === 0
                  ? 'border-[#2d2d44] focus:border-blue-500/60'
                  : commentLengthOK
                    ? 'border-emerald-500/40 focus:border-emerald-500/60'
                    : 'border-amber-500/40 focus:border-amber-500/60'
              }`}
            />
            <div className="flex justify-between items-center mt-1.5">
              <span className={`text-xs ${
                comment.length === 0
                  ? 'text-slate-500'
                  : commentLengthOK
                    ? 'text-emerald-400'
                    : 'text-amber-400'
              }`}>
                {comment.length === 0
                  ? 'Required'
                  : commentLengthOK
                    ? '✓ Looks good'
                    : `Need ${requiredCommentLength - comment.trim().length} more character${requiredCommentLength - comment.trim().length === 1 ? '' : 's'}`
                }
              </span>
              <span className="text-xs text-slate-600">
                {comment.length} chars
              </span>
            </div>
          </div>

          {/* Existing flag info - only in edit mode */}
          {mode === 'edit' && workOrder.missing_data_flagged_at && (
            <div className="bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-3 text-xs text-slate-400">
              <span className="text-slate-500">Originally flagged:</span>{' '}
              {new Date(workOrder.missing_data_flagged_at).toLocaleString()}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#2d2d44] p-6 flex gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-[#1e1e2e] hover:bg-[#2d2d44] border border-[#2d2d44] text-slate-200 rounded-lg font-semibold transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-[#2d2d44] disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg font-bold transition flex items-center justify-center gap-2"
          >
            {saving
              ? <>⏳ Saving...</>
              : mode === 'create'
                ? <>🚩 Flag as Missing Data</>
                : <>💾 Update Flag</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
