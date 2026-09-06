// app/dashboard/components/UPSEscalationView.js
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-ONLY: UPS Escalation tracker for disputed CBRE work orders
//
// Lifecycle: Open → Escalated to UPS / Sub-WO requested → Resolved / Written Off
// Each WO has dispute_status, dispute_reason, dispute_notes, dispute_amount,
// and timestamps for each transition. "Sub-WO requested" is the state for WOs
// that are dead at CBRE (cancelled / closed without invoice): the money comes
// back through a sub work order, which is linked in dispute_sub_wo.
//
// The extra "Waiting on CBRE" tab is not a dispute list: it shows work orders
// whose NTE request sits in quote_submitted at CBRE, oldest first, so a
// request cannot silently age out again.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  DISPUTE_STATUS,
  DISPUTE_REASONS,
  STATUS_TRANSITIONS,
  buildTransitionUpdate,
  disputeBadgeClasses,
} from '@/lib/disputeStatus';
import { exportToExcel, exportToPDF } from '@/lib/upsEscalationExport';
import ActivityLogExportModal from './ActivityLogExportModal';

const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const fmt = (n) => `$${(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const daysSince = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;

// NTE requests older than this are overdue for a nudge to CBRE.
const WAITING_WARN_DAYS = 14;
const WAITING_TAB = 'waiting_cbre';

// ═════════════════════════════════════════════════════════════════════════════
export default function UPSEscalationView({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';

  const [disputes, setDisputes]     = useState([]);
  const [invoiceByWo, setInvoiceByWo] = useState({}); // wo_id -> invoice for cross-reference
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState('open');
  const [search, setSearch]         = useState('');
  const [editingNotesFor, setEditingNotesFor] = useState(null); // wo_id of row being edited
  const [notesDraft, setNotesDraft] = useState('');
  const [recoveredAmount, setRecoveredAmount] = useState({}); // wo_id -> draft amount for resolve transition
  const [transitionFor, setTransitionFor] = useState(null); // wo_id requesting resolved transition
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [subWoByWo, setSubWoByWo] = useState({});      // original wo_id -> { wo_number, status, invoice }
  const [editingSubWoFor, setEditingSubWoFor] = useState(null);
  const [subWoDraft, setSubWoDraft] = useState('');
  const [waiting, setWaiting] = useState([]);           // quote_submitted WOs (Waiting on CBRE tab)
  const [waitingLoading, setWaitingLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Data for export (All Active = Open + Escalated by default) ──────────────────────────────────────────
  const exportableDisputes = useMemo(
    () => disputes.filter(d => ['open', 'escalated', 'sub_wo_requested'].includes(d.dispute_status)),
    [disputes]
  );

  const handleExportExcel = async () => {
    if (!exportableDisputes.length) {
      alert('No active disputes to export');
      return;
    }
    setExporting(true);
    setExportDropdownOpen(false);
    try {
      exportToExcel(exportableDisputes);
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!exportableDisputes.length) {
      alert('No active disputes to export');
      return;
    }
    setExporting(true);
    setExportDropdownOpen(false);
    try {
      await exportToPDF(exportableDisputes);
    } catch (e) {
      alert('Export failed: ' + e.message);
    } finally {
      setExporting(false);
    }
  };

  // ── Load disputes ──────────────────────────────────────────────────────────
  useEffect(() => { if (isAdmin) loadData(); else if (currentUser) setLoading(false); /* eslint-disable-next-line */ }, [isAdmin, currentUser]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: wos } = await supabaseClient
        .from('work_orders')
        .select(`
          wo_id, wo_number, building, status, nte,
          date_completed, work_order_description,
          dispute_status, dispute_reason, dispute_notes,
          dispute_opened_at, dispute_escalated_at, dispute_resolved_at,
          dispute_requested_at, dispute_sub_wo,
          dispute_amount, dispute_recovered_amount, cbre_status,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .not('dispute_status', 'is', null)
        .order('dispute_opened_at', { ascending: false });

      setDisputes(wos || []);
      // Show the list as soon as disputes are in; the invoice cross-reference
      // below is decorative and must never keep the view on "Loading".
      setLoading(false);

      // Pull related invoices for cross-reference badge
      if (wos?.length) {
        const woIds = wos.map(w => w.wo_id);
        const { data: invs } = await supabaseClient
          .from('invoices')
          .select('invoice_id, invoice_number, total, status, wo_id')
          .in('wo_id', woIds);
        const map = {};
        (invs || []).forEach(inv => { map[inv.wo_id] = inv; });
        setInvoiceByWo(map);

        // Sub work orders CBRE issued for these disputes — status + invoice,
        // so the card shows whether the money is actually on its way.
        const subNumbers = [...new Set(wos.map(w => w.dispute_sub_wo).filter(Boolean))];
        if (subNumbers.length) {
          const { data: subs } = await supabaseClient
            .from('work_orders')
            .select('wo_id, wo_number, status, cbre_status, nte')
            .in('wo_number', subNumbers);
          const subIds = (subs || []).map(x => x.wo_id);
          const { data: subInvs } = subIds.length
            ? await supabaseClient.from('invoices').select('invoice_id, invoice_number, total, status, wo_id').in('wo_id', subIds)
            : { data: [] };
          const byNumber = {};
          (subs || []).forEach(x => { byNumber[x.wo_number] = { ...x, invoice: (subInvs || []).find(i => i.wo_id === x.wo_id) || null }; });
          const subMap = {};
          wos.forEach(w => { if (w.dispute_sub_wo && byNumber[w.dispute_sub_wo]) subMap[w.wo_id] = byNumber[w.dispute_sub_wo]; });
          setSubWoByWo(subMap);
        } else {
          setSubWoByWo({});
        }
      }
    } catch (e) {
      console.error('UPSEscalationView load error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Waiting on CBRE: NTE requests sitting in quote_submitted ──────────────
  useEffect(() => { if (isAdmin && activeTab === WAITING_TAB) loadWaiting(); /* eslint-disable-next-line */ }, [isAdmin, activeTab]);

  const loadWaiting = async () => {
    setWaitingLoading(true);
    try {
      const { data: wos } = await supabaseClient
        .from('work_orders')
        .select('wo_id, wo_number, building, status, nte, date_entered, cbre_status, cbre_status_updated_at, cbre_quote_submitted_at, dispute_status')
        .eq('cbre_status', 'quote_submitted');
      const list = wos || [];
      // Amount requested = newest written quote on the WO (fallback: current NTE).
      const ids = list.map(w => w.wo_id);
      let latestQuote = {};
      if (ids.length) {
        const { data: quotes } = await supabaseClient
          .from('work_order_quotes')
          .select('wo_id, new_nte_amount, grand_total, nte_status, created_at')
          .in('wo_id', ids)
          .order('created_at', { ascending: false });
        (quotes || []).forEach(q => { if (!latestQuote[q.wo_id]) latestQuote[q.wo_id] = q; });
      }
      const rows = list.map(w => {
        const since = w.cbre_quote_submitted_at || w.cbre_status_updated_at || null;
        const q = latestQuote[w.wo_id];
        return {
          ...w,
          waiting_since: since,
          days: daysSince(since),
          requested: parseFloat(q?.new_nte_amount) || parseFloat(q?.grand_total) || parseFloat(w.nte) || 0,
        };
      }).sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
      setWaiting(rows);
    } catch (e) {
      console.error('UPSEscalationView waiting load error:', e);
    } finally {
      setWaitingLoading(false);
    }
  };

  const copyWaitingList = async () => {
    const overdue = waiting.filter(w => (w.days ?? 0) >= WAITING_WARN_DAYS);
    const lines = overdue.map(w =>
      `${w.wo_number}\t${(w.building || '').split(' - ')[0]}\tsubmitted ${fmtDate(w.waiting_since)}\t${w.days} days\t${fmt(w.requested)}`
    );
    const text = `NTE increase requests waiting for a decision (${overdue.length}):\n` + lines.join('\n');
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    catch { alert(text); }
  };

  const saveSubWo = async (woId) => {
    const value = (subWoDraft || '').trim().toUpperCase() || null;
    const { error } = await supabaseClient
      .from('work_orders')
      .update({ dispute_sub_wo: value })
      .eq('wo_id', woId);
    if (error) { alert('Failed: ' + error.message); return; }
    setDisputes(prev => prev.map(d => d.wo_id === woId ? { ...d, dispute_sub_wo: value } : d));
    setEditingSubWoFor(null);
    loadData();
  };

  // ── Update functions ───────────────────────────────────────────────────────
  const updateNotes = async (woId, newNotes) => {
    const { error } = await supabaseClient
      .from('work_orders')
      .update({ dispute_notes: newNotes })
      .eq('wo_id', woId);
    if (!error) {
      setDisputes(prev => prev.map(d =>
        d.wo_id === woId ? { ...d, dispute_notes: newNotes } : d
      ));
    }
    setEditingNotesFor(null);
  };

  const transitionStatus = async (woId, toStatus, opts = {}) => {
    const update = buildTransitionUpdate(toStatus);

    // If transitioning to resolved, capture recovered amount
    if (toStatus === 'resolved' && opts.recoveredAmount !== undefined) {
      update.dispute_recovered_amount = parseFloat(opts.recoveredAmount) || 0;
    }

    const { error } = await supabaseClient
      .from('work_orders')
      .update(update)
      .eq('wo_id', woId);

    if (error) {
      alert('Failed: ' + error.message);
      return;
    }

    setDisputes(prev => prev.map(d => d.wo_id === woId ? { ...d, ...update } : d));
    setTransitionFor(null);
  };

  const removeDispute = async (woId) => {
    if (!confirm('Remove this dispute entirely? This will clear all dispute tracking for the WO.')) return;
    const { error } = await supabaseClient
      .from('work_orders')
      .update({
        dispute_status: null,
        dispute_reason: null,
        dispute_notes: null,
        dispute_opened_at: null,
        dispute_escalated_at: null,
        dispute_resolved_at: null,
        dispute_requested_at: null,
        dispute_sub_wo: null,
        dispute_amount: null,
        dispute_recovered_amount: null,
      })
      .eq('wo_id', woId);
    if (error) { alert('Failed: ' + error.message); return; }
    setDisputes(prev => prev.filter(d => d.wo_id !== woId));
  };

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredDisputes = useMemo(() => {
    let list = disputes.filter(d => d.dispute_status === activeTab);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(d =>
        d.wo_number?.toLowerCase().includes(s) ||
        d.building?.toLowerCase().includes(s) ||
        d.dispute_notes?.toLowerCase().includes(s)
      );
    }
    return list;
  }, [disputes, activeTab, search]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const calc = (status) => disputes
      .filter(d => d.dispute_status === status)
      .reduce((s, d) => s + (parseFloat(d.dispute_amount) || 0), 0);

    const calcRecovered = () => disputes
      .filter(d => d.dispute_status === 'resolved')
      .reduce((s, d) => s + (parseFloat(d.dispute_recovered_amount) || parseFloat(d.dispute_amount) || 0), 0);

    return {
      open:             { count: disputes.filter(d => d.dispute_status === 'open').length,             total: calc('open') },
      escalated:        { count: disputes.filter(d => d.dispute_status === 'escalated').length,        total: calc('escalated') },
      sub_wo_requested: { count: disputes.filter(d => d.dispute_status === 'sub_wo_requested').length, total: calc('sub_wo_requested') },
      resolved:         { count: disputes.filter(d => d.dispute_status === 'resolved').length,         total: calcRecovered() },
      written_off:      { count: disputes.filter(d => d.dispute_status === 'written_off').length,      total: calc('written_off') },
    };
  }, [disputes]);

  const waitingOverdue = useMemo(() => waiting.filter(w => (w.days ?? 0) >= WAITING_WARN_DAYS).length, [waiting]);

  // ── Admin gate ─────────────────────────────────────────────────────────────
  if (!isAdmin) return (
    <div className="flex items-center justify-center min-h-[60vh] text-red-400">
      🔒 Admin access required
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">📞 UPS Escalation</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            CBRE-disputed WOs — track follow-up with UPS directly
          </p>
        </div>

        {/* Action buttons — Activity Log + Export Report */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Activity Log Bulk Export */}
          <button
            onClick={() => setShowActivityLog(true)}
            disabled={exportableDisputes.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            title="Export activity logs for all active disputes (check-ins, status changes, submissions, etc)"
          >
            📜 Activity Log <span className="opacity-80">({exportableDisputes.length})</span>
          </button>

          {/* Existing Export dropdown */}
          <div className="relative">
          <button onClick={() => setExportDropdownOpen(o => !o)}
            disabled={exporting || exportableDisputes.length === 0}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exporting ? 'Exporting...' : `Export Report (${exportableDisputes.length})`}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${exportDropdownOpen ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {exportDropdownOpen && (
            <>
              {/* backdrop to close on outside click */}
              <div className="fixed inset-0 z-40" onClick={() => setExportDropdownOpen(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-[#0d0d14] border border-[#1e1e2e] rounded-xl shadow-2xl z-50 overflow-hidden">
                <button onClick={handleExportExcel}
                  className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-[#1e1e2e] transition flex items-center gap-3 border-b border-[#1e1e2e]">
                  <span className="text-xl">📊</span>
                  <div>
                    <div className="font-semibold">Excel (.xlsx)</div>
                    <div className="text-xs text-slate-500">Editable, sortable</div>
                  </div>
                </button>
                <button onClick={handleExportPDF}
                  className="w-full px-4 py-3 text-left text-sm text-slate-200 hover:bg-[#1e1e2e] transition flex items-center gap-3">
                  <span className="text-xl">📄</span>
                  <div>
                    <div className="font-semibold">PDF (.pdf)</div>
                    <div className="text-xs text-slate-500">Polished, final report</div>
                  </div>
                </button>
                <div className="px-4 py-2 text-xs text-slate-600 bg-[#0a0a0f] border-t border-[#1e1e2e]">
                  Includes {exportableDisputes.length} active dispute{exportableDisputes.length !== 1 ? 's' : ''} (Open + Escalated)
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(DISPUTE_STATUS).map(([key, cfg]) => (
          <div key={key} className={`border rounded-xl p-4 ${cfg.bg}`}>
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
              {cfg.emoji} {cfg.short}
            </div>
            <div className={`text-2xl font-bold ${cfg.color}`}>{fmt(stats[key].total)}</div>
            <div className="text-xs text-slate-600 mt-1">
              {stats[key].count} WO{stats[key].count !== 1 ? 's' : ''}
              {key === 'resolved' && ' recovered'}
            </div>
          </div>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex flex-wrap gap-2 border-b border-[#1e1e2e] pb-0">
        {Object.entries(DISPUTE_STATUS).map(([key, cfg]) => (
          <TabButton
            key={key}
            active={activeTab === key}
            onClick={() => setActiveTab(key)}
            label={`${cfg.emoji} ${cfg.short}`}
            count={stats[key].count}
            total={stats[key].total}
            color={cfg.color}
          />
        ))}
        <TabButton
          active={activeTab === WAITING_TAB}
          onClick={() => setActiveTab(WAITING_TAB)}
          label="⏳ Waiting on CBRE"
          count={waiting.length}
          total={null}
          color="text-amber-400"
          hint={waitingOverdue ? `${waitingOverdue} overdue` : 'NTE requests in quote_submitted'}
        />
      </div>

      {/* Search */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search WO#, building, or notes..."
          className="bg-[#0d0d14] border border-[#2d2d44] text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/60 flex-1 min-w-[200px]"
        />
      </div>

      {/* Waiting on CBRE — not disputes, but the list that turns into disputes when ignored */}
      {activeTab === WAITING_TAB ? (
        <WaitingOnCbre
          rows={waiting}
          loading={waitingLoading}
          onRefresh={loadWaiting}
          onCopy={copyWaitingList}
          copied={copied}
        />
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
          <svg className="animate-spin w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Loading disputes...
        </div>
      ) : filteredDisputes.length === 0 ? (
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl py-20 text-center text-slate-600">
          {activeTab === 'open'        && '🎉 No open disputes right now'}
          {activeTab === 'escalated'   && 'No disputes currently in escalation'}
          {activeTab === 'sub_wo_requested' && 'No sub work orders requested'}
          {activeTab === 'resolved'    && 'No recoveries yet'}
          {activeTab === 'written_off' && 'No write-offs yet'}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDisputes.map(d => (
            <DisputeCard
              key={d.wo_id}
              dispute={d}
              invoice={invoiceByWo[d.wo_id]}
              subWo={subWoByWo[d.wo_id]}
              editingSubWo={editingSubWoFor === d.wo_id}
              subWoDraft={editingSubWoFor === d.wo_id ? subWoDraft : (d.dispute_sub_wo || '')}
              onStartEditSubWo={() => { setEditingSubWoFor(d.wo_id); setSubWoDraft(d.dispute_sub_wo || ''); }}
              onChangeSubWo={(v) => setSubWoDraft(v)}
              onSaveSubWo={() => saveSubWo(d.wo_id)}
              onCancelSubWo={() => setEditingSubWoFor(null)}
              activeTab={activeTab}
              editingNotes={editingNotesFor === d.wo_id}
              notesDraft={editingNotesFor === d.wo_id ? notesDraft : d.dispute_notes}
              onStartEditNotes={() => { setEditingNotesFor(d.wo_id); setNotesDraft(d.dispute_notes || ''); }}
              onChangeNotes={(v) => setNotesDraft(v)}
              onSaveNotes={() => updateNotes(d.wo_id, notesDraft)}
              onCancelNotes={() => setEditingNotesFor(null)}
              onTransition={(to) => {
                if (to === 'resolved') {
                  setTransitionFor(d.wo_id);
                  // Prefill with what the sub-WO invoice says when there is one.
                  const subTotal = subWoByWo[d.wo_id]?.invoice?.total;
                  setRecoveredAmount(prev => ({ ...prev, [d.wo_id]: (subTotal ?? d.dispute_amount ?? 0).toString() }));
                } else {
                  transitionStatus(d.wo_id, to);
                }
              }}
              onRemove={() => removeDispute(d.wo_id)}
              transitionResolveOpen={transitionFor === d.wo_id}
              recoveredAmountDraft={recoveredAmount[d.wo_id] || ''}
              onChangeRecovered={(v) => setRecoveredAmount(prev => ({ ...prev, [d.wo_id]: v }))}
              onConfirmResolve={() => transitionStatus(d.wo_id, 'resolved', { recoveredAmount: recoveredAmount[d.wo_id] })}
              onCancelResolve={() => setTransitionFor(null)}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="text-xs text-slate-600 px-1 space-y-0.5 pt-4">
        <div>• <strong className="text-red-400">Open</strong> = Just marked as disputed, no UPS contact yet</div>
        <div>• <strong className="text-orange-400">Escalated</strong> = Contacted UPS (Deontye Archie), waiting on response</div>
        <div>• <strong className="text-sky-400">Sub-WO requested</strong> = WO is dead at CBRE (cancelled / closed without invoice); sub work order requested from CBRE — link it here when it arrives (the e-mail import links it automatically when the sub-WO names the original)</div>
        <div>• <strong className="text-amber-400">Waiting on CBRE</strong> = not a dispute: NTE requests still sitting in quote_submitted. Older than {WAITING_WARN_DAYS} days = send the list to CBRE before they age out</div>
        <div>• <strong className="text-emerald-400">Resolved</strong> = Got paid via UPS direct — money recovered</div>
        <div>• <strong className="text-slate-500">Written Off</strong> = Unable to recover, accept the loss</div>
        <div className="text-slate-700 mt-1">💡 Disputed WOs are automatically excluded from Cash Flow forecasts</div>
      </div>

      {/* Activity Log Bulk Export Modal */}
      {showActivityLog && (
        <ActivityLogExportModal
          woIds={exportableDisputes.map(d => d.wo_id)}
          supabase={supabaseClient}
          onClose={() => setShowActivityLog(false)}
          title={`📥 Activity Log Export — ${exportableDisputes.length} active dispute${exportableDisputes.length !== 1 ? 's' : ''}`}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function TabButton({ active, onClick, label, count, total, color, hint }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-semibold transition border-b-2 -mb-px ${
        active ? 'text-slate-100 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'
      }`}>
      {label}
      <span className="ml-2 text-xs text-slate-600">({count})</span>
      <div className={`text-xs font-normal mt-0.5 ${active ? color : 'text-slate-600'}`}>
        {total == null ? (hint || '') : `$${total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function DisputeCard({
  dispute, invoice, subWo, activeTab,
  editingSubWo, subWoDraft, onStartEditSubWo, onChangeSubWo, onSaveSubWo, onCancelSubWo,
  editingNotes, notesDraft, onStartEditNotes, onChangeNotes, onSaveNotes, onCancelNotes,
  onTransition, onRemove,
  transitionResolveOpen, recoveredAmountDraft, onChangeRecovered, onConfirmResolve, onCancelResolve,
}) {
  const transitions = STATUS_TRANSITIONS[dispute.dispute_status] || [];
  const reasonLabel = DISPUTE_REASONS[dispute.dispute_reason]?.label || dispute.dispute_reason || '—';

  // Date timeline based on current status
  const timeline = [];
  if (dispute.dispute_opened_at)    timeline.push({ label: 'Opened',    date: dispute.dispute_opened_at });
  if (dispute.dispute_escalated_at) timeline.push({ label: 'Escalated', date: dispute.dispute_escalated_at });
  if (dispute.dispute_requested_at) timeline.push({ label: 'Sub-WO requested', date: dispute.dispute_requested_at });
  if (dispute.dispute_resolved_at)  timeline.push({ label: dispute.dispute_status === 'resolved' ? 'Resolved' : 'Closed', date: dispute.dispute_resolved_at });

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
      {/* Top row */}
      <div className="px-4 py-3 border-b border-[#1e1e2e] flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-blue-400 font-semibold font-mono">{dispute.wo_number}</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${disputeBadgeClasses(dispute.dispute_status)}`}>
              {DISPUTE_STATUS[dispute.dispute_status]?.emoji} {DISPUTE_STATUS[dispute.dispute_status]?.short}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700/30 text-slate-400 border border-slate-700/50">
              {reasonLabel}
            </span>
            {invoice && (
              <a
                href={`/invoices?invoiceId=${invoice.invoice_id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={`Open invoice ${invoice.invoice_number} in a new tab`}
                className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 font-mono hover:bg-blue-500/30 hover:text-blue-300 hover:border-blue-400/50 transition cursor-pointer inline-flex items-center gap-1"
              >
                {invoice.invoice_number}
                <span className="text-[8px] opacity-70">↗</span>
              </a>
            )}
          </div>
          <div className="text-slate-500 text-xs mt-1 truncate">{dispute.building}</div>
          {dispute.lead_tech && (
            <div className="text-slate-600 text-xs">Lead: {dispute.lead_tech.first_name} {dispute.lead_tech.last_name}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Amount at Risk</div>
          <div className={`text-xl font-bold font-mono ${dispute.dispute_status === 'resolved' ? 'text-emerald-400' : dispute.dispute_status === 'written_off' ? 'text-slate-500' : 'text-yellow-400'}`}>
            {fmt(dispute.dispute_amount)}
          </div>
          {dispute.dispute_status === 'resolved' && dispute.dispute_recovered_amount != null && (
            <div className="text-[10px] text-emerald-500 mt-0.5">
              Recovered: {fmt(dispute.dispute_recovered_amount)}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="px-4 py-2 bg-[#0a0a0f]/40 border-b border-[#1e1e2e] flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {timeline.map((t, i) => (
            <span key={i} className="text-slate-500">
              <span className="text-slate-600 mr-1">{t.label}:</span>
              <span className="text-slate-400">{fmtDate(t.date)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Sub work order — the way money comes back on a cancelled/closed WO */}
      {(dispute.dispute_status === 'sub_wo_requested' || dispute.dispute_sub_wo) && (
        <div className="px-4 py-2.5 border-b border-[#1e1e2e] bg-sky-500/5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-sky-400 font-semibold uppercase tracking-wider">Sub-WO</span>
          {editingSubWo ? (
            <>
              <input value={subWoDraft} onChange={e => onChangeSubWo(e.target.value)}
                placeholder="e.g. C3301234"
                className="bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded px-2 py-1 font-mono w-36 focus:outline-none focus:border-sky-500/60" />
              <button onClick={onSaveSubWo} className="px-2 py-1 rounded bg-sky-600 text-white font-semibold">Save</button>
              <button onClick={onCancelSubWo} className="px-2 py-1 rounded bg-[#1e1e2e] border border-[#2d2d44] text-slate-400">Cancel</button>
            </>
          ) : dispute.dispute_sub_wo ? (
            <>
              <span className="font-mono text-slate-200">{dispute.dispute_sub_wo}</span>
              {subWo ? (
                <span className="text-slate-400">
                  · in FSM: {subWo.status}{subWo.cbre_status ? ` / ${subWo.cbre_status}` : ''}
                  {subWo.invoice
                    ? <> · <a href={`/invoices?invoiceId=${subWo.invoice.invoice_id}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 font-mono">{subWo.invoice.invoice_number}</a> {subWo.invoice.status} {fmt(subWo.invoice.total)}</>
                    : ' · no invoice yet'}
                </span>
              ) : (
                <span className="text-amber-400">· not in FSM yet (import the dispatch e-mail)</span>
              )}
              <button onClick={onStartEditSubWo} className="text-blue-400 hover:text-blue-300 ml-auto">✏️</button>
            </>
          ) : (
            <>
              <span className="text-slate-500 italic">waiting for CBRE{dispute.dispute_requested_at ? ` — requested ${fmtDate(dispute.dispute_requested_at)} (${daysSince(dispute.dispute_requested_at)} days)` : ''}</span>
              <button onClick={onStartEditSubWo} className="text-blue-400 hover:text-blue-300 ml-auto">+ Link sub-WO</button>
            </>
          )}
        </div>
      )}

      {/* Notes section */}
      <div className="px-4 py-3 border-b border-[#1e1e2e]">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Notes / UPS Communication Log</div>
          {!editingNotes && (
            <button onClick={onStartEditNotes}
              className="text-xs text-blue-400 hover:text-blue-300">
              {dispute.dispute_notes ? '✏️ Edit' : '+ Add'}
            </button>
          )}
        </div>
        {editingNotes ? (
          <div className="space-y-2">
            <textarea value={notesDraft} onChange={e => onChangeNotes(e.target.value)}
              rows={4}
              placeholder="e.g. 5/12 — Called Deontye, said he'll check with billing. 5/14 — Sent invoice copy via email..."
              className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/60 resize-none font-mono" />
            <div className="flex gap-2 justify-end">
              <button onClick={onCancelNotes}
                className="px-3 py-1 rounded text-xs bg-[#1e1e2e] border border-[#2d2d44] text-slate-400">Cancel</button>
              <button onClick={onSaveNotes}
                className="px-3 py-1 rounded text-xs bg-blue-600 text-white font-semibold">Save</button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-300 whitespace-pre-wrap font-mono leading-relaxed bg-[#0a0a0f]/30 rounded p-2 min-h-[2rem]">
            {dispute.dispute_notes || <span className="text-slate-700 italic font-sans">No notes yet</span>}
          </div>
        )}
      </div>

      {/* Resolve inline form */}
      {transitionResolveOpen && (
        <div className="px-4 py-3 border-b border-[#1e1e2e] bg-emerald-500/5">
          <div className="text-xs text-emerald-400 font-semibold mb-2">🟢 Mark as Resolved — Recovery Amount</div>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-slate-500">$</span>
            <input type="number" step="0.01"
              value={recoveredAmountDraft}
              onChange={e => onChangeRecovered(e.target.value)}
              className="flex-1 bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded px-2 py-1 text-sm font-mono" />
            <button onClick={onCancelResolve}
              className="px-3 py-1 rounded text-xs bg-[#1e1e2e] border border-[#2d2d44] text-slate-400">Cancel</button>
            <button onClick={onConfirmResolve}
              className="px-3 py-1 rounded text-xs bg-emerald-600 text-white font-semibold">Confirm Resolve</button>
          </div>
          <p className="text-xs text-slate-600 mt-1">Enter the actual amount recovered (can differ from original at-risk amount)</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-2.5 flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {transitions.map(t => (
            <button key={t.to} onClick={() => onTransition(t.to)}
              className={`px-2.5 py-1 rounded text-xs font-semibold transition ${getBtnClass(t.variant)}`}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={onRemove}
          title="Remove dispute tracking entirely"
          className="text-xs text-red-500/50 hover:text-red-400">🗑 Remove</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function WaitingOnCbre({ rows, loading, onRefresh, onCopy, copied }) {
  const overdue = rows.filter(r => (r.days ?? 0) >= WAITING_WARN_DAYS);
  const total = rows.reduce((s, r) => s + (r.requested || 0), 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="text-slate-400">
          <span className="text-slate-200 font-semibold">{rows.length}</span> NTE request{rows.length !== 1 ? 's' : ''} waiting at CBRE
          {' · '}<span className="text-amber-400 font-semibold">{overdue.length}</span> older than {WAITING_WARN_DAYS} days
          {' · '}{fmt(total)} requested
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="px-3 py-1.5 rounded-lg text-xs bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:bg-[#2d2d44]">↻ Refresh</button>
          <button onClick={onCopy} disabled={!overdue.length}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 disabled:cursor-not-allowed">
            {copied ? '✓ Copied' : `📋 Copy overdue list for CBRE (${overdue.length})`}
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 text-sm">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl py-16 text-center text-slate-600">Nothing waiting at CBRE</div>
      ) : (
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 uppercase tracking-wider">
              <tr className="border-b border-[#1e1e2e]">
                <th className="text-left px-3 py-2">WO</th>
                <th className="text-left px-3 py-2">Site</th>
                <th className="text-left px-3 py-2">Submitted</th>
                <th className="text-right px-3 py-2">Days</th>
                <th className="text-right px-3 py-2">Requested</th>
                <th className="text-left px-3 py-2">FSM status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const late = (r.days ?? 0) >= WAITING_WARN_DAYS;
                return (
                  <tr key={r.wo_id} className={`border-b border-[#1e1e2e]/60 ${late ? 'bg-amber-500/5' : ''}`}>
                    <td className="px-3 py-2 font-mono text-blue-400">{r.wo_number}{r.dispute_status ? <span className="ml-1 text-[10px] text-slate-500">(dispute)</span> : null}</td>
                    <td className="px-3 py-2 text-slate-400 truncate max-w-[220px]">{r.building}</td>
                    <td className="px-3 py-2 text-slate-400">{fmtDate(r.waiting_since)}</td>
                    <td className={`px-3 py-2 text-right font-mono ${late ? 'text-amber-400 font-semibold' : 'text-slate-300'}`}>{r.days ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-200">{fmt(r.requested)}</td>
                    <td className="px-3 py-2 text-slate-500">{r.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function getBtnClass(variant) {
  return {
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    orange:  'bg-orange-600 hover:bg-orange-500 text-white',
    sky:     'bg-sky-600 hover:bg-sky-500 text-white',
    default: 'bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:bg-[#2d2d44]',
    ghost:   'text-slate-500 hover:text-slate-300 hover:bg-[#1e1e2e]',
  }[variant] || 'bg-[#1e1e2e] border border-[#2d2d44] text-slate-300';
}
