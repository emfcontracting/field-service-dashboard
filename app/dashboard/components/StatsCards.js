// app/dashboard/components/StatsCards.js
'use client';

export default function StatsCards({ stats, onFilterByBillingStatus }) {
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

      {/* Billing Status Row - Only show if there are items needing attention */}
      {(stats.pending_cbre_quote > 0 || stats.quoted > 0 || stats.quote_approved > 0) && (
        <div className="bg-orange-900/50 border border-orange-600 rounded-lg p-4">
          <div className="text-orange-300 text-sm font-semibold mb-3 flex items-center gap-2">
            <span>💰</span> BILLING STATUS (Separate from Work Status)
          </div>
          <div className="grid grid-cols-3 gap-4">
            {/* Pending CBRE Quote */}
            <button
              onClick={() => onFilterByBillingStatus && onFilterByBillingStatus('pending_cbre_quote')}
              className="bg-orange-800 hover:bg-orange-700 rounded-lg p-3 text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">📋</span>
                <div>
                  <div className="text-orange-200 text-xs">Pending CBRE Quote</div>
                  <div className="text-3xl font-bold text-orange-100">{stats.pending_cbre_quote}</div>
                </div>
              </div>
            </button>

            {/* Quoted - Awaiting Approval */}
            <button
              onClick={() => onFilterByBillingStatus && onFilterByBillingStatus('quoted')}
              className="bg-blue-800 hover:bg-blue-700 rounded-lg p-3 text-left transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">📤</span>
                <div>
                  <div className="text-blue-200 text-xs">Quote Submitted</div>
                  <div className="text-3xl font-bold text-blue-100">{stats.quoted}</div>
                </div>
              </div>
            </button>

            {/* Quote Approved */}
            <button
              onClick={() => onFilterByBillingStatus && onFilterByBillingStatus('quote_approved')}
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
          </div>
        </div>
      )}
    </div>
  );
}
