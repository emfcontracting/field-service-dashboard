// lib/queueCompletionNow.js
// ─────────────────────────────────────────────────────────────────────────────
// Queue ONE work order's completion the moment it becomes reportable, instead
// of waiting for the next 15-minute sweep of queue-completions.
//
// Same readiness rules, same row, same idempotency — only the trigger differs.
// This is deliberately a per-work-order version of the producer and not a
// second implementation: everything that decides anything lives in
// lib/completionReadiness.js and is shared.
//
// WHY THIS AND NOT A HOOK IN THE DASHBOARD
// ----------------------------------------
// A work order becomes reportable through many doors: the office in the
// dashboard, a technician in the mobile app (which writes straight to
// Supabase, with no server of ours in between), the e-mail import, the grid
// import, and SQL run by hand in the Supabase editor — that last one is how
// eight work orders were unblocked on 2026-10-21. Wiring the dashboard would
// have covered none of them. A database webhook fires for all of them, because
// it watches the table rather than the caller.
//
// The 15-minute producer stays as the net. This only removes the wait on the
// paths the webhook sees; anything it misses is still picked up by the sweep,
// and the unique index on (kind, wo_id) means a double attempt costs nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js';
import {
  COMPLETION_SELECT,
  completionReadinessCheck,
  buildCompletionApprovalRow,
  isActiveWo,
  isCompletionDone,
} from '@/lib/completionReadiness';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/** Columns whose change can make a completion reportable (or stop it being one). */
export const COMPLETION_TRIGGER_COLUMNS = [
  'status', 'acknowledged', 'is_locked', 'dispute_status',
  'cbre_status', 'cbre_posting_status', 'nte',
  'time_in', 'time_out', 'date_completed',
  'completion_transferred', 'cbre_completion_submitted_at',
];

/** Did this webhook payload touch anything that matters here? */
export function completionTriggerChanged(record = {}, oldRecord = {}) {
  // No old_record (INSERT, or a webhook configured without it): assume yes and
  // let the readiness check decide. It is one select.
  if (!oldRecord || Object.keys(oldRecord).length === 0) return true;
  return COMPLETION_TRIGGER_COLUMNS.some((c) => record?.[c] !== oldRecord?.[c]);
}

/**
 * Queue the completion for one work order if it is ready and not already
 * queued. Never throws — a failure here must not break the webhook that
 * carried it, and the sweep will try again regardless.
 *
 * @returns {Promise<{queued: boolean, reason?: string, woNumber?: string}>}
 */
export async function queueCompletionNow(woId) {
  if (!woId) return { queued: false, reason: 'no wo_id' };
  try {
    const supabase = serviceClient();

    const { data: wo, error } = await supabase
      .from('work_orders')
      .select(COMPLETION_SELECT)
      .eq('wo_id', woId)
      .single();
    if (error || !wo) return { queued: false, reason: error?.message || 'work order not found' };

    if (wo.status !== 'completed')  return { queued: false, reason: 'not completed', woNumber: wo.wo_number };
    if (isCompletionDone(wo))       return { queued: false, reason: 'already reported', woNumber: wo.wo_number };
    if (!isActiveWo(wo))            return { queued: false, reason: 'acknowledged, locked or escalated', woNumber: wo.wo_number };

    const readiness = completionReadinessCheck(wo);
    if (!readiness.ready) return { queued: false, reason: readiness.reason, woNumber: wo.wo_number };

    // A Complete request the office REJECTED must not come back on its own —
    // same rule the sweep applies.
    const { data: rejected } = await supabase
      .from('approval_requests')
      .select('approval_id')
      .eq('kind', 'cbre_complete')
      .eq('status', 'rejected')
      .eq('wo_id', wo.wo_id)
      .limit(1);
    if (rejected?.length) return { queued: false, reason: 'previously rejected', woNumber: wo.wo_number };

    const { row, problems } = buildCompletionApprovalRow(wo);
    if (!row) return { queued: false, reason: problems.join('; '), woNumber: wo.wo_number };

    const { error: insErr } = await supabase.from('approval_requests').insert(row);
    if (insErr) {
      // 23505 = the unique index on (kind, wo_id) — already queued, which is
      // the expected outcome whenever the sweep got there first.
      if (insErr.code === '23505') return { queued: false, reason: 'already queued', woNumber: wo.wo_number };
      return { queued: false, reason: insErr.message, woNumber: wo.wo_number };
    }
    return { queued: true, woNumber: wo.wo_number };
  } catch (e) {
    return { queued: false, reason: e.message };
  }
}
