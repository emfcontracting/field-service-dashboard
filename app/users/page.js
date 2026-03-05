'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import AppShell from '@/app/components/AppShell';

const supabase = getSupabase();

// ── Role config ──────────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  admin:        { label: 'Admin',        color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  office_staff: { label: 'Office Staff', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  office:       { label: 'Office',       color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  lead_tech:    { label: 'Lead Tech',    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  tech:         { label: 'Tech',         color: 'bg-teal-500/15 text-teal-400 border-teal-500/30' },
  helper:       { label: 'Helper',       color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};
const RoleBadge = ({ role }) => {
  const cfg = ROLE_CONFIG[role] || { label: role, color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>{cfg.label}</span>;
};

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
    warning: 'bg-yellow-600 hover:bg-yellow-500 text-white',
    danger:  'bg-red-600 hover:bg-red-500 text-white',
    ghost:   'text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2e]',
  };
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150
        disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

const Input = ({ label, hint, className = '', ...props }) => (
  <div>
    {label && <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">{label}</label>}
    <input
      className={`w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600
        rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition ${className}`}
      {...props}
    />
    {hint && <p className="text-slate-600 text-xs mt-1">{hint}</p>}
  </div>
);

const Select = ({ label, hint, children, className = '', ...props }) => (
  <div>
    {label && <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">{label}</label>}
    <select
      className={`w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200
        rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition ${className}`}
      {...props}>
      {children}
    </select>
    {hint && <p className="text-slate-600 text-xs mt-1">{hint}</p>}
  </div>
);

// ── Stat card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color = 'text-slate-200', warning = false }) => (
  <div className={`bg-[#0d0d14] border rounded-xl px-5 py-4 ${warning ? 'border-yellow-500/30' : 'border-[#1e1e2e]'}`}>
    <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">{label}</p>
    <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
  </div>
);

// ── Avatar initial ───────────────────────────────────────────────────────────
const Avatar = ({ name, role }) => {
  const colors = {
    admin: 'from-purple-600 to-purple-800', office_staff: 'from-blue-600 to-blue-800',
    office: 'from-blue-600 to-blue-800',   lead_tech: 'from-emerald-600 to-emerald-800',
    tech: 'from-teal-600 to-teal-800',     helper: 'from-slate-600 to-slate-800',
  };
  return (
    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors[role] || 'from-slate-600 to-slate-800'} flex items-center justify-center flex-shrink-0`}>
      <span className="text-white text-xs font-bold">{name?.charAt(0)?.toUpperCase()}</span>
    </div>
  );
};

// ── Format phone ─────────────────────────────────────────────────────────────
const fmtPhone = (p) => p?.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') || '';

// ════════════════════════════════════════════════════════════════════════════
export default function UserManagement() {
  const router = useRouter();
  const [users, setUsers]           = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [lookingUpCarrier, setLookingUpCarrier] = useState(false);
  const [carrierLookupResult, setCarrierLookupResult] = useState(null);

  const isSuperuser = currentUser?.email === 'jones.emfcontracting@gmail.com';
  const isAdmin = currentUser?.role === 'admin';

  // ── Wages state (admin-only) ──────────────────────────────────────────────
  const [wages, setWages] = useState({});       // { user_id: { rt, ot } }
  const [savingWage, setSavingWage] = useState(null); // user_id being saved
  const [wageForm, setWageForm] = useState({});  // { user_id: { rt, ot } } edit buffer

  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '', sms_carrier: '',
    role: 'lead_tech', regular_rate: 64, overtime_rate: 96, is_active: true,
  });

  useEffect(() => { checkAuth(); fetchUsers(); }, []);
  useEffect(() => { if (isAdmin) fetchWages(); }, [isAdmin]);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    const { data } = await supabase.from('users').select('*').eq('auth_id', user.id).single();
    setCurrentUser(data);
  }

  async function fetchUsers() {
    try {
      const { data, error } = await supabase.from('users').select('*').order('first_name');
      if (error) throw error;
      setUsers(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function fetchWages() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/admin/wages', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });
      if (!res.ok) return;
      const json = await res.json();
      const lookup = {};
      const formBuf = {};
      (json.data || []).forEach(w => {
        lookup[w.user_id]  = { rt: parseFloat(w.hourly_rate_regular) || 0, ot: parseFloat(w.hourly_rate_overtime) || 0, mi: parseFloat(w.mileage_rate) || 0.55 };
        formBuf[w.user_id] = { rt: parseFloat(w.hourly_rate_regular) || 0, ot: parseFloat(w.hourly_rate_overtime) || 0, mi: parseFloat(w.mileage_rate) || 0.55 };
      });
      setWages(lookup);
      setWageForm(formBuf);
    } catch (err) { console.error('Wage fetch error:', err); }
  }

  async function saveWage(userId) {
    try {
      setSavingWage(userId);
      const { data: { session } } = await supabase.auth.getSession();
      const form = wageForm[userId] || { rt: 0, ot: 0 };
      const res = await fetch('/api/admin/wages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ user_id: userId, hourly_rate_regular: form.rt, hourly_rate_overtime: form.ot, mileage_rate: form.mi }),
      });
      if (!res.ok) throw new Error('Save failed');
      setWages(prev => ({ ...prev, [userId]: { rt: form.rt, ot: form.ot, mi: form.mi } }));
      alert('✅ Wage saved!');
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSavingWage(null); }
  }

  const baseForm = { first_name:'', last_name:'', email:'', phone:'', sms_carrier:'', role:'lead_tech', regular_rate:64, overtime_rate:96, is_active:true };

  function openNewUserModal() {
    setEditingUser(null); setNewPassword(''); setShowPasswordReset(false);
    setCarrierLookupResult(null); setFormData(baseForm); setShowModal(true);
  }

  function openEditModal(user) {
    setEditingUser(user); setNewPassword(''); setShowPasswordReset(false); setCarrierLookupResult(null);
    setFormData({ first_name:user.first_name, last_name:user.last_name, email:user.email,
      phone:user.phone||'', sms_carrier:user.sms_carrier||'', role:user.role,
      regular_rate:user.regular_rate||64, overtime_rate:user.overtime_rate||96, is_active:user.is_active });
    setShowModal(true);
  }

  async function handleCarrierLookup() {
    if (!formData.phone) { setCarrierLookupResult({ success:false, message:'Enter a phone number first' }); return; }
    setLookingUpCarrier(true); setCarrierLookupResult(null);
    try {
      const res  = await fetch(`/api/carrier-lookup?phone=${encodeURIComponent(formData.phone)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lookup failed');
      if (data.carrier_code) {
        setFormData({ ...formData, sms_carrier: data.carrier_code });
        setCarrierLookupResult({ success:true, message:`✅ Detected: ${data.carrier_name} (${data.line_type||'wireless'})` });
      } else {
        setCarrierLookupResult({ success:false, message:`⚠️ "${data.carrier_name}" not in list. Select manually.` });
      }
    } catch (err) { setCarrierLookupResult({ success:false, message:`❌ ${err.message}` }); }
    finally { setLookingUpCarrier(false); }
  }

  async function handleSubmit(e) {
    e.preventDefault(); setSaving(true);
    try {
      if (editingUser) {
        const { error } = await supabase.from('users').update(formData).eq('user_id', editingUser.user_id);
        if (error) throw error;
        if (isSuperuser && showPasswordReset && newPassword) await handlePasswordReset(editingUser.user_id);
        alert('User updated!');
      } else {
        const { error } = await supabase.from('users').insert([formData]);
        if (error) throw error;
        alert('User created! Default PIN: 5678');
      }
      setShowModal(false); fetchUsers();
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSaving(false); }
  }

  async function handlePasswordReset(userId) {
    if (!newPassword || newPassword.length < 6) { alert('Minimum 6 characters'); return; }
    try {
      const res = await fetch('/api/users/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword, requestorEmail: currentUser.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('Password reset!'); setNewPassword(''); setShowPasswordReset(false);
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function handleDeleteUser(user) {
    if (!isSuperuser) { alert('Superuser only'); return; }
    const confirmation = prompt(`Type "DELETE" to permanently delete ${user.first_name} ${user.last_name}.\n\nThis removes all their hours, assignments and availability records.`);
    if (confirmation !== 'DELETE') { alert('Cancelled'); return; }
    try {
      const res = await fetch('/api/users/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.user_id, requestorEmail: currentUser.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert('✅ User deleted!'); fetchUsers();
    } catch (err) { alert('Error: ' + err.message); }
  }

  async function toggleUserStatus(user) {
    if (!confirm(`${user.is_active ? 'Deactivate' : 'Activate'} ${user.first_name} ${user.last_name}?`)) return;
    const { error } = await supabase.from('users').update({ is_active: !user.is_active }).eq('user_id', user.user_id);
    if (error) alert('Error: ' + error.message);
    else fetchUsers();
  }

  const filtered = users.filter(u => {
    const s = searchTerm.toLowerCase();
    const matchSearch = !s || u.first_name?.toLowerCase().includes(s) || u.last_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s);
    const matchRole   = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const stats = {
    total:          users.length,
    active:         users.filter(u => u.is_active).length,
    leadTechs:      users.filter(u => u.role === 'lead_tech').length,
    helpers:        users.filter(u => u.role === 'helper').length,
    missingCarrier: users.filter(u => u.is_active && !u.sms_carrier && ['lead_tech','helper','tech'].includes(u.role)).length,
  };

  if (loading) {
    return (
      <AppShell activeLink="/users">
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <p className="text-slate-500 text-sm">Loading users…</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell activeLink="/users">
      <div className="min-h-screen bg-[#0a0a0f] text-slate-200">

        {/* ── Header ── */}
        <div className="border-b border-[#1e1e2e] bg-[#0d0d14] px-6 py-5">
          <div className="max-w-7xl mx-auto flex justify-between items-center gap-4 flex-col sm:flex-row">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">User Management</h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Manage team members and access
                {isSuperuser && <span className="ml-2 text-purple-400 text-xs">🔑 Superuser</span>}
              </p>
            </div>
            <Btn onClick={openNewUserModal} variant="success" size="md">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add User
            </Btn>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

          {/* ── Stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <StatCard label="Total Users"    value={stats.total}          color="text-slate-200" />
            <StatCard label="Active"         value={stats.active}         color="text-blue-400" />
            <StatCard label="Lead Techs"     value={stats.leadTechs}      color="text-emerald-400" />
            <StatCard label="Helpers"        value={stats.helpers}        color="text-slate-400" />
            <StatCard label="Missing Carrier" value={stats.missingCarrier}
              color={stats.missingCarrier > 0 ? 'text-yellow-400' : 'text-emerald-400'}
              warning={stats.missingCarrier > 0} />
          </div>

          {/* ── Filters ── */}
          <Card>
            <CardBody className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search name or email…"
                  className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600
                    rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition" />
              </div>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                className="bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded-lg px-3 py-2.5 text-sm
                  focus:outline-none focus:border-blue-500/60 transition sm:w-44">
                <option value="all">All Roles</option>
                <option value="lead_tech">Lead Techs</option>
                <option value="tech">Techs</option>
                <option value="helper">Helpers</option>
                <option value="office">Office</option>
                <option value="admin">Admins</option>
              </select>
              {(searchTerm || roleFilter !== 'all') && (
                <Btn onClick={() => { setSearchTerm(''); setRoleFilter('all'); }} variant="ghost" size="md">Clear</Btn>
              )}
            </CardBody>
          </Card>

          {/* ── Users Table ── */}
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h2 className="text-sm font-semibold text-slate-300">
                {filtered.length} {filtered.length === 1 ? 'user' : 'users'}
                {(searchTerm || roleFilter !== 'all') && <span className="text-slate-500"> (filtered)</span>}
              </h2>
            </CardHeader>

            {filtered.length === 0 ? (
              <CardBody>
                <div className="text-center py-10 text-slate-600">
                  <p className="text-lg font-medium text-slate-500 mb-1">No users found</p>
                  <p className="text-sm">Try adjusting your filters.</p>
                </div>
              </CardBody>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e2e]">
                      {['Name', 'Email', 'Phone / Carrier', 'Role', isAdmin ? 'Actual Wage (RT/OT)' : 'Rates (RT/OT)', 'Status', ''].map(h => (
                        <th key={h} className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === '' ? 'text-center' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((user, i) => (
                      <tr key={user.user_id}
                        className={`border-b border-[#1e1e2e]/60 hover:bg-[#1e1e2e]/40 transition ${i % 2 !== 0 ? 'bg-[#0a0a0f]/30' : ''}`}>

                        {/* Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={user.first_name} role={user.role} />
                            <div>
                              <p className="font-semibold text-slate-200">{user.first_name} {user.last_name}</p>
                              {!user.is_active && <p className="text-xs text-red-400/70">Inactive</p>}
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-4 py-3 text-slate-400 text-xs">{user.email}</td>

                        {/* Phone / Carrier */}
                        <td className="px-4 py-3">
                          {user.phone ? (
                            <div className="space-y-1">
                              <p className="text-slate-300 text-xs font-mono">{fmtPhone(user.phone)}</p>
                              {user.sms_carrier
                                ? <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                                    📱 {user.sms_carrier.charAt(0).toUpperCase() + user.sms_carrier.slice(1)}
                                  </span>
                                : <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 font-semibold">
                                    ⚠ No carrier
                                  </span>
                              }
                            </div>
                          ) : (
                            <span className="text-slate-600 text-xs">—</span>
                          )}
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3"><RoleBadge role={user.role} /></td>

                        {/* Rates / Wages */}
                        <td className="px-4 py-3">
                          {isAdmin ? (
                            // Admin: show EK wage (actual) with inline edit
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number" step="0.50" placeholder="RT"
                                value={wageForm[user.user_id]?.rt ?? ''}
                                onChange={e => setWageForm(prev => ({ ...prev, [user.user_id]: { ...prev[user.user_id], rt: parseFloat(e.target.value) || 0 } }))}
                                className="w-16 bg-[#0a0a0f] border border-[#2d2d44] text-emerald-400 rounded px-1.5 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
                              />
                              <span className="text-slate-600 text-xs">/</span>
                              <input
                                type="number" step="0.50" placeholder="OT"
                                value={wageForm[user.user_id]?.ot ?? ''}
                                onChange={e => setWageForm(prev => ({ ...prev, [user.user_id]: { ...prev[user.user_id], ot: parseFloat(e.target.value) || 0 } }))}
                                className="w-16 bg-[#0a0a0f] border border-[#2d2d44] text-emerald-400 rounded px-1.5 py-1 text-xs font-mono focus:outline-none focus:border-emerald-500/60"
                              />
                              <span className="text-slate-600 text-xs">/</span>
                              <input
                                type="number" step="0.05" placeholder="mi"
                                value={wageForm[user.user_id]?.mi ?? ''}
                                onChange={e => setWageForm(prev => ({ ...prev, [user.user_id]: { ...prev[user.user_id], mi: parseFloat(e.target.value) || 0 } }))}
                                className="w-14 bg-[#0a0a0f] border border-[#2d2d44] text-sky-400 rounded px-1.5 py-1 text-xs font-mono focus:outline-none focus:border-sky-500/60"
                                title="Mileage reimbursement rate ($/mi)"
                              />
                              <button
                                onClick={() => saveWage(user.user_id)}
                                disabled={savingWage === user.user_id}
                                className="text-emerald-500 hover:text-emerald-400 disabled:opacity-40 text-xs px-1.5 py-1 rounded hover:bg-emerald-500/10 transition"
                                title="Save wages"
                              >
                                {savingWage === user.user_id ? '…' : '💾'}
                              </button>
                              {!wages[user.user_id] && (
                                <span className="text-yellow-500/70 text-[10px]">⚠ not set</span>
                              )}
                            </div>
                          ) : (
                            // Non-admin: billing rates only
                            <span className="font-mono text-xs text-slate-400">${user.regular_rate||64} / ${user.overtime_rate||96}</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border
                            ${user.is_active
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <Btn onClick={() => openEditModal(user)} variant="ghost" size="sm">Edit</Btn>
                            <Btn onClick={() => toggleUserStatus(user)}
                              variant="ghost" size="sm"
                              className={user.is_active ? 'text-orange-400 hover:text-orange-300' : 'text-emerald-400 hover:text-emerald-300'}>
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </Btn>
                            {isSuperuser && user.email !== 'jones.emfcontracting@gmail.com' && (
                              <Btn onClick={() => handleDeleteUser(user)} variant="ghost" size="sm" className="text-red-500/50 hover:text-red-400">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                              </Btn>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MODAL: Add / Edit User
        ══════════════════════════════════════════════════════════════════ */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl max-w-2xl w-full my-8 shadow-2xl">

              {/* Modal Header */}
              <div className="border-b border-[#1e1e2e] px-6 py-5 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-slate-100">{editingUser ? 'Edit User' : 'Add New User'}</h2>
                  {editingUser && <p className="text-slate-500 text-sm mt-0.5">{editingUser.first_name} {editingUser.last_name}</p>}
                </div>
                <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-300 text-2xl leading-none transition">×</button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

                  {/* Name row */}
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="First Name" required value={formData.first_name}
                      onChange={e => setFormData({...formData, first_name: e.target.value})} />
                    <Input label="Last Name" required value={formData.last_name}
                      onChange={e => setFormData({...formData, last_name: e.target.value})} />
                  </div>

                  <Input label="Email" type="email" required value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})} />

                  <Input label="Phone" type="tel" value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="(555) 123-4567" />

                  {/* Carrier row */}
                  <div>
                    <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Phone Carrier (SMS alerts)</label>
                    <div className="flex gap-2">
                      <select value={formData.sms_carrier} onChange={e => setFormData({...formData, sms_carrier: e.target.value})}
                        className="flex-1 bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition">
                        <option value="">— Select Carrier —</option>
                        {[['att','AT&T'],['boost','Boost Mobile'],['cricket','Cricket'],['googlefi','Google Fi'],['metro','Metro PCS'],['sprint','Sprint'],['straight_talk','Straight Talk'],['tmobile','T-Mobile'],['uscellular','US Cellular'],['verizon','Verizon'],['virgin','Virgin Mobile']].map(([v,l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                      <Btn onClick={handleCarrierLookup} disabled={!formData.phone || lookingUpCarrier} variant="primary" size="md">
                        {lookingUpCarrier ? '…' : '🔍 Detect'}
                      </Btn>
                    </div>
                    {carrierLookupResult && (
                      <p className={`text-xs mt-1.5 ${carrierLookupResult.success ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {carrierLookupResult.message}
                      </p>
                    )}
                    <p className="text-slate-600 text-xs mt-1">Required to receive text notifications</p>
                  </div>

                  <Select label="Role" required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="lead_tech">Lead Tech</option>
                    <option value="tech">Tech</option>
                    <option value="helper">Helper</option>
                    <option value="office">Office</option>
                    <option value="office_staff">Office Staff</option>
                    <option value="admin">Admin</option>
                  </Select>

                  {/* Rates row */}
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Regular Rate ($/hr)" type="number" value={formData.regular_rate}
                      onChange={e => setFormData({...formData, regular_rate: parseFloat(e.target.value)})}
                      hint="RT — up to 8 hrs" />
                    <Input label="Overtime Rate ($/hr)" type="number" value={formData.overtime_rate}
                      onChange={e => setFormData({...formData, overtime_rate: parseFloat(e.target.value)})}
                      hint="OT — over 8 hrs" />
                  </div>

                  {/* Password reset (superuser + edit only) */}
                  {isSuperuser && editingUser && (
                    <div className="border-t border-[#1e1e2e] pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">🔑 Password Reset</p>
                        <Btn onClick={() => setShowPasswordReset(p => !p)} variant="ghost" size="sm">
                          {showPasswordReset ? 'Cancel' : 'Change Password'}
                        </Btn>
                      </div>
                      {showPasswordReset && (
                        <Input type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                          placeholder="New password (min 6 characters)"
                          hint="Password saved when you click Update User" />
                      )}
                    </div>
                  )}

                  {/* Active toggle */}
                  <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition
                    ${formData.is_active ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-[#0a0a0f] border-[#2d2d44]'}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition
                      ${formData.is_active ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                      {formData.is_active && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <input type="checkbox" checked={formData.is_active}
                      onChange={e => setFormData({...formData, is_active: e.target.checked})} className="sr-only" />
                    <span className={`text-sm font-medium ${formData.is_active ? 'text-emerald-300' : 'text-slate-500'}`}>Active User</span>
                  </label>
                </div>

                {/* Modal Footer */}
                <div className="border-t border-[#1e1e2e] px-6 py-4 flex gap-3">
                  <Btn onClick={() => setShowModal(false)} variant="default" size="lg" className="flex-1">Cancel</Btn>
                  <Btn type="submit" disabled={saving} variant="primary" size="lg" className="flex-1">
                    {saving ? 'Saving…' : editingUser ? 'Update User' : 'Create User'}
                  </Btn>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
