'use client';

export default function AgingStatsCards({ stats, onFilterClick }) {
  const cards = [
    { id:'critical', label:'Critical', sub:'5+ days',  val:stats.critical, bar:'border-red-500/50',    bg:'bg-red-500/10',    text:'text-red-400'    },
    { id:'warning',  label:'Warning',  sub:'3-4 days', val:stats.warning,  bar:'border-orange-500/50', bg:'bg-orange-500/10', text:'text-orange-400' },
    { id:'stale',    label:'Stale',    sub:'2-3 days', val:stats.stale,    bar:'border-yellow-500/50', bg:'bg-yellow-500/10', text:'text-yellow-400' },
    { id:'all',      label:'Total',    sub:'2+ days',  val:stats.total,    bar:'border-[#2d2d44]',     bg:'bg-[#0d0d14]',    text:'text-slate-200'  },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => (
          <button key={c.id} onClick={() => onFilterClick(c.id)}
            className={`${c.bg} border-l-4 ${c.bar} border border-[#1e1e2e] rounded-xl p-4 text-left transition hover:border-blue-500/40 group`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-2xl font-black font-mono ${c.text}`}>{c.val}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600 group-hover:text-slate-400 transition"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
            <p className="font-semibold text-slate-200 text-sm">{c.label}</p>
            <p className="text-slate-600 text-[10px] mt-0.5">{c.sub}</p>
          </button>
        ))}
      </div>

      {stats.oldest && (
        <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-red-400 text-xs font-bold uppercase tracking-wide mb-1">Oldest Open Work Order</p>
              <p className="text-slate-200 font-bold truncate">{stats.oldest.wo_number} — {stats.oldest.building}</p>
              <p className="text-slate-500 text-xs mt-1 line-clamp-2">{stats.oldest.work_order_description?.substring(0,100)}{stats.oldest.work_order_description?.length>100?'...':''}</p>
            </div>
            <div className="flex items-center md:flex-col md:items-end gap-3 md:gap-0 flex-shrink-0">
              <p className="text-4xl font-black font-mono text-red-400">{stats.oldest.aging.days}</p>
              <p className="text-slate-600 text-xs">days old</p>
              {stats.oldest.lead_tech && (
                <p className="text-blue-400 text-xs mt-1">{stats.oldest.lead_tech.first_name} {stats.oldest.lead_tech.last_name}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
