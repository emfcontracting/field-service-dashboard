// app/components/TodaySidebar.js
// ─────────────────────────────────────────────────────────────────────────────
// The sidebar of the "Today" theme (lib/uiThemes.js) — AppShell renders this
// instead of its classic SidebarNav when the signed-in admin has chosen it.
//
// Three ideas, in this order:
//   1. Today / Pipeline / Sites & Crew / Money / Calendar / Invoicing / Archive
//      are the front door: what you do in the morning and what you catch up on
//      in the evening.
//   2. Every classic tab is still here, under "All tools". Nothing that worked
//      yesterday is gone — the theme is a different entrance, not a smaller
//      house. The badges move with them.
//   3. The look follows the design canvas (ground #0b0d12, panel #141822,
//      border #232a38): calmer and wider than Obsidian, no gradients.
//
// Routing is the same as the classic sidebar: dashboard views are
// /dashboard?view=<id>, everything else is a plain link.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icons, NAV_ITEMS, QUICK_LINKS } from './AppShell';

const S = {
  ground: '#0b0d12', panel: '#0f121a', card: '#141822', border: '#232a38',
  active: '#1b2232', text: '#e6e8ef', muted: '#9aa3b5', dim: '#6b7385',
};

// The front door. `view` → /dashboard?view=…, `href` → a page.
export const TODAY_NAV = [
  { id: 'today',     label: 'Today',        view: 'today',     Icon: () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h10M4 18h7"/></svg>
  ) },
  { id: 'pipeline',  label: 'Pipeline',     view: 'pipeline',  Icon: () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/></svg>
  ) },
  { id: 'cockpit',   label: 'Sites & Crew', view: 'cockpit',   Icon: () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/></svg>
  ) },
  { id: 'money',     label: 'Money',        view: 'cash-flow', adminOnly: true, Icon: () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 10h5a2 2 0 0 1 0 4H9"/></svg>
  ) },
  { id: 'calendar',  label: 'Calendar',     view: 'calendar',  Icon: () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
  ) },
  { id: 'invoicing', label: 'Invoicing',    href: '/invoices', Icon: () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6M9 13h6M9 17h6"/></svg>
  ) },
  { id: 'archive',   label: 'Archive',      view: 'archive',   adminOnly: true, Icon: () => (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="4"/><path d="M5 8v11h14V8M10 12h4"/></svg>
  ) },
];

// Classic views that already have a seat above are not repeated under All tools.
const COVERED_VIEWS = new Set(TODAY_NAV.filter((n) => n.view).map((n) => n.view));
const COVERED_LINKS = new Set(['/invoices', '/settings']);

function roleAllows(item, role) {
  if (item.adminOnly && role !== 'admin') return false;
  if (item.officeOrAdmin && !['admin', 'office_staff'].includes(role)) return false;
  return true;
}

