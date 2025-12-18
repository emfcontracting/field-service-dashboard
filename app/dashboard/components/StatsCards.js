// app/dashboard/components/StatsCards.js
'use client';

export default function StatsCards({ stats, onFilterByCbreStatus, onMissingHoursClick, missingHoursCount = 0 }) {
  return (
    <div className="space-y-4 mb-4 md:mb-6">
      {/* Work Status Row - 2 columns on mobile, 4 on tablet, 8 on desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 md:gap-4">
        <div className="bg-gray-800 rounded-lg p-3 md:p-4">
          <div className="text-gray-400 text-xs md:text-sm">Total</div>
          <div className="text-2xl md:text-3xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-3 md:p-4">
          <div className="text-gray-400 text-xs md:text-sm">Pending</div>
          <div className="text-2xl md:text-3xl font-bold">{stats.pending}</div>
        </div>
        <div className="bg-blue-900 rounded-lg p-3 md:p-4">
          <div className="text-blue-300 text-xs md:text-sm">Assigned</div>
          <div className="text-2xl md:text-3xl font-bold">{stats.assigned}</div>
        </div>
        <div className="bg-yellow-900 rounded-lg p-3 md:p-4">
          <div className="text-yellow-300 text-xs md:text-sm">In Progress</div>
          <div className="text-2xl md:text-3xl font-bold">{stats.in_progress}</div>
        </div>
        <div className="bg-purple-900 rounded-lg p-3 md:p-4">
          <div className="text-purple-300 text-xs md:text-sm">Tech Review</div>
          <div className="text-2xl md:text-3xl font-bold">{stats.tech_review}</div>
        </div>
        <div className="bg-orange-900 rounded-lg p-3 md:p-4">
          <div className="text-orange-300 text-xs md:text-sm">Return Trip</div>
          <div className="text-2xl md:text-3xl font-bold">{stats.return_trip}</div>
        </div>
        <div className="bg-green-900 rounded-lg p-3 md:p-4">
          <div className="text-green-300 text-xs md:text-sm">Completed</div>
          <div className="text-2xl md:text-3xl font-bold">{stats.completed}</div>
        </div>
        
        {/* Missing Hours Card - Clickable */}
        <button
          onClick={onMissingHoursClick}
          className={`rounded-lg p-3 md:p-4 text-left transition cursor-pointer ${
            missingHoursCount > 0 
              ? 'bg-red-800 hover:bg-red-700 active:bg-red-700' 
              : 'bg-gray-700 hover:bg-gray-600 active:bg-gray-600'
          }`}
        >
          <div className={`text-xs md:text-sm ${missingHoursCount > 0 ? 'text-red-200' : 'text-gray-400'}`}>
            ⚠️ Missing Hours
          </div>
          <div className={`text-2xl md:text-3xl font-bold ${missingHoursCount > 0 ? 'text-red-100' : 'text-white'}`}>
            {missingHoursCount}
          </div>
        </button>
      </div>

      {/* CBRE Status Row - Show if there are items needing attention */}
      {(stats.escalation > 0 || stats.quote_rejected > 0 || stats.pending_quote > 0 || stats.quote_submitted > 0 || stats.quote_approved > 0 || stats.reassigned > 0) && (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 md:p-4">
          <div className="text-gray-300 text-xs md:text-sm font-semibold mb-2 md:mb-3 flex items-center gap-2">
            <span>📧</span> CBRE STATUS (from Gmail)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
            {/* Escalation */}
            {stats.escalation > 0 && (
              <button
                onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('escalation')}
                className="bg-red-800 hover:bg-red-700 active:bg-red-700 rounded-lg p-2 md:p-3 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl md:text-2xl">🚨</span>
                  <div>
                    <div className="text-red-200 text-[10px] md:text-xs">Escalation</div>
                    <div className="text-2xl md:text-3xl font-bold text-red-100">{stats.escalation}</div>
                  </div>
                </div>
              </button>
            )}

            {/* Quote Rejected */}
            {stats.quote_rejected > 0 && (
              <button
                onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('quote_rejected')}
                className="bg-red-900 hover:bg-red-800 active:bg-red-800 rounded-lg p-2 md:p-3 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl md:text-2xl">❌</span>
                  <div>
                    <div className="text-red-200 text-[10px] md:text-xs">Quote Rejected</div>
                    <div className="text-2xl md:text-3xl font-bold text-red-100">{stats.quote_rejected}</div>
                  </div>
                </div>
              </button>
            )}

            {/* Pending Quote */}
            {stats.pending_quote > 0 && (
              <button
                onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('pending_quote')}
                className="bg-orange-800 hover:bg-orange-700 active:bg-orange-700 rounded-lg p-2 md:p-3 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl md:text-2xl">📋</span>
                  <div>
                    <div className="text-orange-200 text-[10px] md:text-xs">Pending Quote</div>
                    <div className="text-2xl md:text-3xl font-bold text-orange-100">{stats.pending_quote}</div>
                  </div>
                </div>
              </button>
            )}

            {/* Quote Submitted */}
            {stats.quote_submitted > 0 && (
              <button
                onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('quote_submitted')}
                className="bg-blue-800 hover:bg-blue-700 active:bg-blue-700 rounded-lg p-2 md:p-3 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl md:text-2xl">📤</span>
                  <div>
                    <div className="text-blue-200 text-[10px] md:text-xs">Quote Submitted</div>
                    <div className="text-2xl md:text-3xl font-bold text-blue-100">{stats.quote_submitted}</div>
                  </div>
                </div>
              </button>
            )}

            {/* Quote Approved */}
            {stats.quote_approved > 0 && (
              <button
                onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('quote_approved')}
                className="bg-green-800 hover:bg-green-700 active:bg-green-700 rounded-lg p-2 md:p-3 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl md:text-2xl">✅</span>
                  <div>
                    <div className="text-green-200 text-[10px] md:text-xs">Quote Approved</div>
                    <div className="text-2xl md:text-3xl font-bold text-green-100">{stats.quote_approved}</div>
                  </div>
                </div>
              </button>
            )}

            {/* Reassigned */}
            {stats.reassigned > 0 && (
              <button
                onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('reassigned')}
                className="bg-purple-800 hover:bg-purple-700 active:bg-purple-700 rounded-lg p-2 md:p-3 text-left transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl md:text-2xl">🔄</span>
                  <div>
                    <div className="text-purple-200 text-[10px] md:text-xs">Reassigned</div>
                    <div className="text-2xl md:text-3xl font-bold text-purple-100">{stats.reassigned}</div>
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
