// app/dashboard/components/BackendTriggerResultModal.js
// ─────────────────────────────────────────────────────────────────────────────
// Modal that displays trigger results from /api/backend/trigger
// Replaces the ugly alert(JSON.stringify(...)) pattern with a clean visual layout.
// Special-cased for sync_email_status to show CBRE status changes in a table.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

// ── CBRE status display config ───────────────────────────────────────────────
const STATUS_CONFIG = {
  escalation:        { color: 'red',     label: 'Escalation',       icon: '🚨' },
  quote_approved:    { color: 'emerald', label: 'Quote Approved',   icon: '✅' },
  quote_rejected:    { color: 'red',     label: 'Quote Rejected',   icon: '❌' },
  quote_submitted:   { color: 'blue',    label: 'Quote Submitted',  icon: '📤' },
  reassigned:        { color: 'yellow',  label: 'Reassigned',       icon: '🔄' },
  invoice_rejected:  { color: 'red',     label: 'Invoice Rejected', icon: '❌' },
  cancelled:         { color: 'slate',   label: 'Cancelled',        icon: '🚫' },
  pending:           { color: 'slate',   label: 'Pending',          icon: '⏳' },
};

const COLOR_CLASSES = {
  red:     'bg-red-500/15 text-red-400 border-red-500/30',
  emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  blue:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  yellow:  'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  slate:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
  purple:  'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const ACTION_NAMES = {
  sync_email_status:     'CBRE Status Sync',
  email_import:          'Email Import',
  availability_reminder: 'Availability Reminder',
  aging_alert:           'Aging Alert',
  test_notification:     'Test Notification',
};

// ── Reusable status badge ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { color: 'slate', label: status || 'Unknown', icon: '?' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${COLOR_CLASSES[cfg.color]}`}>
      <span>{cfg.icon}</span>
      <span className="uppercase tracking-wider">{cfg.label}</span>
    </span>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(n) {
  if (n == null) return '—';
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  } catch { return ''; }
}

