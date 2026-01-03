// app/dashboard/components/DashboardHeader.js
'use client';

import { useState, useEffect } from 'react';

export default function DashboardHeader({ activeView, setActiveView, missingHoursCount = 0, onGlobalSearch }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Check screen size on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // View navigation tabs
  const viewTabs = [
    { id: 'workorders', label: 'Work Orders', shortLabel: 'WOs', icon: '📋' },
    { id: 'calendar', label: 'Calendar', shortLabel: 'Cal', icon: '📅' },
    { id: 'aging', label: 'Aging', shortLabel: 'Age', icon: '⏰' },
    { id: 'missing-hours', label: 'Missing Hours', shortLabel: 'Hrs', icon: '⚠️', alert: missingHoursCount > 0 },
    { id: 'availability', label: 'Availability', shortLabel: 'Avail', icon: '👥' },
  ];

  // Quick action links
  const quickLinks = [
    { href: '/', label: 'Home', icon: '🏠', color: 'bg-gray-600' },
    { href: '/dashboard/backend', label: 'Backend', icon: '🛠️', color: 'bg-red-600' },
    { href: '/weather', label: 'Weather', icon: '🌤️', color: 'bg-sky-600' },
    { href: '/messages', label: 'Messages', icon: '💬', color: 'bg-teal-600' },
    { href: '/invoices', label: 'Invoicing', icon: '💰', color: 'bg-purple-600' },
    { href: '/users', label: 'Users', icon: '👥', color: 'bg-blue-600' },
    { href: '/settings', label: 'Settings', icon: '⚙️', color: 'bg-gray-600' },
    { href: '/mobile', label: 'Mobile', icon: '📱', color: 'bg-green-600' },
  ];

  const handleViewChange = (viewId) => {
    setActiveView(viewId);
    setNavMenuOpen(false);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setMenuOpen(false);
      setNavMenuOpen(false);
    };
    
    if (menuOpen || navMenuOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [menuOpen, navMenuOpen]);

  return (
    <div className="mb-4">
      {/* ===== MOBILE HEADER (hidden on md+) ===== */}
      <div className="md:hidden">
        {/* Mobile Header Row */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <img src="/emf-logo.png" alt="EMF" className="h-8 w-auto" />
            <div>
              <h1 className="text-base font-bold leading-tight">EMF Contracting</h1>
              <p className="text-xs text-gray-400">Field Service</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            {onGlobalSearch && (
              <button
                onClick={onGlobalSearch}
                className="bg-blue-600 active:bg-blue-700 p-2.5 rounded-lg"
                aria-label="Search"
              >
                🔍
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="bg-gray-700 active:bg-gray-600 p-2.5 rounded-lg text-lg"
              aria-label="Menu"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Quick Links Dropdown */}
        {menuOpen && (
          <div 
            className="bg-gray-800 rounded-lg p-3 mb-3 border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="grid grid-cols-4 gap-2">
              {quickLinks.map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`${link.color} p-2.5 rounded-lg text-center flex flex-col items-center gap-1 active:opacity-80`}
                >
                  <span className="text-lg">{link.icon}</span>
                  <span className="text-[10px] font-medium leading-tight">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Mobile View Selector - Dropdown Style */}
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setNavMenuOpen(!navMenuOpen); }}
            className="w-full bg-gray-800 p-3 rounded-lg flex justify-between items-center border border-gray-700"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{viewTabs.find(t => t.id === activeView)?.icon}</span>
              <span className="font-semibold">{viewTabs.find(t => t.id === activeView)?.label}</span>
              {activeView === 'missing-hours' && missingHoursCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {missingHoursCount}
                </span>
              )}
            </div>
            <span className="text-gray-400">{navMenuOpen ? '▲' : '▼'}</span>
          </button>

          {navMenuOpen && (
            <div 
              className="absolute top-full left-0 right-0 mt-1 bg-gray-800 rounded-lg overflow-hidden z-50 border border-gray-700 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {viewTabs.map(tab => {
                const isActive = activeView === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleViewChange(tab.id)}
                    className={`
                      w-full flex items-center justify-between px-4 py-3.5 transition border-b border-gray-700 last:border-b-0
                      ${isActive 
                        ? tab.id === 'missing-hours' ? 'bg-orange-600 text-white'
                          : tab.id === 'aging' ? 'bg-red-600 text-white'
                          : 'bg-blue-600 text-white'
                        : 'text-gray-300 active:bg-gray-700'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{tab.icon}</span>
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

      {/* ===== DESKTOP/TABLET HEADER (hidden on mobile) ===== */}
      <div className="hidden md:block">
        {/* Top row - Logo and quick actions */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <img src="/emf-logo.png" alt="EMF Contracting LLC" className="h-12 w-auto" />
            <div>
              <h1 className="text-2xl font-bold">EMF Contracting LLC</h1>
              <p className="text-sm text-gray-400">Field Service Dashboard</p>
            </div>
          </div>
          
          {/* Quick action buttons */}
          <div className="flex gap-2 flex-wrap justify-end">
            {onGlobalSearch && (
              <button
                onClick={onGlobalSearch}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg font-semibold transition text-sm"
              >
                🔍 Search All
              </button>
            )}
            {quickLinks.map(link => (
              <a
                key={link.href}
                href={link.href}
                className={`${link.color} hover:opacity-90 px-3 py-2 rounded-lg font-semibold transition text-sm`}
              >
                {link.icon} {link.label}
              </a>
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
                    ? tab.id === 'missing-hours' ? 'bg-orange-600 text-white'
                      : tab.id === 'aging' ? 'bg-red-600 text-white'
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
    </div>
  );
}