export default function TodaySidebar({
  userInfo, missingHoursCount, cbreDataEntryCount, reviewQueueCount, approvalsCount,
  onLogout, isMobile, activeLink, onSearch,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = userInfo?.role;
  const activeView = activeLink ? null : (searchParams.get('view') || 'today');
  const go = (item) => {
    setMobileOpen(false);
    if (item.href) { router.push(item.href); return; }
    router.push(`/dashboard?view=${item.view}`);
  };

  const badgeFor = (item) => item.alert ? missingHoursCount
    : item.cbreDataEntry ? cbreDataEntryCount
    : item.approvals ? approvalsCount
    : item.reviewQueue ? reviewQueueCount
    : 0;
  // Everything the office has to touch, as one number on the front door.
  const todayBadge = (cbreDataEntryCount || 0) + (reviewQueueCount || 0) + (approvalsCount || 0) + (missingHoursCount || 0);

  const front = TODAY_NAV.filter((n) => roleAllows(n, role));
  const tools = NAV_ITEMS.filter((n) => roleAllows(n, role) && !COVERED_VIEWS.has(n.id));
  const links = QUICK_LINKS.filter((l) => roleAllows(l, role) && !COVERED_LINKS.has(l.href));
  const toolsBadge = tools.reduce((s, t) => s + (badgeFor(t) || 0), 0);
  const toolActive = tools.some((t) => t.id === activeView) || links.some((l) => l.href === activeLink);

  const Row = ({ item, active, badge, badgeTone = 'amber', muted = false }) => (
    <button type="button" onClick={() => go(item)}
      aria-current={active ? 'page' : undefined}
      className="w-full flex items-center gap-3 rounded-[10px] px-3 min-h-[44px] text-[14px] text-left transition"
      style={{
        background: active ? S.active : 'transparent',
        color: active ? '#fff' : muted ? S.muted : '#c7cdd9',
        fontWeight: active ? 600 : 500,
      }}>
      <item.Icon />
      <span className="truncate">{item.label}</span>
      {badge > 0 && (
        <span className="ml-auto rounded-full px-2 py-[1px] text-[11px] font-bold"
          style={badgeTone === 'amber' ? { background: '#f59e0b', color: '#111' } : { background: '#232a38', color: S.text }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );

  const body = (
    <>
      <div className="flex flex-col gap-1">
        {front.map((item) => (
          <Row key={item.id} item={item}
            active={item.view ? activeView === item.view : activeLink === item.href}
            badge={item.id === 'today' ? todayBadge : 0} />
        ))}
      </div>

      <div className="mt-3 pt-3 flex flex-col gap-1" style={{ borderTop: `1px solid ${S.border}` }}>
        <button type="button" onClick={() => setToolsOpen((o) => !o)} aria-expanded={toolsOpen || toolActive}
          className="w-full flex items-center gap-3 rounded-[10px] px-3 min-h-[40px] text-[12px] font-semibold uppercase tracking-[.06em] text-left"
          style={{ color: S.muted }}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
            style={{ transform: (toolsOpen || toolActive) ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><path d="M9 6l6 6-6 6"/></svg>
          All tools
          {!toolsOpen && !toolActive && toolsBadge > 0 && (
            <span className="ml-auto rounded-full px-2 py-[1px] text-[11px] font-bold" style={{ background: '#232a38', color: S.text }}>{toolsBadge}</span>
          )}
        </button>
        {(toolsOpen || toolActive) && (
          <div className="flex flex-col gap-0.5 pl-1">
            {tools.map((item) => (
              <Row key={item.id} item={{ ...item, view: item.id }} active={activeView === item.id} badge={badgeFor(item)} badgeTone="grey" muted />
            ))}
            <div className="my-1.5" style={{ borderTop: `1px solid ${S.border}` }} />
            {links.map((item) => (
              <Row key={item.href} item={item} active={activeLink === item.href} badge={0} muted />
            ))}
          </div>
        )}
      </div>
    </>
  );

  const footer = (
    <div className="flex flex-col gap-0.5 p-2" style={{ borderTop: `1px solid ${S.border}` }}>
      <Row item={{ label: 'Settings', href: '/settings', Icon: Icons.settings }} active={activeLink === '/settings'} badge={0} muted />
      <button type="button" onClick={onLogout}
        className="w-full flex items-center gap-3 rounded-[10px] px-3 min-h-[44px] text-[14px] text-left"
        style={{ color: '#f87171' }}>
        <Icons.logout /><span>Logout</span>
      </button>
    </div>
  );

  /* ── Mobile: top bar + dropdown ───────────────────────────────────────── */
  if (isMobile) {
    return (
      <>
        <div className="flex items-center justify-between px-4 py-3" style={{ background: S.panel, borderBottom: `1px solid ${S.border}` }}>
          <div className="flex items-center gap-2.5">
            <img src="/emf-logo.png" alt="EMF" className="h-7 w-auto object-contain" />
            <span className="font-semibold text-sm" style={{ color: S.text }}>PCS FieldService</span>
          </div>
          <button type="button" onClick={() => setMobileOpen((o) => !o)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            className="p-2 rounded-lg" style={{ background: S.card, border: `1px solid ${S.border}`, color: S.muted }}>
            {mobileOpen
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>}
          </button>
        </div>
        {mobileOpen && (
          <div style={{ background: S.panel, borderBottom: `1px solid ${S.border}` }}>
            <div className="p-2">{body}</div>
            {footer}
          </div>
        )}
      </>
    );
  }

  /* ── Desktop ──────────────────────────────────────────────────────────── */
  return (
    <aside className="flex flex-col flex-shrink-0 w-[220px]" style={{ background: S.panel, borderRight: `1px solid ${S.border}`, color: S.text }}>
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: `1px solid ${S.border}` }}>
        <img src="/emf-logo.png" alt="EMF" className="h-8 w-auto object-contain flex-shrink-0" />
        <div className="overflow-hidden">
          <div className="font-semibold text-[14px] leading-tight whitespace-nowrap">EMF Contracting</div>
          <div className="text-[11px] whitespace-nowrap" style={{ color: S.muted }}>PCS FieldService</div>
        </div>
      </div>

      {onSearch && (
        <div className="px-3 pt-3">
          <button type="button" onClick={onSearch}
            className="w-full flex items-center gap-2 rounded-[10px] px-3 min-h-[40px] text-[13px] text-left"
            style={{ background: S.card, border: `1px solid #2a3243`, color: S.muted }}>
            <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            Search work orders
          </button>
        </div>
      )}

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-3">
        {body}
      </nav>

      {userInfo && (
        <div className="px-4 py-2 text-[12px]" style={{ color: S.muted, borderTop: `1px solid ${S.border}` }}>
          <div className="font-semibold truncate" style={{ color: S.text }}>{userInfo.first_name} {userInfo.last_name}</div>
          <div className="capitalize">{String(userInfo.role || '').replace(/_/g, ' ')}</div>
        </div>
      )}
      {footer}
    </aside>
  );
}
