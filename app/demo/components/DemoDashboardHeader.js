// app/demo/components/DemoDashboardHeader.js
'use client';

import Link from 'next/link';

export default function DemoDashboardHeader({ activeView, setActiveView }) {
  // View navigation tabs
  const viewTabs = [
    { id: 'workorders', label: 'Work Orders', icon: '📋' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'aging', label: 'Aging', icon: '⚠️' },
    { id: 'availability', label: 'Availability', icon: '👥' },
  ];

  return (
    <div className="mb-6">
      {/* Top row - Logo and quick actions */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-2xl">⚡</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">PCS FieldService</h1>
            <p className="text-sm text-gray-400">Field Service Dashboard</p>
          </div>
        </div>
        
        {/* Quick action buttons */}
        <div className="flex gap-2">
          <Link
            href="/demo"
            className="bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            ← Demo Home
          </Link>
          <Link
            href="/demo/invoices"
            className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            💰 Invoicing
          </Link>
          <button
            onClick={() => alert('Users page available in full version')}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            👥 Users
          </button>
          <button
            onClick={() => alert('Settings page available in full version')}
            className="bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            ⚙️ Settings
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
                flex items-center gap-2 px-4 py-2 rounded-md font-semibold transition
                ${isActive 
                  ? tab.id === 'aging' 
                    ? 'bg-red-600 text-white' 
                    : 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }
              `}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
