// app/dashboard/components/StatsCards.js
'use client';

export default function StatsCards({ stats, onFilterByCbreStatus, onMissingHoursClick, missingHoursCount = 0 }) {
  return (
    <div className="space-y-3 mb-5">

      {/* Work Status Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">

        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-3 border-t-2 border-t-slate-600">
          <div className="text-slate-500 text-xs mb-1 font-medium">Total</div>
          <div className="text-2xl font-bold text-slate-200">{stats.total}</div>
        </div>

        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-3 border-t-2 border-t-slate-500">
          <div className="text-slate-500 text-xs mb-1 font-medium">Pending</div>
          <div className="text-2xl font-bold text-slate-300">{stats.pending}</div>
        </div>

        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-3 border-t-2 border-t-blue-500">
          <div className="text-blue-400 text-xs mb-1 font-medium">Assigned</div>
          <div className="text-2xl font-bold text-slate-200">{stats.assigned}</div>
        </div>

        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-3 border-t-2 border-t-yellow-500">
          <div className="text-yellow-400 text-xs mb-1 font-medium">In Progress</div>
          <div className="text-2xl font-bold text-slate-200">{stats.in_progress}</div>
        </div>

        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-3 border-t-2 border-t-purple-500">
          <div className="text-purple-400 text-xs mb-1 font-medium">Tech Review</div>
          <div className="text-2xl font-bold text-slate-200">{stats.tech_review}</div>
        </div>

        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-3 border-t-2 border-t-orange-500">
          <div className="text-orange-400 text-xs mb-1 font-medium">Return Trip</div>
          <div className="text-2xl font-bold text-slate-200">{stats.return_trip}</div>
        </div>

        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-3 border-t-2 border-t-emerald-500">
          <div className="text-emerald-400 text-xs mb-1 font-medium">Completed</div>
          <div className="text-2xl font-bold text-slate-200">{stats.completed}</div>
        </div>

        {/* Missing Hours - Clickable */}
        <button
          onClick={onMissingHoursClick}
          className={`rounded-lg p-3 text-left transition border border-[#1e1e2e] border-t-2 ${
            missingHoursCount > 0
              ? 'bg-red-950/60 border-t-red-500 hover:bg-red-950'
              : 'bg-[#0d0d14] border-t-slate-600 hover:bg-[#1e1e2e]'
          }`}
        >
          <div className={`text-xs mb-1 font-medium ${missingHoursCount > 0 ? 'text-red-400' : 'text-slate-500'}`}>
            ⚠ Missing Hrs
          </div>
          <div className={`text-2xl font-bold ${missingHoursCount > 0 ? 'text-red-300' : 'text-slate-200'}`}>
            {missingHoursCount}
          </div>
        </button>
      </div>

      {/* CBRE Status Row */}
      {(stats.escalation > 0 || stats.quote_rejected > 0 || stats.pending_quote > 0 || stats.quote_submitted > 0 || stats.quote_approved > 0 || stats.reassigned > 0) && (
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-3">
          <div className="text-slate-500 text-xs font-medium mb-2 tracking-wide">CBRE STATUS</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">

            {stats.escalation > 0 && (
              <button onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('escalation')}
                className="bg-red-950/40 hover:bg-red-950/70 border border-red-900/50 rounded-lg p-2.5 text-left transition">
                <div className="flex items-center gap-2">
                  <span>🚨</span>
                  <div>
                    <div className="text-red-400 text-xs">Escalation</div>
                    <div className="text-xl font-bold text-red-300">{stats.escalation}</div>
                  </div>
                </div>
              </button>
            )}

            {stats.quote_rejected > 0 && (
              <button onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('quote_rejected')}
                className="bg-red-950/40 hover:bg-red-950/70 border border-red-900/50 rounded-lg p-2.5 text-left transition">
                <div className="flex items-center gap-2">
                  <span>❌</span>
                  <div>
                    <div className="text-red-400 text-xs">Quote Rejected</div>
                    <div className="text-xl font-bold text-red-300">{stats.quote_rejected}</div>
                  </div>
                </div>
              </button>
            )}

            {stats.pending_quote > 0 && (
              <button onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('pending_quote')}
                className="bg-orange-950/40 hover:bg-orange-950/70 border border-orange-900/50 rounded-lg p-2.5 text-left transition">
                <div className="flex items-center gap-2">
                  <span>📋</span>
                  <div>
                    <div className="text-orange-400 text-xs">Pending Quote</div>
                    <div className="text-xl font-bold text-orange-300">{stats.pending_quote}</div>
                  </div>
                </div>
              </button>
            )}

            {stats.quote_submitted > 0 && (
              <button onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('quote_submitted')}
                className="bg-blue-950/40 hover:bg-blue-950/70 border border-blue-900/50 rounded-lg p-2.5 text-left transition">
                <div className="flex items-center gap-2">
                  <span>📤</span>
                  <div>
                    <div className="text-blue-400 text-xs">Quote Submitted</div>
                    <div className="text-xl font-bold text-blue-300">{stats.quote_submitted}</div>
                  </div>
                </div>
              </button>
            )}

            {stats.quote_approved > 0 && (
              <button onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('quote_approved')}
                className="bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-900/50 rounded-lg p-2.5 text-left transition">
                <div className="flex items-center gap-2">
                  <span>✅</span>
                  <div>
                    <div className="text-emerald-400 text-xs">Quote Approved</div>
                    <div className="text-xl font-bold text-emerald-300">{stats.quote_approved}</div>
                  </div>
                </div>
              </button>
            )}

            {stats.reassigned > 0 && (
              <button onClick={() => onFilterByCbreStatus && onFilterByCbreStatus('reassigned')}
                className="bg-purple-950/40 hover:bg-purple-950/70 border border-purple-900/50 rounded-lg p-2.5 text-left transition">
                <div className="flex items-center gap-2">
                  <span>🔄</span>
                  <div>
                    <div className="text-purple-400 text-xs">Reassigned</div>
                    <div className="text-xl font-bold text-purple-300">{stats.reassigned}</div>
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
