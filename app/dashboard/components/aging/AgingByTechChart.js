// app/dashboard/components/aging/AgingByTechChart.js
'use client';

export default function AgingByTechChart({ stats, onTechClick, selectedTech, onSendToTech }) {
  const sortedTechs = Object.entries(stats.byTech)
    .sort((a, b) => b[1].total - a[1].total);

  const maxTotal = Math.max(...sortedTechs.map(([_, data]) => data.total), 1);

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="p-2 md:p-4 border-b border-gray-700">
        <h3 className="font-semibold text-sm md:text-base flex items-center gap-2">
          👥 By Technician
        </h3>
        <p className="text-[10px] md:text-xs text-gray-500 mt-0.5">
          Tap to filter
        </p>
      </div>

      <div className="p-2 md:p-4 space-y-2 md:space-y-3 max-h-[300px] md:max-h-[500px] overflow-y-auto">
        {sortedTechs.length === 0 ? (
          <div className="text-center text-gray-500 py-4 text-sm">
            No aging work orders
          </div>
        ) : (
          sortedTechs.map(([techId, data]) => {
            const isSelected = selectedTech === techId;
            const barWidth = (data.total / maxTotal) * 100;
            const isUnassigned = techId === 'unassigned';

            return (
              <div
                key={techId}
                onClick={() => onTechClick(isSelected ? 'all' : techId)}
                className={`
                  p-2 md:p-3 rounded-lg transition cursor-pointer
                  ${isSelected ? 'bg-blue-900/50 ring-2 ring-blue-400' : 'bg-gray-700/50 active:bg-gray-700 md:hover:bg-gray-700'}
                `}
              >
                {/* Tech Name & Total */}
                <div className="flex items-center justify-between mb-1.5 md:mb-2">
                  <span className={`font-semibold text-xs md:text-sm truncate max-w-[120px] ${isUnassigned ? 'text-gray-400 italic' : 'text-white'}`}>
                    {data.name}
                  </span>
                  <div className="flex items-center gap-1.5 md:gap-2">
                    <span className="text-base md:text-lg font-bold text-white">
                      {data.total}
                    </span>
                    {!isUnassigned && onSendToTech && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSendToTech(techId);
                        }}
                        className="p-1 md:p-1.5 bg-red-600 active:bg-red-500 md:hover:bg-red-500 rounded text-[10px] md:text-xs transition"
                        title={`Send alert`}
                      >
                        📧
                      </button>
                    )}
                  </div>
                </div>

                {/* Stacked Bar */}
                <div className="h-3 md:h-4 bg-gray-600 rounded-full overflow-hidden flex">
                  {data.critical > 0 && (
                    <div 
                      className="bg-red-500 h-full"
                      style={{ width: `${(data.critical / data.total) * barWidth}%` }}
                    />
                  )}
                  {data.warning > 0 && (
                    <div 
                      className="bg-orange-500 h-full"
                      style={{ width: `${(data.warning / data.total) * barWidth}%` }}
                    />
                  )}
                  {data.stale > 0 && (
                    <div 
                      className="bg-yellow-500 h-full"
                      style={{ width: `${(data.stale / data.total) * barWidth}%` }}
                    />
                  )}
                </div>

                {/* Breakdown */}
                <div className="flex gap-2 md:gap-3 mt-1.5 text-[10px] md:text-xs">
                  {data.critical > 0 && <span className="text-red-400">🔴 {data.critical}</span>}
                  {data.warning > 0 && <span className="text-orange-400">🟠 {data.warning}</span>}
                  {data.stale > 0 && <span className="text-yellow-400">🟡 {data.stale}</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Legend - Hidden on mobile */}
      <div className="hidden md:block p-3 border-t border-gray-700 bg-gray-900/50">
        <div className="flex gap-4 text-xs flex-wrap">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-red-500 rounded"></span>
            Critical (5+d)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-orange-500 rounded"></span>
            Warning (3-4d)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 bg-yellow-500 rounded"></span>
            Stale (2-3d)
          </span>
        </div>
      </div>
    </div>
  );
}
