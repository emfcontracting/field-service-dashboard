'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/app/components/AppShell';

// ── Helpers ───────────────────────────────────────────────────────────────────
const usd = (n) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(n || 0);
const fmtDate = (s) => { if (!s) return '—'; const [y,m,d] = s.split('-'); return `${m}/${d}/${y}`; };
const approvalColor = (rate) => rate >= 80 ? 'text-emerald-400' : rate >= 60 ? 'text-yellow-400' : 'text-red-400';

// ── UI primitives ─────────────────────────────────────────────────────────────
const Card = ({ children, className = '' }) => (
  <div className={`bg-[#0d0d14] border border-[#1e1e2e] rounded-xl ${className}`}>{children}</div>
);
const CardHeader = ({ children, className = '' }) => (
  <div className={`px-5 py-4 border-b border-[#1e1e2e] ${className}`}>{children}</div>
);
const CardBody = ({ children, className = '' }) => (
  <div className={`px-5 py-4 ${className}`}>{children}</div>
);

const Btn = ({ children, onClick, disabled, variant = 'default', size = 'md', className = '' }) => {
  const v = {
    default: 'bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:text-slate-100 hover:bg-[#2d2d44]',
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    danger:  'bg-red-600 hover:bg-red-500 text-white',
  };
  const s = { sm:'px-3 py-1.5 text-xs', md:'px-4 py-2 text-sm' };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed ${v[variant]} ${s[size]} ${className}`}>
      {children}
    </button>
  );
};

const StatCard = ({ label, value, sub, color = 'text-slate-100', borderColor = '' }) => (
  <Card className={borderColor}>
    <CardBody>
      <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-slate-600 text-xs mt-1">{sub}</p>}
    </CardBody>
  </Card>
);

// ── Status badge ──────────────────────────────────────────────────────────────
const ApprovalBadge = ({ approved }) => approved ? (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-emerald-500/15 text-emerald-400 border-emerald-500/30 uppercase">
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
    Approved
  </span>
) : (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border bg-yellow-500/15 text-yellow-400 border-yellow-500/30 uppercase">
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
    Held
  </span>
);

const WOStatusBadge = ({ status }) => {
  const cfg = {
    Completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Invoiced:  'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    Closed:    'bg-slate-500/15 text-slate-400 border-slate-500/30',
    'In Progress': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg[status] || 'bg-slate-500/15 text-slate-500 border-slate-500/20'}`}>
      {status || '—'}
    </span>
  );
};

