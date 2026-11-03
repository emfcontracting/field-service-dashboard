// app/dashboard/components/WorkOrdersView.js
'use client';

import { useState, useEffect } from 'react';
import WorkOrdersTable, { hasUnackCbreUpdate } from './WorkOrdersTable';
import StatsCards from './StatsCards';
import WorkOrdersFilters from './WorkOrdersFilters';
import ExportDropdown from './ExportDropdown';
import { exportCostDetailCSV } from '../utils/exportHelpers';
import { extractPriorityCode } from '@/lib/priorityCodes';
import { ARCHIVE_REASONS, archiveWarnings, archiveWorkOrders } from '@/lib/workOrderArchive';

export default function WorkOrdersView({ 
  workOrders, 
  stats, 
  loading, 
  users,
  supabase,
  onSelectWorkOrder, 
  onNewWorkOrder, 
  onImport,
  refreshWorkOrders,
  isSuperuser = false,
  isAdmin = false,
  currentUser = null,
  missingHoursCount = 0,
  onMissingHoursClick
}) {
  const [filteredWorkOrders, setFilteredWorkOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [cbreStatusFilter, setCbreStatusFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [nteFilter, setNteFilter] = useState(false); // true = show only WOs with pending NTE
  
  // Multi-select state
  const [selectedWOs, setSelectedWOs] = useState(new Set());
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  const [isExportingCombined, setIsExportingCombined] = useState(false);
  
  // Bulk archive (admin only). Deleting for good moved to the Archive tab on
  // 2026-11-03 — out of the list, so it takes two deliberate steps.
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('cbre_cancelled');
  const [archiveNote, setArchiveNote] = useState('');
  const [isArchiving, setIsArchiving] = useState(false);
  const currentUserId = currentUser?.user_id ?? null;

  // Apply filters whenever workOrders or filters change
  useEffect(() => {
    applyFilters();
  }, [workOrders, statusFilter, priorityFilter, cbreStatusFilter, techFilter, searchTerm, nteFilter]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedWOs(new Set());
  }, [statusFilter, priorityFilter, cbreStatusFilter, techFilter, searchTerm, nteFilter]);

  const applyFilters = () => {
    let filtered = [...workOrders];

    // NTE pending filter
    if (nteFilter) {
      filtered = filtered.filter(wo => wo.nte_quotes?.some(q => q.nte_status === 'pending'));
    }

    // Work status filter - handle both single value and array.
    // Special case: 'update_required' is a SOFT flag (not a real status), so it
    // matches on update_required_flagged_at instead of status.
    if (statusFilter !== 'all') {
      const matchStatus = (wo, val) =>
        val === 'update_required' ? !!wo.update_required_flagged_at : wo.status === val;

      if (Array.isArray(statusFilter)) {
        filtered = filtered.filter(wo => statusFilter.some(val => matchStatus(wo, val)));
      } else {
        filtered = filtered.filter(wo => matchStatus(wo, statusFilter));
      }
    }

    // CBRE status filter - handle both single value and array.
    // 'escalation' is now a separate overlay flag (wo.escalation), not a
    // cbre_status value — match it against the flag instead.
    if (cbreStatusFilter !== 'all') {
      const matchCbre = (wo, val) =>
        val === 'escalation' ? wo.escalation === true : wo.cbre_status === val;
      if (Array.isArray(cbreStatusFilter)) {
        filtered = filtered.filter(wo => cbreStatusFilter.some(val => matchCbre(wo, val)));
      } else {
        filtered = filtered.filter(wo => matchCbre(wo, cbreStatusFilter));
      }
    }

    // Priority filter - match by canonical P-code (handles "P1", "P1 - Emergency", etc.)
    if (priorityFilter !== 'all') {
      const codes = Array.isArray(priorityFilter) ? priorityFilter : [priorityFilter];
      filtered = filtered.filter(wo => codes.includes(extractPriorityCode(wo.priority)));
    }

    // Tech filter - handle both single value and array
    if (techFilter !== 'all') {
      if (Array.isArray(techFilter)) {
        filtered = filtered.filter(wo => {
          if (techFilter.includes('unassigned') && !wo.lead_tech_id) return true;
          if (techFilter.includes(wo.lead_tech_id)) return true;
          if (wo.teamMembers && wo.teamMembers.some(tm => techFilter.includes(tm.user_id))) return true;
          if (wo.lead_tech && techFilter.includes(wo.lead_tech.user_id)) return true;
          return false;
        });
      } else {
        if (techFilter === 'unassigned') {
          filtered = filtered.filter(wo => !wo.lead_tech_id);
        } else {
          filtered = filtered.filter(wo => {
            if (wo.lead_tech_id === techFilter) return true;
            if (wo.teamMembers && wo.teamMembers.some(tm => tm.user_id === techFilter)) return true;
            if (wo.lead_tech?.user_id === techFilter) return true;
            return false;
          });
        }
      }
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(wo =>
        wo.wo_number?.toLowerCase().includes(search) ||
        wo.qb_invoice_number?.toLowerCase().includes(search) ||
        wo.building?.toLowerCase().includes(search) ||
        wo.work_order_description?.toLowerCase().includes(search) ||
        wo.requestor?.toLowerCase().includes(search) ||
        (wo.lead_tech && 
          `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`.toLowerCase().includes(search))
      );
    }

    setFilteredWorkOrders(filtered);
  };

  // Handle clicking on CBRE status cards. Clicking the active card again
  // toggles the filter off; the filter bar mirrors this state, so its
  // Clear button removes a card-set filter too.
  const handleFilterByCbreStatus = (status) => {
    setCbreStatusFilter(prev => {
      const current = Array.isArray(prev) ? prev[0] : prev;
      return current === status && (!Array.isArray(prev) || prev.length === 1)
        ? 'all'
        : [status];
    });
  };

  const selectWorkOrderEnhanced = async (wo) => {
    const { data: teamMembers } = await supabase
      .from('work_order_assignments')
      .select(`
        *,
        user:users(first_name, last_name, email, role)
      `)
      .eq('wo_id', wo.wo_id);

    onSelectWorkOrder({ ...wo, teamMembers: teamMembers || [] });
  };

  // Toggle single work order selection
  const toggleWOSelection = (woId) => {
    setSelectedWOs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(woId)) {
        newSet.delete(woId);
      } else {
        newSet.add(woId);
      }
      return newSet;
    });
  };

  // Select all filtered work orders
  const selectAllWOs = () => {
    const allIds = new Set(filteredWorkOrders.map(wo => wo.wo_id));
    setSelectedWOs(allIds);
  };

  // Clear all selections
  const clearSelection = () => {
    setSelectedWOs(new Set());
  };

  // Toggle checkbox mode
  const toggleCheckboxMode = () => {
    if (showCheckboxes) {
      setSelectedWOs(new Set());
      setShowCheckboxes(false);
    } else {
      setShowCheckboxes(true);
    }
  };

  // Download combined cost CSV for selected work orders
  const handleDownloadCombinedCSV = async () => {
    if (selectedWOs.size === 0) {
      alert('Please select at least one work order.');
      return;
    }

    setIsExportingCombined(true);
    try {
      const selectedWorkOrders = filteredWorkOrders.filter(wo => selectedWOs.has(wo.wo_id));
      await exportCostDetailCSV(supabase, selectedWorkOrders);
    } catch (err) {
      console.error('Error exporting combined CSV:', err);
      alert('❌ Error exporting: ' + err.message);
    } finally {
      setIsExportingCombined(false);
    }
  };

  // Handle bulk archive (admin only). One statement for the whole selection;
  // the work orders stay in the table, they just leave the dashboard list.
  const handleBulkArchive = async () => {
    if (selectedWOs.size === 0) return;
    setIsArchiving(true);
    try {
      const { error } = await archiveWorkOrders(supabase, Array.from(selectedWOs), {
        reason: archiveReason,
        note: archiveNote.trim() || null,
        userId: currentUserId || null,
      });
      if (error) throw error;
      await refreshWorkOrders();
      setSelectedWOs(new Set());
      setShowArchiveModal(false);
      setArchiveNote('');
    } catch (error) {
      console.error('Error archiving work orders:', error);
      alert('Error archiving work orders: ' + error.message);
    } finally {
      setIsArchiving(false);
    }
  };

  // The selected work orders that still have money or an open answer in them.
  const selectedWithWarnings = filteredWorkOrders
    .filter((wo) => selectedWOs.has(wo.wo_id))
    .map((wo) => ({ wo, warnings: archiveWarnings(wo) }))
    .filter((x) => x.warnings.length > 0);

  // Get selected WO numbers for display
  const getSelectedWONumbers = () => {
    return filteredWorkOrders
      .filter(wo => selectedWOs.has(wo.wo_id))
      .map(wo => wo.wo_number)
      .join(', ');
  };

  // Count WOs with pending NTE for badge
  const pendingNTECount = workOrders.filter(wo => wo.nte_quotes?.some(q => q.nte_status === 'pending')).length;

  // CBRE acknowledgment: WOs with status changes the office hasn't acknowledged yet
  const unackCbreWOs = workOrders.filter(hasUnackCbreUpdate);

  const handleAcknowledgeCbre = async (woId) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ cbre_status_acknowledged_at: new Date().toISOString() })
        .eq('wo_id', woId);
      if (error) throw error;
      await refreshWorkOrders();
    } catch (err) {
      console.error('Failed to acknowledge CBRE update:', err);
      alert('Failed to acknowledge: ' + err.message);
    }
  };

  // Banner chip: open the work order the status change belongs to. Opening it
  // IS the acknowledgement — the office has seen the change — so the marker is
  // cleared at the same time. The ✓ next to the chip acknowledges without
  // opening, for the ones that need no second look.
  const openCbreWO = async (wo) => {
    try {
      await selectWorkOrderEnhanced(wo);
    } catch (err) {
      console.error('Failed to open work order from CBRE banner:', err);
      onSelectWorkOrder(wo);   // open it anyway, just without the team members
    }
    handleAcknowledgeCbre(wo.wo_id);
  };

  const handleAcknowledgeAllCbre = async () => {
    if (unackCbreWOs.length === 0) return;
    try {
      const woIds = unackCbreWOs.map(wo => wo.wo_id);
      const { error } = await supabase
        .from('work_orders')
        .update({ cbre_status_acknowledged_at: new Date().toISOString() })
        .in('wo_id', woIds);
      if (error) throw error;
      await refreshWorkOrders();
    } catch (err) {
      console.error('Failed to acknowledge all CBRE updates:', err);
      alert('Failed to acknowledge all: ' + err.message);
    }
  };

  return (
    <>
      {/* ── CBRE Status Update Banner ── Sticky, persistent until acknowledged ── */}
      {unackCbreWOs.length > 0 && (
        <div className="bg-gradient-to-r from-amber-900/40 via-amber-800/30 to-amber-900/20 border-2 border-amber-500/60 rounded-lg p-4 mb-4 shadow-lg shadow-amber-500/10">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl animate-pulse">🔔</span>
              <div>
                <div className="text-amber-100 font-bold text-base">
                  {unackCbreWOs.length} {unackCbreWOs.length === 1 ? 'work order has' : 'work orders have'} new CBRE status updates
                </div>
                <div className="text-amber-300/70 text-xs mt-0.5">
                  Click a WO# below to open it (that acknowledges it too), or ✓ to just clear the marker.
                </div>
              </div>
            </div>
            <button
              onClick={handleAcknowledgeAllCbre}
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition shadow-lg shadow-amber-600/30 whitespace-nowrap"
            >
              ✓ Acknowledge All ({unackCbreWOs.length})
            </button>
          </div>

          {/* Quick chips: WO number opens the work order (and acknowledges), ✓ acknowledges only */}
          <div className="mt-3 pt-3 border-t border-amber-500/30 flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {unackCbreWOs.slice(0, 50).map(wo => {
              const cbreLabel = (wo.cbre_status || '').replace(/_/g, ' ');
              return (
                <span
                  key={wo.wo_id}
                  className="bg-amber-950/60 border border-amber-500/40 hover:border-amber-300 rounded flex items-stretch overflow-hidden transition"
                >
                  <button
                    onClick={() => openCbreWO(wo)}
                    className="hover:bg-amber-700/60 text-amber-200 hover:text-white text-[10px] font-mono px-2 py-1 transition flex items-center gap-1"
                    title={`${wo.building || ''} — ${cbreLabel} — click to open the work order`}
                  >
                    <span className="font-bold">{wo.wo_number}</span>
                    <span className="text-amber-400/70">·</span>
                    <span className="opacity-80">{cbreLabel}</span>
                  </button>
                  <button
                    onClick={() => handleAcknowledgeCbre(wo.wo_id)}
                    className="border-l border-amber-500/40 hover:bg-amber-600/70 text-amber-400/80 hover:text-white text-[10px] px-1.5 transition"
                    title={`Acknowledge ${wo.wo_number} without opening it`}
                    aria-label={`Acknowledge ${wo.wo_number}`}
                  >
                    ✓
                  </button>
                </span>
              );
            })}
            {unackCbreWOs.length > 50 && (
              <span className="text-amber-400/60 text-[10px] italic px-2 py-1">
                + {unackCbreWOs.length - 50} more…
              </span>
            )}
          </div>
        </div>
      )}

      <StatsCards 
        stats={stats} 
        onFilterByCbreStatus={handleFilterByCbreStatus}
        onMissingHoursClick={onMissingHoursClick}
        missingHoursCount={missingHoursCount}
      />
      
      <WorkOrdersFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        cbreStatusFilter={cbreStatusFilter}
        setCbreStatusFilter={setCbreStatusFilter}
        techFilter={techFilter}
        setTechFilter={setTechFilter}
        users={users}
        onNewWorkOrder={onNewWorkOrder}
        onImport={onImport}
        nteFilter={nteFilter}
        setNteFilter={setNteFilter}
        pendingNTECount={pendingNTECount}
        exportDropdown={<ExportDropdown workOrders={workOrders} supabase={supabase} />}
      />

      {/* Selection Action Bar - Shows when checkboxes are on and items selected */}
      {showCheckboxes && selectedWOs.size > 0 && (
        <div className="bg-purple-900/70 border border-purple-500 rounded-lg p-3 mb-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div className="flex items-center gap-4">
              <span className="text-purple-100 font-semibold">
                ✅ {selectedWOs.size} work order(s) selected
              </span>
              <button
                onClick={clearSelection}
                className="text-purple-300 hover:text-white text-sm underline"
              >
                Clear
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadCombinedCSV}
                disabled={isExportingCombined}
                className="bg-green-600 hover:bg-green-500 disabled:bg-green-800 px-4 py-2 rounded font-bold text-white flex items-center gap-2"
              >
                {isExportingCombined ? (
                  <>
                    <span className="animate-spin">⏳</span> Exporting...
                  </>
                ) : (
                  <>💰 Download Combined Cost CSV</>
                )}
              </button>

              {(isAdmin || isSuperuser) && (
                <button
                  onClick={() => setShowArchiveModal(true)}
                  className="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded font-bold text-white flex items-center gap-2"
                  title="Move out of the dashboard into the Archive tab. Nothing is deleted."
                >
                  📦 Move to Archive
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 text-xs text-purple-300 truncate">
            Selected: {getSelectedWONumbers()}
          </div>
        </div>
      )}

      {/* Archive Modal — admin only. Warns about money, never blocks. */}
      {showArchiveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d0d14] rounded-lg p-6 max-w-lg w-full border border-slate-600 max-h-[85vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-slate-100 mb-1">📦 Move to Archive</h3>
            <p className="text-slate-400 text-sm mb-4">
              {selectedWOs.size} work order(s) leave the dashboard and show up under Archive.
              Nothing is deleted — you can restore them there at any time.
            </p>

            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Reason</label>
            <select
              value={archiveReason}
              onChange={(e) => setArchiveReason(e.target.value)}
              className="w-full bg-[#14141f] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 mb-3"
            >
              {ARCHIVE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>

            <label className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Note (optional)</label>
            <input
              value={archiveNote}
              onChange={(e) => setArchiveNote(e.target.value)}
              placeholder="e.g. covered by P3374674"
              className="w-full bg-[#14141f] border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 mb-4"
            />

            {selectedWithWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/60 bg-amber-900/20 p-3 mb-4">
                <div className="text-amber-300 font-semibold text-sm mb-2">
                  ⚠️ {selectedWithWarnings.length} of these still have something open
                </div>
                <ul className="space-y-1 text-xs text-amber-200/90">
                  {selectedWithWarnings.map(({ wo, warnings }) => (
                    <li key={wo.wo_id}>
                      <span className="font-semibold">{wo.wo_number}</span> — {warnings.join(' · ')}
                    </li>
                  ))}
                </ul>
                <div className="text-[11px] text-amber-200/70 mt-2">
                  Archiving them is allowed. They just stop being visible on the dashboard,
                  so settle them first if the money still has to come in.
                </div>
              </div>
            )}

            <div className="text-xs text-slate-500 mb-4 truncate">Selected: {getSelectedWONumbers()}</div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowArchiveModal(false)}
                disabled={isArchiving}
                className="bg-[#2d2d44] hover:bg-[#3d3d5e] px-4 py-2 rounded font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkArchive}
                disabled={isArchiving}
                className="bg-slate-600 hover:bg-slate-500 px-4 py-2 rounded font-bold flex items-center gap-2"
              >
                {isArchiving ? (<><span className="animate-spin">⏳</span> Archiving...</>) : (<>📦 Move to Archive</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results count + Select/Combine toggle */}
      <div className="mb-2 flex justify-between items-center">
        <span className="text-sm text-slate-400">
          Showing {filteredWorkOrders.length} of {workOrders.length} work orders
          {nteFilter && <span className="ml-2 text-orange-400 font-semibold">· NTE filter active</span>}
        </span>
        <button
          onClick={toggleCheckboxMode}
          className={`px-3 py-1 rounded text-sm font-semibold transition flex items-center gap-2 ${
            showCheckboxes 
              ? 'bg-purple-600 hover:bg-purple-700 text-white' 
              : 'bg-[#1e1e2e] hover:bg-[#2d2d44] text-slate-300'
          }`}
        >
          {showCheckboxes ? '✅ Select Mode ON' : '☑️ Select & Combine'}
        </button>
      </div>

      <WorkOrdersTable
        workOrders={filteredWorkOrders}
        loading={loading}
        onSelectWorkOrder={selectWorkOrderEnhanced}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        isSuperuser={isSuperuser}
        selectedWOs={selectedWOs}
        onToggleSelect={toggleWOSelection}
        onSelectAll={selectAllWOs}
        onClearSelection={clearSelection}
        showCheckboxes={showCheckboxes}
        onAcknowledgeCbre={handleAcknowledgeCbre}
      />
    </>
  );
}
