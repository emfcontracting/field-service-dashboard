// app/demo/components/DemoDashboardHeader.js
'use client';

import Link from 'next/link';

// Quiet header for the dashboard demo: same dark surfaces as the production
// shell, no emojis, one row of view tabs.
const VIEW_TABS = [
  { id: 'workorders',    label: 'Work orders',   shortLabel: 'WOs' },
  { id: 'calendar',      label: 'Calendar',      shortLabel: 'Calendar' },
  { id: 'missing-hours', label: 'Missing hours', shortLabel: 'Hours' },
  { id: 'availability',  label: 'Availability',  shortLabel: 'Avail.' },
];

export default function DemoDashboardHeader({ activeView, setActiveView, missingHoursCount = 0 }) {
  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link href="/demo" className="flex items-center gap-3 min-w-0">
          <span className="w-9 h-9 bg-slate-200 text-[#0d0d14] rounded-[3px] grid place-items-center text-[11px] font-black tracking-tight flex-shrink-0">
            PCS
          </span>
          <span className="min-w-0">
            <span className="block text-slate-100 font-bold text-base sm:text-lg leading-tight truncate">PCS FieldService</span>
            <span className="block text-slate-500 text-xs leading-tight truncate">Summit Mechanical Services</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm" aria-label="Demo sections">
          <Link href="/demo/mobile"
            className="px-3 py-2 rounded-[3px] text-slate-400 hover:text-slate-100 hover:bg-[#1e1e2e] transition">
            Field app
          </Link>
          <Link href="/demo/invoices"
            className="px-3 py-2 rounded-[3px] text-slate-400 hover:text-slate-100 hover:bg-[#1e1e2e] transition">
            Invoicing
          </Link>
        </nav>
      </div>

      <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
        <div role="tablist" className="flex gap-0 border-b border-[#1e1e2e] w-fit min-w-full">
          {VIEW_TABS.map(tab => {
            const isActive = activeView === tab.id;
            const badge = tab.id === 'missing-hours' ? missingHoursCount : 0;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveView(tab.id)}
                className={`relative -mb-px flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition
                  ${isActive
                    ? 'border-slate-200 text-slate-100'
                    : 'border-transparent text-slate-500 hover:text-slate-300'}`}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                {badge > 0 && (
                  <span className="min-w-[20px] px-1.5 py-0.5 text-[10px] leading-none rounded-[3px] bg-[#2a2a3a] text-slate-200 tabular-nums">
                    {badge}
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
