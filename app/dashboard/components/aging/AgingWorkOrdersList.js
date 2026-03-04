'use client';

import { useState } from 'react';

const SEV = {
  critical: { pill:'bg-red-500/20 text-red-400 border-red-500/30',    row:'bg-red-500/5'     },
  warning:  { pill:'bg-orange-500/20 text-orange-400 border-orange-500/30', row:'bg-orange-500/5' },
  stale:    { pill:'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', row:''               },
};
const PRI = {
  emergency: 'text-red-400',
  high:      'text-orange-400',
  medium:    'text-yellow-400',
  low:       'text-emerald-400',
};

export default function AgingWorkOrdersList({ workOrders, onSelectWorkOrder, leadTechs }) {
  const [expanded, setExpanded] = useState(null);

  if (!workOrders.length) return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-10 text-center">
      <div className="text-3xl mb-2">🎉</div>
      <p className="font-bold text-emerald-400">All Clear!</p>
      <p className="text-slate-600 text-sm mt-1">No aging work orders</p>
    </div>
  );

  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#1e1e2e] flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <h3 className="font-semibold text-slate-200 text-sm">Aging Work Orders</h3>
        <span className="text-slate-600 text-xs ml-1">({workOrders.length})</span>
      </div>

      <div className="divide-y divide-[#1e1e2e] max-h-[600px] overflow-y-auto">
        {workOrders.map(wo => {
          const sev = SEV[wo.aging.severity] || SEV.stale;
          const pri = PRI[wo.priority] || PRI.medium;
          const isOpen = expanded === wo.wo_id;

          return (
            <div key={wo.wo_id} className={`px-5 py-4 cursor-pointer transition hover:bg-[#1e1e2e]/50 ${sev.row}`}
              onClick={() => setExpanded(isOpen ? null : wo.wo_id)}>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${sev.pill}`}>
                      {wo.aging.severity}
                    </span>
                    <span className="font-bold text-slate-200 text-sm">{wo.wo_number}</span>
                    <span className={`text-[10px] font-semibold ${pri} hidden sm:inline`}>{wo.priority}</span>
                  </div>
                  <p className="text-slate-400 text-xs mt-1 truncate">{wo.building}</p>
                  {wo.lead_tech && (
                    <p className="text-blue-400 text-[10px] mt-0.5">{wo.lead_tech.first_name} {wo.lead_tech.last_name.charAt(0)}.</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={`text-2xl font-black font-mono ${
                    wo.aging.severity==='critical'?'text-red-400':wo.aging.severity==='warning'?'text-orange-400':'text-yellow-400'
                  }`}>{wo.aging.days}d</p>
                </div>
              </div>

              {isOpen && (
                <div className="mt-3 pt-3 border-t border-[#2d2d44] space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-600">Assigned:</span>
                      <span className="text-slate-300 ml-2">{wo.aging.assignedDate.toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-600">NTE:</span>
                      <span className="text-emerald-400 font-semibold ml-2">${(wo.nte||0).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-slate-500 text-xs line-clamp-2">{wo.work_order_description}</p>
                  <button onClick={e => { e.stopPropagation(); onSelectWorkOrder(wo); }}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition">
                    View Details →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
