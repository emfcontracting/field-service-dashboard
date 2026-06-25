// app/dashboard/components/WorkOrdersTable.js
'use client';

import { getStatusColor } from '../utils/styleHelpers';
import { calculateTotalCost } from '../utils/calculations';
import { getPriorityBadge } from '../utils/priorityHelpers';
import { formatDateEST } from '../utils/dateUtils';
import { getSubmissionStatus, SUBMISSION_META, tooltipFor } from '@/lib/submissionStatus';
import { postingBadgeConfig, computePostingPayoutDate } from '@/lib/cbrePostingStatus';

// CBRE posting-status badge (CPW/CIS/CIR/CA1/CA2/CMP) — separate track from the
// active cbre_status. Shows the CBRE-side processing stage of a completed WO.
const PostingStatusBadge = ({ wo }) => {
  const cfg = postingBadgeConfig(wo.cbre_posting_status);
  if (!cfg) return null;
  const payout = computePostingPayoutDate(wo);
  const tip = payout
    ? `CBRE: ${cfg.label} · payout ~${payout.date.toLocaleDateString()} (${payout.daysRemaining}d)`
    : `CBRE: ${cfg.label}`;
  return (
    <span title={tip} className={`${cfg.badge} text-[9px] font-bold px-1.5 py-0.5 rounded-full cursor-help`}>
      {cfg.emoji} {cfg.short}
    </span>
  );
};

// Highest-priority open flag for this WO (high > medium > low).
const getTopFlag = (wo) => {
  const flags = wo.open_flags || [];
  if (!flags.length) return null;
  const rank = { high: 0, medium: 1, low: 2 };
  return [...flags].sort((a, b) => (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9))[0];
};

const FLAG_PRIORITY_CLASS = {
  high:   'bg-red-500/20    text-red-400    border border-red-500/40    animate-pulse',
  medium: 'bg-orange-500/20 text-orange-400 border border-orange-500/40',
  low:    'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
};

const FlagBadge = ({ wo }) => {
  const flag = getTopFlag(wo);
  if (!flag) return null;
  const count = (wo.open_flags || []).length;
  const cls = FLAG_PRIORITY_CLASS[flag.priority] || FLAG_PRIORITY_CLASS.medium;
  const tooltip = count === 1
    ? `Flagged for review (${flag.priority}): ${flag.comment}`
    : `${count} open flags — highest priority: ${flag.priority}`;
  return (
    <span title={tooltip} className={`${cls} text-[9px] font-bold px-1.5 py-0.5 rounded-full cursor-help`}>
      🚩{count > 1 ? ` ${count}` : ''}
    </span>
  );
};

// Icon row shown next to a WO number. Each icon is dimmed when the
// corresponding submission hasn't been received — so a fully complete WO
// shows three bright icons and an incomplete one shows whichever are missing.
// We deliberately hide 'not_required' types so labour-only or non-PM WOs
// don't show false-negative reds.
const SubmissionBadges = ({ wo }) => {
  const status = getSubmissionStatus(wo);
  const types = ['photos', 'receipts', 'writeups'];
  // If every required submission is 'not_required', show nothing at all.
  const hasAny = types.some(t => status[t] !== 'not_required');
  if (!hasAny) return null;

  return (
    <span className="inline-flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {types.map(type => {
        const st = status[type];
        if (st === 'not_required') return null;
        const meta = SUBMISSION_META[type];
        const colour =
          st === 'received'    ? 'opacity-100' :
          st === 'missing'     ? 'opacity-50 grayscale' :
                                 'opacity-30 grayscale';   // not_checked
        return (
          <span
            key={type}
            title={tooltipFor(type, st, wo)}
            className={`text-[11px] leading-none ${colour} cursor-help`}
          >
            {meta.icon}
          </span>
        );
      })}
    </span>
  );
};

