'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import AppShell from '@/app/components/AppShell';

const supabase = getSupabase();

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

const Btn = ({ children, onClick, disabled, type = 'button', variant = 'default', size = 'md', className = '' }) => {
  const variants = {
    default: 'bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:text-slate-100 hover:bg-[#2d2d44]',
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    danger:  'bg-red-600 hover:bg-red-500 text-white',
    ghost:   'text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2e]',
    gradient:'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors
        disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, hint, error, className = '', ...props }) => (
  <div>
    {label && <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">{label}</label>}
    <input
      className={`w-full bg-[#0a0a0f] border ${error ? 'border-red-500/50' : 'border-[#2d2d44]'} text-slate-200 placeholder-slate-600
        rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition ${className}`}
      {...props}
    />
    {hint  && <p className="text-slate-600 text-xs mt-1">{hint}</p>}
    {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
  </div>
);

const KV = ({ label, value }) => (
  <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl px-4 py-3">
    <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-1">{label}</p>
    <p className="text-slate-200 font-semibold text-sm">{value || <span className="text-slate-600 font-normal">Not set</span>}</p>
  </div>
);

// ── Admin tool card ──────────────────────────────────────────────────────────
const AdminTool = ({ icon, label, onClick }) => (
  <button onClick={onClick}
    className="flex flex-col items-center gap-2.5 p-4 bg-[#0a0a0f] border border-[#1e1e2e]
      hover:border-[#3d3d5e] hover:bg-[#1e1e2e]/40 rounded-xl transition group">
    <span className="text-2xl group-hover:scale-110 transition-transform">{icon}</span>
    <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition text-center leading-tight">{label}</span>
  </button>
);

// ════════════════════════════════════════════════════════════════════════════
export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser]     = useState(null);
  const [loading, setLoading]             = useState(true);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError]             = useState('');
  const [pwSuccess, setPwSuccess]         = useState('');
  const [changing, setChanging]           = useState(false);
  const [showCurrent, setShowCurrent]     = useState(false);
  const [showNew, setShowNew]             = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);

  const isSuperuser = currentUser?.email === 'jones.emfcontracting@gmail.com';

  useEffect(() => { fetchCurrentUser(); }, []);

  async function fetchCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      const { data } = await supabase.from('users').select('*').eq('auth_id', user.id).single();
      setCurrentUser(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError(''); setPwSuccess('');
    if (newPassword.length < 6)         { setPwError('New password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return; }
    if (currentPassword === newPassword) { setPwError('New password must differ from current'); return; }
    setChanging(true);
    try {
      const res  = await fetch('/api/users/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, userEmail: currentUser?.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
      setPwSuccess('Password changed successfully!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setPwSuccess(''), 5000);
    } catch (err) { setPwError(err.message); }
    finally { setChanging(false); }
  }

  // ── Eye toggle input ─────────────────────────────────────────────────────
  const PwInput = ({ label, value, onChange, show, onToggle, placeholder }) => (
    <div>
      <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">{label}</label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} required
          className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600
            rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:border-blue-500/60 transition" />
        <button type="button" onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition">
          {show
            ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          }
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <AppShell activeLink="/settings">
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <p className="text-slate-500 text-sm">Loading settings…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const roleLabel = currentUser?.role?.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <AppShell activeLink="/settings">
      <div className="min-h-screen bg-[#0a0a0f] text-slate-200">

        {/* ── Header ── */}
        <div className="border-b border-[#1e1e2e] bg-[#0d0d14] px-6 py-5">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Account preferences and configuration
              {isSuperuser && <span className="ml-2 text-purple-400 text-xs font-semibold">🔑 Superuser</span>}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-6 space-y-5">

          {/* ── Profile ── */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Profile Information
              </h2>
            </CardHeader>
            <CardBody>
              <div className="flex items-center gap-4 mb-5">
                {/* Avatar */}
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xl font-bold">
                    {currentUser?.first_name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-lg font-bold text-slate-100">{currentUser?.first_name} {currentUser?.last_name}</p>
                  <p className="text-slate-500 text-sm">{currentUser?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KV label="Role"   value={roleLabel} />
                <KV label="Phone"  value={currentUser?.phone} />
                <KV label="Carrier" value={currentUser?.sms_carrier?.replace(/_/g, ' ')} />
                <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl px-4 py-3">
                  <p className="text-slate-600 text-[10px] uppercase tracking-widest mb-1">Status</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border
                    ${currentUser?.is_active
                      ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                    {currentUser?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <p className="text-slate-600 text-xs mt-3">Contact an admin to update your phone number or carrier.</p>
            </CardBody>
          </Card>

          {/* ── Admin Tools (superuser only) ── */}
          {isSuperuser && (
            <Card className="border-purple-500/20">
              <CardHeader className="bg-gradient-to-r from-blue-500/5 to-purple-500/5">
                <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                  Admin Tools
                  <span className="text-xs text-purple-400 font-normal ml-1">Superuser only</span>
                </h2>
              </CardHeader>
              <CardBody>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
                  <AdminTool icon="👥" label="Manage Users"      onClick={() => router.push('/users')} />
                  <AdminTool icon="🤖" label="Automations"       onClick={() => router.push('/settings/automations')} />
                  <AdminTool icon="💰" label="QuickBooks"        onClick={() => router.push('/settings/quickbooks')} />
                  <AdminTool icon="🧱" label="Subcontractors"    onClick={() => router.push('/settings/subcontractors')} />
                  <AdminTool icon="🔍" label="Invoice Review"    onClick={() => router.push('/admin/subcontractor-invoices')} />
                  <AdminTool icon="🧾" label="Ext. Invoices"     onClick={() => router.push('/admin/invoice-verification')} />
                  <AdminTool icon="💬" label="Send Messages"     onClick={() => router.push('/messages')} />
                </div>
              </CardBody>
            </Card>
          )}

          {/* ── Change Password ── */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Change Password
              </h2>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                <PwInput label="Current Password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                  show={showCurrent} onToggle={() => setShowCurrent(p => !p)} placeholder="Enter current password" />
                <PwInput label="New Password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  show={showNew} onToggle={() => setShowNew(p => !p)} placeholder="Min 6 characters" />
                <PwInput label="Confirm New Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  show={showConfirm} onToggle={() => setShowConfirm(p => !p)} placeholder="Repeat new password" />

                {/* Strength indicator */}
                {newPassword.length > 0 && (
                  <div>
                    <div className="flex gap-1 mb-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full transition ${
                          newPassword.length >= i * 3
                            ? i <= 1 ? 'bg-red-500' : i <= 2 ? 'bg-yellow-500' : i <= 3 ? 'bg-blue-500' : 'bg-emerald-500'
                            : 'bg-[#2d2d44]'
                        }`} />
                      ))}
                    </div>
                    <p className="text-xs text-slate-600">
                      {newPassword.length < 4 ? 'Too short' : newPassword.length < 7 ? 'Weak' : newPassword.length < 10 ? 'Fair' : 'Strong'}
                    </p>
                  </div>
                )}

                {pwError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p className="text-red-400 text-xs">{pwError}</p>
                  </div>
                )}
                {pwSuccess && (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400 flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                    <p className="text-emerald-400 text-xs">{pwSuccess}</p>
                  </div>
                )}

                <Btn type="submit" disabled={changing} variant="primary" size="lg" className="w-full">
                  {changing ? 'Changing…' : 'Change Password'}
                </Btn>
              </form>

              <div className="mt-5 max-w-md">
                <div className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl p-4">
                  <p className="text-xs font-semibold text-slate-400 mb-2">Password Tips</p>
                  <ul className="space-y-1 text-xs text-slate-600">
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-slate-700 flex-shrink-0"/>Use at least 6 characters</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-slate-700 flex-shrink-0"/>Mix letters, numbers and symbols</li>
                    <li className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-slate-700 flex-shrink-0"/>Avoid common or reused passwords</li>
                  </ul>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* ── Notification Settings (read-only) ── */}
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M22 17H2a3 3 0 0 0 3-3V9a7 7 0 0 1 14 0v5a3 3 0 0 0 3 3zm-8.27 4a2 2 0 0 1-3.46 0"/></svg>
                Notification Settings
              </h2>
            </CardHeader>
            <CardBody>
              <p className="text-slate-500 text-sm mb-4">Your phone and carrier for receiving SMS job notifications.</p>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <KV label="Phone"   value={currentUser?.phone} />
                <KV label="Carrier" value={currentUser?.sms_carrier?.replace(/_/g, ' ')} />
              </div>
              {(!currentUser?.phone || !currentUser?.sms_carrier) && (
                <div className="mt-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 max-w-sm">
                  <p className="text-yellow-400 text-xs flex items-center gap-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    SMS notifications disabled — phone or carrier missing. Ask an admin to update your profile.
                  </p>
                </div>
              )}
            </CardBody>
          </Card>

        </div>
      </div>
    </AppShell>
  );
}
