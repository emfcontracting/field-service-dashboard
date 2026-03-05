// app/components/AppShell.js
// ─────────────────────────────────────────────────────────────────────────────
// Reusable shell component — Obsidian design system
// Wraps any office/admin page with: auth check + sidebar + main content area
//
// Usage:
//   import AppShell from '@/components/AppShell';
//   export default function MyPage() {
//     return <AppShell><div>Page content here</div></AppShell>;
//   }
//
// Optional props:
//   activeLink  — highlights a QUICK_LINKS entry by href (e.g. '/invoices')
//                 for pages that are NOT dashboard views
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

// ── SVG Icons (16×16, stroke-width 1.8) ──────────────────────────────────────
export const Icons = {
  workorders: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  ),
  calendar: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
      <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
    </svg>
  ),
  aging: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <polyline points="12 7 12 12 15 15"/>
    </svg>
  ),
  missingHours: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  availability: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  home: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  backend: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  weather: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/>
      <line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
      <line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  messages: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  invoices: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/>
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
  users: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  settings: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  mobile: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
      <line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  ),
  logout: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  expand: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/>
    </svg>
  ),
  collapse: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/>
    </svg>
  ),
};

// ── Nav config ────────────────────────────────────────────────────────────────
export const NAV_ITEMS = [
  { id: 'workorders',    label: 'Work Orders',   Icon: Icons.workorders },
  { id: 'calendar',      label: 'Calendar',       Icon: Icons.calendar },
  { id: 'aging',         label: 'Aging',          Icon: Icons.aging },
  { id: 'missing-hours', label: 'Missing Hours',  Icon: Icons.missingHours, alert: true },
  { id: 'availability',  label: 'Availability',   Icon: Icons.availability },
];

export const QUICK_LINKS = [
  { href: '/',                  label: 'Home',      Icon: Icons.home },
  { href: '/dashboard/backend', label: 'Backend',   Icon: Icons.backend },
  { href: '/weather',           label: 'Weather',   Icon: Icons.weather },
  { href: '/messages',          label: 'Messages',  Icon: Icons.messages },
  { href: '/invoices',          label: 'Invoicing', Icon: Icons.invoices },
  { href: '/users',             label: 'Users',     Icon: Icons.users },
  { href: '/settings',          label: 'Settings',  Icon: Icons.settings },
  { href: '/mobile',            label: 'Mobile',    Icon: Icons.mobile },
];

