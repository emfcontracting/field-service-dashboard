'use client';

export default function AgingByTechChart({ stats, onTechClick, selectedTech, onSendToTech }) {
  const sorted = Object.entries(stats.byTech).sort((a,b) => b[1].total - a[1].total);
  const max = Math.max(...sorted.map(([,d]) => d.total), 1);

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1e1e2e]">
        <h3 className="font-semibold text-slate-200 text-sm">By Technician</h3>
        <p className="text-slate-600 text-[10px] mt-0.5">Click to filter</p>
      </div>

      <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="text-center text-slate-600 py-4 text-sm">No aging work orders</p>
        ) : sorted.map(([techId, data]) => {
          const isSel = selectedTech === techId;
          const isUnassigned = techId === 'unassigned';
          return (
            <div key={techId} onClick={() => onTechClick(isSel ? 'all' : techId)}
              className={`p-3 rounded-xl transition cursor-pointer ${isSel ? 'bg-blue-500/15 border border-blue-500/30' : 'bg-[#0a0a0f] border border-[#1e1e2e] hover:border-[#2d2d44]'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`font-semibold text-sm truncate max-w-[140px] ${isUnassigned ? 'text-slate-600 italic' : 'text-slate-200'}`}>
                  {data.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-black font-mono text-slate-200">{data.total}</span>
                  {!isUnassigned && onSendToTech && (
                    <button onClick={e => { e.stopPropagation(); onSendToTech(techId); }}
                      className="p-1 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded text-[10px] text-red-400 transition">
                      ✉
                    </button>
                  )}
                </div>
              </div>

              {/* Stacked bar */}
              <div className="h-2 bg-[#1e1e2e] rounded-full overflow-hidden flex">
                {data.critical > 0 && <div className="bg-red-500 h-full" style={{width:`${(data.critical/data.total)*(data.total/max)*100}%`}}/>}
                {data.warning  > 0 && <div className="bg-orange-500 h-full" style={{width:`${(data.warning/data.total)*(data.total/max)*100}%`}}/>}
                {data.stale    > 0 && <div className="bg-yellow-500 h-full" style={{width:`${(data.stale/data.total)*(data.total/max)*100}%`}}/>}
              </div>

              <div className="flex gap-3 mt-1.5 text-[10px]">
                {data.critical > 0 && <span className="text-red-400">{data.critical} crit</span>}
                {data.warning  > 0 && <span className="text-orange-400">{data.warning} warn</span>}
                {data.stale    > 0 && <span className="text-yellow-400">{data.stale} stale</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-[#1e1e2e] hidden md:flex gap-4 text-[10px] text-slate-600">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"/>Critical (5+d)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-500"/>Warning (3-4d)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500"/>Stale (2-3d)</span>
      </div>
    </div>
  );
}