const getCBREStatusBadge = (cbreStatus) => {
  switch (cbreStatus) {
    case 'escalation':
      return { text: '🚨 ESCALATION', color: 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse', shortText: '🚨 ESC' };
    case 'quote_approved':
      return { text: '✅ QUOTE APPROVED', color: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30', shortText: '✅ Approved' };
    case 'quote_rejected':
      return { text: '❌ QUOTE REJECTED', color: 'bg-red-500/20 text-red-400 border border-red-500/30', shortText: '❌ Rejected' };
    case 'quote_submitted':
      return { text: '📤 QUOTE SUBMITTED', color: 'bg-blue-500/20 text-blue-400 border border-blue-500/30', shortText: '📤 Submitted' };
    case 'reassigned':
      return { text: '🔄 REASSIGNED', color: 'bg-purple-500/20 text-purple-400 border border-purple-500/30', shortText: '🔄 Reassign' };
    case 'pending_quote':
      return { text: '📋 PENDING QUOTE', color: 'bg-orange-500/20 text-orange-400 border border-orange-500/30', shortText: '📋 Pending' };
    case 'invoice_rejected':
      return { text: '❌ INVOICE REJECTED', color: 'bg-red-500/20 text-red-400 border border-red-500/30', shortText: '❌ Inv Rej' };
    case 'cancelled':
      return { text: '🚫 CANCELLED', color: 'bg-slate-500/20 text-slate-400 border border-slate-500/30', shortText: '🚫 Cancel' };
    default:
      return null;
  }
};

const getStatusBadge = (status) => {
  switch (status) {
    case 'pending':
      return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
    case 'assigned':
      return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
    case 'in_progress':
      return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
    case 'tech_review':
      return 'bg-yellow-400 text-black border border-yellow-300 animate-pulse font-bold';
    case 'return_trip':
      return 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
    case 'completed':
      return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
    case 'missing_data':
      return 'bg-red-500/30 text-red-300 border border-red-500/60 animate-pulse font-bold';
    default:
      return 'bg-slate-500/20 text-slate-400 border border-slate-500/30';
  }
};

const getPriorityStyle = (badge) => {
  if (!badge) return { cls: 'text-slate-500', text: '—' };
  const text = badge.text || '';
  const parts = text.split(' ');
  const compact = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : text;

  if (badge.color?.includes('red')) return { cls: 'text-red-400 font-bold', text: compact };
  if (badge.color?.includes('orange')) return { cls: 'text-orange-400 font-bold', text: compact };
  if (badge.color?.includes('yellow')) return { cls: 'text-yellow-400 font-semibold', text: compact };
  if (badge.color?.includes('blue')) return { cls: 'text-blue-400', text: compact };
  if (badge.color?.includes('green') || badge.color?.includes('emerald')) return { cls: 'text-emerald-400', text: compact };
  return { cls: 'text-slate-400', text: compact };
};

const isNewWorkOrder = (wo) => {
  if (wo.lead_tech_id) return false;
  const created = new Date(wo.date_entered || wo.created_at);
  const hours = (new Date() - created) / (1000 * 60 * 60);
  return hours <= 24;
};

// Returns true if this WO has a CBRE status change that hasn't been acknowledged yet.
// Compares cbre_status_updated_at against cbre_status_acknowledged_at.
const hasUnackCbreUpdate = (wo) => {
  if (!wo.cbre_status_updated_at) return false;
  if (!wo.cbre_status_acknowledged_at) return true;
  return new Date(wo.cbre_status_updated_at) > new Date(wo.cbre_status_acknowledged_at);
};

export { hasUnackCbreUpdate };

export default function WorkOrdersTable({
  workOrders,
  loading,
  onSelectWorkOrder,
  searchTerm,
  statusFilter,
  priorityFilter,
  isSuperuser = false,
  selectedWOs = new Set(),
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  showCheckboxes = false,
  onAcknowledgeCbre  // (woId) => void — called when user clicks the 🔔 NEW badge to acknowledge a CBRE status change
}) {
  const allSelected = workOrders.length > 0 && workOrders.every(wo => selectedWOs.has(wo.wo_id));
  const someSelected = workOrders.some(wo => selectedWOs.has(wo.wo_id));

  const handleHeaderCheckbox = (e) => {
    e.stopPropagation();
    allSelected ? onClearSelection() : onSelectAll();
  };

  const handleRowCheckbox = (e, woId) => {
    e.stopPropagation();
    onToggleSelect(woId);
  };

  if (loading) {
    return (
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-10 text-center text-slate-500 text-sm">
        <div className="animate-pulse">Loading work orders...</div>
      </div>
    );
  }

  if (workOrders.length === 0) {
    return (
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-10 text-center text-slate-500 text-sm">
        {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
          ? 'No work orders match your filters.'
          : 'No work orders yet. Create your first one!'}
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg overflow-hidden">
      <div className="overflow-x-auto overflow-y-visible" style={{ maxWidth: '100%' }}>
        <table
          className="w-full text-xs"
          style={{ tableLayout: 'fixed', minWidth: (showCheckboxes || isSuperuser) ? '1440px' : '1400px' }}
        >
          <thead>
            <tr className="border-b border-[#1e1e2e] bg-[#0a0a0f]">
              {(showCheckboxes || isSuperuser) && (
                <th className="px-3 py-2.5 text-center" style={{ width: '40px' }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={input => { if (input) input.indeterminate = someSelected && !allSelected; }}
                    onChange={handleHeaderCheckbox}
                    className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-500"
                  />
                </th>
              )}
              <th className="px-3 py-2.5 text-left text-slate-500 font-medium tracking-wide" style={{ width: '100px' }}>WO #</th>
              <th className="px-3 py-2.5 text-left text-slate-500 font-medium tracking-wide" style={{ width: '80px' }}>Date</th>
              <th className="px-3 py-2.5 text-left text-slate-500 font-medium tracking-wide" style={{ width: '100px' }}>Building</th>
              <th className="px-3 py-2.5 text-left text-slate-500 font-medium tracking-wide" style={{ width: '280px' }}>Description</th>
              <th className="px-3 py-2.5 text-left text-slate-500 font-medium tracking-wide" style={{ width: '110px' }}>Status</th>
              <th className="px-3 py-2.5 text-left text-slate-500 font-medium tracking-wide" style={{ width: '100px' }}>CBRE</th>
              <th className="px-3 py-2.5 text-left text-slate-500 font-medium tracking-wide" style={{ width: '72px' }}>Priority</th>
              <th className="px-3 py-2.5 text-left text-slate-500 font-medium tracking-wide" style={{ width: '110px' }}>Lead Tech</th>
              <th className="px-3 py-2.5 text-right text-slate-500 font-medium tracking-wide" style={{ width: '80px' }}>NTE</th>
              <th className="px-3 py-2.5 text-right text-slate-500 font-medium tracking-wide" style={{ width: '80px' }}>Est Cost</th>
              <th className="px-3 py-2.5 text-center text-slate-500 font-medium" style={{ width: '36px' }}>🔒</th>
              <th className="px-3 py-2.5 text-center text-slate-500 font-medium tracking-wide" style={{ width: '64px' }}>Open</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.map((wo, idx) => {
              const totalCost = calculateTotalCost(wo);
              const overBudget = totalCost > (wo.nte || 0) && (wo.nte || 0) > 0;
              const isNew = isNewWorkOrder(wo);
              const isSelected = selectedWOs.has(wo.wo_id);
              const cbreBadge = getCBREStatusBadge(wo.cbre_status);
              const priorityBadge = getPriorityBadge(wo.priority);
              const priorityStyle = getPriorityStyle(priorityBadge);
              const hasPendingNTE = wo.nte_quotes?.some(q => q.nte_status === 'pending');
              const hasSubmittedNTE = wo.nte_quotes?.some(q => q.nte_status === 'submitted');
              const isUnackCbre = hasUnackCbreUpdate(wo);

              const rowBg = isSelected
                ? 'bg-blue-600/10 border-l-2 border-l-blue-500'
                : wo.status === 'missing_data' ? 'bg-red-950/40 border-l-4 border-l-red-500'
                : isUnackCbre ? 'bg-amber-500/10 border-l-4 border-l-amber-500'
                : wo.cbre_status === 'escalation' ? 'bg-red-950/30'
                : wo.cbre_status === 'cancelled' ? 'bg-slate-900/30'
                : '';

              return (
                <tr
                  key={wo.wo_id}
                  onClick={() => onSelectWorkOrder(wo)}
                  className={`border-b border-[#1a1a28] hover:bg-[#1e1e2e] transition cursor-pointer ${rowBg}`}
                >
                  {(showCheckboxes || isSuperuser) && (
                    <td className="px-3 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleRowCheckbox(e, wo.wo_id)}
                        className="w-3.5 h-3.5 rounded cursor-pointer accent-blue-500"
                      />
                    </td>
                  )}

                  {/* WO Number */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-blue-400 font-semibold">{wo.wo_number}</span>
                      <SubmissionBadges wo={wo} />
                      <FlagBadge wo={wo} />
                      <PostingStatusBadge wo={wo} />
                      {isUnackCbre && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onAcknowledgeCbre) onAcknowledgeCbre(wo.wo_id);
                          }}
                          title={`CBRE status changed to ${(wo.cbre_status || '').replace(/_/g, ' ')} — click to acknowledge`}
                          className="bg-amber-500/30 hover:bg-amber-500/60 text-amber-200 hover:text-white border border-amber-400/70 hover:border-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse cursor-pointer transition shadow-md shadow-amber-500/30"
                        >
                          🔔 NEW
                        </button>
                      )}
                      {isNew && (
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                          NEW
                        </span>
                      )}
                      {hasPendingNTE && (
                        <span
                          className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          title="NTE increase created – needs to be uploaded to CBRE"
                        >
                          💰 NTE
                        </span>
                      )}
                      {hasSubmittedNTE && !hasPendingNTE && (
                        <span
                          className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          title="NTE increase uploaded to CBRE – awaiting approval"
                        >
                          📤 NTE
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Date */}
                  <td className="px-3 py-2.5 text-slate-500">
                    {wo.date_entered ? formatDateEST(wo.date_entered) : '—'}
                  </td>

                  {/* Building */}
                  <td className="px-3 py-2.5 text-slate-300 font-medium">{wo.building}</td>

                  {/* Description */}
                  <td className="px-3 py-2.5">
                    <div className="truncate text-slate-400" title={wo.work_order_description}>
                      {wo.work_order_description}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium inline-flex items-center gap-1 ${getStatusBadge(wo.status)}`}>
                        {wo.status.replace(/_/g, ' ')}
                      </span>
                      {wo.assigned_to_field && (
                        <span className="text-[10px] text-blue-400">📱 Field</span>
                      )}
                    </div>
                  </td>

                  {/* CBRE */}
                  <td className="px-3 py-2.5">
                    {cbreBadge ? (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${cbreBadge.color}`} title={cbreBadge.text}>
                        {cbreBadge.shortText}
                      </span>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>

                  {/* Priority */}
                  <td className="px-3 py-2.5">
                    <span className={`text-[11px] ${priorityStyle.cls}`}>{priorityStyle.text}</span>
                  </td>

                  {/* Lead Tech */}
                  <td className="px-3 py-2.5">
                    {wo.lead_tech ? (
                      <span className="text-slate-300 truncate block" title={`${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`}>
                        {wo.lead_tech.first_name} {wo.lead_tech.last_name.charAt(0)}.
                      </span>
                    ) : (
                      <span className="text-yellow-600/70 text-[10px]">Unassigned</span>
                    )}
                  </td>

                  {/* NTE */}
                  <td className="px-3 py-2.5 text-right text-slate-400 font-medium">
                    ${(wo.nte || 0).toFixed(0)}
                  </td>

                  {/* Est Cost */}
                  <td className="px-3 py-2.5 text-right font-semibold">
                    <span className={overBudget ? 'text-red-400' : 'text-emerald-400'}>
                      ${(totalCost || 0).toFixed(0)}
                    </span>
                  </td>

                  {/* Locked */}
                  <td className="px-3 py-2.5 text-center text-slate-600">
                    {wo.is_locked ? '🔒' : ''}
                  </td>

                  {/* Open button */}
                  <td className="px-3 py-2.5 text-center">
                    <button className="bg-[#1e1e2e] hover:bg-blue-600/20 border border-[#2d2d44] hover:border-blue-500/40 text-slate-400 hover:text-blue-400 px-2.5 py-1 rounded-md text-[11px] font-medium transition">
                      Open →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
