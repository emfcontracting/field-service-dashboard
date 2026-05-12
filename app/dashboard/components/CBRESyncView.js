// app/dashboard/components/CBRESyncView.js
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-ONLY: CBRE Status Sync — weekly reconciliation tool
//
// Workflow:
//   1. Upload CBRE export (.xls, which is actually HTML)
//   2. Parse and match WOs by wo_number (handles both C##### and P##### formats)
//   3. Show reconciliation: Matched / Discrepancy / Missing
//   4. Auto-sync with 5-second confirmation, full audit trail
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import {
  DEFAULT_CBRE_MAPPING,
  buildEffectiveMapping,
  parseCbreStatus,
} from '@/lib/cbreStatusMapping';

const supabase = getSupabase();
const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const AUTO_CONFIRM_SECONDS = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Parse the CBRE "xls" file (which is actually an HTML table)
// ─────────────────────────────────────────────────────────────────────────────
function parseCbreHtmlTable(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const table = doc.querySelector('table');
  if (!table) throw new Error('No table found in file');

  // Read header
  const headers = Array.from(table.querySelectorAll('thead th, tr:first-child th'))
    .map(th => th.textContent.trim());

  // Read body rows (skip first row if it was the header)
  const allRows = Array.from(table.querySelectorAll('tr'));
  const dataRows = headers.length ? allRows.slice(1) : allRows;

  const rows = dataRows.map(tr => {
    const cells = Array.from(tr.querySelectorAll('td, th')).map(c => c.textContent.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] || ''; });
    return row;
  }).filter(r => Object.values(r).some(v => v)); // drop fully empty rows

  return { headers, rows };
}

