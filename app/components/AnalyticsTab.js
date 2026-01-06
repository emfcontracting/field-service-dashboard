'use client';

import { useState, useEffect } from 'react';

export default function AnalyticsTab() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30); // days

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  async function fetchAnalytics() {
    setLoading(true);
    try {
      const response = await fetch(`/api/backend/analytics?days=${period}`);
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12">Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className="text-center py-12 text-red-600">Failed to load analytics</div>;
  }

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Analytics Period</h3>
          <div className="flex space-x-2">
            {[7, 14, 30, 60, 90].map(days => (
              <button
                key={days}
                onClick={() => setPeriod(days)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  period === days
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {days} Days
              </button>
            ))}
            <button
              onClick={fetchAnalytics}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Work Orders"
          value={analytics.overview.total}
          icon="📋"
          color="blue"
        />
        <StatCard
          title="Open Work Orders"
          value={analytics.overview.open}
          icon="🔓"
          color="yellow"
        />
        <StatCard
          title="Completed"
          value={analytics.overview.completed}
          icon="✅"
          color="green"
          subtitle={`${analytics.overview.completionRate}% completion rate`}
        />
        <StatCard
          title="Billed"
          value={analytics.overview.billed}
          icon="💰"
          color="purple"
        />
      </div>

      {/* Financial Metrics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-xl font-semibold mb-4">💵 Financial Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <FinancialMetric 
            label="Total NTE" 
            value={`$${parseFloat(analytics.financial.totalNTE).toLocaleString()}`}
          />
          <FinancialMetric 
            label="Total Cost" 
            value={`$${parseFloat(analytics.financial.totalCost).toLocaleString()}`}
          />
          <FinancialMetric 
            label="Total Billed" 
            value={`$${parseFloat(analytics.financial.totalBilled).toLocaleString()}`}
            highlight
          />
          <FinancialMetric 
            label="Quoted" 
            value={`$${parseFloat(analytics.financial.quotedAmount).toLocaleString()}`}
          />
          <FinancialMetric 
            label="Profit Margin" 
            value={`${analytics.financial.margin}%`}
            highlight
          />
          <FinancialMetric 
            label="Avg Job Cost" 
            value={`$${parseFloat(analytics.financial.averageJobCost).toLocaleString()}`}
          />
        </div>
      </div>

      {/* Work Orders by Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-xl font-semibold mb-4">📊 Work Orders by Status</h3>
          <div className="space-y-3">
            {Object.entries(analytics.byStatus).map(([status, count]) => (
              <ProgressBar
                key={status}
                label={status.replace(/_/g, ' ').toUpperCase()}
                value={count}
                max={analytics.overview.total}
                color={getStatusColor(status)}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-xl font-semibold mb-4">🎯 Work Orders by Priority</h3>
          <div className="space-y-3">
            {Object.entries(analytics.byPriority).map(([priority, count]) => (
              <ProgressBar
                key={priority}
                label={priority.toUpperCase()}
                value={count}
                max={analytics.overview.total}
                color={getPriorityColor(priority)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Aging Analysis */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-xl font-semibold mb-4">⏱️ Work Order Aging</h3>
        <div className="space-y-3">
          {analytics.aging.byRange.map((range) => (
            <ProgressBar
              key={range.range}
              label={range.range}
              value={range.count}
              max={Math.max(...analytics.aging.byRange.map(r => r.count))}
              color={range.color}
              showCount
            />
          ))}
        </div>
        {analytics.aging.critical > 0 && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">
              ⚠️ <strong>Alert:</strong> {analytics.aging.critical} work order(s) are over 30 days old and need immediate attention!
            </p>
          </div>
        )}
      </div>

      {/* Top Buildings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-xl font-semibold mb-4">🏢 Top 10 Buildings (Most Work Orders)</h3>
        <div className="space-y-3">
          {Object.entries(analytics.byBuilding).map(([building, count], index) => (
            <div key={building} className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold mr-3">
                {index + 1}
              </div>
              <div className="flex-1">
                <ProgressBar
                  label={building}
                  value={count}
                  max={Object.values(analytics.byBuilding)[0]}
                  color="#3b82f6"
                  showCount
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Technician Performance */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-xl font-semibold mb-4">👷 Technician Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Technician</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Jobs</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Completed</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">In Progress</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Pending</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Completion %</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(analytics.technicians).map(([name, stats]) => (
                <tr key={name} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{stats.role.replace('_', ' ')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 font-semibold">{stats.totalJobs}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      {stats.completed}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {stats.inProgress}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      {stats.pending}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900">{stats.totalHours}h</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      parseFloat(stats.completionRate) >= 80 ? 'bg-green-100 text-green-800' :
                      parseFloat(stats.completionRate) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {stats.completionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({ title, value, icon, color, subtitle }) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    purple: 'bg-purple-50 border-purple-200',
    red: 'bg-red-50 border-red-200'
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-600">{title}</div>
        <div className="text-2xl">{icon}</div>
      </div>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {subtitle && (
        <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      )}
    </div>
  );
}

function FinancialMetric({ label, value, highlight }) {
  return (
    <div className={`p-4 rounded-lg ${highlight ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50'}`}>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>
        {value}
      </div>
    </div>
  );
}

function ProgressBar({ label, value, max, color, showCount }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {showCount && <span className="text-sm font-semibold text-gray-900">{value}</span>}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
        <div
          className="h-6 flex items-center justify-end pr-2 text-white text-xs font-semibold transition-all duration-300"
          style={{
            width: `${Math.max(percentage, 5)}%`,
            backgroundColor: color
          }}
        >
          {!showCount && value}
        </div>
      </div>
    </div>
  );
}

function getStatusColor(status) {
  const colors = {
    pending: '#f59e0b',
    assigned: '#3b82f6',
    in_progress: '#8b5cf6',
    completed: '#10b981',
    cancelled: '#6b7280',
    on_hold: '#ef4444'
  };
  return colors[status] || '#6b7280';
}

function getPriorityColor(priority) {
  const colors = {
    emergency: '#991b1b',
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#10b981'
  };
  return colors[priority] || '#6b7280';
}
