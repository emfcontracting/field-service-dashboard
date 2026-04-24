'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import AnalyticsTab from '@/app/components/AnalyticsTab';
import BulkOperationsTab from '@/app/components/BulkOperationsTab';
import BackendTriggerResultModal from '@/app/dashboard/components/BackendTriggerResultModal';

// ── UI primitives ────────────────────────────────────────────────────────────
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
    ghost:   'text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2e]',
  };
  const s = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed ${v[variant]} ${s[size]} ${className}`}>
      {children}
    </button>
  );
};

const StatusBadge = ({ status }) => {
  const cfg = {
    healthy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    error:   'bg-red-500/15 text-red-400 border-red-500/30',
    failed:  'bg-red-500/15 text-red-400 border-red-500/30',
    info:    'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };
  const icons = { healthy:'✓', success:'✓', warning:'⚠', error:'✗', failed:'✗', info:'i' };
  const cls = cfg[status] || 'bg-slate-500/15 text-slate-400 border-slate-500/30';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border uppercase ${cls}`}>
      {icons[status] || '?'} {status}
    </span>
  );
};

// ── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color = 'text-slate-200' }) => (
  <Card>
    <div className="px-5 py-4">
      <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
    </div>
  </Card>
);

// ════════════════════════════════════════════════════════════════════════════
// ── Health Tab ───────────────────────────────────────────────────────────────
function HealthTab({ healthData, autoRefresh, setAutoRefresh, onRefresh }) {
  if (!healthData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
          <p className="text-slate-500 text-sm">Loading health data…</p>
        </div>
      </div>
    );
  }

  const overall = healthData.status;
  const overallCfg = {
    healthy: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-yellow-500/30 bg-yellow-500/5',
    error:   'border-red-500/30 bg-red-500/5',
  };

  return (
    <div className="space-y-5">
      {/* Overall status banner */}
      <div className={`rounded-xl border p-5 flex items-center justify-between ${overallCfg[overall] || 'border-[#1e1e2e]'}`}>
        <div className="flex items-center gap-3">
          <StatusBadge status={overall} />
          <div>
            <p className="font-bold text-slate-100">System Status</p>
            <p className="text-slate-500 text-xs">Last checked: {new Date(healthData.timestamp).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
            <div onClick={() => setAutoRefresh(p => !p)}
              className={`w-8 h-4 rounded-full transition-colors relative cursor-pointer
                ${autoRefresh ? 'bg-blue-600' : 'bg-[#2d2d44]'}`}>
              <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform
                ${autoRefresh ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            Auto-refresh (30s)
          </label>
          <Btn onClick={onRefresh} variant="default" size="sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </Btn>
        </div>
      </div>

      {/* Checks grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(healthData.checks).map(([key, check]) => (
          <Card key={key} className={
            check.status === 'healthy' || check.status === 'success' ? 'border-emerald-500/20' :
            check.status === 'warning' ? 'border-yellow-500/20' :
            check.status === 'error' || check.status === 'failed' ? 'border-red-500/20' : ''
          }>
            <CardBody>
              <div className="flex items-start justify-between mb-3">
                <p className="font-semibold text-slate-200 text-sm capitalize">{key.replace(/_/g, ' ')}</p>
                <StatusBadge status={check.status} />
              </div>
              <p className="text-slate-500 text-xs leading-relaxed mb-2">{check.message}</p>
              {check.lastRun && (
                <p className="text-slate-700 text-[10px]">Last run: {new Date(check.lastRun).toLocaleString()}</p>
              )}
              {check.sentToday !== undefined && (
                <div className="mt-2 space-y-0.5 text-[10px] text-slate-600">
                  <p>📧 Sent today: <span className="text-emerald-400">{check.sentToday}</span></p>
                  <p>❌ Failed: <span className="text-red-400">{check.failedToday}</span></p>
                  <p>📊 Success rate: <span className="text-blue-400">{check.successRate}</span></p>
                </div>
              )}
              {check.minutesAgo !== undefined && check.minutesAgo !== null && (
                <p className="text-slate-700 text-[10px] mt-1">
                  {check.minutesAgo < 60
                    ? `${check.minutesAgo}m ago`
                    : `${Math.floor(check.minutesAgo / 60)}h ago`}
                </p>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Triggers Tab ─────────────────────────────────────────────────────────────
function TriggersTab({ trigger, triggering }) {
  const triggers = [
    { id: 'email_import',          name: 'Force Email Import',       desc: 'Manually trigger the IMAP email import cron job',  icon: '📧', color: 'blue' },
    { id: 'availability_reminder', name: 'Availability Reminder',    desc: 'Send availability reminder to all technicians',     icon: '📅', color: 'emerald' },
    { id: 'aging_alert',           name: 'Aging Work Order Alert',   desc: 'Send aging work order alerts to assigned techs',    icon: '⚠️', color: 'yellow' },
    { id: 'sync_email_status',     name: 'Sync Email Status',        desc: 'Sync work order status from Gmail labels',          icon: '🔄', color: 'purple' },
    { id: 'test_notification',     name: 'Test Notification',        desc: 'Send a test email notification to verify setup',    icon: '✉️', color: 'slate' },
  ];

  const borderColor = { blue:'border-blue-500/20 hover:border-blue-500/40', emerald:'border-emerald-500/20 hover:border-emerald-500/40', yellow:'border-yellow-500/20 hover:border-yellow-500/40', purple:'border-purple-500/20 hover:border-purple-500/40', slate:'border-slate-500/20 hover:border-slate-500/40' };
  const iconBg = { blue:'bg-blue-500/10', emerald:'bg-emerald-500/10', yellow:'bg-yellow-500/10', purple:'bg-purple-500/10', slate:'bg-slate-500/10' };

  return (
    <div className="space-y-5">
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
        <p className="text-xs text-slate-500">
          <span className="text-blue-400 font-semibold">Manual Triggers</span> — Use these to manually execute system operations. Results are logged in system logs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {triggers.map(item => {
          const isRunning = triggering === item.id;
          return (
            <button key={item.id} onClick={() => trigger(item.id)} disabled={!!triggering}
              className={`text-left p-5 bg-[#0d0d14] rounded-xl border transition
                ${borderColor[item.color]} ${triggering && !isRunning ? 'opacity-40' : ''}`}>
              <div className={`w-10 h-10 rounded-xl ${iconBg[item.color]} flex items-center justify-center text-xl mb-3`}>
                {isRunning
                  ? <div className="w-5 h-5 rounded-full border-2 border-slate-400/30 border-t-slate-400 animate-spin" />
                  : item.icon
                }
              </div>
              <p className="font-semibold text-slate-200 text-sm mb-1">{item.name}</p>
              <p className="text-slate-600 text-xs leading-relaxed">{item.desc}</p>
              {isRunning && <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">Executing…</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Logs Tab ─────────────────────────────────────────────────────────────────
function LogsTab({ logs, stats, logType, setLogType, logStatus, setLogStatus, logLimit, setLogLimit, onRefresh }) {
  const LOG_TYPES   = ['all','email_import','availability_reminder','aging_alert','manual_trigger','notification','error'];
  const STATUS_OPTS = ['','success','failed','warning','info'];

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Total Logs"    value={stats.total}                color="text-slate-200" />
          <StatCard label="Last Hour"     value={stats.recent?.lastHour}     color="text-blue-400" />
          <StatCard label="Last 24 Hours" value={stats.recent?.last24Hours}  color="text-emerald-400" />
          <StatCard label="Last Week"     value={stats.recent?.lastWeek}     color="text-purple-400" />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Filters</h3>
          <Btn onClick={onRefresh} variant="default" size="sm">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </Btn>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label:'Log Type', value:logType, onChange:setLogType, opts:LOG_TYPES.map(t => ({ v:t, l:t==='all'?'All Types':t.replace(/_/g,' ').toUpperCase() })) },
              { label:'Status',   value:logStatus, onChange:setLogStatus, opts:STATUS_OPTS.map(s => ({ v:s, l:s===''?'All Statuses':s.toUpperCase() })) },
              { label:'Limit',    value:logLimit,  onChange:v => setLogLimit(parseInt(v)), opts:[50,100,200,500].map(n => ({ v:n, l:`${n} logs` })) },
            ].map(f => (
              <div key={f.label}>
                <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">{f.label}</label>
                <select value={f.value} onChange={e => f.onChange(e.target.value)}
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/60 transition">
                  {f.opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Logs table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                {['Time','Type','Status','Message'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-[10px] text-slate-600 uppercase tracking-widest font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e1e2e]">
              {logs.length === 0 ? (
                <tr><td colSpan="4" className="px-5 py-12 text-center text-slate-600 text-sm">No logs found</td></tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-[#1e1e2e]/30 transition">
                    <td className="px-5 py-3 text-xs text-slate-600 font-mono whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full font-semibold">
                        {log.log_type}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={log.status || 'info'} />
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs max-w-md">
                      <div className="truncate" title={log.message}>{log.message}</div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="mt-1">
                          <summary className="text-blue-400 cursor-pointer hover:text-blue-300">Metadata</summary>
                          <pre className="mt-1.5 text-[10px] bg-[#0a0a0f] border border-[#1e1e2e] p-2 rounded-lg overflow-auto max-h-32 text-slate-500">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Database Tab ─────────────────────────────────────────────────────────────
function DatabaseTab() {
  const [dbStats, setDbStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => { fetchStats(); }, []);

  async function fetchStats() {
    setLoading(true);
    const tables = ['work_orders','users','notifications','daily_hours_log','system_logs'];
    const counts = {};
    for (const t of tables) {
      try {
        const { count, error } = await supabase.from(t).select('*', { count:'exact', head:true });
        counts[t] = error ? null : (count ?? 0);
      } catch { counts[t] = null; }
    }
    setDbStats(counts);
    setLoading(false);
  }

  const TABLE_ICONS = { work_orders:'📋', users:'👥', notifications:'🔔', daily_hours_log:'⏱️', system_logs:'📜' };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Btn onClick={fetchStats} disabled={loading} variant="default" size="sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={loading ? 'animate-spin' : ''}><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          Refresh
        </Btn>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {dbStats && Object.entries(dbStats).map(([table, count]) => (
            <Card key={table}>
              <CardBody>
                <div className="text-2xl mb-2">{TABLE_ICONS[table] || '🗄️'}</div>
                <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-1 capitalize">{table.replace(/_/g,' ')}</p>
                {count === null
                  ? <p className="text-red-400 text-xs font-semibold">Not found</p>
                  : <p className="text-2xl font-bold font-mono text-slate-200">{count.toLocaleString()}</p>
                }
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-4 flex items-start gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400 flex-shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <p className="text-yellow-400 text-xs">Direct database operations should be performed carefully. Always test in development first.</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── Main page ────────────────────────────────────────────────────────────────
const TABS = [
  { id:'health',    label:'Health',     icon:'💚' },
  { id:'analytics', label:'Analytics',  icon:'📊' },
  { id:'bulk-ops',  label:'Bulk Ops',   icon:'⚙️' },
  { id:'triggers',  label:'Triggers',   icon:'⚡' },
  { id:'logs',      label:'Logs',       icon:'📜' },
  { id:'database',  label:'Database',   icon:'🗄️' },
];

export default function BackendDashboard() {
  const [activeTab, setActiveTab]   = useState('health');
  const [healthData, setHealthData] = useState(null);
  const [logs, setLogs]             = useState([]);
  const [logStats, setLogStats]     = useState(null);
  const [triggering, setTriggering] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [logType, setLogType]       = useState('all');
  const [logStatus, setLogStatus]   = useState('');
  const [logLimit, setLogLimit]     = useState(100);
  const [triggerResult, setTriggerResult] = useState(null);

  useEffect(() => { fetchHealthData(); }, []);

  useEffect(() => {
    if (autoRefresh && activeTab === 'health') {
      const iv = setInterval(fetchHealthData, 30000);
      return () => clearInterval(iv);
    }
  }, [autoRefresh, activeTab]);

  useEffect(() => {
    if (activeTab === 'health') fetchHealthData();
    else if (activeTab === 'logs') fetchLogs();
  }, [activeTab, logType, logStatus, logLimit]);

  async function fetchHealthData() {
    try {
      const res = await fetch('/api/backend/health');
      setHealthData(await res.json());
    } catch (err) { console.error(err); }
  }

  async function fetchLogs() {
    try {
      const p = new URLSearchParams({ type: logType, limit: logLimit.toString() });
      if (logStatus) p.append('status', logStatus);
      const res  = await fetch(`/api/backend/logs?${p}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setLogStats(data.stats || null);
    } catch (err) { console.error(err); }
  }

  async function trigger(action, params = {}) {
    setTriggering(action);
    try {
      const res  = await fetch('/api/backend/trigger', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params }),
      });
      const data = await res.json();
      // Show structured result modal instead of alert(JSON.stringify(...))
      setTriggerResult({ ...data, action: data.action || action });
      fetchHealthData(); fetchLogs();
    } catch (err) {
      setTriggerResult({
        success: false,
        action,
        message: `Failed: ${err.message}`,
        details: null,
        timestamp: new Date().toISOString(),
      });
    }
    finally { setTriggering(null); }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200">

        {/* ── Header ── */}
        <div className="border-b border-[#1e1e2e] bg-[#0d0d14] px-6 py-5">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-100">Backend Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">System monitoring and administration</p>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="border-b border-[#1e1e2e] bg-[#0d0d14] px-6">
          <div className="max-w-7xl mx-auto flex gap-1 overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold border-b-2 transition whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="max-w-7xl mx-auto px-6 py-6">
          {activeTab === 'health'    && <HealthTab healthData={healthData} autoRefresh={autoRefresh} setAutoRefresh={setAutoRefresh} onRefresh={fetchHealthData} />}
          {activeTab === 'analytics' && <AnalyticsTab />}
          {activeTab === 'bulk-ops'  && <BulkOperationsTab />}
          {activeTab === 'triggers'  && <TriggersTab trigger={trigger} triggering={triggering} />}
          {activeTab === 'logs'      && <LogsTab logs={logs} stats={logStats} logType={logType} setLogType={setLogType} logStatus={logStatus} setLogStatus={setLogStatus} logLimit={logLimit} setLogLimit={setLogLimit} onRefresh={fetchLogs} />}
          {activeTab === 'database'  && <DatabaseTab />}
        </div>

        {/* ── Trigger result modal ── */}
        {triggerResult && (
          <BackendTriggerResultModal
            result={triggerResult}
            onClose={() => setTriggerResult(null)}
          />
        )}
    </div>
  );
}
