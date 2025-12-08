// app/dashboard/components/WorkOrdersView.js
'use client';

import { useState, useEffect } from 'react';
import WorkOrdersTable from './WorkOrdersTable';
import StatsCards from './StatsCards';
import WorkOrdersFilters from './WorkOrdersFilters';
import ExportDropdown from './ExportDropdown';

export default function WorkOrdersView({ 
  workOrders, 
  stats, 
  loading, 
  users,
  supabase,
  onSelectWorkOrder, 
  onNewWorkOrder, 
  onImport,
  refreshWorkOrders 
}) {
  const [filteredWorkOrders, setFilteredWorkOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [billingStatusFilter, setBillingStatusFilter] = useState('all');
  const [cbreStatusFilter, setCbreStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Apply filters whenever workOrders or filters change
  useEffect(() => {
    applyFilters();
  }, [workOrders, statusFilter, priorityFilter, billingStatusFilter, cbreStatusFilter, searchTerm]);

  const applyFilters = () => {
    let filtered = [...workOrders];

    // Work status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(wo => wo.status === statusFilter);
    }

    // CBRE status filter
    if (cbreStatusFilter !== 'all') {
      filtered = filtered.filter(wo => wo.cbre_status === cbreStatusFilter);
    }

    // Billing status filter
    if (billingStatusFilter !== 'all') {
      if (billingStatusFilter === 'none') {
        // Show only work orders without any billing flag
        filtered = filtered.filter(wo => !wo.billing_status);
      } else {
        filtered = filtered.filter(wo => wo.billing_status === billingStatusFilter);
      }
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(wo => wo.priority === priorityFilter);
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(wo =>
        wo.wo_number.toLowerCase().includes(search) ||
        wo.building.toLowerCase().includes(search) ||
        wo.work_order_description.toLowerCase().includes(search) ||
        wo.requestor?.toLowerCase().includes(search)
      );
    }

    setFilteredWorkOrders(filtered);
  };

  // Handle clicking on billing status cards
  const handleFilterByBillingStatus = (status) => {
    setBillingStatusFilter(status);
  };

  const selectWorkOrderEnhanced = async (wo) => {
    // Fetch team members for this work order
    const { data: teamMembers } = await supabase
      .from('work_order_assignments')
      .select(`
        *,
        user:users(first_name, last_name, email, role)
      `)
      .eq('wo_id', wo.wo_id);

    onSelectWorkOrder({ ...wo, teamMembers: teamMembers || [] });
  };

  return (
    <>
      <StatsCards 
        stats={stats} 
        onFilterByBillingStatus={handleFilterByBillingStatus}
      />
      
      <WorkOrdersFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        billingStatusFilter={billingStatusFilter}
        setBillingStatusFilter={setBillingStatusFilter}
        cbreStatusFilter={cbreStatusFilter}
        setCbreStatusFilter={setCbreStatusFilter}
        onNewWorkOrder={onNewWorkOrder}
        onImport={onImport}
        exportDropdown={<ExportDropdown workOrders={workOrders} />}
      />

      {/* Active CBRE Filter Indicator */}
      {cbreStatusFilter !== 'all' && (
        <div className="bg-red-900/50 border border-red-600 rounded-lg p-3 mb-4 flex justify-between items-center">
          <span className="text-red-200">
            <strong>CBRE Filter Active:</strong>{' '}
            {cbreStatusFilter === 'escalation' && '🚨 Escalation'}
            {cbreStatusFilter === 'quote_approved' && '✅ Quote Approved'}
            {cbreStatusFilter === 'quote_rejected' && '❌ Quote Rejected'}
            {cbreStatusFilter === 'quote_submitted' && '📤 Quote Submitted'}
            {cbreStatusFilter === 'reassigned' && '🔄 Reassigned'}
            {' '}({filteredWorkOrders.length} results)
          </span>
          <button
            onClick={() => setCbreStatusFilter('all')}
            className="bg-red-700 hover:bg-red-600 px-3 py-1 rounded text-sm font-semibold"
          >
            Clear Filter
          </button>
        </div>
      )}

      {/* Active Billing Filter Indicator */}
      {billingStatusFilter !== 'all' && (
        <div className="bg-orange-900/50 border border-orange-600 rounded-lg p-3 mb-4 flex justify-between items-center">
          <span className="text-orange-200">
            <strong>Billing Filter Active:</strong>{' '}
            {billingStatusFilter === 'none' && 'No Billing Flag'}
            {billingStatusFilter === 'pending_cbre_quote' && '📋 Needs CBRE Quote'}
            {billingStatusFilter === 'quoted' && '📤 Quote Submitted'}
            {billingStatusFilter === 'quote_approved' && '✅ Quote Approved'}
            {' '}({filteredWorkOrders.length} results)
          </span>
          <button
            onClick={() => setBillingStatusFilter('all')}
            className="bg-orange-700 hover:bg-orange-600 px-3 py-1 rounded text-sm font-semibold"
          >
            Clear Filter
          </button>
        </div>
      )}

      <WorkOrdersTable
        workOrders={filteredWorkOrders}
        loading={loading}
        onSelectWorkOrder={selectWorkOrderEnhanced}
        searchTerm={searchTerm}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
      />
    </>
  );
}
