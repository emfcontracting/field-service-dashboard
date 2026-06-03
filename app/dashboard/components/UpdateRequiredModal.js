// app/dashboard/components/UpdateRequiredModal.js
'use client';

import { useState, useEffect } from 'react';

/**
 * Structured Update-Required flag for Office/Admin.
 * Used when techs aren't following up on tickets (NTE approvals, material
 * delivery tracking, quote status, etc.).
 *
 * Behaves identically to MissingDataModal — same lockout flow, same banner
 * pattern, same notifications. Only difference is the items and the BLUE
 * theme (not red).
 *
 * SOFT REMINDER (Option B): unlike Missing Data, this flag does NOT change the
 * work order's status or block the tech's workflow. The tech can still change
 * status and complete the WO. The blue flag lives in the update_required_*
 * columns as a reminder layer on top, detected via update_required_flagged_at.
 *
 * Modes:
 *   - 'create' : new flag. Sets update_required_flagged_at (status untouched).
 *   - 'edit'   : edit existing flag. Updates only items + comment.
 *
 * Props:
 *   - workOrder
 *   - currentUser
 *   - supabase
 *   - mode: 'create' | 'edit'
 *   - onClose
 *   - onSaved: (updatedWO) => void
 */

const UPDATE_REQUIRED_ITEMS = [
  { id: 'nte_status',       icon: '📞', label: 'NTE Status with CBRE' },
  { id: 'material_delivery', icon: '📦', label: 'Material Delivery' },
  { id: 'quote_status',     icon: '💰', label: 'Quote Status' },
  { id: 'other',            icon: '❓', label: 'Other (must specify in comment)' }
];

const MIN_COMMENT_LENGTH = 15;
const MIN_COMMENT_LENGTH_WITH_OTHER = 30;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safeUuid(val) {
  if (typeof val !== 'string') return null;
  return UUID_REGEX.test(val) ? val : null;
}

export default function UpdateRequiredModal({
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

  useEffect(() => {
    if (mode === 'edit' && workOrder) {
      const items = Array.isArray(workOrder.update_required_items)
        ? workOrder.update_required_items
        : [];
      setSelectedItems(new Set(items));
      setComment(workOrder.update_required_comment || '');
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
        // Option B — SOFT reminder. Do NOT touch status; the flag lives only in
        // the update_required_* columns. Tech keeps full control of the WO.
        updatePayload = {
          update_required_items: itemsArray,
          update_required_comment: comment.trim(),
          update_required_flagged_by: safeUuid(currentUser?.user_id),
          update_required_flagged_at: nowISO,
          // Clear any leftover state from previous flag cycle
          update_required_snoozed_until: null,
          update_required_snooze_reason: null,
          update_required_tech_marked_done_at: null,
          update_required_office_reminded_at: null
        };

        commentLogEntry =
          `[${new Date().toLocaleString()}] ${flaggerName} — 🔵 FLAGGED FOR STATUS UPDATE\n` +
          `Items: ${itemsArray.join(', ')}\n` +
          `Note: ${comment.trim()}`;
      } else {
        updatePayload = {
          update_required_items: itemsArray,
          update_required_comment: comment.trim()
        };

        commentLogEntry =
          `[${new Date().toLocaleString()}] ${flaggerName} — ✏️ UPDATED STATUS UPDATE FLAG\n` +
          `Items: ${itemsArray.join(', ')}\n` +
          `Note: ${comment.trim()}`;
      }

      // Append to comments log
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

      const { data: updated, error: updateErr } = await supabase
        .from('work_orders')
        .update(updatePayload)
        .eq('wo_id', workOrder.wo_id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      if (onSaved) onSaved(updated);
      onClose();
    } catch (err) {
      console.error('Error saving update-required flag:', {
        message: err?.message,
        details: err?.details,
        hint: err?.hint,
        code: err?.code,
        raw: err
      });
      const detail = err?.details || err?.hint || err?.code || '';
      alert(
        'Failed to save update-required flag.\n\n' +
        (err?.message || 'Unknown error') +
        (detail ? `\n\nDetails: ${detail}` : '')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4 overflow-y-auto">
      <div className="bg-[#0d0d14] border border-blue-500/40 rounded-2xl max-w-2xl w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="border-b border-[#2d2d44] p-6 flex justify-between items-start rounded-t-2xl bg-blue-500/5">
          <div>
            <h2 className="text-2xl font-bold text-blue-300 flex items-center gap-2">
              🔵 {mode === 'create' ? 'Flag for Status Update' : 'Edit Status Update Flag'}
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
          {/* Info Box - only for create mode */}
          {mode === 'create' && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-sm text-blue-200">
              <div className="font-semibold mb-1">🔔 This is a reminder — it won't block the tech.</div>
              <p className="text-xs text-blue-300/80 leading-relaxed">
                The tech will see a full-screen blue alert on their next app open and a banner on the WO.
                They can still change status and complete the work order normally.
                They tap "I followed up" to notify office. The banner stays until you resolve it.
              </p>
            </div>
          )}

          {/* Checkbox list */}
          <div>
            <label className="block text-xs text-slate-500 uppercase tracking-wider mb-2">
              What needs follow-up? <span className="text-blue-400">*</span>
            </label>
            <div className="space-y-1.5">
              {UPDATE_REQUIRED_ITEMS.map(item => {
                const checked = selectedItems.has(item.id);
                const isOther = item.id === 'other';
                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer transition select-none ${
                      checked
                        ? isOther
                          ? 'bg-purple-500/10 border-purple-500/50'
                          : 'bg-blue-500/10 border-blue-500/50'
                        : 'bg-[#0a0a0f] border-[#2d2d44] hover:border-[#3d3d5c]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleItem(item.id)}
                      disabled={saving}
                      className="w-4 h-4 accent-blue-500 cursor-pointer"
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
              Instructions for the tech <span className="text-blue-400">*</span>
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
                  ? "Explain exactly what the tech needs to follow up on."
                  : "e.g. Call CBRE and ask if the NTE increase from last week has been approved."
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
          {mode === 'edit' && workOrder.update_required_flagged_at && (
            <div className="bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-3 text-xs text-slate-400">
              <span className="text-slate-500">Originally flagged:</span>{' '}
              {new Date(workOrder.update_required_flagged_at).toLocaleString()}
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
            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-[#2d2d44] disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg font-bold transition flex items-center justify-center gap-2"
          >
            {saving
              ? <>⏳ Saving...</>
              : mode === 'create'
                ? <>🔵 Flag for Status Update</>
                : <>💾 Update Flag</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}
