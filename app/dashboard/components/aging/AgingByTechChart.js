// app/dashboard/components/aging/AgingByTechChart.js
'use client';

export default function AgingByTechChart({ stats, onTechClick, selectedTech }) {
  // Sort techs by total aging work orders (descending)
  const sortedTechs = Object.entries(stats.byTech)
    .sort((a, b) => b[1].total - a[1].total);

  // Find max for bar scaling
  const maxTotal = Math.max(...sortedTechs.map(([_, data]) => data.total), 1);

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-700">
        <h3 className="font-semibold flex items-center gap-2">
          👥 Aging by Technician
        </h3>
        <p className="text-xs text-gray-500 mt-1">
          Click to filter by tech
        </p>
      </div>

      <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
        {sortedTechs.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            No aging work orders
          </div>
        ) : (
          sortedTechs.map(([techId, data]) => {
            const isSelected = selectedTech === techId;
            const barWidth = (data.total / maxTotal) * 100;

            return (
              <button
                key={techId}
                onClick={() => onTechClick(isSelected ? 'all' : techId)}
                className={`
                  w-full text-left p-3 rounded-lg transition
                  ${isSelected ? 'bg-blue-900/50 ring-2 ring-blue-400' : 'bg-gray-700/50 hover:bg-gray-700'}
                `}
              >
                {/* Tech Name & Total */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-semibold ${techId === 'unassigned' ? 'text-gray-400 italic' : 'text-white'}`}>
                    {data.name}
                  </span>
                  <span className="text-lg font-bold text-white">
                    {data.total}
                  </span>
                </div>

                {/* Stacked Bar */}
                <div className="h-4 bg-gray-600 rounded-full overflow-hidden flex">
                  {/* Critical */}
                  {data.critical > 0 && (
                    <div 
                      className="bg-red-500 h-full"
                      style={{ width: `${(data.critical / data.total) * barWidth}%` }}
                      title={`Critical: ${data.critical}`}
                    />
                  )}
                  {/* Warning */}
                  {data.warning > 0 && (
                    <div 
                      className="bg-orange-500 h-full"
                      style={{ width: `${(data.warning / data.total) * barWidth}%` }}
                      title={`Warning: ${data.warning}`}
                    />
                  )}
                  {/* Stale */}
                  {data.stale > 0 && (
                    <div 
                      className="bg-yellow-500 h-full"
                      style={{ width: `${(data.stale / data.total) * barWidth}%` }}
                      title={`Stale: ${data.stale}`}
                    />
                  )}
                </div>

                {/* Breakdown */}
                <div className="flex gap-3 mt-2 text-xs">
                  {data.critical > 0 && (
                    <span className="text-red-400">🔴 {data.critical}</span>
                  )}
                  {data.warning > 0 && (
                    <span className="text-orange-400">🟠 {data.warning}</span>
                  )}
                  {data.stale > 0 && (
                    <span className="text-yellow-400">🟡 {data.stale}</span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-gray-700 bg-gray-900/50">
        <div className="text-xs text-gray-500 mb-2">Legend:</div>
        <div className="flex gap-4 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-red-500 rounded"></span>
            Critical (5+ days)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-orange-500 rounded"></span>
            Warning (3-4 days)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-yellow-500 rounded"></span>
            Stale (2-3 days)
          </span>
        </div>
      </div>
    </div>
  );
}
