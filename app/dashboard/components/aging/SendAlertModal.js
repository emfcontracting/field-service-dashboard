'use client';

import { useState, useMemo } from 'react';

export default function SendAlertModal({ stats, agingWorkOrders, leadTechs, users, preselectedTechId, onClose, onAlertSent }) {
  const [selectedTechs, setSelectedTechs] = useState(preselectedTechId ? [preselectedTechId] : []);
  const [sendToAll,     setSendToAll]     = useState(!preselectedTechId);
  const [sending,       setSending]       = useState(false);
  const [results,       setResults]       = useState(null);

  const techsWithAging = useMemo(() =>
    Object.entries(stats.byTech)
      .filter(([id, d]) => id !== 'unassigned' && d.total > 0)
      .map(([id, d]) => ({ techId:id, ...d, email: users.find(u=>u.user_id===id)?.email||'No email' }))
      .sort((a,b) => b.total - a.total),
    [stats.byTech, users]
  );

  const toggle = id => {
    if (sendToAll) { setSendToAll(false); setSelectedTechs([id]); }
    else setSelectedTechs(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);
  };

  const selCount = sendToAll ? techsWithAging.length : selectedTechs.length;

  const handleSend = async () => {
    if (!selCount) { alert('Select at least one technician'); return; }
    const names = sendToAll ? 'ALL technicians' : techsWithAging.filter(t=>selectedTechs.includes(t.techId)).map(t=>t.name).join(', ');
    if (!confirm(`Send aging alerts to ${names}?`)) return;
    setSending(true); setResults(null);
    try {
      const wos = sendToAll ? agingWorkOrders : agingWorkOrders.filter(wo=>selectedTechs.includes(wo.lead_tech_id));
      const res = await fetch('/api/aging/send-alerts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({workOrders:wos,targetTechIds:sendToAll?null:selectedTechs})});
      const data = await res.json();
      setResults(data);
      if (data.success) onAlertSent();
    } catch(e) { setResults({success:false,error:e.message}); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">

        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1e1e2e] flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-200">Send Aging Alert Emails</h2>
            <p className="text-slate-500 text-xs mt-0.5">Select which technicians should receive alerts</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-2xl leading-none transition">×</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {/* Results */}
          {results && (
            <div className={`p-4 rounded-xl border ${results.success ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-red-500/10 border-red-500/25'}`}>
              {results.success ? (
                <>
                  <p className="text-emerald-400 font-bold text-sm mb-2">✓ Sent {results.emailsSent} alert email(s)</p>
                  {results.results?.map((r,i) => (
                    <p key={i} className={`text-xs ${r.status==='sent'?'text-emerald-300':'text-red-400'}`}>
                      {r.status==='sent'?'✓':'✗'} {r.tech} ({r.email}){r.error&&` — ${r.error}`}
                    </p>
                  ))}
                </>
              ) : <p className="text-red-400 text-sm">Failed: {results.error}</p>}
            </div>
          )}

          {/* Send to all */}
          <button onClick={() => { setSendToAll(true); setSelectedTechs([]); }}
            className={`w-full p-4 rounded-xl border-2 transition text-left ${sendToAll ? 'border-blue-500/50 bg-blue-500/10' : 'border-[#2d2d44] hover:border-[#3d3d5e]'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${sendToAll ? 'bg-blue-500 border-blue-500' : 'border-[#2d2d44]'}`}>
                {sendToAll && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
              </div>
              <div>
                <p className="font-semibold text-slate-200 text-sm">Send to All Technicians</p>
                <p className="text-slate-500 text-xs">{techsWithAging.length} techs with {agingWorkOrders.length} aging work orders</p>
              </div>
            </div>
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-[#2d2d44]"/>
            <span className="text-slate-600 text-xs">OR select individual</span>
            <div className="flex-1 border-t border-[#2d2d44]"/>
          </div>

          {/* Individual techs */}
          <div className="space-y-2">
            {techsWithAging.length === 0 ? (
              <p className="text-center text-slate-600 text-sm py-4">No technicians with aging work orders</p>
            ) : techsWithAging.map(tech => {
              const isSel = !sendToAll && selectedTechs.includes(tech.techId);
              return (
                <button key={tech.techId} onClick={() => toggle(tech.techId)}
                  className={`w-full p-4 rounded-xl border-2 transition text-left ${isSel ? 'border-blue-500/50 bg-blue-500/10' : sendToAll ? 'border-[#1e1e2e] opacity-50' : 'border-[#2d2d44] hover:border-[#3d3d5e]'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSel ? 'bg-blue-500 border-blue-500' : 'border-[#2d2d44]'}`}>
                        {isSel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-200 text-sm">{tech.name}</p>
                        <p className="text-slate-500 text-xs">{tech.email}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {tech.critical > 0 && <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{tech.critical} crit</span>}
                      {tech.warning  > 0 && <span className="bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{tech.warning} warn</span>}
                      {tech.stale    > 0 && <span className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[10px] px-2 py-0.5 rounded-full font-bold">{tech.stale} stale</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#1e1e2e] flex items-center justify-between">
          <p className="text-slate-500 text-sm">
            {sendToAll ? <><span className="text-slate-200 font-semibold">{techsWithAging.length}</span> technicians</> :
             selectedTechs.length > 0 ? <><span className="text-slate-200 font-semibold">{selectedTechs.length}</span> selected</> :
             'Select technicians'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:text-slate-100 px-4 py-2 rounded-lg text-sm font-semibold transition">
              {results?.success ? 'Close' : 'Cancel'}
            </button>
            {!results?.success && (
              <button onClick={handleSend} disabled={sending || !selCount}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-semibold transition">
                {sending ? 'Sending...' : 'Send Alerts'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
