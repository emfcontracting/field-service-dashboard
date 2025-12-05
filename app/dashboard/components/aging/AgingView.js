// app/dashboard/components/aging/AgingView.js
'use client';

import { useState, useMemo } from 'react';
import AgingStatsCards from './AgingStatsCards';
import AgingWorkOrdersList from './AgingWorkOrdersList';
import AgingByTechChart from './AgingByTechChart';
import SendAlertModal from './SendAlertModal';

export default function AgingView({ 
  workOrders, 
  users, 
  supabase, 
  refreshWorkOrders,
  onSelectWorkOrder 
}) {
  const [filterSeverity, setFilterSeverity] = useState('all'); // 'all' | 'critical' | 'warning' | 'stale'
  const [filterTech, setFilterTech] = useState('all');
  const [sortBy, setSortBy] = useState('age'); // 'age' | 'priority' | 'tech'
  const [lastAlertSent, setLastAlertSent] = useState(null);
  const [sendingAlerts, setSendingAlerts] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);

  // Get lead techs for filter
  const leadTechs = users.filter(u => u.role === 'lead_tech' || u.role === 'admin');

  // Calculate aging for each work order
  const calculateAging = (wo) => {
    // Only calculate for work orders that have a lead tech assigned
    // and are not completed or needs_return
    if (!wo.lead_tech_id) return null;
    if (wo.status === 'completed' || wo.status === 'needs_return') return null;

    // Get the date when lead tech was assigned
    // Use lead_tech_assigned_at if available, otherwise fall back to date_entered
    const assignedDate = wo.lead_tech_assigned_at 
      ? new Date(wo.lead_tech_assigned_at)
      : wo.date_entered 
        ? new Date(wo.date_entered)
        : null;

    if (!assignedDate || isNaN(assignedDate.getTime())) return null;

    const now = new Date();
    const diffTime = now - assignedDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    // Determine severity
    let severity = 'ok';
    if (diffDays >= 5) {
      severity = 'critical';
    } else if (diffDays >= 3) {
      severity = 'warning';
    } else if (diffDays >= 2) {
      severity = 'stale';
    }

    return {
      days: diffDays,
      hours: diffHours,
      totalHours: Math.floor(diffTime / (1000 * 60 * 60)),
      severity,
      assignedDate
    };
  };

  // Process all work orders with aging data
  const agingWorkOrders = useMemo(() => {
    return workOrders
      .map(wo => {
        const aging = calculateAging(wo);
        return { ...wo, aging };
      })
      .filter(wo => wo.aging !== null && wo.aging.days >= 2) // Only show 2+ days old
      .sort((a, b) => {
        if (sortBy === 'age') {
          return b.aging.totalHours - a.aging.totalHours;
        } else if (sortBy === 'priority') {
          const priorityOrder = { emergency: 0, high: 1, medium: 2, low: 3 };
          return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
        } else if (sortBy === 'tech') {
          const techA = a.lead_tech ? `${a.lead_tech.first_name} ${a.lead_tech.last_name}` : 'ZZZ';
          const techB = b.lead_tech ? `${b.lead_tech.first_name} ${b.lead_tech.last_name}` : 'ZZZ';
          return techA.localeCompare(techB);
        }
        return 0;
      });
  }, [workOrders, sortBy]);

  // Apply filters
  const filteredWorkOrders = useMemo(() => {
    return agingWorkOrders.filter(wo => {
      // Severity filter
      if (filterSeverity !== 'all' && wo.aging.severity !== filterSeverity) {
        return false;
      }
      // Tech filter
      if (filterTech !== 'all' && wo.lead_tech_id !== filterTech) {
        return false;
      }
      return true;
    });
  }, [agingWorkOrders, filterSeverity, filterTech]);

  // Calculate stats
  const stats = useMemo(() => {
    const critical = agingWorkOrders.filter(wo => wo.aging.severity === 'critical').length;
    const warning = agingWorkOrders.filter(wo => wo.aging.severity === 'warning').length;
    const stale = agingWorkOrders.filter(wo => wo.aging.severity === 'stale').length;
    const total = agingWorkOrders.length;

    // Calculate by tech
    const byTech = {};
    agingWorkOrders.forEach(wo => {
      const techId = wo.lead_tech_id || 'unassigned';
      const techName = wo.lead_tech 
        ? `${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`
        : 'Unassigned';
      
      if (!byTech[techId]) {
        byTech[techId] = { 
          name: techName, 
          visibleName: techName,
          visibleNameWithId: techId,
          critical: 0, 
          warning: 0, 
          stale: 0, 
          total: 0,
          workOrders: []
        };
      }
      byTech[techId][wo.aging.severity]++;
      byTech[techId].total++;
      byTech[techId].workOrders.push(wo);
    });

    // Find oldest
    const oldest = agingWorkOrders.length > 0 ? agingWorkOrders[0] : null;

    return { critical, warning, stale, total, byTech, oldest };
  }, [agingWorkOrders]);

  // Handle alert sent callback
  const handleAlertSent = () => {
    setLastAlertSent(new Date());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              ⚠️ Aging Report & Priority Alerts
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Work orders open 2+ days since tech assignment
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Severity Filter */}
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
            >
              <option value="all">All Severities</option>
              <option value="critical">🔴 Critical (5+ days)</option>
              <option value="warning">🟠 Warning (3-4 days)</option>
              <option value="stale">🟡 Stale (2-3 days)</option>
            </select>

            {/* Tech Filter */}
            <select
              value={filterTech}
              onChange={(e) => setFilterTech(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
            >
              <option value="all">All Techs</option>
              {leadTechs.map(tech => (
                <option key={tech.user_id} value={tech.user_id}>
                  {tech.first_name} {tech.last_name}
                </option>
              ))}
            </select>

            {/* Sort By */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-gray-700 text-white px-3 py-2 rounded-lg text-sm"
            >
              <option value="age">Sort by Age</option>
              <option value="priority">Sort by Priority</option>
              <option value="tech">Sort by Tech</option>
            </select>

            {/* Send Alerts Button - Opens Modal */}
            <button
              onClick={() => setShowSendModal(true)}
              disabled={stats.total === 0}
              className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2"
            >
              📧 Send Alert Emails
            </button>
          </div>
        </div>

        {lastAlertSent && (
          <div className="mt-2 text-xs text-gray-500">
            Last alert sent: {lastAlertSent.toLocaleString()}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <AgingStatsCards 
        stats={stats} 
        onFilterClick={setFilterSeverity}
      />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Work Orders List */}
        <div className="lg:col-span-2">
          <AgingWorkOrdersList
            workOrders={filteredWorkOrders}
            onSelectWorkOrder={onSelectWorkOrder}
            leadTechs={leadTechs}
          />
        </div>

        {/* Sidebar - By Tech Breakdown */}
        <div>
          <AgingByTechChart
            stats={stats}
            onTechClick={setFilterTech}
            selectedTech={filterTech}
            onSendToTech={(techId) => setShowSendModal({ techId })}
          />
        </div>
      </div>

      {/* Send Alert Modal */}
      {showSendModal && (
        <SendAlertModal
          stats={stats}
          agingWorkOrders={agingWorkOrders}
          leadTechs={leadTechs}
          users={users}
          preselectedTechId={showSendModal.techId || null}
          onClose={() => setShowSendModal(false)}
          onAlertSent={handleAlertSent}
        />
      )}
    </div>
  );
}
