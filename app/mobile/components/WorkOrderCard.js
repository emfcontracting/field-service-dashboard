// mobile/components/WorkOrderCard.js
'use client';

import {
  formatDate,
  calculateAge,
  getPriorityBadge,
  getPriorityColor,
  getStatusBadge
} from '../utils/formatters';

export default function WorkOrderCard({ workOrder, onClick }) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer active:scale-98"
    >
      <div className="flex justify-between items-start mb-2">
        <div>
          <span className="font-bold text-lg">{workOrder.wo_number}</span>
          <span className={`ml-2 text-sm ${getPriorityColor(workOrder.priority)}`}>
            {getPriorityBadge(workOrder.priority)}
          </span>
        </div>
        <span className="text-xs bg-gray-700 px-2 py-1 rounded-full">
          {getStatusBadge(workOrder.status)}
        </span>
      </div>
      
      <h3 className="font-semibold mb-1">{workOrder.building}</h3>
      <p className="text-sm text-gray-400 mb-2">{workOrder.work_order_description}</p>
      
      <div className="flex justify-between items-center text-xs text-gray-500">
        <div>
          <span>Entered: {formatDate(workOrder.date_entered)}</span>
          <span className="ml-2 text-orange-500 font-semibold">
            {calculateAge(workOrder.date_entered)} days old
          </span>
        </div>
        <span className="text-green-500 font-bold">
          NTE: ${(workOrder.nte || 0).toFixed(2)}
        </span>
      </div>
    </div>
  );
}