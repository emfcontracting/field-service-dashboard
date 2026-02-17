// app/dashboard/components/WorkOrdersView.js
'use client';

import { useState, useEffect } from 'react';
import WorkOrdersTable from './WorkOrdersTable';
import StatsCards from './StatsCards';
import WorkOrdersFilters from './WorkOrdersFilters';
import ExportDropdown from './ExportDropdown';
import { exportCostDetailCSV } from '../utils/exportHelpers';

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
  missingHoursCount = 0,
  onMissingHoursClick
}) {
  const [filteredWorkOrders, setFilteredWorkOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [cbreStatusFilter, setCbreStatusFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Multi-select state
  const [selectedWOs, setSelectedWOs] = useState(new Set());
  const [showCheckboxes, setShowCheckboxes] = useState(false);
  const [isExportingCombined, setIsExportingCombined] = useState(false);
  
  // Bulk delete (superuser only)
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Apply filters whenever workOrders or filters change
  useEffect(() => {
    applyFilters();
  }, [workOrders, statusFilter, priorityFilter, cbreStatusFilter, techFilter, searchTerm]);

  // Clear selection when filters change
  useEffect(() => {
    setSelectedWOs(new Set());
  }, [statusFilter, priorityFilter, cbreStatusFilter, techFilter, searchTerm]);

  const applyFilters = () => {
    let filtered = [...workOrders];

    // Work status filter - handle both single value and array
    if (statusFilter !== 'all') {
      if (Array.isArray(statusFilter)) {
        filtered = filtered.filter(wo => statusFilter.includes(wo.status));
      } else {
        filtered = filtered.filter(wo => wo.status === statusFilter);
      }
    }

    // CBRE status filter - handle both single value and array
    if (cbreStatusFilter !== 'all') {
      if (Array.isArray(cbreStatusFilter)) {
        filtered = filtered.filter(wo => cbreStatusFilter.includes(wo.cbre_status));
      } else {
        filtered = filtered.filter(wo => wo.cbre_status === cbreStatusFilter);
      }
    }

    // Priority filter - handle both single value and array
    if (priorityFilter !== 'all') {
      if (Array.isArray(priorityFilter)) {
        filtered = filtered.filter(wo => priorityFilter.includes(wo.priority));
      } else {
        filtered = filtered.filter(wo => wo.priority === priorityFilter);
      }
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
        wo.building?.toLowerCase().includes(search) ||
        wo.work_order_description?.toLowerCase().includes(search) ||
        wo.requestor?.toLowerCase().includes(search) ||
        (wo.lead_tech && 
          `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`.toLowerCase().includes(search))
      );
    }

    setFilteredWorkOrders(filtered);
  };

  // Handle clicking on CBRE status cards
  const handleFilterByCbreStatus = (status) => {
    setCbreStatusFilter([status]);
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
      // Turning off - clear selections
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
      // Get the selected WO objects from the filtered list
      const selectedWorkOrders = filteredWorkOrders.filter(wo => selectedWOs.has(wo.wo_id));
      await exportCostDetailCSV(supabase, selectedWorkOrders);
    } catch (err) {
      console.error('Error exporting combined CSV:', err);
      alert('❌ Error exporting: ' + err.message);
    } finally {
      setIsExportingCombined(false);
    }
  };

  // Handle bulk delete (superuser only)
  const handleBulkDelete = async () => {
    if (selectedWOs.size === 0) return;
    
    setIsDeleting(true);
    
    try {
      const woIds = Array.from(selectedWOs);
      
      await supabase
        .from('work_order_assignments')
        .delete()
        .in('wo_id', woIds);
      
      await supabase
        .from('daily_hours_log')
        .delete()
        .in('wo_id', woIds);
      
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .in('wo_id', woIds);
      
      if (error) throw error;
      
      await refreshWorkOrders();
      setSelectedWOs(new Set());
      setShowDeleteConfirm(false);
      
    } catch (error) {
      console.error('Error deleting work orders:', error);
      alert('Error deleting work orders: ' + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Get selected WO numbers for display
  const getSelectedWONumbers = () => {
    return filteredWorkOrders
      .filter(wo => selectedWOs.has(wo.wo_id))
      .map(wo => wo.wo_number)
      .join(', ');
  };

  return (
    <>
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
              {/* Combined Cost CSV Download */}
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

              {/* Bulk Delete - Superuser Only */}
              {isSuperuser && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold text-white flex items-center gap-2"
                >
                  🗑️ Delete Selected
                </button>
              )}
            </div>
          </div>
          {/* Show selected WO numbers */}
          <div className="mt-2 text-xs text-purple-300 truncate">
            Selected: {getSelectedWONumbers()}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-red-500">
            <h3 className="text-xl font-bold text-red-400 mb-4">⚠️ Confirm Delete</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to permanently delete <strong className="text-white">{selectedWOs.size} work order(s)</strong>?
            </p>
            <p className="text-red-400 text-sm mb-6">
              This will also delete all related assignments, daily hours logs, and cannot be undone!
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-bold flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin">⏳</span> Deleting...
                  </>
                ) : (
                  <>🗑️ Yes, Delete All</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Results count + Select/Combine toggle */}
      <div className="mb-2 flex justify-between items-center">
        <span className="text-sm text-gray-400">
          Showing {filteredWorkOrders.length} of {workOrders.length} work orders
        </span>
        <button
          onClick={toggleCheckboxMode}
          className={`px-3 py-1 rounded text-sm font-semibold transition flex items-center gap-2 ${
            showCheckboxes 
              ? 'bg-purple-600 hover:bg-purple-700 text-white' 
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
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
      />
    </>
  );
}
