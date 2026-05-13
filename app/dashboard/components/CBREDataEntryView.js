// app/dashboard/components/CBREDataEntryView.js
// ─────────────────────────────────────────────────────────────────────────────
// CBRE Data Entry Queue — Admin/Office only
//
// Workflow:
//   1. Tech checks out daily → daily_hours_log entry created
//      → Office assistant must enter check-in/out + hours into CBRE Portal
//   2. Tech completes WO → work_orders.status='completed'
//      → Office assistant must notify CBRE
//
// Both events tracked separately via cbre_transferred / completion_transferred.
// Office staff opens CBRE Portal in another tab, copies data from this view,
// pastes it in, then clicks "Mark transferred" to clear the entry.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useMemo } from 'react';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

// Timezone-safe date parser. JS's `new Date('2026-04-13')` treats date-only strings
// as UTC midnight, which then displays one day earlier in EST. This helper detects
// 'YYYY-MM-DD' format and parses as LOCAL date instead. Timestamps with a time
// component fall through to standard Date parsing.
function parseLocalDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
  return new Date(d);
}

const fmtDate = (d) => {
  const date = parseLocalDate(d);
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
};

const fmtDateTime = (d) => d
  ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
  : '—';

// Parse FIRST check-in and LAST check-out timestamps from comments.
// Comments may have multiple events on the SAME LINE separated by whitespace:
//   [4/13/2026, 3:34:23 PM] Stephen Jordan - ✓ CHECKED IN     [4/13/2026, 4:38:43 PM] Stephen Jordan - ⏸ CHECKED OUT
// or on separate lines. We use a global regex (no line-splitting) so we catch ALL events.
// Supports English (CHECKED IN/OUT) and Spanish (ENTRADA/SALIDA).
// A tech may check in/out multiple times in a day (lunch break, etc.) — we want the
// EARLIEST check-in and the LATEST check-out as the working window for CBRE.
function extractCheckInOut(comments, userName, workDate) {
  if (!comments) return { checkIn: null, checkOut: null };
  const checkIns = [], checkOuts = [];
  // Build target date string "M/D/YYYY" using LOCAL parsing (no UTC shift)
  const date = parseLocalDate(workDate);
  const dateStr = date ? `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}` : null;
  const firstName = userName ? userName.toLowerCase().split(' ')[0] : null;

  // Global regex — finds every [timestamp] name - event anywhere in the string
  // (not anchored to line start, so multiple events on one line all match)
  const regex = /\[([^\]]+)\]\s+([^[\n]+?)\s+-\s+(✓ CHECKED IN|⏸ CHECKED OUT|✓ ENTRADA|⏸ SALIDA)/g;
  let m;
  while ((m = regex.exec(comments)) !== null) {
    const [, timestamp, name, event] = m;
    // Filter to this date — normalize both sides to strip leading zeros ("04/13" ≡ "4/13")
    if (dateStr) {
      const tsDate = timestamp.split(',')[0].trim().split('/').map(p => parseInt(p, 10)).join('/');
      if (tsDate !== dateStr) continue;
    }
    // Filter to this user (first name match)
    if (firstName && !name.trim().toLowerCase().includes(firstName)) continue;
    if (event.includes('CHECKED IN')  || event.includes('ENTRADA')) checkIns.push(timestamp);
    if (event.includes('CHECKED OUT') || event.includes('SALIDA'))  checkOuts.push(timestamp);
  }
  // Sort by parsed Date — earliest first
  const byTime = (a, b) => new Date(a) - new Date(b);
  checkIns.sort(byTime);
  checkOuts.sort(byTime);
  return {
    checkIn:  checkIns[0]                        || null,  // earliest IN
    checkOut: checkOuts[checkOuts.length - 1]    || null,  // latest OUT
  };
}

// Strip date prefix from "5/11/2026, 10:28:46 AM" → "10:28 AM"
// (seconds dropped for cleaner display)
function timeOnly(timestamp) {
  if (!timestamp) return null;
  const m = timestamp.match(/(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)/i);
  return m ? `${m[1]}:${m[2]} ${m[3].toUpperCase()}` : timestamp;
}

