// app/dashboard/components/StatsCards.js
'use client';

export default function StatsCards({ stats, onFilterByCbreStatus }) {
  return (
    <div className="space-y-4 mb-6">
      {/* Work Status Row */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Total</div>
          <div className="text-3xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Pending</div>
          <div className="text-3xl font-bold">{stats.pending}</div>
        </div>
        <div className="bg-blue-900 rounded-lg p-4">
          <div className="text-blue-300 text-sm">Assigned</div>
          <div className="text-3xl font-bold">{stats.assigned}</div>
        </div>
        <div className="bg-yellow-900 rounded-lg p-4">
          <div className="text-yellow-300 text-sm">In Progress</div>
          <div className="text-3xl font-bold">{stats.in_progress}</div>
        </div>
        <div className="bg-purple-900 rounded-lg p-4">
          <div className="text-purple-300 text-sm">Needs Return</div>
          <div className="text-3xl font-bold">{stats.needs_return}</div>
        </div>
        <div className="bg-green-900 rounded-lg p-4">
          <div className="text-green-300 text-sm">Completed</div>
          <div className="text-3xl font-bold">{stats.completed}</div>
        </div>
      </div>

      {/* CBRE Status Row - Show if there are items needing attention */}
      {(stats.escalation > 0 || stats.quote_rejected > 0 || stats.pending_quote > 0 || stats.quote_submitted > 0 || stats.quote_approved > 0) && (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-4">
          <div className="text-gray-300 text-sm font-semibold mb-3 flex items-center gap-2">
            <span>📧</span> CBRE STATUS (from Gmail)
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {/* Escalation */}
            {stats.escalation > 0 && (
              <button
                onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('escalation')}
                className="bg-red-800 hover:bg-red-700 rounded-lg p-3 text-left transition cursor-pointer animate-pulse"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🚨</span>
                  <div>
                    <div className="text-red-200 text-xs">Escalation</div>
                    <div className="text-3xl font-bold text-red-100">{stats.escalation}</div>
                  </div>
                </div>
              </button>
            )}

            {/* Quote Rejected */}
            {stats.quote_rejected > 0 && (
              <button
                onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('quote_rejected')}
                className="bg-red-900 hover:bg-red-800 rounded-lg p-3 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">❌</span>
                  <div>
                    <div className="text-red-200 text-xs">Quote Rejected</div>
                    <div className="text-3xl font-bold text-red-100">{stats.quote_rejected}</div>
                  </div>
                </div>
              </button>
            )}

            {/* Pending Quote */}
            {stats.pending_quote > 0 && (
              <button
                onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('pending_quote')}
                className="bg-orange-800 hover:bg-orange-700 rounded-lg p-3 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📋</span>
                  <div>
                    <div className="text-orange-200 text-xs">Pending Quote</div>
                    <div className="text-3xl font-bold text-orange-100">{stats.pending_quote}</div>
                  </div>
                </div>
              </button>
            )}

            {/* Quote Submitted */}
            {stats.quote_submitted > 0 && (
              <button
                onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('quote_submitted')}
                className="bg-blue-800 hover:bg-blue-700 rounded-lg p-3 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📤</span>
                  <div>
                    <div className="text-blue-200 text-xs">Quote Submitted</div>
                    <div className="text-3xl font-bold text-blue-100">{stats.quote_submitted}</div>
                  </div>
                </div>
              </button>
            )}

            {/* Quote Approved */}
            {stats.quote_approved > 0 && (
              <button
                onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('quote_approved')}
                className="bg-green-800 hover:bg-green-700 rounded-lg p-3 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✅</span>
                  <div>
                    <div className="text-green-200 text-xs">Quote Approved</div>
                    <div className="text-3xl font-bold text-green-100">{stats.quote_approved}</div>
                  </div>
                </div>
              </button>
            )}

            {/* Reassigned */}
            {stats.reassigned > 0 && (
              <button
                onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('reassigned')}
                className="bg-purple-800 hover:bg-purple-700 rounded-lg p-3 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔄</span>
                  <div>
                    <div className="text-purple-200 text-xs">Reassigned</div>
                    <div className="text-3xl font-bold text-purple-100">{stats.reassigned}</div>
                  </div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