// ═════════════════════════════════════════════════════════════════════════════
export default function CBRESyncView({ currentUser }) {
  const isAdmin = currentUser?.role === 'admin';
  const fileInputRef = useRef(null);

  // ── State ──────────────────────────────────────────────────────────────────
  const [file, setFile]               = useState(null);
  const [parsedRows, setParsedRows]   = useState([]);
  const [parsing, setParsing]         = useState(false);
  const [parseError, setParseError]   = useState(null);

  const [dbInvoices, setDbInvoices]   = useState([]);
  const [dbWOs, setDbWOs]             = useState([]);
  const [mappingOverrides, setMappingOverrides] = useState([]);
  const [recentSyncs, setRecentSyncs] = useState([]);

  const [loading, setLoading]         = useState(false);
  const [syncing, setSyncing]         = useState(false);
  const [confirmTimer, setConfirmTimer] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  const [expandedSections, setExpandedSections] = useState({
    matched: false, discrepancy: true, missing: false, unknown: false,
  });

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAdmin) loadDbData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const loadDbData = async () => {
    setLoading(true);
    try {
      const [invRes, woRes, mapRes, logRes] = await Promise.all([
        supabaseClient.from('invoices').select('invoice_id, invoice_number, wo_id, invoice_date, status, cbre_status, cbre_status_label, cmp_date, cbre_status_updated_at, cbre_status_acknowledged_at, total, work_order:work_orders(wo_number)'),
        supabaseClient.from('work_orders').select('wo_id, wo_number, status, cbre_status, cbre_status_label, cbre_status_updated_at, cbre_status_acknowledged_at, acknowledged, is_locked'),
        supabaseClient.from('cbre_status_mappings').select('*').eq('is_active', true),
        supabaseClient.from('cbre_sync_log').select('*').order('synced_at', { ascending: false }).limit(10),
      ]);
      setDbInvoices(invRes.data || []);
      setDbWOs(woRes.data || []);
      setMappingOverrides(mapRes.data || []);
      setRecentSyncs(logRes.data || []);
    } catch (e) {
      console.error('CBRESyncView load error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Effective mapping (defaults + DB overrides) ────────────────────────────
  const mapping = useMemo(() => buildEffectiveMapping(mappingOverrides), [mappingOverrides]);

  // ── File handlers ──────────────────────────────────────────────────────────
  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setParsing(true);
    setParseError(null);
    setParsedRows([]);

    try {
      const text = await f.text();
      const { rows } = parseCbreHtmlTable(text);
      if (!rows.length) throw new Error('No data rows found in file');

      // Enrich rows with parsed status
      const enriched = rows.map(r => {
        const woNum = (r['WorkOrderNumber'] || r['Work Order Number'] || r['WO#'] || '').trim();
        const statusRaw = (r['Status'] || '').trim();
        const { code: statusCode, label: statusLabel } = parseCbreStatus(statusRaw);
        return {
          wo_number: woNum,
          status_raw: statusRaw,
          status_code: statusCode,
          status_label: statusLabel,
          building: r['Address'] || '',
          city: r['City'] || '',
          state: r['State'] || '',
          completed_at: r['DateCompleteSite'] || '',
          entered_at: r['Date Entered'] || '',
          priority: r['Priority'] || '',
          fm: r['FM'] || '',
        };
      }).filter(r => r.wo_number);

      setParsedRows(enriched);
    } catch (e) {
      console.error(e);
      setParseError(e.message || 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  };

  const onFileDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f) handleFile(f);
  };

  const onDragOver = (e) => e.preventDefault();

  const clearFile = () => {
    setFile(null);
    setParsedRows([]);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Reconciliation ─────────────────────────────────────────────────────────
  // For each CBRE row, find the matching WO/invoice in our DB and compare
  const reconciliation = useMemo(() => {
    if (!parsedRows.length) return null;

    // Build lookup maps from DB
    const dbWoByNumber = new Map(dbWOs.map(w => [w.wo_number, w]));
    const dbInvByWoNumber = new Map();
    dbInvoices.forEach(inv => {
      const wn = inv.work_order?.wo_number;
      if (wn && !dbInvByWoNumber.has(wn)) dbInvByWoNumber.set(wn, inv);
    });

    const matched = [];      // status matches what we expect
    const discrepancy = [];  // we have it, status differs
    const missing = [];      // CBRE has it, we don't
    const unknown = [];      // status code not in our mapping

    for (const row of parsedRows) {
      const woInDb = dbWoByNumber.get(row.wo_number);
      const invInDb = dbInvByWoNumber.get(row.wo_number);
      const map = mapping[row.status_code];

      if (!map) {
        unknown.push({ row, woInDb, invInDb });
        continue;
      }

      if (!woInDb && !invInDb) {
        missing.push({ row, map });
        continue;
      }

      // Determine if our state matches what CBRE says
      const proposed = computeProposedChanges(row, woInDb, invInDb, map);

      if (proposed.changes.length === 0) {
        matched.push({ row, woInDb, invInDb, map });
      } else {
        discrepancy.push({ row, woInDb, invInDb, map, ...proposed });
      }
    }

    return { matched, discrepancy, missing, unknown };
  }, [parsedRows, dbWOs, dbInvoices, mapping]);

  // ── Apply the sync ─────────────────────────────────────────────────────────
  const startSync = () => {
    if (!reconciliation || !reconciliation.discrepancy.length) return;
    setShowConfirm(true);
    setConfirmTimer(AUTO_CONFIRM_SECONDS);
  };

  // Countdown effect
  useEffect(() => {
    if (!showConfirm || confirmTimer === null) return;
    if (confirmTimer === 0) {
      doSync();
      return;
    }
    const t = setTimeout(() => setConfirmTimer(c => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showConfirm, confirmTimer]);

  const cancelSync = () => {
    setShowConfirm(false);
    setConfirmTimer(null);
  };

  const doSync = async () => {
    setShowConfirm(false);
    setConfirmTimer(null);
    if (!reconciliation) return;
    setSyncing(true);

    try {
      // 1. Create sync log entry
      const { data: { user } } = await supabase.auth.getUser();
      const { data: logRow, error: logErr } = await supabaseClient
        .from('cbre_sync_log')
        .insert({
          file_name: file?.name || 'unknown',
          total_rows: parsedRows.length,
          matched_count: reconciliation.matched.length,
          updated_count: reconciliation.discrepancy.length,
          unmatched_count: reconciliation.missing.length,
          user_id: user?.id,
          summary: {
            matched: reconciliation.matched.length,
            discrepancy: reconciliation.discrepancy.length,
            missing: reconciliation.missing.length,
            unknown: reconciliation.unknown.length,
          },
        })
        .select()
        .single();

      if (logErr) throw logErr;

      const now = new Date().toISOString();
      const today = now.split('T')[0]; // YYYY-MM-DD for cmp_date
      const changesToLog = [];

      // 2. Apply each discrepancy
      for (const item of reconciliation.discrepancy) {
        for (const change of item.changes) {
          if (change.target === 'invoice' && item.invInDb) {
            const update = { [change.field]: change.newValue };
            // Set cbre_status fields always
            update.cbre_status = item.row.status_code;
            update.cbre_status_label = item.row.status_label;
            update.cbre_status_updated_at = now;
            update.cbre_last_synced_at = now;
            // IMPORTANT: don't set cbre_status_acknowledged_at — leaves an "unack" marker
            // for office staff to see something changed
            // Set cmp_date if not yet set and mapping says so
            if (item.map.set_cmp_date && !item.invInDb.cmp_date) {
              update.cmp_date = today;
            }
            await supabaseClient
              .from('invoices')
              .update(update)
              .eq('invoice_id', item.invInDb.invoice_id);
          } else if (change.target === 'wo' && item.woInDb) {
            const update = { [change.field]: change.newValue };
            update.cbre_status = item.row.status_code;
            update.cbre_status_label = item.row.status_label;
            update.cbre_status_updated_at = now;
            update.cbre_last_synced_at = now;
            await supabaseClient
              .from('work_orders')
              .update(update)
              .eq('wo_id', item.woInDb.wo_id);
          }

          changesToLog.push({
            sync_log_id: logRow.id,
            wo_number: item.row.wo_number,
            field_changed: `${change.target}.${change.field}`,
            old_value: String(change.oldValue ?? ''),
            new_value: String(change.newValue ?? ''),
          });
        }
      }

      // 3. Log all changes
      if (changesToLog.length) {
        await supabaseClient.from('cbre_sync_changes').insert(changesToLog);
      }

      setLastSyncResult({
        timestamp: now,
        applied: changesToLog.length,
        matched: reconciliation.matched.length,
        missing: reconciliation.missing.length,
      });

      // Reload DB data and clear file
      await loadDbData();
      clearFile();
    } catch (e) {
      console.error('Sync error:', e);
      alert(`Sync failed: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  // ── Admin gate ─────────────────────────────────────────────────────────────
  if (!isAdmin) return (
    <div className="flex items-center justify-center min-h-[60vh] text-red-400">
      🔒 Admin access required
    </div>
  );

  const totalDiscrepancies = reconciliation?.discrepancy?.length || 0;

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200 p-4 md:p-6 space-y-5">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-100">🔄 CBRE Sync</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Weekly status reconciliation between CBRE Service Insight and FSM
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/settings/cbre-mapping"
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1e1e2e] border border-[#2d2d44] text-slate-400 hover:text-slate-200 transition">
            ⚙️ Edit Status Mapping
          </a>
        </div>
      </div>

      {/* ── Last sync result toast ── */}
      {lastSyncResult && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-emerald-400 font-semibold text-sm">
              ✅ Sync complete — {lastSyncResult.applied} change{lastSyncResult.applied !== 1 ? 's' : ''} applied
            </div>
            <div className="text-slate-500 text-xs mt-0.5">
              {lastSyncResult.matched} matched · {lastSyncResult.missing} unmatched
            </div>
          </div>
          <button onClick={() => setLastSyncResult(null)} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
        </div>
      )}

      {/* ── Upload Zone (when no file loaded) ── */}
      {!file && (
        <div
          onDrop={onFileDrop}
          onDragOver={onDragOver}
          className="bg-[#0d0d14] border-2 border-dashed border-[#2d2d44] hover:border-blue-500/40 transition rounded-xl p-12 text-center cursor-pointer"
          onClick={() => fileInputRef.current?.click()}>
          <div className="text-5xl mb-3">📥</div>
          <div className="text-slate-300 font-semibold mb-1">Drop CBRE Export here</div>
          <div className="text-slate-500 text-sm">or click to browse (.xls file from Service Insight)</div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xls,.html"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </div>
      )}

      {/* ── Parsing state ── */}
      {parsing && (
        <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl py-12 text-center text-slate-500">
          <svg className="animate-spin w-6 h-6 mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          Parsing {file?.name}...
        </div>
      )}

      {/* ── Parse error ── */}
      {parseError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-red-400 font-semibold text-sm">❌ Parse failed</div>
            <div className="text-slate-400 text-xs mt-0.5">{parseError}</div>
          </div>
          <button onClick={clearFile} className="px-3 py-1.5 rounded-lg text-xs bg-[#1e1e2e] border border-[#2d2d44] text-slate-300">Try again</button>
        </div>
      )}

      {/* ── Reconciliation Report ── */}
      {reconciliation && !parsing && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <SummaryCard label="Total Rows" value={parsedRows.length} color="slate" />
            <SummaryCard label="Matched" value={reconciliation.matched.length} color="emerald" icon="✅" />
            <SummaryCard label="Discrepancy" value={reconciliation.discrepancy.length} color="yellow" icon="⚠️" highlight={totalDiscrepancies > 0} />
            <SummaryCard label="Missing in FSM" value={reconciliation.missing.length} color="blue" icon="❓" />
            <SummaryCard label="Unknown Code" value={reconciliation.unknown.length} color="red" icon="🔴" />
          </div>

          {/* File info bar */}
          <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-slate-400 flex items-center gap-2">
              <span className="text-lg">📄</span>
              <span className="font-mono text-xs">{file?.name}</span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-500">{parsedRows.length} rows</span>
            </div>
            <div className="flex gap-2">
              <button onClick={clearFile}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1e1e2e] border border-[#2d2d44] text-slate-400 hover:text-slate-200 transition">
                Clear
              </button>
              {totalDiscrepancies > 0 && (
                <button onClick={startSync} disabled={syncing}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition disabled:opacity-50 flex items-center gap-1.5">
                  {syncing ? (
                    <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Syncing...</>
                  ) : (
                    <>🚀 Apply {totalDiscrepancies} Update{totalDiscrepancies !== 1 ? 's' : ''}</>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Sections */}
          {reconciliation.discrepancy.length > 0 && (
            <Section
              title="⚠️ Discrepancies (will be synced)"
              count={reconciliation.discrepancy.length}
              color="yellow"
              expanded={expandedSections.discrepancy}
              onToggle={() => setExpandedSections(s => ({ ...s, discrepancy: !s.discrepancy }))}>
              <DiscrepancyTable items={reconciliation.discrepancy} />
            </Section>
          )}

          {reconciliation.unknown.length > 0 && (
            <Section
              title="🔴 Unknown Status Codes (skipped)"
              count={reconciliation.unknown.length}
              color="red"
              expanded={expandedSections.unknown}
              onToggle={() => setExpandedSections(s => ({ ...s, unknown: !s.unknown }))}>
              <UnknownTable items={reconciliation.unknown} />
            </Section>
          )}

          {reconciliation.missing.length > 0 && (
            <Section
              title="❓ Missing in FSM"
              count={reconciliation.missing.length}
              color="blue"
              expanded={expandedSections.missing}
              onToggle={() => setExpandedSections(s => ({ ...s, missing: !s.missing }))}>
              <MissingTable items={reconciliation.missing} />
            </Section>
          )}

          {reconciliation.matched.length > 0 && (
            <Section
              title="✅ Matched (no changes needed)"
              count={reconciliation.matched.length}
              color="emerald"
              expanded={expandedSections.matched}
              onToggle={() => setExpandedSections(s => ({ ...s, matched: !s.matched }))}>
              <MatchedTable items={reconciliation.matched} />
            </Section>
          )}
        </>
      )}

      {/* ── Recent Sync History ── */}
      {!file && recentSyncs.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mt-6">Recent Syncs</h2>
          <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-[#1e1e2e] text-xs uppercase tracking-wider text-slate-500 font-semibold">
              <div className="col-span-3">Date</div>
              <div className="col-span-4">File</div>
              <div className="col-span-1 text-right">Rows</div>
              <div className="col-span-2 text-right">Matched</div>
              <div className="col-span-2 text-right">Updated</div>
            </div>
            <div className="divide-y divide-[#1e1e2e]">
              {recentSyncs.map(s => (
                <div key={s.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 text-sm hover:bg-[#1e1e2e]/50">
                  <div className="col-span-3 text-slate-400 text-xs">
                    {new Date(s.synced_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </div>
                  <div className="col-span-4 text-slate-500 text-xs font-mono truncate">{s.file_name}</div>
                  <div className="col-span-1 text-right text-slate-400">{s.total_rows}</div>
                  <div className="col-span-2 text-right text-emerald-400">{s.matched_count}</div>
                  <div className="col-span-2 text-right text-yellow-400 font-semibold">{s.updated_count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Modal ── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl max-w-md w-full shadow-2xl">
            <div className="px-6 py-5 border-b border-[#1e1e2e]">
              <h2 className="text-lg font-bold text-slate-100">Confirm Sync</h2>
              <p className="text-slate-500 text-xs mt-1">
                Auto-confirming in {confirmTimer}s...
              </p>
            </div>
            <div className="p-6 space-y-3">
              <div className="text-slate-300 text-sm">
                About to apply <strong className="text-yellow-400">{totalDiscrepancies}</strong> change{totalDiscrepancies !== 1 ? 's' : ''} to your database.
              </div>
              <div className="text-slate-500 text-xs">
                All changes will be logged and can be reviewed in the sync history. CMP-flagged rows will receive a cmp_date so payout estimates become more precise.
              </div>
              <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg p-3 text-xs text-slate-400">
                <div>⏱️ Auto-confirm: <strong className="text-blue-400">{confirmTimer}s</strong></div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#1e1e2e] flex justify-end gap-2">
              <button onClick={cancelSync}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:bg-[#2d2d44] transition">
                Cancel
              </button>
              <button onClick={doSync}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white transition">
                Apply Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Compute what changes are needed for a single row based on mapping
// ─────────────────────────────────────────────────────────────────────────────
function computeProposedChanges(row, woInDb, invInDb, map) {
  const changes = [];

  if (map.target_type === 'invoice' && invInDb) {
    if (invInDb.status !== map.target_status) {
      changes.push({
        target: 'invoice',
        field: 'status',
        oldValue: invInDb.status,
        newValue: map.target_status,
      });
    }
    if (map.set_cmp_date && !invInDb.cmp_date) {
      changes.push({
        target: 'invoice',
        field: 'cmp_date',
        oldValue: null,
        newValue: 'today',
      });
    }
  } else if (map.target_type === 'pending_invoice' && woInDb) {
    // CPW: WO should be completed, no invoice expected
    if (woInDb.status !== map.target_status) {
      changes.push({
        target: 'wo',
        field: 'status',
        oldValue: woInDb.status,
        newValue: map.target_status,
      });
    }
  } else if (map.target_type === 'wo' && woInDb) {
    if (woInDb.status !== map.target_status) {
      changes.push({
        target: 'wo',
        field: 'status',
        oldValue: woInDb.status,
        newValue: map.target_status,
      });
    }
  }

  // Always track CBRE-side fields if they differ
  const target = invInDb || woInDb;
  if (target && target.cbre_status !== row.status_code) {
    changes.push({
      target: invInDb ? 'invoice' : 'wo',
      field: 'cbre_status',
      oldValue: target.cbre_status || '—',
      newValue: row.status_code,
    });
  }

  return { changes };
}

// ─────────────────────────────────────────────────────────────────────────────
// UI sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color, icon, highlight }) {
  const bgMap = {
    slate:   'bg-[#1e1e2e] border-[#2d2d44]',
    emerald: 'bg-emerald-500/10 border-emerald-500/20',
    yellow:  'bg-yellow-500/10 border-yellow-500/30',
    blue:    'bg-blue-500/10 border-blue-500/20',
    red:     'bg-red-500/10 border-red-500/20',
  };
  const txtMap = {
    slate: 'text-slate-100', emerald: 'text-emerald-400', yellow: 'text-yellow-400',
    blue: 'text-blue-400',   red: 'text-red-400',
  };
  return (
    <div className={`border rounded-xl p-4 ${bgMap[color] || bgMap.slate} ${highlight ? 'ring-2 ring-yellow-500/30' : ''}`}>
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
        {icon && <span className="mr-1">{icon}</span>}{label}
      </div>
      <div className={`text-2xl font-bold ${txtMap[color] || txtMap.slate}`}>{value}</div>
    </div>
  );
}

function Section({ title, count, color, expanded, onToggle, children }) {
  return (
    <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
      <button onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#1e1e2e]/50 transition">
        <div className="text-sm font-semibold text-slate-200">
          {title} <span className="text-slate-600 font-normal">({count})</span>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {expanded && <div className="border-t border-[#1e1e2e]">{children}</div>}
    </div>
  );
}

function DiscrepancyTable({ items }) {
  return (
    <div className="divide-y divide-[#1e1e2e]">
      <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-[#0a0a0f]/50 text-xs uppercase tracking-wider text-slate-500 font-semibold">
        <div className="col-span-2">WO #</div>
        <div className="col-span-2">CBRE Code</div>
        <div className="col-span-4">Changes</div>
        <div className="col-span-4 text-slate-600">Building</div>
      </div>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 hover:bg-[#1e1e2e]/30 transition items-start text-sm">
          <div className="col-span-2 text-blue-400 font-semibold font-mono text-xs">{item.row.wo_number}</div>
          <div className="col-span-2">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
              {item.row.status_code}
            </span>
            <div className="text-[10px] text-slate-600 mt-0.5 truncate">{item.row.status_label}</div>
          </div>
          <div className="col-span-4 space-y-0.5">
            {item.changes.map((c, j) => (
              <div key={j} className="text-xs">
                <span className="text-slate-500">{c.target}.{c.field}:</span>
                <span className="text-red-400 line-through mx-1">{String(c.oldValue || '—')}</span>
                <span className="text-slate-600">→</span>
                <span className="text-emerald-400 mx-1 font-semibold">{String(c.newValue)}</span>
              </div>
            ))}
          </div>
          <div className="col-span-4 text-slate-500 text-xs truncate">{item.row.building}</div>
        </div>
      ))}
    </div>
  );
}

function UnknownTable({ items }) {
  return (
    <div className="divide-y divide-[#1e1e2e]">
      <div className="px-4 py-2 text-xs text-slate-500 italic bg-[#0a0a0f]/50">
        These status codes are not in your mapping. Add them in <a href="/settings/cbre-mapping" className="text-blue-400 hover:underline">Status Mapping</a> settings.
      </div>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 px-4 py-2.5 text-sm">
          <div className="col-span-2 text-blue-400 font-mono text-xs">{item.row.wo_number}</div>
          <div className="col-span-3">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
              {item.row.status_code || '???'}
            </span>
          </div>
          <div className="col-span-7 text-slate-500 text-xs truncate">{item.row.status_raw}</div>
        </div>
      ))}
    </div>
  );
}

function MissingTable({ items }) {
  return (
    <div className="divide-y divide-[#1e1e2e]">
      <div className="px-4 py-2 text-xs text-slate-500 italic bg-[#0a0a0f]/50">
        These WOs exist in CBRE but not in your FSM database. They will be skipped during sync.
      </div>
      {items.map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 px-4 py-2.5 text-sm">
          <div className="col-span-2 text-blue-400 font-mono text-xs">{item.row.wo_number}</div>
          <div className="col-span-2 text-yellow-400 text-xs font-mono">{item.row.status_code}</div>
          <div className="col-span-3 text-slate-500 text-xs truncate">{item.row.building}</div>
          <div className="col-span-2 text-slate-500 text-xs">{item.row.city}, {item.row.state}</div>
          <div className="col-span-3 text-slate-600 text-xs">{item.row.entered_at}</div>
        </div>
      ))}
    </div>
  );
}

function MatchedTable({ items }) {
  return (
    <div className="divide-y divide-[#1e1e2e]">
      {items.slice(0, 50).map((item, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 px-4 py-2 text-sm">
          <div className="col-span-2 text-blue-400 font-mono text-xs">{item.row.wo_number}</div>
          <div className="col-span-2 text-emerald-400 text-xs font-mono">{item.row.status_code}</div>
          <div className="col-span-8 text-slate-500 text-xs truncate">{item.row.building}</div>
        </div>
      ))}
      {items.length > 50 && (
        <div className="px-4 py-2 text-xs text-slate-600 italic text-center">
          ... and {items.length - 50} more (hidden for performance)
        </div>
      )}
    </div>
  );
}