// ═════════════════════════════════════════════════════════════════════════════
export default function CBREDataEntryView({ currentUser }) {
  const isAuthorized = currentUser?.role === 'admin' || currentUser?.role === 'office_staff';

  const [loading, setLoading]               = useState(true);
  const [dailyEntries, setDailyEntries]     = useState([]);   // pending check-outs
  const [completions, setCompletions]       = useState([]);   // pending completions
  const [search, setSearch]                 = useState('');
  const [dayWindow, setDayWindow]           = useState(30);   // 14 | 30 | 90 | 0 (=all)
  const [showTransferred, setShowTransferred] = useState(false);
  const [activeTab, setActiveTab]           = useState('daily'); // 'daily' | 'completion'
  const [busy, setBusy]                     = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => { if (isAuthorized) loadData(); /* eslint-disable-next-line */ }, [isAuthorized, dayWindow, showTransferred]);

  const loadData = async () => {
    setLoading(true);
    try {
      const cutoff = dayWindow > 0
        ? new Date(Date.now() - dayWindow * 86400000).toISOString().slice(0, 10)
        : null;

      // ── Daily hours pending transfer ──
      let dailyQuery = supabase
        .from('daily_hours_log')
        .select(`
          log_id, wo_id, user_id, work_date,
          hours_regular, hours_overtime, miles, tech_material_cost, notes,
          cbre_transferred, cbre_transferred_at, cbre_transferred_by,
          user:users!daily_hours_log_user_id_fkey(first_name, last_name),
          work_order:work_orders(wo_id, wo_number, building, work_order_description, comments, nte, status)
        `)
        .order('work_date', { ascending: false });

      if (!showTransferred) dailyQuery = dailyQuery.eq('cbre_transferred', false);
      if (cutoff)            dailyQuery = dailyQuery.gte('work_date', cutoff);

      const { data: dailyData, error: dailyErr } = await dailyQuery;
      if (dailyErr) throw dailyErr;

      // ── Completions pending transfer ──
      let completionQuery = supabase
        .from('work_orders')
        .select(`
          wo_id, wo_number, building, work_order_description, comments, nte, status,
          date_completed, acknowledged_at, customer_signature, customer_name,
          completion_transferred, completion_transferred_at, completion_transferred_by,
          lead_tech:users!work_orders_lead_tech_id_fkey(first_name, last_name)
        `)
        .eq('status', 'completed')
        .order('date_completed', { ascending: false });

      if (!showTransferred) completionQuery = completionQuery.eq('completion_transferred', false);
      if (cutoff)            completionQuery = completionQuery.gte('date_completed', cutoff);

      const { data: completionData, error: completionErr } = await completionQuery;
      if (completionErr) throw completionErr;

      setDailyEntries(dailyData || []);
      setCompletions(completionData || []);
    } catch (e) {
      // Supabase errors have message/details/hint/code — stringify them properly
      const errInfo = {
        message: e?.message,
        details: e?.details,
        hint:    e?.hint,
        code:    e?.code,
        raw:     e,
      };
      console.error('Error loading CBRE data entry queue:', errInfo);
      alert('Error loading data:\n' + (e?.message || e?.details || e?.hint || JSON.stringify(e)));
    } finally {
      setLoading(false);
    }
  };

  // ── Group daily entries by WO ─────────────────────────────────────────
  const filteredDaily = useMemo(() => {
    const s = search.trim().toLowerCase();
    let arr = dailyEntries;
    if (s) arr = arr.filter(e =>
      e.work_order?.wo_number?.toLowerCase().includes(s) ||
      e.work_order?.building?.toLowerCase().includes(s) ||
      `${e.user?.first_name || ''} ${e.user?.last_name || ''}`.toLowerCase().includes(s)
    );
    // Group by wo_id
    const groups = new Map();
    arr.forEach(entry => {
      const k = entry.wo_id;
      if (!groups.has(k)) groups.set(k, { wo: entry.work_order, entries: [] });
      groups.get(k).entries.push(entry);
    });
    return Array.from(groups.values());
  }, [dailyEntries, search]);

  const filteredCompletions = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return completions;
    return completions.filter(c =>
      c.wo_number?.toLowerCase().includes(s) ||
      c.building?.toLowerCase().includes(s)
    );
  }, [completions, search]);

  const pendingDailyCount = dailyEntries.filter(e => !e.cbre_transferred).length;
  const pendingCompletionCount = completions.filter(c => !c.completion_transferred).length;

  // ── Mutations ──────────────────────────────────────────────────────────
  const markDailyTransferred = async (logIds, transferred = true) => {
    if (!logIds.length) return;
    setBusy(true);
    try {
      const update = transferred
        ? { cbre_transferred: true,  cbre_transferred_at: new Date().toISOString(), cbre_transferred_by: currentUser.user_id }
        : { cbre_transferred: false, cbre_transferred_at: null, cbre_transferred_by: null };

      const { error } = await supabase
        .from('daily_hours_log')
        .update(update)
        .in('log_id', logIds);

      if (error) throw error;

      // Optimistic update
      setDailyEntries(prev => prev.map(e =>
        logIds.includes(e.log_id) ? { ...e, ...update } : e
      ));
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  const markCompletionTransferred = async (woId, transferred = true) => {
    setBusy(true);
    try {
      const update = transferred
        ? { completion_transferred: true,  completion_transferred_at: new Date().toISOString(), completion_transferred_by: currentUser.user_id }
        : { completion_transferred: false, completion_transferred_at: null, completion_transferred_by: null };

      const { error } = await supabase
        .from('work_orders')
        .update(update)
        .eq('wo_id', woId);

      if (error) throw error;

      setCompletions(prev => prev.map(c =>
        c.wo_id === woId ? { ...c, ...update } : c
      ));
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setBusy(false);
    }
  };

  // ── Copy summary helpers ───────────────────────────────────────────────
  const buildDailySummary = (wo, entries) => {
    const lines = [
      `=== CBRE Daily Update — WO #${wo.wo_number} ===`,
      `Building: ${wo.building || '—'}`,
      ``,
    ];
    entries.forEach(e => {
      const techName = `${e.user?.first_name || ''} ${e.user?.last_name || ''}`.trim();
      const { checkIn, checkOut } = extractCheckInOut(wo.comments, techName, e.work_date);
      lines.push(`--- ${fmtDate(e.work_date)} | ${techName} ---`);
      lines.push(`  First Check-In:  ${timeOnly(checkIn)  || '(not logged)'}`);
      lines.push(`  Last  Check-Out: ${timeOnly(checkOut) || '(not logged)'}`);
      lines.push(`  Regular Hours:  ${parseFloat(e.hours_regular) || 0}`);
      lines.push(`  Overtime Hours: ${parseFloat(e.hours_overtime) || 0}`);
      lines.push(`  Miles: ${parseFloat(e.miles) || 0}`);
      if (parseFloat(e.tech_material_cost) > 0) {
        lines.push(`  Tech Material: $${parseFloat(e.tech_material_cost).toFixed(2)}`);
      }
      if (e.notes && !e.notes.includes('[MIGRATED]') && !e.notes.includes('[Added by Admin]')) {
        lines.push(`  Notes: ${e.notes}`);
      }
      lines.push('');
    });
    return lines.join('\n');
  };

  const buildCompletionSummary = (c) => {
    return [
      `=== CBRE Work Order COMPLETED ===`,
      `WO #: ${c.wo_number}`,
      `Building: ${c.building || '—'}`,
      `Lead Tech: ${c.lead_tech ? `${c.lead_tech.first_name} ${c.lead_tech.last_name}` : '—'}`,
      `Completion Date: ${fmtDate(c.date_completed)}`,
      c.acknowledged_at ? `Acknowledged: ${fmtDateTime(c.acknowledged_at)}` : '',
      c.customer_signature ? `Customer Signed: YES (${c.customer_name || 'name on file'})` : `Customer Signed: NO`,
      ``,
      `--- Work Performed ---`,
      c.work_order_description || '(no description)',
      ``,
      c.comments ? `--- Tech Comments ---\n${c.comments}` : ''
    ].filter(Boolean).join('\n');
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // Quick visual feedback (no library needed)
      const el = document.createElement('div');
      el.textContent = '✓ Copied to clipboard';
      el.style.cssText = 'position:fixed;top:20px;right:20px;background:#059669;color:white;padding:10px 16px;border-radius:8px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    } catch {
      alert('Copy failed — please select the text manually.');
    }
  };

  // ── Authorization gate ─────────────────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-[#0d0d14] border border-[#2d2d44] rounded-xl p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-slate-200 mb-2">🔒 Access Restricted</h2>
          <p className="text-slate-400 text-sm">This view is available only to Admin and Office Staff.</p>
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
          <p className="text-slate-500 text-sm">Loading CBRE data entry queue...</p>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              📤 CBRE Data Entry
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">Manual data transfer queue for the CBRE Web Portal</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={dayWindow}
              onChange={(e) => setDayWindow(parseInt(e.target.value))}
              className="bg-[#0a0a0f] border border-[#2d2d44] text-slate-300 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500/60"
            >
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="0">All time</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showTransferred}
                onChange={(e) => setShowTransferred(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              Show transferred
            </label>
            <button
              onClick={loadData}
              className="bg-[#1e1e2e] border border-[#2d2d44] hover:bg-[#2d2d44] text-slate-300 px-3 py-2 rounded-lg text-sm transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-[#0a0a0f] border border-[#2d2d44] rounded-lg p-1 mt-4 w-fit">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition ${
              activeTab === 'daily' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            🕒 Daily Check-Outs
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'daily' ? 'bg-blue-500/30 text-blue-300' : 'bg-[#1e1e2e] text-slate-500'
            }`}>
              {pendingDailyCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('completion')}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition ${
              activeTab === 'completion' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            ✅ Completions
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'completion' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-[#1e1e2e] text-slate-500'
            }`}>
              {pendingCompletionCount}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="mt-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search WO#, building, or tech..."
            className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600 px-4 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500/60"
          />
        </div>
      </div>

      {/* ─── DAILY CHECK-OUTS TAB ─── */}
      {activeTab === 'daily' && (
        <div className="space-y-3">
          {filteredDaily.length === 0 ? (
            <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-12 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-slate-300 font-semibold">All daily check-outs transferred!</p>
              <p className="text-slate-500 text-sm mt-1">
                {showTransferred ? 'No entries match your filter.' : 'Office is up to date with CBRE Portal.'}
              </p>
            </div>
          ) : (
            filteredDaily.map(({ wo, entries }) => {
              const allLogIds = entries.filter(e => !e.cbre_transferred).map(e => e.log_id);
              const allTransferred = entries.every(e => e.cbre_transferred);

              return (
                <div key={wo.wo_id} className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
                  {/* WO header */}
                  <div className="bg-[#1e1e2e]/40 border-b border-[#2d2d44] px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-blue-400 text-lg">{wo.wo_number}</span>
                      <span className="text-slate-400 text-sm">{wo.building || '—'}</span>
                      {!allTransferred && (
                        <span className="bg-orange-500/15 text-orange-400 border border-orange-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
                          {entries.filter(e => !e.cbre_transferred).length} pending
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(buildDailySummary(wo, entries.filter(e => !e.cbre_transferred)))}
                        disabled={allLogIds.length === 0}
                        className="bg-blue-600/20 hover:bg-blue-600/30 disabled:opacity-40 disabled:cursor-not-allowed text-blue-400 border border-blue-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        📋 Copy all pending
                      </button>
                      {allLogIds.length > 0 && (
                        <button
                          onClick={() => markDailyTransferred(allLogIds, true)}
                          disabled={busy}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                        >
                          ✓ Mark all transferred ({allLogIds.length})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Entries list */}
                  <div className="divide-y divide-[#1e1e2e]">
                    {entries.map(entry => {
                      const techName = `${entry.user?.first_name || ''} ${entry.user?.last_name || ''}`.trim();
                      const { checkIn, checkOut } = extractCheckInOut(wo.comments, techName, entry.work_date);

                      const inT  = timeOnly(checkIn);
                      const outT = timeOnly(checkOut);

                      return (
                        <div
                          key={entry.log_id}
                          className={`px-5 py-3 flex items-center justify-between gap-3 flex-wrap transition ${
                            entry.cbre_transferred ? 'opacity-60' : 'hover:bg-[#1e1e2e]/30'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            {/* PRIMARY ROW — name · date · check-in → check-out */}
                            <div className="flex items-center gap-3 flex-wrap text-sm">
                              <span className="font-semibold text-slate-200">{techName || 'Unknown'}</span>
                              <span className="text-slate-500">·</span>
                              <span className="text-slate-400">{fmtDate(entry.work_date)}</span>
                              <span className="text-slate-500">·</span>
                              {(inT || outT) ? (
                                <span className="font-mono text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded px-2 py-0.5">
                                  <span className={inT ? '' : 'text-slate-600 italic'}>
                                    {inT || 'no IN'}
                                  </span>
                                  <span className="text-slate-500 mx-1.5">→</span>
                                  <span className={outT ? '' : 'text-slate-600 italic'}>
                                    {outT || 'no OUT'}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-xs text-slate-600 italic">no check-in/out logged</span>
                              )}
                            </div>
                            {/* SECONDARY ROW — hours + miles (for cross-reference) */}
                            <div className="text-xs text-slate-500 mt-1 flex gap-3 flex-wrap">
                              <span className="font-mono">
                                <span className="text-emerald-500/80">{(parseFloat(entry.hours_regular) || 0).toFixed(1)} RT</span>
                                {parseFloat(entry.hours_overtime) > 0 && (
                                  <span className="text-orange-500/80 ml-2">{(parseFloat(entry.hours_overtime) || 0).toFixed(1)} OT</span>
                                )}
                                {parseFloat(entry.miles) > 0 && (
                                  <span className="text-slate-500 ml-2">{(parseFloat(entry.miles) || 0).toFixed(1)} mi</span>
                                )}
                              </span>
                            </div>
                            {entry.cbre_transferred && entry.cbre_transferred_at && (
                              <div className="text-xs text-emerald-500 mt-1">
                                ✓ Transferred {fmtDateTime(entry.cbre_transferred_at)}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {entry.cbre_transferred ? (
                              <button
                                onClick={() => markDailyTransferred([entry.log_id], false)}
                                disabled={busy}
                                className="bg-[#1e1e2e] hover:bg-[#2d2d44] text-slate-400 hover:text-slate-200 border border-[#2d2d44] text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                                title="Undo transfer (admin/office only)"
                              >
                                ↶ Untick
                              </button>
                            ) : (
                              <button
                                onClick={() => markDailyTransferred([entry.log_id], true)}
                                disabled={busy}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                              >
                                ✓ Mark transferred
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── COMPLETIONS TAB ─── */}
      {activeTab === 'completion' && (
        <div className="space-y-3">
          {filteredCompletions.length === 0 ? (
            <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-12 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-slate-300 font-semibold">All completions transferred!</p>
              <p className="text-slate-500 text-sm mt-1">
                {showTransferred ? 'No entries match your filter.' : 'CBRE has been notified of all completions.'}
              </p>
            </div>
          ) : (
            filteredCompletions.map(c => (
              <div
                key={c.wo_id}
                className={`bg-[#0d0d14] border rounded-xl overflow-hidden transition ${
                  c.completion_transferred ? 'border-[#1e1e2e] opacity-60' : 'border-emerald-500/20'
                }`}
              >
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono font-bold text-blue-400 text-lg">{c.wo_number}</span>
                        <span className="text-slate-400 text-sm">{c.building || '—'}</span>
                        {!c.completion_transferred && (
                          <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
                            Pending CBRE notification
                          </span>
                        )}
                        {c.customer_signature && (
                          <span className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
                            ✍️ Signed
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1.5 flex gap-3 flex-wrap">
                        <span>Completed: <span className="text-slate-300">{fmtDate(c.date_completed)}</span></span>
                        {c.lead_tech && (
                          <span>Lead: <span className="text-slate-300">{c.lead_tech.first_name} {c.lead_tech.last_name}</span></span>
                        )}
                        {c.acknowledged_at && (
                          <span>Ack'd: <span className="text-slate-300">{fmtDateTime(c.acknowledged_at)}</span></span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(buildCompletionSummary(c))}
                        className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        📋 Copy summary
                      </button>
                      {c.completion_transferred ? (
                        <button
                          onClick={() => markCompletionTransferred(c.wo_id, false)}
                          disabled={busy}
                          className="bg-[#1e1e2e] hover:bg-[#2d2d44] text-slate-400 hover:text-slate-200 border border-[#2d2d44] text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                        >
                          ↶ Untick
                        </button>
                      ) : (
                        <button
                          onClick={() => markCompletionTransferred(c.wo_id, true)}
                          disabled={busy}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                        >
                          ✓ Mark transferred
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description preview */}
                  {c.work_order_description && (
                    <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 text-sm text-slate-400 line-clamp-3 mb-2">
                      {c.work_order_description}
                    </div>
                  )}

                  {/* Transfer info */}
                  {c.completion_transferred && c.completion_transferred_at && (
                    <div className="text-xs text-emerald-500">
                      ✓ Transferred {fmtDateTime(c.completion_transferred_at)}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
