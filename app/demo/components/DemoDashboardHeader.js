// app/demo/components/DemoDashboardHeader.js
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DemoDashboardHeader({ activeView, setActiveView, missingHoursCount = 0 }) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  
  // View navigation tabs
  const viewTabs = [
    { id: 'workorders', label: 'Work Orders', shortLabel: 'WOs', icon: '📋' },
    { id: 'calendar', label: 'Calendar', shortLabel: 'Cal', icon: '📅' },
    { id: 'aging', label: 'Aging', shortLabel: 'Age', icon: '⚠️' },
    { id: 'missing-hours', label: 'Missing Hours', shortLabel: 'Hours', icon: '⏰', badge: missingHoursCount },
    { id: 'availability', label: 'Availability', shortLabel: 'Avail', icon: '👥' },
  ];

  return (
    <div className="mb-4 sm:mb-6">
      {/* Top row - Logo and quick actions */}
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-xl sm:text-2xl">⚡</span>
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold">PCS FieldService</h1>
            <p className="text-xs sm:text-sm text-gray-400 hidden xs:block">Field Service Dashboard • Demo Mode</p>
            <p className="text-xs text-gray-400 xs:hidden">Demo Mode</p>
          </div>
        </div>
        
        {/* Desktop Quick action buttons */}
        <div className="hidden md:flex gap-2">
          <Link
            href="/demo"
            className="bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            ← Demo Home
          </Link>
          <Link
            href="/demo/mobile"
            className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
          >
            📱 Mobile App
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

        {/* Mobile Menu Button */}
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="md:hidden bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg"
        >
          <span className="text-xl">{showMobileMenu ? '✕' : '☰'}</span>
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {showMobileMenu && (
        <div className="md:hidden bg-gray-800 rounded-lg p-3 mb-3 space-y-2">
          <Link
            href="/demo"
            className="block bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg font-semibold transition text-sm text-center"
            onClick={() => setShowMobileMenu(false)}
          >
            ← Demo Home
          </Link>
          <Link
            href="/demo/mobile"
            className="block bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg font-semibold transition text-sm text-center"
            onClick={() => setShowMobileMenu(false)}
          >
            📱 Mobile App
          </Link>
          <Link
            href="/demo/invoices"
            className="block bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg font-semibold transition text-sm text-center"
            onClick={() => setShowMobileMenu(false)}
          >
            💰 Invoicing
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                alert('Users page available in full version');
                setShowMobileMenu(false);
              }}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
            >
              👥 Users
            </button>
            <button
              onClick={() => {
                alert('Settings page available in full version');
                setShowMobileMenu(false);
              }}
              className="bg-gray-600 hover:bg-gray-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
            >
              ⚙️ Settings
            </button>
          </div>
        </div>
      )}

      {/* View tabs - Scrollable on mobile */}
      <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg w-fit min-w-full sm:min-w-0">
          {viewTabs.map(tab => {
            const isActive = activeView === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`
                  flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 rounded-md font-semibold transition relative whitespace-nowrap text-xs sm:text-sm flex-1 sm:flex-none justify-center sm:justify-start
                  ${isActive 
                    ? tab.id === 'aging' 
                      ? 'bg-red-600 text-white' 
                      : tab.id === 'missing-hours'
                        ? 'bg-orange-600 text-white'
                        : 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }
                `}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                {tab.badge > 0 && (
                  <span className={`
                    px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs rounded-full font-bold
                    ${isActive ? 'bg-white/20' : 'bg-orange-600 text-white'}
                  `}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
