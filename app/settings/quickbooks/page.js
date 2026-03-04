'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useSearchParams } from 'next/navigation';
import AppShell from '@/app/components/AppShell';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── UI primitives ────────────────────────────────────────────────────────────
const Card = ({ children, className = '' }) => (
  <div className={`bg-[#0d0d14] border border-[#1e1e2e] rounded-xl ${className}`}>{children}</div>
);
const CardHeader = ({ children, className = '' }) => (
  <div className={`px-5 py-4 border-b border-[#1e1e2e] ${className}`}>{children}</div>
);
const CardBody = ({ children, className = '' }) => (
  <div className={`px-5 py-4 ${className}`}>{children}</div>
);

const Btn = ({ children, onClick, disabled, variant = 'default', size = 'md', className = '' }) => {
  const variants = {
    default: 'bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:text-slate-100 hover:bg-[#2d2d44]',
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    danger:  'bg-red-600 hover:bg-red-500 text-white',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

const KV = ({ label, value }) => (
  <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl px-4 py-3">
    <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-1">{label}</p>
    <p className="text-slate-200 font-semibold text-sm font-mono">{value || '—'}</p>
  </div>
);

const Step = ({ num, text }) => (
  <li className="flex items-start gap-3">
    <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
      <span className="text-blue-400 text-xs font-bold">{num}</span>
    </div>
    <span className="text-slate-400 text-sm leading-relaxed">{text}</span>
  </li>
);

// ════════════════════════════════════════════════════════════════════════════
function QBContent() {
  const [connected, setConnected]   = useState(false);
  const [settings, setSettings]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [toast, setToast]           = useState(null);
  const searchParams = useSearchParams();

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    checkConnection();
    if (searchParams.get('qb_success')) showToast('QuickBooks connected successfully!');
    if (searchParams.get('qb_error'))   showToast('QuickBooks connection failed. Please try again.', 'error');
  }, []);

  async function checkConnection() {
    const { data, error } = await supabase
      .from('quickbooks_settings').select('*').eq('is_active', true).single();
    if (!error && data) { setConnected(true); setSettings(data); }
    setLoading(false);
  }

  async function connectQB() {
    try {
      const res = await fetch('/api/quickbooks/auth');
      const { authUri } = await res.json();
      window.location.href = authUri;
    } catch (err) { showToast('Failed to connect: ' + err.message, 'error'); }
  }

  async function disconnectQB() {
    if (!confirm('Disconnect QuickBooks? You can reconnect anytime.')) return;
    try {
      const res = await fetch('/api/quickbooks/disconnect', { method: 'POST' });
      if (res.ok) { showToast('QuickBooks disconnected'); setConnected(false); setSettings(null); }
    } catch (err) { showToast('Failed to disconnect: ' + err.message, 'error'); }
  }

  return (
    <AppShell activeLink="/settings">
      <div className="min-h-screen bg-[#0a0a0f] text-slate-200">

        {/* ── Toast ── */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-2 text-sm font-semibold
            ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'} text-white`}>
            {toast.type === 'error'
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            }
            {toast.text}
          </div>
        )}

        {/* ── Header ── */}
        <div className="border-b border-[#1e1e2e] bg-[#0d0d14] px-6 py-5">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-100">QuickBooks Integration</h1>
            <p className="text-slate-500 text-sm mt-0.5">Connect your QuickBooks Online account to sync invoices</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">

          {/* ── QB Connection card ── */}
          <Card className={connected ? 'border-emerald-500/20' : ''}>
            {connected && <div className="h-0.5 bg-emerald-500/40 rounded-t-xl" />}

            <CardHeader className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* QB logo placeholder / icon */}
                <div className="w-10 h-10 rounded-xl bg-[#2CA01C]/20 border border-[#2CA01C]/30 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2CA01C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                </div>
                <div>
                  <p className="font-bold text-slate-100">QuickBooks Online</p>
                  <p className="text-xs text-slate-500">Intuit QuickBooks integration</p>
                </div>
              </div>

              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border
                ${connected
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-500/15 text-slate-500 border-slate-500/30'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                {connected ? 'Connected' : 'Not Connected'}
              </span>
            </CardHeader>

            <CardBody>
              {loading ? (
                <div className="flex items-center gap-2 py-4">
                  <div className="w-5 h-5 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                  <p className="text-slate-500 text-sm">Checking connection…</p>
                </div>

              ) : connected ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <KV label="Company ID"  value={settings?.realm_id} />
                    <KV label="Connected"   value={settings?.connected_at ? new Date(settings.connected_at).toLocaleDateString() : null} />
                    <KV label="Last Sync"   value={settings?.last_sync_at ? new Date(settings.last_sync_at).toLocaleString() : 'Never'} />
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-start gap-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400 flex-shrink-0 mt-0.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <div>
                      <p className="text-emerald-400 text-sm font-semibold">Integration Active</p>
                      <p className="text-slate-500 text-xs mt-0.5">Invoices generated in PCS FieldService can be synced directly to your QuickBooks account.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <Btn onClick={connectQB} variant="default" size="md">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                      Reconnect
                    </Btn>
                    <Btn onClick={disconnectQB} variant="danger" size="md">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      Disconnect
                    </Btn>
                  </div>
                </div>

              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                    <p className="text-blue-400 text-sm font-semibold mb-1">Connect QuickBooks Online</p>
                    <p className="text-slate-500 text-xs leading-relaxed">
                      Sync your invoices directly to QuickBooks Online. You'll need a QuickBooks Online account (not Desktop) with admin access to your company.
                    </p>
                  </div>

                  <Btn onClick={connectQB} variant="success" size="lg">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    Connect QuickBooks
                  </Btn>
                </div>
              )}
            </CardBody>
          </Card>

          {/* ── Setup instructions (only when not connected) ── */}
          {!connected && !loading && (
            <Card>
              <CardHeader>
                <h3 className="text-sm font-semibold text-slate-200">Setup Instructions</h3>
              </CardHeader>
              <CardBody>
                <p className="text-slate-500 text-sm mb-4">Don't have QuickBooks yet? Follow these steps:</p>
                <ol className="space-y-3">
                  <Step num={1} text={<>Sign up for QuickBooks Online at <a href="https://quickbooks.intuit.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">quickbooks.intuit.com</a></>} />
                  <Step num={2} text="Complete your company setup in QuickBooks" />
                  <Step num={3} text='Return here and click "Connect QuickBooks"' />
                  <Step num={4} text="Log in with your QuickBooks credentials when prompted" />
                  <Step num={5} text="Authorize the connection to allow invoice syncing" />
                </ol>

                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex items-start gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400 flex-shrink-0 mt-0.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <p className="text-yellow-400 text-xs">This integration requires <strong>QuickBooks Online</strong>, not QuickBooks Desktop.</p>
                </div>
              </CardBody>
            </Card>
          )}

          {/* ── What syncs ── */}
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-slate-200">What Gets Synced</h3></CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: '🧾', label: 'Invoices',    text: 'Finalized invoices sync automatically with all line items and totals' },
                  { icon: '👤', label: 'Customers',   text: 'CBRE and other clients are matched or created as QuickBooks customers' },
                  { icon: '📦', label: 'Line Items',  text: 'Labor, materials, equipment and custom items map to QB service items' },
                ].map(item => (
                  <div key={item.label} className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl p-4">
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <p className="text-sm font-semibold text-slate-300 mb-1">{item.label}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

        </div>
      </div>
    </AppShell>
  );
}

export default function QuickBooksPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
          <p className="text-slate-500 text-sm">Loading…</p>
        </div>
      </div>
    }>
      <QBContent />
    </Suspense>
  );
}
