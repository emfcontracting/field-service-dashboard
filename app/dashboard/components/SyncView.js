// app/dashboard/components/SyncView.js
// ─────────────────────────────────────────────────────────────────────────────
// ADMIN-ONLY: one place for the files our partners send us.
//
// Both imports work the same way — upload, reconcile against FSM, look at what
// would change, apply — so they live under one nav entry with a tab each
// instead of two near-identical screens. The payment report is not a CBRE file
// at all (it comes from UPS via Corpay), which is why the section is no longer
// called "CBRE Sync".
//
//   CBRE Status   — the weekly CBRE work-order export (status, posting, CMP)
//   UPS Payments  — the UPS procurement payment report (marks invoices paid)
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState } from 'react';
import CBRESyncView from './CBRESyncView';
import UPSPaymentsSyncView from './UPSPaymentsSyncView';

const TABS = [
  { id: 'cbre',     label: '🔄 CBRE Status',  hint: 'weekly work order export' },
  { id: 'payments', label: '💵 UPS Payments', hint: 'payment report from UPS BaSE' },
];

export default function SyncView({ currentUser }) {
  const [tab, setTab] = useState('cbre');

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-200">
      <div className="px-4 md:px-6 pt-4 md:pt-6">
        <div className="flex flex-wrap gap-2 border-b border-[#1e1e2e]">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition ${
                tab === t.id ? 'text-slate-100 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'
              }`}
            >
              {t.label}
              <div className="text-[11px] font-normal text-slate-600">{t.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* CBRESyncView brings its own page chrome; the payments tab is plain. */}
      {tab === 'cbre'
        ? <CBRESyncView currentUser={currentUser} />
        : <div className="p-4 md:p-6"><UPSPaymentsSyncView currentUser={currentUser} /></div>}
    </div>
  );
}
