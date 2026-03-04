// app/dashboard/components/DashboardHeader.js
'use client';

import { useState, useEffect } from 'react';

export default function DashboardHeader({ activeView, setActiveView, missingHoursCount = 0, onGlobalSearch }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const viewTabs = [
    { id: 'workorders', label: 'Work Orders', icon: '◫' },
    { id: 'calendar', label: 'Calendar', icon: '⬡' },
    { id: 'aging', label: 'Aging', icon: '◉' },
    { id: 'missing-hours', label: 'Missing Hours', icon: '⚠', alert: missingHoursCount > 0 },
    { id: 'availability', label: 'Availability', icon: '◈' },
  ];

  const quickLinks = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/dashboard/backend', label: 'Backend', icon: '🛠️' },
    { href: '/weather', label: 'Weather', icon: '🌤️' },
    { href: '/messages', label: 'Messages', icon: '💬' },
    { href: '/invoices', label: 'Invoicing', icon: '💰' },
    { href: '/users', label: 'Users', icon: '👥' },
    { href: '/settings', label: 'Settings', icon: '⚙️' },
    { href: '/mobile', label: 'Mobile', icon: '📱' },
  ];

  const handleViewChange = (viewId) => {
    setActiveView(viewId);
    setNavMenuOpen(false);
  };

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
    <div className="mb-6">

      {/* ===== MOBILE HEADER ===== */}
      <div className="md:hidden">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">P</div>
            <div>
              <h1 className="text-sm font-semibold text-slate-200 leading-tight">PCS FieldService</h1>
              <p className="text-xs text-slate-500">EMF Contracting LLC</p>
            </div>
          </div>
          <div className="flex gap-2">
            {onGlobalSearch && (
              <button onClick={onGlobalSearch} className="bg-[#1e1e2e] border border-[#2d2d44] text-slate-400 p-2 rounded-lg text-sm">🔍</button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="bg-[#1e1e2e] border border-[#2d2d44] text-slate-400 p-2 rounded-lg text-sm"
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-lg p-3 mb-3" onClick={(e) => e.stopPropagation()}>
            <div className="grid grid-cols-4 gap-2">
              {quickLinks.map(link => (
                <a key={link.href} href={link.href}
                  className="bg-[#1e1e2e] hover:bg-[#2d2d44] border border-[#2d2d44] p-2 rounded-lg text-center flex flex-col items-center gap-1 transition">
                  <span className="text-base">{link.icon}</span>
                  <span className="text-xs text-slate-400">{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setNavMenuOpen(!navMenuOpen); }}
            className="w-full bg-[#0d0d14] border border-[#1e1e2e] p-3 rounded-lg flex justify-between items-center"
          >
            <div className="flex items-center gap-2">
              <span className="text-slate-400">{viewTabs.find(t => t.id === activeView)?.icon}</span>
              <span className="text-slate-200 font-medium text-sm">{viewTabs.find(t => t.id === activeView)?.label}</span>
              {activeView === 'missing-hours' && missingHoursCount > 0 && (
                <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold px-2 py-0.5 rounded-full">{missingHoursCount}</span>
              )}
            </div>
            <span className="text-slate-500 text-xs">{navMenuOpen ? '▲' : '▼'}</span>
          </button>

          {navMenuOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#0d0d14] border border-[#1e1e2e] rounded-lg overflow-hidden z-50 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {viewTabs.map(tab => {
                const isActive = activeView === tab.id;
                return (
                  <button key={tab.id} onClick={() => handleViewChange(tab.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 transition border-b border-[#1e1e2e] last:border-b-0 text-sm
                      ${isActive ? 'bg-blue-600/10 text-blue-400 border-l-2 border-l-blue-500' : 'text-slate-400 hover:bg-[#1e1e2e]'}`}
                  >
                    <div className="flex items-center gap-3">
                      <span>{tab.icon}</span>
                      <span className="font-medium">{tab.label}</span>
                    </div>
                    {tab.alert && (
                      <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold px-2 py-0.5 rounded-full">
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

      {/* ===== DESKTOP HEADER ===== */}
      <div className="hidden md:block">
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-lg">P</div>
            <div>
              <h1 className="text-base font-semibold text-slate-200 leading-tight tracking-tight">PCS FieldService</h1>
              <p className="text-xs text-slate-500">EMF Contracting LLC</p>
            </div>
          </div>

          <div className="flex gap-1.5 flex-wrap justify-end items-center">
            {onGlobalSearch && (
              <button onClick={onGlobalSearch}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-medium transition">
                🔍 Search
              </button>
            )}
            {quickLinks.map(link => (
              <a key={link.href} href={link.href}
                className="bg-[#1e1e2e] hover:bg-[#2d2d44] border border-[#2d2d44] text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-md text-xs font-medium transition">
                {link.icon} {link.label}
              </a>
            ))}
          </div>
        </div>

        {/* View tabs - underline style */}
        <div className="flex gap-0 border-b border-[#1e1e2e]">
          {viewTabs.map(tab => {
            const isActive = activeView === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveView(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition relative border-b-2 -mb-px
                  ${isActive
                    ? tab.id === 'missing-hours' ? 'border-orange-500 text-orange-400'
                      : tab.id === 'aging' ? 'border-red-500 text-red-400'
                      : 'border-blue-500 text-slate-200'
                    : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
                  }`}
              >
                <span className="text-xs opacity-70">{tab.icon}</span>
                {tab.label}
                {tab.alert && !isActive && (
                  <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    {missingHoursCount > 99 ? '99+' : missingHoursCount}
                  </span>
                )}
                {tab.alert && isActive && (
                  <span className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-bold px-1.5 py-0.5 rounded-full">
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
