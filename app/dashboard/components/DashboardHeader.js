// app/dashboard/components/DashboardHeader.js
'use client';

export default function DashboardHeader({ activeView, setActiveView }) {
  return (
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-4">
        <img 
          src="/emf-logo.png" 
          alt="EMF Contracting LLC" 
          className="h-12 w-auto"
        />
        <div>
          <h1 className="text-2xl font-bold">EMF Contracting LLC</h1>
          <p className="text-sm text-gray-400">Field Service Dashboard</p>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setActiveView(activeView === 'availability' ? 'workorders' : 'availability')}
          className={`${activeView === 'availability' ? 'bg-green-700' : 'bg-green-600'} hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition`}
        >
          {activeView === 'availability' ? '← Back to Work Orders' : '📅 Availability'}
        </button>
        <button
          onClick={() => window.location.href = '/'}
          className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg font-semibold transition"
        >
          🏠 Home
        </button>
        <button
          onClick={() => window.location.href = '/invoices'}
          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold transition"
        >
          💰 Invoicing
        </button>
        <button
          onClick={() => window.location.href = '/users'}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition"
        >
          👥 Users
        </button>
        <button
          onClick={() => window.location.href = '/settings'}
          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold transition"
        >
          ⚙️ Settings
        </button>
        <button
          onClick={() => window.location.href = '/mobile'}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition"
        >
          📱 Mobile App
        </button>
      </div>
    </div>
  );
}