// ── Single change card (used in updates list) ────────────────────────────────
function ChangeRow({ update }) {
  const u = update;
  const hasNTEChange = u.new_nte != null && u.old_nte !== u.new_nte;

  return (
    <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-4 hover:border-[#2d2d44] transition">
      {/* Top row: WO# + Building + Date */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono font-bold text-slate-100 text-sm">{u.wo_number}</span>
            <span className="text-slate-700">•</span>
            <span className="text-sm text-slate-400 truncate">{u.building || '—'}</span>
          </div>
          {u.subject && (
            <p className="text-xs text-slate-600 truncate" title={u.subject}>
              {u.subject}
            </p>
          )}
        </div>
        {u.email_date && (
          <span className="text-[10px] text-slate-600 whitespace-nowrap font-mono mt-0.5">
            {formatDate(u.email_date)}
          </span>
        )}
      </div>

      {/* Status change row */}
      <div className="flex items-center gap-2 flex-wrap">
        <StatusBadge status={u.old_status} />
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="text-slate-600 flex-shrink-0">
          <line x1="5" y1="12" x2="19" y2="12"/>
          <polyline points="12 5 19 12 12 19"/>
        </svg>
        <StatusBadge status={u.new_status} />

        {/* NTE change inline */}
        {hasNTEChange && (
          <div className="ml-auto flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-600 uppercase tracking-wider font-semibold">NTE</span>
            <span className="text-slate-500 line-through font-mono">{formatCurrency(u.old_nte)}</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" className="text-slate-600">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
            <span className="text-emerald-400 font-mono font-bold">{formatCurrency(u.new_nte)}</span>
          </div>
        )}

        {/* Invoice updated badge */}
        {u.invoice_updated && (
          <span className={`${hasNTEChange ? '' : 'ml-auto'} inline-flex items-center gap-1 text-[10px] font-bold border px-2 py-0.5 rounded-full ${COLOR_CLASSES.purple}`}>
            📄 Invoice {u.invoice_status}
          </span>
        )}
      </div>

      {/* Submitted quote amount */}
      {u.submitted_quote && (
        <div className="mt-2 text-xs text-slate-500">
          📤 Quote submitted: <span className="text-blue-400 font-mono font-bold">{formatCurrency(u.submitted_quote)}</span>
        </div>
      )}
    </div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function BackendTriggerResultModal({ result, onClose }) {
  if (!result) return null;

  const { success, action, message, details } = result;
  const isStatusSync = action === 'sync_email_status';
  const title = ACTION_NAMES[action] || action || 'Trigger Result';

  // CBRE Status Sync stats
  const syncStats = isStatusSync && details ? {
    processed: details.processed ?? 0,
    updated:   details.updated ?? 0,
    skipped:   details.skipped ?? 0,
    notFound:  details.notFound ?? 0,
    errors:    details.errors?.length ?? 0,
  } : null;

  // CBRE updates (for sync_email_status OR nested in email_import)
  const updates = isStatusSync
    ? (details?.updates || [])
    : (details?.cbreSync?.updates || []);

  const errors = details?.errors || [];

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-[#1e1e2e] flex justify-between items-center bg-[#0a0a0f]">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-base font-bold flex-shrink-0 ${
              success ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'
            }`}>
              {success ? '✓' : '✗'}
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-100">{title}</h2>
              <p className="text-xs text-slate-500 truncate">{message || (success ? 'Completed' : 'Failed')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#1e1e2e] transition flex-shrink-0"
          >
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* CBRE Status Sync stats grid */}
          {syncStats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { label: 'Processed', value: syncStats.processed, color: 'text-slate-200' },
                { label: 'Updated',   value: syncStats.updated,   color: 'text-emerald-400' },
                { label: 'Skipped',   value: syncStats.skipped,   color: 'text-slate-500' },
                { label: 'Not Found', value: syncStats.notFound,  color: 'text-yellow-400' },
                { label: 'Errors',    value: syncStats.errors,    color: 'text-red-400' },
              ].map(s => (
                <div key={s.label} className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-4 py-3">
                  <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-1">{s.label}</p>
                  <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* CBRE Status Changes list */}
          {isStatusSync && updates.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <span className="w-1 h-3 bg-emerald-500 rounded-full" />
                Status Changes ({updates.length})
              </h3>
              <div className="space-y-2">
                {updates.map((u, i) => <ChangeRow key={i} update={u} />)}
              </div>
            </div>
          )}

          {/* No changes message (for sync_email_status only) */}
          {isStatusSync && updates.length === 0 && success && (
            <div className="text-center py-12 text-slate-500 bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl">
              <div className="text-5xl mb-3">🎉</div>
              <p className="text-base font-semibold text-slate-300 mb-1">No Status Changes</p>
              <p className="text-sm text-slate-600">
                All work orders are already in sync with CBRE.
              </p>
              {syncStats && syncStats.skipped > 0 && (
                <p className="text-xs text-slate-700 mt-3">
                  {syncStats.skipped} email{syncStats.skipped !== 1 ? 's' : ''} checked, none required updates.
                </p>
              )}
            </div>
          )}

          {/* Generic non-sync triggers - simpler view */}
          {!isStatusSync && details && (
            <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-4">
              {details.imported !== undefined && (
                <>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1 h-3 bg-blue-500 rounded-full" />
                    Import Summary
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'Imported',   value: details.imported,           color: 'text-emerald-400' },
                      { label: 'Duplicates', value: details.duplicates ?? 0,    color: 'text-yellow-400' },
                      { label: 'Skipped',    value: details.skipped ?? 0,       color: 'text-slate-500' },
                      { label: 'Errors',     value: details.errors?.length ?? 0, color: 'text-red-400' },
                    ].map(s => (
                      <div key={s.label} className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg px-3 py-2">
                        <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-0.5">{s.label}</p>
                        <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {details.message && !details.imported && (
                <p className="text-sm text-slate-300">{details.message}</p>
              )}

              {/* Imported work orders list */}
              {details.workOrders && details.workOrders.length > 0 && (
                <div className="mt-4 pt-4 border-t border-[#1e1e2e]">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                    Imported Work Orders ({details.workOrders.length})
                  </p>
                  <div className="space-y-1.5">
                    {details.workOrders.map((wo, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm bg-[#0d0d14] rounded px-3 py-2">
                        <span className="font-mono font-bold text-slate-200">{wo.wo_number}</span>
                        <span className="text-slate-700">•</span>
                        <span className="text-slate-400 truncate">{wo.building}</span>
                        <span className="ml-auto text-[10px] uppercase font-bold text-slate-500">{wo.priority}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Embedded CBRE Sync results inside email_import */}
              {details.cbreSync && (
                <div className="mt-4 pt-4 border-t border-[#1e1e2e]">
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-1 h-3 bg-purple-500 rounded-full" />
                    CBRE Status Sync — {details.cbreSync.updated || 0} update{details.cbreSync.updated !== 1 ? 's' : ''}
                  </h3>
                  {updates.length > 0 ? (
                    <div className="space-y-2">
                      {updates.map((u, i) => <ChangeRow key={i} update={u} />)}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 italic">No status changes detected.</p>
                  )}
                </div>
              )}

              {/* Notifications sent */}
              {details.notifications?.sent > 0 && (
                <div className="mt-3 text-xs text-slate-500">
                  ✉️ {details.notifications.sent} notification{details.notifications.sent !== 1 ? 's' : ''} sent
                </div>
              )}
            </div>
          )}

          {/* Errors block (shown for any action) */}
          {errors.length > 0 && (
            <details className="bg-red-500/5 border border-red-500/20 rounded-lg overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer text-sm font-semibold text-red-400 hover:bg-red-500/10 transition select-none">
                ⚠️ {errors.length} Error{errors.length !== 1 ? 's' : ''}
              </summary>
              <ul className="px-4 py-3 border-t border-red-500/20 space-y-1 text-xs text-red-300/80 font-mono">
                {errors.map((err, i) => (
                  <li key={i}>• {err}</li>
                ))}
              </ul>
            </details>
          )}

          {/* Raw JSON fallback (collapsed by default) */}
          {details && (
            <details className="text-xs">
              <summary className="text-slate-600 cursor-pointer hover:text-slate-400 select-none">
                View raw response
              </summary>
              <pre className="mt-2 text-[10px] bg-[#0a0a0f] border border-[#1e1e2e] p-3 rounded-lg overflow-auto max-h-64 text-slate-500 font-mono">
                {JSON.stringify(details, null, 2)}
              </pre>
            </details>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 py-4 border-t border-[#1e1e2e] flex justify-between items-center bg-[#0a0a0f]">
          <p className="text-[10px] text-slate-700 font-mono">
            {result.timestamp ? new Date(result.timestamp).toLocaleString() : ''}
          </p>
          <button
            onClick={onClose}
            className="bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:text-slate-100 hover:bg-[#2d2d44] px-5 py-2 rounded-lg text-sm font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
