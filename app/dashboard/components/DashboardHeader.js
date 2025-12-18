// app/dashboard/components/DashboardHeader.js
'use client';

import { useState } from 'react';
import { useMobileDetect } from '../hooks/useMobileDetect';

export default function DashboardHeader({ activeView, setActiveView, missingHoursCount = 0, onGlobalSearch }) {
  const { isMobile, isTablet } = useMobileDetect();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);

  // View navigation tabs
  const viewTabs = [
    { id: 'workorders', label: 'Work Orders', icon: '📋' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
    { id: 'aging', label: 'Aging', icon: '⏰' },
    { id: 'missing-hours', label: 'Missing Hours', icon: '⚠️', alert: missingHoursCount > 0 },
    { id: 'availability', label: 'Availability', icon: '👥' },
  ];

  // Quick action links
  const quickLinks = [
    { href: '/', label: 'Home', icon: '🏠', color: 'bg-gray-600 hover:bg-gray-700' },
    { href: '/weather', label: 'Weather', icon: '🌤️', color: 'bg-sky-600 hover:bg-sky-700' },
    { href: '/messages', label: 'Messages', icon: '💬', color: 'bg-teal-600 hover:bg-teal-700' },
    { href: '/invoices', label: 'Invoicing', icon: '💰', color: 'bg-purple-600 hover:bg-purple-700' },
    { href: '/users', label: 'Users', icon: '👥', color: 'bg-blue-600 hover:bg-blue-700' },
    { href: '/settings', label: 'Settings', icon: '⚙️', color: 'bg-gray-600 hover:bg-gray-700' },
    { href: '/mobile', label: 'Mobile', icon: '📱', color: 'bg-green-600 hover:bg-green-700' },
  ];

  const handleViewChange = (viewId) => {
    setActiveView(viewId);
    setNavMenuOpen(false);
  };

  const handleQuickLink = (href) => {
    window.location.href = href;
    setMenuOpen(false);
  };

  // Mobile Layout
  if (isMobile) {
    return (
      <div className="mb-4">
        {/* Mobile Header Row */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <img 
              src="/emf-logo.png" 
              alt="EMF" 
              className="h-8 w-auto"
            />
            <div>
              <h1 className="text-lg font-bold">EMF Contracting</h1>
              <p className="text-xs text-gray-400">Field Service</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {/* Search Button */}
            {onGlobalSearch && (
              <button
                onClick={onGlobalSearch}
                className="bg-blue-600 hover:bg-blue-700 p-2 rounded-lg transition"
                aria-label="Search"
              >
                🔍
              </button>
            )}
            
            {/* Quick Links Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="bg-gray-700 hover:bg-gray-600 p-2 rounded-lg transition"
              aria-label="Menu"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Quick Links Dropdown */}
        {menuOpen && (
          <div className="bg-gray-800 rounded-lg p-3 mb-3 animate-fadeIn">
            <div className="grid grid-cols-3 gap-2">
              {quickLinks.map(link => (
                <button
                  key={link.href}
                  onClick={() => handleQuickLink(link.href)}
                  className={`${link.color} p-3 rounded-lg text-center transition flex flex-col items-center gap-1`}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span className="text-xs font-medium">{link.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile View Tabs - Horizontal Scrollable */}
        <div className="relative">
          <button
            onClick={() => setNavMenuOpen(!navMenuOpen)}
            className="w-full bg-gray-800 p-3 rounded-lg flex justify-between items-center"
          >
            <div className="flex items-center gap-2">
              <span>{viewTabs.find(t => t.id === activeView)?.icon}</span>
              <span className="font-semibold">{viewTabs.find(t => t.id === activeView)?.label}</span>
            </div>
            <span className="text-gray-400">{navMenuOpen ? '▲' : '▼'}</span>
          </button>

          {navMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg overflow-hidden z-50 shadow-xl">
              {viewTabs.map(tab => {
                const isActive = activeView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleViewChange(tab.id)}
                    className={`
                      w-full flex items-center justify-between px-4 py-3 transition
                      ${isActive 
                        ? tab.id === 'missing-hours'
                          ? 'bg-orange-600 text-white'
                          : tab.id === 'aging'
                            ? 'bg-red-600 text-white'
                            : 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-700'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span>{tab.icon}</span>
                      <span className="font-medium">{tab.label}</span>
                    </div>
                    {tab.alert && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        {missingHoursCount > 99 ? '99+' : missingHoursCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Tablet Layout
  if (isTablet) {
    return (
      <div className="mb-4">
        {/* Tablet Header Row */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <img 
              src="/emf-logo.png" 
              alt="EMF Contracting LLC" 
              className="h-10 w-auto"
            />
            <div>
              <h1 className="text-xl font-bold">EMF Contracting LLC</h1>
              <p className="text-xs text-gray-400">Field Service Dashboard</p>
            </div>
          </div>
          
          <div className="flex gap-2 flex-wrap justify-end">
            {onGlobalSearch && (
              <button
                onClick={onGlobalSearch}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
              >
                🔍 Search
              </button>
            )}
            {quickLinks.slice(0, 4).map(link => (
              <button
                key={link.href}
                onClick={() => window.location.href = link.href}
                className={`${link.color} px-3 py-2 rounded-lg font-semibold transition text-sm`}
              >
                {link.icon} {link.label}
              </button>
            ))}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg font-semibold transition text-sm"
            >
              More ▼
            </button>
          </div>
        </div>

        {/* More Menu Dropdown */}
        {menuOpen && (
          <div className="bg-gray-800 rounded-lg p-2 mb-4 flex gap-2 justify-end">
            {quickLinks.slice(4).map(link => (
              <button
                key={link.href}
                onClick={() => handleQuickLink(link.href)}
                className={`${link.color} px-3 py-2 rounded-lg font-semibold transition text-sm`}
              >
                {link.icon} {link.label}
              </button>
            ))}
          </div>
        )}

        {/* View tabs - scrollable on tablet */}
        <div className="flex gap-1 bg-gray-800 p-1 rounded-lg overflow-x-auto">
          {viewTabs.map(tab => {
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id)}
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-md font-semibold transition relative whitespace-nowrap
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

  // Desktop Layout (Original)
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
          {quickLinks.map(link => (
            <button
              key={link.href}
              onClick={() => window.location.href = link.href}
              className={`${link.color} px-3 py-2 rounded-lg font-semibold transition text-sm`}
            >
              {link.icon} {link.label}
            </button>
          ))}
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
