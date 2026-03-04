// app/dashboard/layout.js
'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

const NAV_ITEMS = [
  { id: 'workorders',    label: 'Work Orders',   icon: '◫' },
  { id: 'calendar',      label: 'Calendar',       icon: '⬡' },
  { id: 'aging',         label: 'Aging',          icon: '◉' },
  { id: 'missing-hours', label: 'Missing Hours',  icon: '⚠', alert: true },
  { id: 'availability',  label: 'Availability',   icon: '◈' },
];

const QUICK_LINKS = [
  { href: '/',                  label: 'Home',      icon: '🏠' },
  { href: '/dashboard/backend', label: 'Backend',   icon: '🛠️' },
  { href: '/weather',           label: 'Weather',   icon: '🌤️' },
  { href: '/messages',          label: 'Messages',  icon: '💬' },
  { href: '/invoices',          label: 'Invoicing', icon: '💰' },
  { href: '/users',             label: 'Users',     icon: '👥' },
  { href: '/settings',          label: 'Settings',  icon: '⚙️' },
  { href: '/mobile',            label: 'Mobile',    icon: '📱' },
];

// ── Sidebar inner component (needs useSearchParams) ──
function SidebarNav({ userInfo, missingHoursCount, sidebarCollapsed, onCollapse, onLogout, isMobile }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const activeView = searchParams.get('view') || 'workorders';

  const setActiveView = (viewId) => {
    router.push(`/dashboard?view=${viewId}`);
    setMobileNavOpen(false);
  };

  /* ── MOBILE ── */
  if (isMobile) {
    return (
      <>
        {/* Mobile top bar */}
        <div className="bg-[#0d0d14] border-b border-[#1e1e2e] px-4 py-2.5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-xs">P</div>
            <span className="text-slate-300 font-semibold text-sm">PCS FieldService</span>
          </div>
          <button onClick={() => setMobileNavOpen(!mobileNavOpen)}
            className="bg-[#1e1e2e] border border-[#2d2d44] text-slate-400 p-2 rounded-lg text-sm">
            {mobileNavOpen ? '✕' : '☰'}
          </button>
        </div>

        {mobileNavOpen && (
          <div className="bg-[#0d0d14] border-b border-[#1e1e2e] py-2">
            {NAV_ITEMS.map(item => {
              const isActive = activeView === item.id;
              return (
                <button key={item.id} onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 text-sm transition
                    ${isActive ? 'bg-blue-600/10 text-blue-400 border-l-2 border-l-blue-500' : 'text-slate-400 hover:bg-[#1e1e2e]'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xs opacity-70">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </div>
                  {item.alert && missingHoursCount > 0 && (
                    <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold px-1.5 py-0.5 rounded-full">
                      {missingHoursCount}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="border-t border-[#1e1e2e] mt-2 pt-2 px-4 flex justify-between items-center">
              <span className="text-xs text-slate-600">{userInfo?.first_name} {userInfo?.last_name}</span>
              <button onClick={onLogout} className="text-xs text-red-500 hover:text-red-400">Logout</button>
            </div>
          </div>
        )}
      </>
    );
  }

  /* ── DESKTOP ── */
  return (
    <aside className={`flex flex-col bg-[#0d0d14] border-r border-[#1e1e2e] transition-all duration-200 flex-shrink-0 ${sidebarCollapsed ? 'w-14' : 'w-52'}`}>

      {/* Logo */}
      <div className={`flex items-center gap-3 px-3 py-4 border-b border-[#1e1e2e] ${sidebarCollapsed ? 'justify-center' : ''}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">P</div>
        {!sidebarCollapsed && (
          <div>
            <div className="text-slate-200 font-semibold text-sm leading-tight">PCS FieldService</div>
            <div className="text-slate-600 text-xs">EMF Contracting</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2 overflow-y-auto">
        {!sidebarCollapsed && <div className="text-slate-600 text-xs px-2 pb-1 tracking-wider font-medium">VIEWS</div>}

        {NAV_ITEMS.map(item => {
          const isActive = activeView === item.id;
          return (
            <button key={item.id} onClick={() => setActiveView(item.id)} title={sidebarCollapsed ? item.label : ''}
              className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition relative
                ${isActive
                  ? item.id === 'missing-hours' ? 'bg-orange-500/10 text-orange-400'
                    : item.id === 'aging' ? 'bg-red-500/10 text-red-400'
                    : 'bg-blue-600/10 text-blue-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-[#1e1e2e]'
                } ${sidebarCollapsed ? 'justify-center' : ''}`}
            >
              {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r-full" />}
              <span className={`${sidebarCollapsed ? 'text-base' : 'text-xs opacity-80'}`}>{item.icon}</span>
              {!sidebarCollapsed && <span>{item.label}</span>}
              {item.alert && missingHoursCount > 0 && (
                <span className={`bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-full
                  ${sidebarCollapsed ? 'absolute -top-1 -right-1 text-[9px] px-1 py-0' : 'ml-auto text-xs px-1.5 py-0.5'}`}>
                  {missingHoursCount > 99 ? '99+' : missingHoursCount}
                </span>
              )}
            </button>
          );
        })}

        {/* Quick links */}
        <div className="pt-3">
          {!sidebarCollapsed && <div className="text-slate-600 text-xs px-2 pb-1 tracking-wider font-medium">QUICK LINKS</div>}
          {sidebarCollapsed && <div className="border-t border-[#1e1e2e] my-2" />}
          {QUICK_LINKS.map(link => (
            <a key={link.href} href={link.href} title={sidebarCollapsed ? link.label : ''}
              className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-xs text-slate-600 hover:text-slate-300 hover:bg-[#1e1e2e] transition ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <span>{link.icon}</span>
              {!sidebarCollapsed && <span>{link.label}</span>}
            </a>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-[#1e1e2e] p-2 space-y-1">
        {!sidebarCollapsed && userInfo && (
          <div className="px-2 py-1.5">
            <div className="text-slate-300 text-xs font-medium truncate">{userInfo.first_name} {userInfo.last_name}</div>
            <div className="text-slate-600 text-xs">{userInfo.role?.replace('_', ' ')}</div>
          </div>
        )}
        <div className={`flex gap-1 ${sidebarCollapsed ? 'flex-col items-center' : ''}`}>
          <button onClick={onLogout} title="Logout"
            className={`text-red-500/60 hover:text-red-400 hover:bg-red-950/30 p-2 rounded-lg text-xs transition ${sidebarCollapsed ? 'w-full flex justify-center' : ''}`}>
            {sidebarCollapsed ? '🚪' : '🚪 Logout'}
          </button>
          <button onClick={onCollapse} title={sidebarCollapsed ? 'Expand' : 'Collapse'}
            className={`text-slate-600 hover:text-slate-400 hover:bg-[#1e1e2e] p-2 rounded-lg text-xs transition ${sidebarCollapsed ? 'w-full flex justify-center' : 'ml-auto'}`}>
            {sidebarCollapsed ? '→' : '← Collapse'}
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Main layout ──
export default function DashboardLayout({ children }) {
  const router = useRouter();
  const [loading, setLoading]             = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [userInfo, setUserInfo]           = useState(null);
  const [isMobile, setIsMobile]           = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [missingHoursCount, setMissingHoursCount] = useState(0);

  useEffect(() => {
    const checkMobile = () => {
      const w = window.innerWidth;
      setIsMobile(w < 768);
      if (w < 1280) setSidebarCollapsed(true);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.push('/login');
      else if (event === 'SIGNED_IN') checkAuth();
    });

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('resize', checkMobile);
    };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    const fetch = async () => {
      try {
        const { data } = await supabase
          .from('work_orders')
          .select('wo_id')
          .in('status', ['in_progress', 'return_trip', 'tech_review', 'completed'])
          .eq('acknowledged', false);
        setMissingHoursCount(data?.length || 0);
      } catch {}
    };
    fetch();
  }, [authenticated]);

  async function checkAuth() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) { router.push('/login'); return; }

      const { data: userData, error: userError } = await supabase
        .from('users').select('*').eq('auth_id', user.id).eq('is_active', true).single();

      if (userError || !userData) {
        await supabase.auth.signOut();
        router.push('/login');
        return;
      }

      if (!['admin', 'office_staff'].includes(userData.role)) {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 animate-pulse" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) return null;

  return (
    <div className={`min-h-screen bg-[#0a0a0f] ${isMobile ? 'flex flex-col' : 'flex'}`}>
      {/* Sidebar wrapped in Suspense because SidebarNav uses useSearchParams */}
      <Suspense fallback={
        isMobile ? null : (
          <div className={`bg-[#0d0d14] border-r border-[#1e1e2e] flex-shrink-0 ${sidebarCollapsed ? 'w-14' : 'w-52'}`} />
        )
      }>
        <SidebarNav
          userInfo={userInfo}
          missingHoursCount={missingHoursCount}
          sidebarCollapsed={sidebarCollapsed}
          onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onLogout={handleLogout}
          isMobile={isMobile}
        />
      </Suspense>

      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
