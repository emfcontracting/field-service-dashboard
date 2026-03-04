'use client';

import { useState } from 'react';

const STATUS_STYLE = {
  pending:     'border-l-slate-500  bg-slate-500/10',
  assigned:    'border-l-blue-500   bg-blue-500/10',
  in_progress: 'border-l-yellow-500 bg-yellow-500/10',
  needs_return:'border-l-purple-500 bg-purple-500/10',
  completed:   'border-l-emerald-500 bg-emerald-500/10',
};

const PRI_ICON = { emergency:'🔴', high:'🟠', medium:'🟡', low:'🟢' };

export default function CalendarWorkOrderCard({
  workOrder, onDragStart, onDragEnd, onClick, onUnschedule, compact = false, leadTechs
}) {
  const [showActions, setShowActions] = useState(false);

  const statusStyle = STATUS_STYLE[workOrder.status] || STATUS_STYLE.pending;
  const priIcon     = PRI_ICON[workOrder.priority] || '⚪';
  const techName    = (() => {
    if (!workOrder.lead_tech_id) return null;
    const t = leadTechs?.find(x => x.user_id === workOrder.lead_tech_id);
    if (t) return `${t.first_name} ${t.last_name.charAt(0)}.`;
    if (workOrder.lead_tech) return `${workOrder.lead_tech.first_name} ${workOrder.lead_tech.last_name.charAt(0)}.`;
    return null;
  })();

  if (compact) return (
    <div draggable
      onDragStart={e => onDragStart(e, workOrder)} onDragEnd={onDragEnd}
      onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}
      onTouchStart={() => setShowActions(true)}
      onClick={e => { e.stopPropagation(); onClick(workOrder); }}
      className={`relative cursor-grab active:cursor-grabbing text-[9px] md:text-xs p-1 md:p-1.5 rounded border-l-2 md:border-l-4 transition hover:ring-1 hover:ring-blue-400 ${statusStyle}`}>
      <div className="flex items-start gap-0.5 md:gap-1">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-0.5">
            <span className="text-[8px] md:text-[10px]">{priIcon}</span>
            <span className="font-semibold text-slate-200 truncate text-[9px] md:text-xs">{workOrder.wo_number}</span>
          </div>
          <div className="text-slate-500 truncate text-[8px] md:text-[10px] hidden sm:block">{workOrder.building}</div>
        </div>
      </div>
      {showActions && onUnschedule && (
        <button onClick={e => { e.stopPropagation(); onUnschedule(workOrder); }}
          className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-600 hover:bg-red-500 rounded text-white text-[8px] flex items-center justify-center transition">
          ×
        </button>
      )}
    </div>
  );

  return (
    <div draggable
      onDragStart={e => onDragStart(e, workOrder)} onDragEnd={onDragEnd}
      onMouseEnter={() => setShowActions(true)} onMouseLeave={() => setShowActions(false)}
      onTouchStart={() => setShowActions(true)}
      onClick={e => { e.stopPropagation(); onClick(workOrder); }}
      className={`relative cursor-grab active:cursor-grabbing p-2 rounded-lg border-l-4 transition hover:ring-1 hover:ring-blue-400 ${statusStyle}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1">
            <span className="text-xs">{priIcon}</span>
            <span className="font-bold text-slate-200 text-sm">{workOrder.wo_number}</span>
          </div>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border
            ${workOrder.status==='pending'     ? 'bg-slate-500/20 text-slate-400 border-slate-500/30':''}
            ${workOrder.status==='assigned'    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30':''}
            ${workOrder.status==='in_progress' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30':''}
            ${workOrder.status==='needs_return'? 'bg-purple-500/20 text-purple-400 border-purple-500/30':''}
            ${workOrder.status==='completed'   ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30':''}`}>
            {workOrder.status.replace('_',' ').slice(0,8)}
          </span>
        </div>
        <p className="text-slate-400 text-xs truncate">{workOrder.building}</p>
        <p className="text-slate-600 text-[10px] mt-1 line-clamp-2 hidden md:block">{workOrder.work_order_description}</p>
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#2d2d44]">
          {techName
            ? <span className="text-blue-400 text-[10px] truncate">{techName}</span>
            : <span className="text-slate-700 text-[10px]">—</span>}
          {workOrder.nte > 0 && <span className="text-emerald-400 text-[10px] font-semibold">${workOrder.nte.toLocaleString()}</span>}
        </div>
      </div>
      {showActions && onUnschedule && (
        <button onClick={e => { e.stopPropagation(); onUnschedule(workOrder); }}
          className="absolute top-1 right-1 w-5 h-5 bg-red-600 hover:bg-red-500 rounded text-white text-xs flex items-center justify-center transition">
          ×
        </button>
      )}
    </div>
  );
}
