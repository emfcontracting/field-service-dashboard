// app/dashboard/components/DashboardHeader.js
'use client';

export default function DashboardHeader({ activeView, setActiveView, missingHoursCount = 0, onGlobalSearch }) {
  // View navigation tabs
  const viewTabs = [
    { id: 'workorders', label: 'Work Orders', icon: '📋' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'aging', label: 'Aging', icon: '⏰' },
    { id: 'missing-hours', label: 'Missing Hours', icon: '⚠️', alert: missingHoursCount > 0 },
    { id: 'availability', label: 'Availability', icon: '👥' },
  ];

  return (
    <div className="mb-6">
      {/* Top row - Logo and quick actions */}
      <div className="flex justify-between items-center mb-4">
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
        
        {/* Quick action buttons */}
        <div className="flex gap-2">
          {onGlobalSearch && (
            <button
              onClick={onGlobalSearch}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
            >
              🔍 Search All
            </button>
          )}
          <button
            onClick={() => window.location.href = '/'}
            className="bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            🏠 Home
          </button>
          <button
            onClick={() => window.location.href = '/weather'}
            className="bg-sky-600 hover:bg-sky-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            🌤️ Weather
          </button>
          <button
            onClick={() => window.location.href = '/messages'}
            className="bg-teal-600 hover:bg-teal-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            💬 Messages
          </button>
          <button
            onClick={() => window.location.href = '/invoices'}
            className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            💰 Invoicing
          </button>
          <button
            onClick={() => window.location.href = '/users'}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            👥 Users
          </button>
          <button
            onClick={() => window.location.href = '/settings'}
            className="bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            ⚙️ Settings
          </button>
          <button
            onClick={() => window.location.href = '/mobile'}
            className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            📱 Mobile
          </button>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 bg-gray-800 p-1 rounded-lg w-fit">
        {viewTabs.map(tab => {
          const isActive = activeView === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition relative
                ${isActive 
                  ? tab.id === 'missing-hours'
                    ? 'bg-orange-600 text-white'
                    : tab.id === 'aging' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }
              `}
            >
              <span>{tab.icon}</span>
              {tab.label}
              {/* Alert badge for missing hours */}
              {tab.alert && !isActive && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                  {missingHoursCount > 99 ? '99+' : missingHoursCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