// ════════════════════════════════════════════════════════════════════════════
export default function ApprovalAnalysisPage() {
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [data, setData]               = useState(null);
  const [days, setDays]               = useState(30);
  const [selectedTech, setSelectedTech] = useState(null);
  const [showHeldOnly, setShowHeldOnly] = useState(false);

  useEffect(() => { fetchAnalysis(); }, [days]);

  async function fetchAnalysis() {
    setLoading(true); setError(null);
    try {
      const res    = await fetch(`/api/contractor/approval-analysis?days=${days}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Failed to fetch analysis');
      setData(result);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  const totals        = data?.overall_totals || {};
  const byTech        = data?.by_tech || [];
  const approvalRate  = parseFloat(totals.approval_rate) || 0;

  const filteredItems = (data?.detailed_items || []).filter(item => {
    if (selectedTech && item.tech_name !== selectedTech) return false;
    if (showHeldOnly && item.would_be_approved) return false;
    return true;
  });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell activeLink="/approval-analysis">
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <p className="text-slate-300 font-medium">Analyzing subcontractor invoices…</p>
            <p className="text-slate-600 text-sm">Cross-referencing with work order completion status</p>
          </div>
        </div>
      </AppShell>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <AppShell activeLink="/approval-analysis">
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-6">
          <Card className="border-red-500/30 max-w-md w-full">
            <CardBody className="text-center space-y-3">
              <p className="text-red-400 font-bold text-lg">Error Loading Analysis</p>
              <p className="text-slate-400 text-sm">{error}</p>
              <Btn onClick={fetchAnalysis} variant="danger" size="md">Retry</Btn>
            </CardBody>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeLink="/approval-analysis">
      <div className="min-h-screen bg-[#0a0a0f] text-slate-200">

        {/* ── Header ── */}
        <div className="border-b border-[#1e1e2e] bg-[#0d0d14] px-6 py-5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Invoice Approval Analysis</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Dry run — what would happen if completed tickets were required for payment?
                {data?.analysis_period && (
                  <span className="ml-2 text-slate-600">
                    {fmtDate(data.analysis_period.start_date)} – {fmtDate(data.analysis_period.end_date)}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select value={days} onChange={e => setDays(parseInt(e.target.value))}
                className="bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/60 transition">
                {[7,14,30,60,90].map(d => <option key={d} value={d}>Last {d} days</option>)}
              </select>
              <Btn onClick={fetchAnalysis} variant="default" size="md">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                Refresh
              </Btn>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Line Items"     value={totals.total_items || 0}         sub={usd(totals.total_amount)} />
            <StatCard label="Would Be Approved"    value={totals.approved_items || 0}      sub={usd(totals.approved_amount)}
              color="text-emerald-400" borderColor="border-emerald-500/20" />
            <StatCard label="Would Be Held"        value={totals.held_items || 0}           sub={usd(totals.held_amount)}
              color="text-yellow-400" borderColor="border-yellow-500/20" />
            <StatCard label="Approval Rate"
              value={<span className={approvalColor(approvalRate)}>{totals.approval_rate || 0}%</span>}
              sub={`${totals.held_rate || 0}% would be held`} />
          </div>

          {/* ── Cash flow impact ── */}
          {totals.held_amount > 0 && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 flex items-start gap-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                className="text-yellow-400 flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-slate-400 text-sm leading-relaxed">
                <span className="text-yellow-400 font-semibold">Cash Flow Impact: </span>
                If these rules were in place, <span className="text-yellow-400 font-bold">{usd(totals.held_amount)}</span> would
                have been held until tickets were properly completed — {totals.held_rate}% of total invoiced amounts.
              </p>
            </div>
          )}

          {/* ── By tech table ── */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-200">Breakdown by Technician</h2>
            </CardHeader>
            {byTech.length === 0 ? (
              <CardBody><p className="text-center py-8 text-slate-600">No invoice data for this period.</p></CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e2e]">
                      {['Technician','Items','Total','Approved','Held','Held $','Top Issues',''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] text-slate-600 uppercase tracking-widest font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e2e]">
                    {byTech.map((tech, idx) => {
                      const rate      = tech.total_items > 0 ? ((tech.approved_items / tech.total_items) * 100).toFixed(0) : 100;
                      const topReasons = Object.entries(tech.hold_reasons || {}).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([r,c])=>`${r} (${c})`);
                      const isSelected = selectedTech === tech.tech_name;
                      return (
                        <tr key={tech.user_id || idx}
                          className={`hover:bg-[#1e1e2e]/40 transition ${isSelected ? 'bg-blue-500/5' : ''}`}>
                          <td className="px-4 py-3 font-semibold text-slate-200">{tech.tech_name}</td>
                          <td className="px-4 py-3 text-slate-400 font-mono">{tech.total_items}</td>
                          <td className="px-4 py-3 text-slate-300 font-mono">{usd(tech.total_amount)}</td>
                          <td className="px-4 py-3">
                            <span className="text-emerald-400 font-mono">{tech.approved_items}</span>
                            <span className="text-slate-600 text-xs ml-1">({rate}%)</span>
                          </td>
                          <td className="px-4 py-3">
                            {tech.held_items > 0
                              ? <span className="text-yellow-400 font-bold font-mono">{tech.held_items}</span>
                              : <span className="text-slate-600 font-mono">0</span>
                            }
                          </td>
                          <td className="px-4 py-3">
                            {tech.held_amount > 0
                              ? <span className="text-yellow-400 font-mono">{usd(tech.held_amount)}</span>
                              : <span className="text-slate-600 font-mono">—</span>
                            }
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 max-w-[180px]">
                            {topReasons.length > 0 ? topReasons.join(', ') : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Btn onClick={() => setSelectedTech(isSelected ? null : tech.tech_name)}
                              variant={isSelected ? 'primary' : 'default'} size="sm">
                              {isSelected ? 'Clear' : 'Filter'}
                            </Btn>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ── Detailed items ── */}
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                Detailed Line Items
                {selectedTech && <span className="text-blue-400 font-normal text-xs">— {selectedTech}</span>}
                <span className="text-slate-600 font-normal text-xs">({filteredItems.length})</span>
              </h2>
              <div className="flex items-center gap-3">
                {/* Held-only toggle */}
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <div onClick={() => setShowHeldOnly(p => !p)}
                    className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer
                      ${showHeldOnly ? 'bg-yellow-600' : 'bg-[#2d2d44]'}`}>
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform
                      ${showHeldOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-xs text-slate-500">Held only</span>
                </label>
                {selectedTech && (
                  <Btn onClick={() => setSelectedTech(null)} variant="default" size="sm">Clear filter</Btn>
                )}
              </div>
            </CardHeader>

            {filteredItems.length === 0 ? (
              <CardBody><p className="text-center py-8 text-slate-600">
                {showHeldOnly ? 'No held items found.' : 'No items found for this selection.'}
              </p></CardBody>
            ) : (
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[#0d0d14] z-10">
                    <tr className="border-b border-[#1e1e2e]">
                      {['Status','Invoice','Tech','WO #','Building','Date','Type','Amount','WO Status','Photos','Issues'].map(h => (
                        <th key={h} className="px-3 py-3 text-left text-[10px] text-slate-600 uppercase tracking-widest font-semibold whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e1e2e]">
                    {filteredItems.map((item, idx) => (
                      <tr key={idx}
                        className={`transition hover:bg-[#1e1e2e]/40 ${!item.would_be_approved ? 'bg-yellow-500/3' : ''}`}>
                        <td className="px-3 py-2.5"><ApprovalBadge approved={item.would_be_approved} /></td>
                        <td className="px-3 py-2.5 font-mono text-slate-500">{item.invoice_number}</td>
                        <td className="px-3 py-2.5 text-slate-300 font-medium whitespace-nowrap">{item.tech_name}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-400">
                          {item.wo_number || '—'}
                          {item.is_pm && <span className="ml-1 text-purple-400">(PM)</span>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-500 max-w-[140px] truncate" title={item.building}>{item.building || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{fmtDate(item.work_date)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{item.item_type}</td>
                        <td className="px-3 py-2.5 text-slate-300 font-mono font-semibold whitespace-nowrap">{usd(item.amount)}</td>
                        <td className="px-3 py-2.5"><WOStatusBadge status={item.wo_status} /></td>
                        <td className="px-3 py-2.5 text-center">
                          {item.photos_received
                            ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-emerald-400 mx-auto"><polyline points="20 6 9 17 4 12"/></svg>
                            : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-red-400 mx-auto"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          }
                        </td>
                        <td className="px-3 py-2.5">
                          {item.issues?.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.issues.map((issue, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 whitespace-nowrap">{issue}</span>
                              ))}
                            </div>
                          ) : <span className="text-slate-700">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ── Legend ── */}
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-slate-200">How This Analysis Works</h3></CardHeader>
            <CardBody>
              <div className="grid md:grid-cols-2 gap-5 text-sm">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Approval Rules Applied</p>
                  <ul className="space-y-1.5 text-slate-600 text-xs">
                    {['Work order status must be: Completed, Invoiced, or Closed','Photos must be received (verified via email)','Line items without a WO link are auto-approved'].map((t,i)=>(
                      <li key={i} className="flex items-start gap-1.5"><span className="w-1 h-1 rounded-full bg-slate-700 flex-shrink-0 mt-1.5"/>{t}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">What the Results Mean</p>
                  <ul className="space-y-1.5 text-xs">
                    <li className="flex items-start gap-1.5"><span className="w-1 h-1 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5"/><span className="text-slate-600"><span className="text-emerald-400">Approved</span> — Would be paid immediately</span></li>
                    <li className="flex items-start gap-1.5"><span className="w-1 h-1 rounded-full bg-yellow-500 flex-shrink-0 mt-1.5"/><span className="text-slate-600"><span className="text-yellow-400">Held</span> — Payment pending until ticket is complete</span></li>
                    <li className="flex items-start gap-1.5"><span className="w-1 h-1 rounded-full bg-blue-500 flex-shrink-0 mt-1.5"/><span className="text-slate-600">Held amount = potential cash flow protection</span></li>
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>

        </div>
      </div>
    </AppShell>
  );
}
