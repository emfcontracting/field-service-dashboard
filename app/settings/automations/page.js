'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import AppShell from '@/app/components/AppShell';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const DEFAULT_AUTOMATIONS = [
  {
    automation_key: 'availability_reminder',
    name: 'Availability Reminder',
    description: 'Reminds field techs to submit their daily availability',
    schedule_time: '19:00',
    schedule_days: ['monday','tuesday','wednesday','thursday','friday','sunday'],
    target_roles: ['lead_tech','tech','helper'],
    send_sms: true, send_email: true,
    sms_message: 'EMF: Please submit your availability for tomorrow in the mobile app.',
    email_subject: '⏰ Daily Availability Reminder - EMF',
    is_enabled: true, condition_type: 'missing_submission', icon: '📅',
  },
  {
    automation_key: 'hours_reminder',
    name: 'Hours Entry Reminder',
    description: 'Reminds techs to log their hours for the day',
    schedule_time: '18:00',
    schedule_days: ['monday','tuesday','wednesday','thursday','friday'],
    target_roles: ['lead_tech','tech','helper'],
    send_sms: true, send_email: true,
    sms_message: 'EMF: Please log your hours for today in the mobile app before EOD.',
    email_subject: '⏰ Daily Hours Reminder - EMF',
    is_enabled: false, condition_type: 'always', icon: '⏱️',
  },
  {
    automation_key: 'aging_alert',
    name: 'Aging Work Order Alert',
    description: 'Alerts techs about work orders open 2+ days',
    schedule_time: '08:00',
    schedule_days: ['monday','tuesday','wednesday','thursday','friday'],
    target_roles: ['lead_tech','tech'],
    send_sms: false, send_email: true,
    sms_message: 'EMF: You have aging work orders. Check your app for details.',
    email_subject: '⚠️ Aging Work Orders Alert - EMF',
    is_enabled: false, condition_type: 'has_aging_wo', icon: '⚠️',
  },
  {
    automation_key: 'weekly_schedule',
    name: 'Weekly Schedule Summary',
    description: 'Sends weekly schedule to all techs on Sunday evening',
    schedule_time: '18:00',
    schedule_days: ['sunday'],
    target_roles: ['lead_tech','tech','helper'],
    send_sms: false, send_email: true,
    sms_message: 'EMF: Your weekly schedule has been sent to your email.',
    email_subject: '📋 Your Week Ahead - EMF Schedule',
    is_enabled: false, condition_type: 'always', icon: '📋',
  },
];

const DAYS = [
  { key:'sunday',    label:'Sun' },
  { key:'monday',    label:'Mon' },
  { key:'tuesday',   label:'Tue' },
  { key:'wednesday', label:'Wed' },
  { key:'thursday',  label:'Thu' },
  { key:'friday',    label:'Fri' },
  { key:'saturday',  label:'Sat' },
];

const ROLES = [
  { key:'admin',        label:'Admin' },
  { key:'office',       label:'Office' },
  { key:'lead_tech',    label:'Lead Tech' },
  { key:'tech',         label:'Tech' },
  { key:'helper',       label:'Helper' },
];

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
    danger:  'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/20',
    ghost:   'text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2e]',
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

// ── Toggle switch ────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }) => (
  <button onClick={onChange} type="button"
    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
      ${checked ? 'bg-emerald-600' : 'bg-[#2d2d44]'}`}>
    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform
      ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

// ── Pill toggle ──────────────────────────────────────────────────────────────
const Pill = ({ active, onClick, children }) => (
  <button onClick={onClick} type="button"
    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition border
      ${active
        ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
        : 'bg-[#0a0a0f] text-slate-500 border-[#1e1e2e] hover:border-[#2d2d44] hover:text-slate-300'}`}>
    {children}
  </button>
);

// ── Check row ────────────────────────────────────────────────────────────────
const CheckRow = ({ id, checked, onChange, children }) => (
  <label htmlFor={id}
    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition
      ${checked ? 'bg-blue-500/10 border-blue-500/20' : 'bg-[#0a0a0f] border-[#1e1e2e] hover:border-[#2d2d44]'}`}>
    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition
      ${checked ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`}>
      {checked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
    </div>
    <input type="checkbox" id={id} checked={checked} onChange={onChange} className="sr-only" />
    <span className={`text-xs font-medium ${checked ? 'text-blue-300' : 'text-slate-400'}`}>{children}</span>
  </label>
);

