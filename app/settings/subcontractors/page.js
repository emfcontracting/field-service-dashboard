'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '@/app/components/AppShell';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ── Role config ──────────────────────────────────────────────────────────────
const ROLE_COLORS = {
  lead_tech: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  tech:      'bg-blue-500/15 text-blue-400 border-blue-500/30',
  helper:    'bg-slate-500/15 text-slate-400 border-slate-500/30',
};

const SUB_STATUS = {
  active:  { badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  trial:   { badge: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',   dot: 'bg-yellow-400' },
  expired: { badge: 'bg-red-500/15 text-red-400 border-red-500/30',            dot: 'bg-red-400' },
  none:    { badge: 'bg-slate-500/15 text-slate-500 border-slate-500/20',      dot: 'bg-slate-600' },
};

// ── UI primitives ────────────────────────────────────────────────────────────
const Card = ({ children, className = '' }) => (
  <div className={`bg-[#0d0d14] border border-[#1e1e2e] rounded-xl ${className}`}>{children}</div>
);
const CardHeader = ({ children, className = '' }) => (
  <div className={`px-5 py-4 border-b border-[#1e1e2e] ${className}`}>{children}</div>
);

const Toggle = ({ checked, onChange, disabled }) => (
  <button onClick={onChange} disabled={disabled} type="button"
    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
      disabled:opacity-40 disabled:cursor-not-allowed
      ${checked ? 'bg-emerald-600' : 'bg-[#2d2d44]'}`}>
    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
      ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

const Avatar = ({ name, role }) => {
  const grad = {
    lead_tech: 'from-purple-600 to-purple-800',
    tech:      'from-blue-600 to-blue-800',
    helper:    'from-slate-600 to-slate-800',
  };
  return (
    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${grad[role] || 'from-slate-600 to-slate-800'}
      flex items-center justify-center flex-shrink-0`}>
      <span className="text-white text-sm font-bold">{name?.charAt(0)?.toUpperCase()}</span>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
export default function SubcontractorsPage() {
  const [users, setUsers]       = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(null);
  const [toast, setToast]       = useState(null);

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const { data: usersData } = await supabase
        .from('users').select('user_id, first_name, last_name, email, role')
        .eq('is_active', true).in('role', ['lead_tech','tech','helper']).order('first_name');

      const { data: profilesData } = await supabase.from('subcontractor_profiles').select('*');

      const map = {};
      (profilesData || []).forEach(p => { map[p.user_id] = p; });

      setUsers(usersData || []);
      setProfiles(map);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function toggleSubcontractor(userId, enable) {
    setSaving(userId);
    try {
      if (enable) {
        const { error } = await supabase.from('subcontractor_profiles').upsert({
          user_id: userId, is_enabled: true, subscription_status: 'trial',
          hourly_rate: 35.00, ot_rate: 52.50, mileage_rate: 0.67,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (error) throw error;
        setProfiles(p => ({ ...p, [userId]: { ...p[userId], user_id: userId, is_enabled: true, subscription_status: p[userId]?.subscription_status || 'trial' } }));
      } else {
        const { error } = await supabase.from('subcontractor_profiles')
          .update({ is_enabled: false, updated_at: new Date().toISOString() }).eq('user_id', userId);
        if (error) throw error;
        setProfiles(p => ({ ...p, [userId]: { ...p[userId], is_enabled: false } }));
      }
      showToast(enable ? 'Subcontractor access enabled' : 'Access disabled');
    } catch (err) {
      showToast('Failed to update. Check subcontractor tables exist.', 'error');
    } finally { setSaving(null); }
  }

  async function updateSubscription(userId, status) {
    setSaving(userId);
    try {
      const { error } = await supabase.from('subcontractor_profiles')
        .update({ subscription_status: status, updated_at: new Date().toISOString() }).eq('user_id', userId);
      if (error) throw error;
      setProfiles(p => ({ ...p, [userId]: { ...p[userId], subscription_status: status } }));
      showToast('Subscription updated');
    } catch { showToast('Failed to update subscription', 'error'); }
    finally { setSaving(null); }
  }

  // Stats
  const enabled = Object.values(profiles).filter(p => p.is_enabled).length;
  const active  = Object.values(profiles).filter(p => p.is_enabled && p.subscription_status === 'active').length;
  const trial   = Object.values(profiles).filter(p => p.is_enabled && p.subscription_status === 'trial').length;

  if (loading) {
    return (
      <AppShell activeLink="/settings">
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <p className="text-slate-500 text-sm">Loading…</p>
          </div>
        </div>
      </AppShell>
    );
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
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-100">Subcontractor Management</h1>
            <p className="text-slate-500 text-sm mt-0.5">Enable portal access and manage subscription status for field workers</p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">

          {/* ── Stats row ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Portal Enabled', value: enabled, color: 'text-blue-400' },
              { label: 'Active',         value: active,  color: 'text-emerald-400' },
              { label: 'Trial',          value: trial,   color: 'text-yellow-400' },
            ].map(s => (
              <Card key={s.label}>
                <div className="px-5 py-4">
                  <p className="text-slate-600 text-xs uppercase tracking-widest mb-1">{s.label}</p>
                  <p className={`text-3xl font-bold font-mono ${s.color}`}>{s.value}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* ── Info box ── */}
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-400 mb-2">About the Subcontractor Portal</p>
            <ul className="space-y-1 text-xs text-slate-600">
              {[
                'Subcontractors access /contractor with their own PIN',
                'They pull hours & mileage from EMF work and generate invoices',
                'Invoices are emailed directly to emfcontractingsc2@gmail.com',
                'They can configure their own hourly, OT, and mileage rates',
                'Use subscription status to control access for billing purposes',
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-slate-700 flex-shrink-0 mt-1.5" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* ── Workers table ── */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-200">Field Workers</h2>
            </CardHeader>

            <div className="divide-y divide-[#1e1e2e]">
              {users.map(user => {
                const profile   = profiles[user.user_id];
                const isEnabled = profile?.is_enabled;
                const status    = profile?.subscription_status || 'none';
                const isSaving  = saving === user.user_id;
                const statusCfg = SUB_STATUS[status] || SUB_STATUS.none;

                return (
                  <div key={user.user_id}
                    className={`px-5 py-4 flex items-center justify-between gap-4 transition
                      ${isEnabled ? 'bg-emerald-500/3' : ''}`}>

                    {/* Left — user info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={user.first_name} role={user.role} />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-200 text-sm leading-tight">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-slate-600 text-xs truncate">{user.email}</p>
                        <div className="mt-1">
                          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize
                            ${ROLE_COLORS[user.role] || 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>
                            {user.role.replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right — controls */}
                    <div className="flex items-center gap-3 flex-shrink-0">

                      {/* Subscription status pill / selector */}
                      {isEnabled ? (
                        <div className="relative">
                          <select
                            value={status}
                            onChange={e => updateSubscription(user.user_id, e.target.value)}
                            disabled={isSaving}
                            className={`appearance-none pl-6 pr-7 py-1.5 rounded-full text-xs font-bold border cursor-pointer
                              bg-transparent focus:outline-none transition disabled:opacity-40
                              ${statusCfg.badge}`}>
                            <option value="trial">Trial</option>
                            <option value="active">Active</option>
                            <option value="expired">Expired</option>
                          </select>
                          {/* dot */}
                          <span className={`absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                          {/* chevron */}
                          <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-current opacity-60"
                            width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border
                          ${SUB_STATUS.none.badge}`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                          Disabled
                        </span>
                      )}

                      {/* Toggle */}
                      <Toggle
                        checked={!!isEnabled}
                        onChange={() => toggleSubcontractor(user.user_id, !isEnabled)}
                        disabled={isSaving}
                      />

                      {/* Spinner overlay when saving */}
                      {isSaving && (
                        <div className="w-4 h-4 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
                      )}
                    </div>
                  </div>
                );
              })}

              {users.length === 0 && (
                <div className="px-5 py-10 text-center text-slate-600">
                  <p className="text-sm">No active field workers found.</p>
                </div>
              )}
            </div>
          </Card>

          {/* ── DB setup notice ── */}
          <div className="bg-yellow-500/5 border border-yellow-500/15 rounded-xl p-4 flex items-start gap-3">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              className="text-yellow-400 flex-shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <p className="text-yellow-400 text-xs font-semibold mb-1">Database Setup Required</p>
              <p className="text-slate-600 text-xs">If you see errors, run the migration in Supabase:</p>
              <code className="text-xs text-slate-500 bg-[#0a0a0f] border border-[#1e1e2e] rounded-lg px-2.5 py-1.5 mt-1.5 inline-block font-mono">
                database/migrations/create_subcontractor_tables.sql
              </code>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
