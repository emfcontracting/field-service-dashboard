// app/dashboard/components/StatsCards.js
'use client';

export default function StatsCards({ stats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-gray-400 text-sm">Total</div>
        <div className="text-3xl font-bold">{stats.total}</div>
      </div>
      <div className="bg-gray-700 rounded-lg p-4">
        <div className="text-gray-400 text-sm">Pending</div>
        <div className="text-3xl font-bold">{stats.pending}</div>
      </div>
      <div className="bg-blue-900 rounded-lg p-4">
        <div className="text-blue-300 text-sm">Assigned</div>
        <div className="text-3xl font-bold">{stats.assigned}</div>
      </div>
      <div className="bg-yellow-900 rounded-lg p-4">
        <div className="text-yellow-300 text-sm">In Progress</div>
        <div className="text-3xl font-bold">{stats.in_progress}</div>
      </div>
      <div className="bg-purple-900 rounded-lg p-4">
        <div className="text-purple-300 text-sm">Needs Return</div>
        <div className="text-3xl font-bold">{stats.needs_return}</div>
      </div>
      <div className="bg-green-900 rounded-lg p-4">
        <div className="text-green-300 text-sm">Completed</div>
        <div className="text-3xl font-bold">{stats.completed}</div>
      </div>
    </div>
  );
}