const Input = ({ label, hint, className = '', ...props }) => (
  <div>
    {label && <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">{label}</label>}
    <input className={`w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600
      rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition ${className}`} {...props} />
    {hint && <p className="text-slate-600 text-xs mt-1">{hint}</p>}
  </div>
);

// ════════════════════════════════════════════════════════════════════════════
export default function AutomationsPage() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [editingId, setEditingId]     = useState(null);
  const [showAddNew, setShowAddNew]   = useState(false);
  const [toast, setToast]             = useState(null);

  const showToast = (text, type = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [newAuto, setNewAuto] = useState({
    name:'', description:'', schedule_time:'19:00', icon:'📨',
    schedule_days:['monday','tuesday','wednesday','thursday','friday'],
    target_roles:['lead_tech','tech','helper'],
    send_sms:true, send_email:true, sms_message:'', email_subject:'',
    is_enabled:true, condition_type:'always',
  });

  useEffect(() => { fetchAutomations(); }, []);

  async function fetchAutomations() {
    try {
      const { data, error } = await supabase.from('automated_messages').select('*').order('name');
      if (error || !data?.length) {
        setAutomations(DEFAULT_AUTOMATIONS.map((a, i) => ({ ...a, id: `default-${i}` })));
      } else {
        setAutomations(data);
      }
    } catch { setAutomations(DEFAULT_AUTOMATIONS.map((a, i) => ({ ...a, id: `default-${i}` }))); }
    finally { setLoading(false); }
  }

  async function toggleAutomation(automation) {
    const val = !automation.is_enabled;
    setAutomations(p => p.map(a => a.id === automation.id ? { ...a, is_enabled: val } : a));
    try {
      if (!automation.id.toString().startsWith('default-')) {
        await supabase.from('automated_messages').update({ is_enabled: val, updated_at: new Date().toISOString() }).eq('id', automation.id);
      } else {
        await saveAutomation({ ...automation, is_enabled: val });
      }
      showToast(`${automation.name} ${val ? 'enabled' : 'disabled'}`);
    } catch {
      setAutomations(p => p.map(a => a.id === automation.id ? { ...a, is_enabled: !val } : a));
    }
  }

  async function saveAutomation(automation) {
    setSaving(true);
    try {
      const d = {
        automation_key: automation.automation_key, name: automation.name,
        description: automation.description, schedule_time: automation.schedule_time,
        schedule_days: automation.schedule_days, target_roles: automation.target_roles,
        send_sms: automation.send_sms, send_email: automation.send_email,
        sms_message: automation.sms_message, email_subject: automation.email_subject,
        is_enabled: automation.is_enabled, condition_type: automation.condition_type,
        icon: automation.icon, updated_at: new Date().toISOString(),
      };
      if (automation.id && !automation.id.toString().startsWith('default-') && !automation.id.toString().startsWith('new-')) {
        const { error } = await supabase.from('automated_messages').update(d).eq('id', automation.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('automated_messages').insert(d).select().single();
        if (error) throw error;
        setAutomations(p => p.map(a => a.automation_key === automation.automation_key ? { ...a, id: data.id } : a));
      }
      showToast('Saved!');
      setEditingId(null);
    } catch { showToast('Failed to save. DB table may not exist.', 'error'); }
    finally { setSaving(false); }
  }

  async function deleteAutomation(automation) {
    if (!confirm(`Delete "${automation.name}"?`)) return;
    try {
      if (!automation.id.toString().startsWith('default-') && !automation.id.toString().startsWith('new-')) {
        await supabase.from('automated_messages').delete().eq('id', automation.id);
      }
      setAutomations(p => p.filter(a => a.id !== automation.id));
      showToast('Deleted');
    } catch { showToast('Delete failed', 'error'); }
  }

  async function addNewAutomation() {
    if (!newAuto.name || !newAuto.sms_message) { showToast('Name and SMS message required', 'error'); return; }
    const key = newAuto.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const automation = { ...newAuto, automation_key: key, id: `new-${Date.now()}` };
    setAutomations(p => [...p, automation]);
    await saveAutomation(automation);
    setShowAddNew(false);
    setNewAuto({ name:'', description:'', schedule_time:'19:00', icon:'📨', schedule_days:['monday','tuesday','wednesday','thursday','friday'], target_roles:['lead_tech','tech','helper'], send_sms:true, send_email:true, sms_message:'', email_subject:'', is_enabled:true, condition_type:'always' });
  }

  const updateAuto = (id, field, val) => setAutomations(p => p.map(a => a.id === id ? { ...a, [field]: val } : a));
  const toggleDay  = (id, day)  => updateAuto(id, 'schedule_days', automations.find(a=>a.id===id).schedule_days?.includes(day) ? automations.find(a=>a.id===id).schedule_days.filter(d=>d!==day) : [...(automations.find(a=>a.id===id).schedule_days||[]), day]);
  const toggleRole = (id, role) => updateAuto(id, 'target_roles',  automations.find(a=>a.id===id).target_roles?.includes(role) ? automations.find(a=>a.id===id).target_roles.filter(r=>r!==role) : [...(automations.find(a=>a.id===id).target_roles||[]), role]);

  // ── Shared form fields ─────────────────────────────────────────────────
  const AutoForm = ({ data, onChange, onDayToggle, onRoleToggle }) => (
    <div className="space-y-5">
      {/* Time + Icon */}
      <div className="grid grid-cols-2 gap-3">
        <Input label="Send Time (EST)" type="time" value={data.schedule_time}
          onChange={e => onChange('schedule_time', e.target.value)} />
        <Input label="Icon" value={data.icon || '📨'} maxLength={2}
          onChange={e => onChange('icon', e.target.value)} hint="Single emoji" />
      </div>

      {/* Days */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">Send On Days</p>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(d => (
            <Pill key={d.key} active={(data.schedule_days||[]).includes(d.key)} onClick={() => onDayToggle(d.key)}>
              {d.label}
            </Pill>
          ))}
        </div>
      </div>

      {/* Roles */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">Send To Roles</p>
        <div className="flex flex-wrap gap-1.5">
          {ROLES.map(r => (
            <Pill key={r.key}
              active={(data.target_roles||[]).includes(r.key)}
              onClick={() => onRoleToggle(r.key)}>
              {r.label}
            </Pill>
          ))}
        </div>
      </div>

      {/* Delivery */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">Delivery Methods</p>
        <div className="flex gap-2">
          <CheckRow id={`sms-${data.automation_key||'new'}`} checked={data.send_sms} onChange={e => onChange('send_sms', e.target.checked)}>📱 SMS</CheckRow>
          <CheckRow id={`email-${data.automation_key||'new'}`} checked={data.send_email} onChange={e => onChange('send_email', e.target.checked)}>📧 Email</CheckRow>
        </div>
      </div>

      {/* SMS message */}
      <div>
        <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">
          SMS Message <span className="text-slate-700 normal-case tracking-normal ml-1 font-normal">({(data.sms_message||'').length}/160)</span>
        </label>
        <textarea value={data.sms_message||''} maxLength={160} rows={3}
          onChange={e => onChange('sms_message', e.target.value.slice(0,160))}
          placeholder="SMS message text…"
          className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600
            rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition resize-none" />
      </div>

      {/* Email subject */}
      <Input label="Email Subject" value={data.email_subject||''}
        onChange={e => onChange('email_subject', e.target.value)}
        placeholder="Email subject line…" />
    </div>
  );

  if (loading) {
    return (
      <AppShell activeLink="/settings">
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />
            <p className="text-slate-500 text-sm">Loading automations…</p>
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
          <div className="max-w-5xl mx-auto flex justify-between items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Automated Messages</h1>
              <p className="text-slate-500 text-sm mt-0.5">Configure automatic SMS and email notifications</p>
            </div>
            <Btn onClick={() => setShowAddNew(true)} variant="success" size="md">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Automation
            </Btn>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-6 space-y-4">

          {/* ── Automation cards ── */}
          {automations.map(auto => {
            const isEditing = editingId === auto.id;
            return (
              <Card key={auto.id} className={auto.is_enabled ? 'border-emerald-500/20' : ''}>
                {/* Card top bar */}
                {auto.is_enabled && <div className="h-0.5 bg-emerald-500/40 rounded-t-xl" />}

                {/* Header row */}
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl flex-shrink-0">{auto.icon || '📨'}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-100 text-base leading-tight">{auto.name}</p>
                      <p className="text-slate-500 text-xs mt-0.5 truncate">{auto.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Toggle checked={auto.is_enabled} onChange={() => toggleAutomation(auto)} />
                    <span className={`text-xs font-semibold w-12 ${auto.is_enabled ? 'text-emerald-400' : 'text-slate-600'}`}>
                      {auto.is_enabled ? 'Active' : 'Off'}
                    </span>
                    <button onClick={() => setEditingId(isEditing ? null : auto.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-300 hover:bg-[#1e1e2e] transition">
                      {isEditing
                        ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
                      }
                    </button>
                  </div>
                </div>

                {/* Info chips */}
                <div className="px-5 pb-4 flex flex-wrap gap-2">
                  <span className="flex items-center gap-1 text-xs text-slate-600 bg-[#0a0a0f] border border-[#1e1e2e] rounded-full px-2.5 py-1">
                    🕐 {auto.schedule_time} EST
                  </span>
                  <span className="flex items-center gap-1 text-xs text-slate-600 bg-[#0a0a0f] border border-[#1e1e2e] rounded-full px-2.5 py-1">
                    📅 {(auto.schedule_days||[]).map(d => d.slice(0,3).charAt(0).toUpperCase()+d.slice(1,3)).join(' · ')}
                  </span>
                  {auto.send_sms   && <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2.5 py-1 font-semibold">📱 SMS</span>}
                  {auto.send_email && <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 rounded-full px-2.5 py-1 font-semibold">📧 Email</span>}
                </div>

                {/* Expanded edit panel */}
                {isEditing && (
                  <div className="border-t border-[#1e1e2e] px-5 py-5 space-y-5 bg-[#0a0a0f]/40">
                    <AutoForm
                      data={auto}
                      onChange={(field, val) => updateAuto(auto.id, field, val)}
                      onDayToggle={day  => toggleDay(auto.id, day)}
                      onRoleToggle={role => toggleRole(auto.id, role)}
                    />
                    <div className="flex justify-between items-center pt-2 border-t border-[#1e1e2e]">
                      <Btn onClick={() => deleteAutomation(auto)} variant="danger" size="sm">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Delete
                      </Btn>
                      <div className="flex gap-2">
                        <Btn onClick={() => setEditingId(null)} variant="default" size="md">Cancel</Btn>
                        <Btn onClick={() => saveAutomation(auto)} disabled={saving} variant="primary" size="md">
                          {saving ? 'Saving…' : 'Save Changes'}
                        </Btn>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}

          {/* ── Info box ── */}
          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4 mt-2">
            <p className="text-xs font-semibold text-blue-400 mb-2">How Automations Work</p>
            <ul className="space-y-1 text-xs text-slate-600">
              {['Automations run at the scheduled time on each enabled day','SMS requires users to have phone number and carrier set in their profile','Email requires users to have an email address in their profile','The availability reminder only sends to users who haven\'t submitted yet','All times are Eastern Standard Time (EST)'].map((t, i) => (
                <li key={i} className="flex items-start gap-1.5"><span className="w-1 h-1 rounded-full bg-slate-700 flex-shrink-0 mt-1.5"/>  {t}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ADD NEW MODAL
        ══════════════════════════════════════════════════════════════════ */}
        {showAddNew && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl max-w-lg w-full my-8 shadow-2xl">
              <div className="border-b border-[#1e1e2e] px-6 py-5 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-100">New Automation</h2>
                <button onClick={() => setShowAddNew(false)} className="text-slate-500 hover:text-slate-300 text-2xl leading-none">×</button>
              </div>

              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Name *</label>
                  <input value={newAuto.name} onChange={e => setNewAuto({...newAuto, name: e.target.value})}
                    placeholder="e.g. Morning Check-in"
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition" />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Description</label>
                  <input value={newAuto.description} onChange={e => setNewAuto({...newAuto, description: e.target.value})}
                    placeholder="What does this automation do?"
                    className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition" />
                </div>

                <AutoForm
                  data={newAuto}
                  onChange={(field, val) => setNewAuto(p => ({ ...p, [field]: val }))}
                  onDayToggle={day => setNewAuto(p => ({ ...p, schedule_days: p.schedule_days.includes(day) ? p.schedule_days.filter(d=>d!==day) : [...p.schedule_days, day] }))}
                  onRoleToggle={role => setNewAuto(p => ({ ...p, target_roles: p.target_roles.includes(role) ? p.target_roles.filter(r=>r!==role) : [...p.target_roles, role] }))}
                />
              </div>

              <div className="border-t border-[#1e1e2e] px-6 py-4 flex gap-3">
                <Btn onClick={() => setShowAddNew(false)} variant="default" size="lg" className="flex-1">Cancel</Btn>
                <Btn onClick={addNewAutomation} disabled={saving} variant="success" size="lg" className="flex-1">
                  {saving ? 'Creating…' : 'Create Automation'}
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