// ── SidebarNav (inner component — needs useSearchParams) ──────────────────────
function SidebarNav({ userInfo, missingHoursCount, sidebarCollapsed, onCollapse, onLogout, onThemeToggle, theme, isMobile, activeLink }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeView = searchParams.get('view') || 'workorders';
  const setActiveView = (id) => { router.push(`/dashboard?view=${id}`); setMobileNavOpen(false); };

  // Determines if a quick-link is "active" (highlighted)
  const isLinkActive = (href) => {
    if (activeLink) return activeLink === href;
    return false; // inside dashboard, views handle their own highlight
  };

  /* ── MOBILE ─────────────────────────────────────────────────────────────── */
  if (isMobile) {
    return (
      <>
        {/* Mobile top bar */}
        <div className="bg-[#0d0d14] border-b border-[#1e1e2e] px-4 py-3 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <img src="/emf-logo.png" alt="EMF" className="h-7 w-auto object-contain flex-shrink-0" />
            <span className="text-slate-200 font-semibold text-sm">PCS FieldService</span>
          </div>
          <button onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="bg-[#1e1e2e] border border-[#2d2d44] text-slate-400 p-2 rounded-lg">
            {mobileNavOpen
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            }
          </button>
        </div>

        {/* Mobile dropdown nav */}
        {mobileNavOpen && (
          <div className="bg-[#0d0d14] border-b border-[#1e1e2e] py-1.5">
            {NAV_ITEMS.map(({ id, label, Icon, alert }) => {
              const isActive = activeView === id;
              return (
                <button key={id} onClick={() => setActiveView(id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm transition border-l-2
                    ${isActive ? 'bg-blue-600/10 text-blue-400 border-blue-500' : 'text-slate-400 hover:bg-[#1e1e2e] border-transparent'}`}>
                  <div className="flex items-center gap-3">
                    <Icon /><span className="font-medium">{label}</span>
                  </div>
                  {alert && missingHoursCount > 0 && (
                    <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold px-1.5 py-0.5 rounded-full">{missingHoursCount}</span>
                  )}
                </button>
              );
            })}
            <div className="mx-4 my-1.5 border-t border-[#1e1e2e]" />
            {QUICK_LINKS.map(({ href, label, Icon }) => (
              <a key={href} href={href}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition border-l-2
                  ${isLinkActive(href) ? 'bg-blue-600/10 text-blue-400 border-blue-500' : 'text-slate-500 hover:text-slate-300 hover:bg-[#1e1e2e] border-transparent'}`}>
                <Icon /><span>{label}</span>
              </a>
            ))}
            <div className="mx-4 my-1.5 border-t border-[#1e1e2e]" />
            <div className="px-4 py-2 flex justify-between items-center">
              <span className="text-xs text-slate-600">{userInfo?.first_name} {userInfo?.last_name}</span>
              <button onClick={onLogout} className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400">
                <Icons.logout /><span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  /* ── DESKTOP ─────────────────────────────────────────────────────────────── */
  return (
    <aside className={`flex flex-col bg-[#0d0d14] border-r border-[#1e1e2e] transition-all duration-200 flex-shrink-0 ${sidebarCollapsed ? 'w-[52px]' : 'w-[200px]'}`}>

      {/* ── Header: Logo + User + Collapse button ── */}
      <div className={`border-b border-[#1e1e2e] flex flex-col gap-1.5 ${sidebarCollapsed ? 'items-center py-3 px-1' : 'px-3 pt-3 pb-2'}`}>

        {/* Logo row */}
        <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-2.5'}`}>
          <img src="/emf-logo.png" alt="EMF" className={`object-contain flex-shrink-0 ${sidebarCollapsed ? 'h-8 w-8' : 'h-9 w-auto max-w-[36px]'}`} />
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <div className="text-slate-200 font-semibold text-sm leading-tight whitespace-nowrap">EMF Contracting</div>
              <div className="text-slate-600 text-[10px] whitespace-nowrap">PCS FieldService</div>
            </div>
          )}
        </div>

        {/* Username (expanded only) */}
        {!sidebarCollapsed && userInfo && (
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-blue-600/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-400 text-[9px] font-bold">{userInfo.first_name?.charAt(0)}</span>
            </div>
            <div className="overflow-hidden">
              <div className="text-slate-400 text-xs truncate">{userInfo.first_name} {userInfo.last_name}</div>
              <div className="text-slate-700 text-[9px] truncate capitalize">{userInfo.role?.replace(/_/g, ' ')}</div>
            </div>
          </div>
        )}

        {/* Collapse toggle */}
        <button onClick={onCollapse} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`flex items-center gap-2 rounded-md py-1 transition text-slate-600 hover:text-slate-400 hover:bg-[#1e1e2e]
            ${sidebarCollapsed ? 'justify-center w-8 h-7 px-0' : 'px-1.5 w-full text-xs'}`}>
          {sidebarCollapsed ? <Icons.expand /> : <><Icons.collapse /><span>Collapse</span></>}
        </button>
      </div>

      {/* ── Scrollable nav area ── */}
      <nav className="flex-1 overflow-y-auto py-2 px-1.5 flex flex-col gap-0.5">

        {/* Views section label */}
        {!sidebarCollapsed && <div className="text-slate-700 text-[10px] px-2 pt-1 pb-1 tracking-widest font-semibold uppercase">Views</div>}
        {sidebarCollapsed && <div className="h-2" />}

        {/* Dashboard nav items */}
        {NAV_ITEMS.map(({ id, label, Icon, alert }) => {
          const isActive = !activeLink && activeView === id;
          const activeColor = id === 'missing-hours' ? 'bg-orange-500/10 text-orange-400'
            : id === 'aging' ? 'bg-red-500/10 text-red-400'
            : 'bg-blue-600/15 text-blue-400';

          return (
            <button key={id} onClick={() => setActiveView(id)} title={sidebarCollapsed ? label : undefined}
              className={`relative w-full flex items-center gap-3 rounded-lg transition-all duration-150 font-medium
                ${sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5 text-sm'}
                ${isActive ? activeColor : 'text-slate-500 hover:text-slate-200 hover:bg-[#1e1e2e]'}`}>
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-500" />}
              <Icon />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
              {alert && missingHoursCount > 0 && (
                <span className={`bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-full leading-none
                  ${sidebarCollapsed
                    ? 'absolute top-1 right-1 text-[8px] w-4 h-4 flex items-center justify-center'
                    : 'ml-auto text-[10px] px-1.5 py-0.5'}`}>
                  {missingHoursCount > 99 ? '99+' : missingHoursCount}
                </span>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div className="my-1.5 border-t border-[#1e1e2e]" />

        {/* Quick links section label */}
        {!sidebarCollapsed && <div className="text-slate-700 text-[10px] px-2 pb-1 tracking-widest font-semibold uppercase">Links</div>}

        {/* Quick links */}
        {QUICK_LINKS.map(({ href, label, Icon }) => {
          const isActive = isLinkActive(href);
          return (
            <a key={href} href={href} title={sidebarCollapsed ? label : undefined}
              className={`relative w-full flex items-center gap-3 rounded-lg transition-all duration-150
                ${sidebarCollapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5 text-sm'}
                ${isActive
                  ? 'bg-blue-600/15 text-blue-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-[#1e1e2e]'}`}>
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-500" />}
              <Icon />
              {!sidebarCollapsed && <span className="truncate">{label}</span>}
            </a>
          );
        })}
      </nav>

      {/* ── Footer: Theme toggle + Logout ── */}
      <div className="border-t border-[#1e1e2e] p-1.5 space-y-0.5">
        <button onClick={onThemeToggle} title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          className={`w-full flex items-center gap-2.5 rounded-lg py-2 transition text-slate-500 hover:text-slate-300 hover:bg-[#1e1e2e]
            ${sidebarCollapsed ? 'justify-center px-0' : 'px-3 text-xs'}`}>
          {theme === 'dark'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          }
          {!sidebarCollapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        <button onClick={onLogout} title="Logout"
          className={`w-full flex items-center gap-2.5 rounded-lg py-2 transition text-red-500/50 hover:text-red-400 hover:bg-red-950/20
            ${sidebarCollapsed ? 'justify-center px-0' : 'px-3 text-xs'}`}>
          <Icons.logout />
          {!sidebarCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}

// ── Theme toggle helper ──────────────────────────────────────────────────────
function useTheme() {
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    const saved = localStorage.getItem('pcs-theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('pcs-theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };
  return { theme, toggle };
}

// ── AppShell (default export) ─────────────────────────────────────────────────
export default function AppShell({ children, activeLink, requireRole = ['admin', 'office_staff'] }) {
  const router = useRouter();
  const [loading, setLoading]             = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userInfo, setUserInfo]           = useState(null);
  const [isMobile, setIsMobile]           = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [missingHoursCount, setMissingHoursCount] = useState(0);
  const { theme, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.push('/login');
      else if (event === 'SIGNED_IN') checkAuth();
    });
    return () => { subscription.unsubscribe(); window.removeEventListener('resize', checkMobile); };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    (async () => {
      try {
        // Match MissingHoursView logic: WOs with a tech assigned but 0 hours logged
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 30);

        const { data: eligibleWOs } = await supabase
          .from('work_orders')
          .select('wo_id')
          .not('lead_tech_id', 'is', null)
          .in('status', ['assigned', 'in_progress', 'completed'])
          .gte('date_entered', cutoff.toISOString());

        if (!eligibleWOs?.length) { setMissingHoursCount(0); return; }

        const woIds = eligibleWOs.map(w => w.wo_id);

        // Find which WOs have at least some hours logged
        const { data: withHours } = await supabase
          .from('daily_hours_log')
          .select('wo_id')
          .in('wo_id', woIds);

        const withHoursSet = new Set(withHours?.map(h => h.wo_id) || []);
        const missingCount = woIds.filter(id => !withHoursSet.has(id)).length;
        setMissingHoursCount(missingCount);
      } catch {}
    })();
  }, [authenticated]);

  async function checkAuth() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.push('/login'); return; }

      const { data: userData, error: userError } = await supabase
        .from('users').select('*').eq('auth_id', user.id).eq('is_active', true).single();

      if (userError || !userData) { await supabase.auth.signOut(); router.push('/login'); return; }

      if (!requireRole.includes(userData.role)) {
        await supabase.auth.signOut();
        alert('Access denied. Field workers should use the Mobile App.');
        router.push('/login');
        return;
      }
      setUserInfo(userData);
      setAuthenticated(true);
    } catch { router.push('/login'); }
    finally { setLoading(false); }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // ── Loading screen ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-3">
          <img src="/emf-logo.png" alt="EMF" className="h-10 w-auto object-contain animate-pulse opacity-60" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) return null;

  // ── Render ──
  return (
    <div className={`min-h-screen bg-[#0a0a0f] ${isMobile ? 'flex flex-col' : 'flex'}`}>
      <Suspense fallback={
        isMobile ? null : (
          <div className={`bg-[#0d0d14] border-r border-[#1e1e2e] flex-shrink-0 ${sidebarCollapsed ? 'w-[52px]' : 'w-[200px]'}`} />
        )
      }>
        <SidebarNav
          userInfo={userInfo}
          missingHoursCount={missingHoursCount}
          sidebarCollapsed={sidebarCollapsed}
          onCollapse={() => setSidebarCollapsed(p => !p)}
          onLogout={handleLogout}
          onThemeToggle={toggleTheme}
          theme={theme}
          isMobile={isMobile}
          activeLink={activeLink}
        />
      </Suspense>

      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
