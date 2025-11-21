// Completed Work Orders Page Component
import { formatDate, calculateAge, getPriorityColor, getPriorityBadge } from '../utils/helpers';

export default function CompletedWorkOrders({
  currentUser,
  completedWorkOrders,
  onBack,
  onSelectWO,
  onShowChangePin,
  onLogout
}) {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={onBack}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold">Completed Work Orders</h1>
          <div className="flex gap-2">
            <button
              onClick={onShowChangePin}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm"
            >
              🔐
            </button>
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {completedWorkOrders.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400">No completed work orders</p>
            </div>
          ) : (
            <>
              <div className="bg-blue-900 rounded-lg p-3 mb-4 text-center">
                <p className="text-sm text-blue-200">
                  👆 Tap any completed work order to view details
                </p>
              </div>
              {completedWorkOrders.map(wo => (
                <div
                  key={wo.wo_id}
                  onClick={() => onSelectWO(wo)}
                  className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold text-lg">{wo.wo_number}</span>
                      <span className={`ml-2 text-sm ${getPriorityColor(wo.priority)}`}>
                        {getPriorityBadge(wo.priority)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-500 text-sm">✅ Completed</span>
                    </div>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <p className="font-semibold">{wo.building}</p>
                    <p className="text-gray-400">{wo.work_order_description}</p>
                    <p className="text-orange-500 text-xs">{calculateAge(wo.date_entered)} days old</p>
                    <p className="text-gray-500">Completed: {formatDate(wo.date_completed)}</p>
                    {wo.lead_tech && (
                      <p className="text-gray-500">Tech: {wo.lead_tech.first_name} {wo.lead_tech.last_name}</p>
                    )}
                  </div>

                  {wo.hours_regular || wo.hours_overtime ? (
                    <div className="mt-2 text-xs text-gray-400">
                      Hours: RT {wo.hours_regular || 0} / OT {wo.hours_overtime || 0} | Miles: {wo.miles || 0}
                    </div>
                  ) : null}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
