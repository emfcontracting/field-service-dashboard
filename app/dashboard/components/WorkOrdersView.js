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
  const [cbreStatusFilter, setCbreStatusFilter] = useState('all');
  const [techFilter, setTechFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Apply filters whenever workOrders or filters change
  useEffect(() => {
    applyFilters();
  }, [workOrders, statusFilter, priorityFilter, cbreStatusFilter, techFilter, searchTerm]);

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

    // Priority filter
    if (priorityFilter !== 'all') {
      filtered = filtered.filter(wo => wo.priority === priorityFilter);
    }

    // Tech filter
    if (techFilter !== 'all') {
      if (techFilter === 'unassigned') {
        // Show only unassigned work orders
        filtered = filtered.filter(wo => !wo.lead_tech_id);
      } else {
        // Filter by specific tech (as lead or team member)
        filtered = filtered.filter(wo => {
          // Check if tech is lead
          if (wo.lead_tech_id === techFilter) return true;
          // Check if tech is in team members (if available)
          if (wo.teamMembers && wo.teamMembers.some(tm => tm.user_id === techFilter)) return true;
          // Check lead_tech object
          if (wo.lead_tech?.user_id === techFilter) return true;
          return false;
        });
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
        // Also search by tech name
        (wo.lead_tech && 
          `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`.toLowerCase().includes(search))
      );
    }

    setFilteredWorkOrders(filtered);
  };

  // Handle clicking on CBRE status cards
  const handleFilterByCbreStatus = (status) => {
    setCbreStatusFilter(status);
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
        onFilterByCbreStatus={handleFilterByCbreStatus}
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
            {cbreStatusFilter === 'pending_quote' && '📋 Pending Quote'}
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
