'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

export default function BackendDashboard() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('health');
  
  // State for different sections
  const [healthData, setHealthData] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logStats, setLogStats] = useState(null);
  const [triggering, setTriggering] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Log filters
  const [logType, setLogType] = useState('all');
  const [logStatus, setLogStatus] = useState('');
  const [logLimit, setLogLimit] = useState(100);

  // Initialize and fetch health data
  useEffect(() => {
    fetchHealthData();
  }, []);

  // Auto refresh health data
  useEffect(() => {
    if (autoRefresh && activeTab === 'health') {
      const interval = setInterval(() => {
        fetchHealthData();
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [autoRefresh, activeTab]);

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === 'health') {
      fetchHealthData();
    } else if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [activeTab, logType, logStatus, logLimit]);

  async function fetchHealthData() {
    try {
      const response = await fetch('/api/backend/health');
      const data = await response.json();
      setHealthData(data);
    } catch (error) {
      console.error('Failed to fetch health data:', error);
    }
  }

  async function fetchLogs() {
    try {
      const params = new URLSearchParams({
        type: logType,
        limit: logLimit.toString()
      });
      
      if (logStatus) {
        params.append('status', logStatus);
      }

      const response = await fetch(`/api/backend/logs?${params}`);
      const data = await response.json();
      setLogs(data.logs || []);
      setLogStats(data.stats || null);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  }

  async function trigger(action, params = {}) {
    setTriggering(action);
    try {
      const response = await fetch('/api/backend/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`✓ ${data.message}\n\nDetails: ${JSON.stringify(data.details, null, 2)}`);
        
        // Refresh health data and logs
        await fetchHealthData();
        await fetchLogs();
      } else {
        alert(`✗ ${data.message || 'Action failed'}\n\nError: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert(`✗ Failed to trigger ${action}\n\nError: ${error.message}`);
    } finally {
      setTriggering(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">🛠️ Backend Dashboard</h1>
                <p className="mt-1 text-sm text-gray-500">
                  System monitoring and administration
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  ← Back to Dashboard
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-t border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {['health', 'triggers', 'logs', 'database'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    py-4 px-1 border-b-2 font-medium text-sm capitalize
                    ${activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Health Tab */}
        {activeTab === 'health' && (
          <HealthTab 
            healthData={healthData}
            autoRefresh={autoRefresh}
            setAutoRefresh={setAutoRefresh}
            onRefresh={fetchHealthData}
          />
        )}

        {/* Triggers Tab */}
        {activeTab === 'triggers' && (
          <TriggersTab trigger={trigger} triggering={triggering} />
        )}

        {/* Logs Tab */}
        {activeTab === 'logs' && (
          <LogsTab
            logs={logs}
            stats={logStats}
            logType={logType}
            setLogType={setLogType}
            logStatus={logStatus}
            setLogStatus={setLogStatus}
            logLimit={logLimit}
            setLogLimit={setLogLimit}
            onRefresh={fetchLogs}
          />
        )}

        {/* Database Tab */}
        {activeTab === 'database' && (
          <DatabaseTab />
        )}
      </div>
    </div>
  );
}

// Health Tab Component
function HealthTab({ healthData, autoRefresh, setAutoRefresh, onRefresh }) {
  if (!healthData) {
    return <div className="text-center py-12">Loading health data...</div>;
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
      case 'success':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
      case 'success':
        return '✓';
      case 'warning':
        return '⚠️';
      case 'error':
      case 'failed':
        return '✗';
      default:
        return '?';
    }
  };

  return (
    <div className="space-y-6">
      {/* Overall Status */}
      <div className={`p-6 rounded-lg border-2 ${getStatusColor(healthData.status)}`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center">
              <span className="mr-3">{getStatusIcon(healthData.status)}</span>
              System Status: {healthData.status.toUpperCase()}
            </h2>
            <p className="mt-1 text-sm opacity-75">
              Last checked: {new Date(healthData.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span>Auto-refresh (30s)</span>
            </label>
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
            >
              🔄 Refresh Now
            </button>
          </div>
        </div>
      </div>

      {/* Health Checks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(healthData.checks).map(([key, check]) => (
          <div key={key} className={`p-6 rounded-lg border ${getStatusColor(check.status)}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold capitalize flex items-center">
                  <span className="mr-2">{getStatusIcon(check.status)}</span>
                  {key.replace(/_/g, ' ')}
                </h3>
                <p className="mt-2 text-sm opacity-90">
                  {check.message}
                </p>
                
                {/* Additional details */}
                {check.lastRun && (
                  <p className="mt-1 text-xs opacity-75">
                    Last run: {new Date(check.lastRun).toLocaleString()}
                  </p>
                )}
                {check.sentToday !== undefined && (
                  <div className="mt-2 text-xs space-y-1">
                    <p>📧 Sent today: {check.sentToday}</p>
                    <p>❌ Failed today: {check.failedToday}</p>
                    <p>📊 Success rate: {check.successRate}</p>
                  </div>
                )}
                {check.minutesAgo !== undefined && check.minutesAgo !== null && (
                  <p className="mt-1 text-xs opacity-75">
                    {check.minutesAgo < 60 
                      ? `${check.minutesAgo} minutes ago`
                      : `${Math.floor(check.minutesAgo / 60)} hours ago`
                    }
                  </p>
                )}

                {/* Cron Jobs Details */}
                {key === 'cronJobs' && typeof check === 'object' && (
                  <div className="mt-3 space-y-2">
                    {Object.entries(check).filter(([k]) => k !== 'status').map(([jobKey, jobData]) => (
                      <div key={jobKey} className="text-xs bg-white bg-opacity-50 p-2 rounded">
                        <div className="font-semibold capitalize">{jobKey.replace(/_/g, ' ')}</div>
                        <div className="opacity-75">
                          Status: {jobData.status || 'unknown'}
                        </div>
                        {jobData.lastRun && (
                          <div className="opacity-75">
                            Last: {new Date(jobData.lastRun).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Triggers Tab Component
function TriggersTab({ trigger, triggering }) {
  const triggers = [
    {
      id: 'email_import',
      name: 'Force Email Import',
      description: 'Manually trigger the IMAP email import cron job',
      icon: '📧',
      color: 'blue'
    },
    {
      id: 'availability_reminder',
      name: 'Send Availability Reminder',
      description: 'Send availability reminder to all technicians',
      icon: '📅',
      color: 'green'
    },
    {
      id: 'aging_alert',
      name: 'Trigger Aging Alert',
      description: 'Send aging work order alerts',
      icon: '⚠️',
      color: 'yellow'
    },
    {
      id: 'sync_email_status',
      name: 'Sync Email Status',
      description: 'Sync work order status from Gmail labels',
      icon: '🔄',
      color: 'purple'
    },
    {
      id: 'test_notification',
      name: 'Test Notification',
      description: 'Send a test email notification',
      icon: '✉️',
      color: 'pink'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
      green: 'bg-green-50 border-green-200 hover:bg-green-100',
      yellow: 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100',
      purple: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
      pink: 'bg-pink-50 border-pink-200 hover:bg-pink-100'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          ℹ️ <strong>Manual Triggers:</strong> Use these controls to manually execute system operations. 
          Results will be logged in the system logs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {triggers.map((item) => (
          <button
            key={item.id}
            onClick={() => trigger(item.id)}
            disabled={triggering === item.id}
            className={`
              p-6 rounded-lg border-2 text-left transition-all
              ${getColorClasses(item.color)}
              ${triggering === item.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="text-4xl mb-3">{item.icon}</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {item.name}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {item.description}
            </p>
            {triggering === item.id && (
              <div className="flex items-center text-sm text-gray-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                Executing...
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// Logs Tab Component
function LogsTab({ logs, stats, logType, setLogType, logStatus, setLogStatus, logLimit, setLogLimit, onRefresh }) {
  const logTypes = ['all', 'email_import', 'availability_reminder', 'aging_alert', 'manual_trigger', 'notification', 'error'];
  const statusTypes = ['', 'success', 'failed', 'warning', 'info'];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Log Filters</h3>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            🔄 Refresh
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Log Type
            </label>
            <select
              value={logType}
              onChange={(e) => setLogType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              {logTypes.map(type => (
                <option key={type} value={type}>
                  {type === 'all' ? 'All Types' : type.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={logStatus}
              onChange={(e) => setLogStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              {statusTypes.map(status => (
                <option key={status} value={status}>
                  {status === '' ? 'All Statuses' : status.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Limit
            </label>
            <select
              value={logLimit}
              onChange={(e) => setLogLimit(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              <option value="50">50 logs</option>
              <option value="100">100 logs</option>
              <option value="200">200 logs</option>
              <option value="500">500 logs</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Total Logs</div>
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Last Hour</div>
            <div className="text-2xl font-bold text-blue-600">{stats.recent.lastHour}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Last 24 Hours</div>
            <div className="text-2xl font-bold text-green-600">{stats.recent.last24Hours}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Last Week</div>
            <div className="text-2xl font-bold text-purple-600">{stats.recent.lastWeek}</div>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                    No logs found
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {log.log_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        log.status === 'success' ? 'bg-green-100 text-green-800' :
                        log.status === 'failed' || log.status === 'error' ? 'bg-red-100 text-red-800' :
                        log.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {log.status || 'info'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-md truncate" title={log.message}>
                        {log.message}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="mt-1">
                          <summary className="text-xs text-blue-600 cursor-pointer">View metadata</summary>
                          <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
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
      </div>
    </div>
  );
}

// Database Tab Component
function DatabaseTab() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchDatabaseStats();
  }, []);

  async function fetchDatabaseStats() {
    setLoading(true);
    try {
      // Fetch counts from various tables
      const tables = [
        'work_orders',
        'users',
        'notifications',
        'daily_hours_log',
        'team_members',
        'contractor_invoices',
        'system_logs'
      ];

      const counts = {};
      
      for (const table of tables) {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        counts[table] = error ? 'Error' : count;
      }

      setStats(counts);
    } catch (error) {
      console.error('Failed to fetch database stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading database stats...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold">Database Statistics</h3>
          <button
            onClick={fetchDatabaseStats}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats && Object.entries(stats).map(([table, count]) => (
            <div key={table} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="text-sm text-gray-600 capitalize mb-1">
                {table.replace(/_/g, ' ')}
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {count !== 'Error' ? count.toLocaleString() : '⚠️'}
              </div>
              {count === 'Error' && (
                <div className="text-xs text-red-600 mt-1">Failed to fetch</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          ⚠️ <strong>Note:</strong> Direct database operations should be performed carefully. 
          Always test queries in a development environment first.
        </p>
      </div>
    </div>
  );
}
