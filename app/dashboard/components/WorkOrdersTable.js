// app/dashboard/components/WorkOrdersTable.js
'use client';

import { getStatusColor } from '../utils/styleHelpers';
import { calculateTotalCost } from '../utils/calculations';
import { getPriorityBadge } from '../utils/priorityHelpers';

export default function WorkOrdersTable({ 
  workOrders, 
  loading, 
  onSelectWorkOrder,
  searchTerm,
  statusFilter,
  priorityFilter 
}) {
  
  // Check if work order is "new" (unassigned and less than 24 hours old)
  const isNewWorkOrder = (wo) => {
    // Must be unassigned
    if (wo.lead_tech_id) return false;
    
    // Check if created within last 24 hours
    const createdDate = new Date(wo.date_entered || wo.created_at);
    const now = new Date();
    const hoursSinceCreation = (now - createdDate) / (1000 * 60 * 60);
    
    return hoursSinceCreation <= 24;
  };

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
        Loading work orders...
      </div>
    );
  }

  if (workOrders.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-8 text-center text-gray-400">
        {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
          ? 'No work orders match your filters'
          : 'No work orders yet. Create your first one!'}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto overflow-y-visible" style={{ maxWidth: '100%' }}>
        <table className="w-full text-xs" style={{ tableLayout: 'fixed', minWidth: '1400px' }}>
          <thead className="bg-gray-700">
            <tr>
              <th className="px-2 py-2 text-left" style={{ width: '100px' }}>WO#</th>
              <th className="px-2 py-2 text-left" style={{ width: '80px' }}>Date</th>
              <th className="px-2 py-2 text-left" style={{ width: '80px' }}>Building</th>
              <th className="px-2 py-2 text-left" style={{ width: '300px' }}>Description</th>
              <th className="px-2 py-2 text-left" style={{ width: '120px' }}>Status</th>
              <th className="px-2 py-2 text-left" style={{ width: '80px' }}>Priority</th>
              <th className="px-2 py-2 text-left" style={{ width: '120px' }}>Lead Tech</th>
              <th className="px-2 py-2 text-right" style={{ width: '80px' }}>NTE</th>
              <th className="px-2 py-2 text-right" style={{ width: '80px' }}>Est Cost</th>
              <th className="px-2 py-2 text-center" style={{ width: '40px' }}>🔒</th>
              <th className="px-2 py-2 text-center" style={{ width: '60px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {workOrders.map(wo => {
              const totalCost = calculateTotalCost(wo);
              const overBudget = totalCost > (wo.nte || 0) && (wo.nte || 0) > 0;
              const isNew = isNewWorkOrder(wo);

              return (
                <tr
                  key={wo.wo_id}
                  onClick={() => onSelectWorkOrder(wo)}
                  className="border-t border-gray-700 hover:bg-gray-700 transition cursor-pointer"
                >
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{wo.wo_number}</span>
                      {isNew && (
                        <span className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                          NEW
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    {(() => {
                      const dateValue = wo.date_entered;
                      if (!dateValue) return 'No Date';
                      
                      const date = new Date(dateValue);
                      if (isNaN(date.getTime()) || date.getFullYear() < 2000) {
                        return 'Invalid';
                      }
                      
                      return date.toLocaleDateString('en-US', { 
                        month: '2-digit', 
                        day: '2-digit',
                        year: '2-digit'
                      });
                    })()}
                  </td>
                  <td className="px-2 py-2">{wo.building}</td>
                  <td className="px-2 py-2">
                    <div className="truncate" title={wo.work_order_description}>
                      {wo.work_order_description}
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex flex-col gap-1">
                      <span className={`px-2 py-1 rounded text-xs font-semibold text-center ${getStatusColor(wo.status)}`}>
                        {wo.status.replace('_', ' ').toUpperCase()}
                      </span>
                      {wo.assigned_to_field && (
                        <span className="px-1 py-0.5 bg-blue-600 rounded text-xs font-bold text-center">
                          📱
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-center">
  {(() => {
    const badge = getPriorityBadge(wo.priority);
    
    // Compact version - just show emoji and code (e.g. "🔴 P1")
    const compactText = badge.text.split(' ')[0] + ' ' + badge.text.split(' ')[1];
    
    return (
      <span 
        className={`px-2 py-1 rounded text-xs font-semibold text-white ${badge.color} whitespace-nowrap`}
        title={badge.text} // Full text on hover
      >
        {compactText}
      </span>
    );
  })()}
</td>
                  <td className="px-2 py-2">
                    {wo.lead_tech ? (
                      <div className="truncate" title={`${wo.lead_tech.first_name} ${wo.lead_tech.last_name}`}>
                        {wo.lead_tech.first_name} {wo.lead_tech.last_name.charAt(0)}.
                      </div>
                    ) : (
                      <span className="text-gray-500">Unassigned</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right font-semibold">
                    ${(wo.nte || 0).toFixed(0)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <span className={overBudget ? 'text-red-400 font-bold' : ''}>
                      ${(totalCost || 0).toFixed(0)}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {wo.is_locked && '🔒'}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs font-bold">
                      View
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