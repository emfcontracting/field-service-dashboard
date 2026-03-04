'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import AppShell from '@/app/components/AppShell';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

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
  const v = {
    default: 'bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:text-slate-100 hover:bg-[#2d2d44]',
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    danger:  'bg-red-600/20 text-red-400 hover:bg-red-600/30 border border-red-500/20',
  };
  const s = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base' };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${v[variant]} ${s[size]} ${className}`}>
      {children}
    </button>
  );
};

const Inp = ({ label, hint, className = '', ...props }) => (
  <div>
    {label && <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">{label}</label>}
    <input className={`w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition ${className}`} {...props} />
    {hint && <p className="text-slate-600 text-[10px] mt-1">{hint}</p>}
  </div>
);

const Sel = ({ label, className = '', children, ...props }) => (
  <div>
    {label && <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">{label}</label>}
    <select className={`w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition ${className}`} {...props}>{children}</select>
  </div>
);

const TA = ({ label, className = '', ...props }) => (
  <div>
    {label && <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">{label}</label>}
    <textarea className={`w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition resize-none ${className}`} {...props} />
  </div>
);

const SRow = ({ label, value, hi, bold, top }) => (
  <div className={`flex justify-between items-center py-2 ${top ? 'border-t-2 border-[#2d2d44] mt-2' : 'border-b border-[#1e1e2e]'}`}>
    <span className={`text-sm ${hi ? 'text-yellow-400' : 'text-slate-500'}`}>{label}</span>
    <span className={`font-mono text-sm ${bold ? 'text-2xl font-bold text-blue-400' : hi ? 'text-yellow-400 font-semibold' : 'text-slate-300 font-semibold'}`}>{value}</span>
  </div>
);

const STATUS_CFG = {
  pending:      { label: 'Pending',            color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  assigned:     { label: 'Assigned',           color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  in_progress:  { label: 'In Progress',        color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  needs_return: { label: 'Review for Invoice', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  completed:    { label: 'Completed',          color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
};

export default function WorkOrderDetail({ params }) {
  const router = useRouter();
  const workOrderId = params?.id;

  const [workOrder,   setWorkOrder]   = useState(null);
  const [users,       setUsers]       = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [dailyLogs,   setDailyLogs]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [addUserId,   setAddUserId]   = useState('');
  const [addRole,     setAddRole]     = useState('helper');
  const [showModal,   setShowModal]   = useState(false);
  const [selUser,     setSelUser]     = useState(null);
  const [entry,       setEntry]       = useState({
    workDate: new Date().toISOString().split('T')[0], rt: '', ot: '', miles: '', notes: '',
  });

  useEffect(() => { if (workOrderId) fetchAll(); }, [workOrderId]);

  async function fetchAll() {
    await Promise.all([fetchUsers(), fetchWorkOrder(), fetchTeamMembers(), fetchDailyLogs()]);
  }
  async function fetchUsers() {
    const { data } = await supabase.from('users').select('*').eq('is_active', true).order('first_name');
    setUsers(data || []);
  }
  async function fetchWorkOrder() {
    const { data, error } = await supabase.from('work_orders')
      .select('*, lead_tech:lead_tech_id(user_id, first_name, last_name)')
      .eq('wo_id', workOrderId).single();
    if (error) { alert('Error loading work order'); setLoading(false); return; }
    setWorkOrder(data); setLoading(false);
  }
  async function fetchTeamMembers() {
    const { data } = await supabase.from('work_order_assignments')
      .select('*, users:user_id(user_id, first_name, last_name, hourly_rate_regular, hourly_rate_overtime)')
      .eq('wo_id', workOrderId);
    setTeamMembers(data || []);
  }
  async function fetchDailyLogs() {
    const { data } = await supabase.from('daily_hours_log')
      .select('*, user:users(user_id, first_name, last_name)')
      .eq('wo_id', workOrderId).order('work_date', { ascending: false });
    setDailyLogs(data || []);
  }

  async function updateWO(updates) {
    setSaving(true);
    const { error } = await supabase.from('work_orders').update(updates).eq('wo_id', workOrderId);
    if (error) alert('Error updating work order');
    else setWorkOrder(p => ({ ...p, ...updates }));
    setSaving(false);
  }
  async function addMember() {
    if (!addUserId) return;
    setSaving(true);
    const { error } = await supabase.from('work_order_assignments')
      .insert({ wo_id: workOrderId, user_id: addUserId, role_on_job: addRole, hours_regular: 0, hours_overtime: 0, miles: 0 });
    if (error) alert('Error: ' + error.message);
    else { await fetchTeamMembers(); setAddUserId(''); }
    setSaving(false);
  }
  async function updateMember(id, updates) {
    setSaving(true);
    await supabase.from('work_order_assignments').update(updates).eq('assignment_id', id);
    setTeamMembers(p => p.map(tm => tm.assignment_id === id ? { ...tm, ...updates } : tm));
    setSaving(false);
  }
  async function removeMember(id, name) {
    if (!confirm(`Remove ${name}?`)) return;
    setSaving(true);
    await supabase.from('work_order_assignments').delete().eq('assignment_id', id);
    await fetchTeamMembers(); setSaving(false);
  }
  async function addHours() {
    if (!selUser) { alert('Select a user'); return; }
    const rt = parseFloat(entry.rt) || 0, ot = parseFloat(entry.ot) || 0;
    if (!rt && !ot) { alert('Enter at least one hour'); return; }
    if (rt + ot > 24) { alert('Total cannot exceed 24 hours'); return; }
    setSaving(true);
    const { data: ex } = await supabase.from('daily_hours_log').select('id')
      .eq('wo_id', workOrderId).eq('user_id', selUser.user_id).eq('work_date', entry.workDate).single();
    if (ex) { alert('Hours already logged for this date.'); setSaving(false); return; }
    const asgn = teamMembers.find(tm => tm.user_id === selUser.user_id);
    const { error } = await supabase.from('daily_hours_log').insert({
      wo_id: workOrderId, user_id: selUser.user_id, assignment_id: asgn?.assignment_id || null,
      work_date: entry.workDate, hours_regular: rt, hours_overtime: ot,
      miles: parseFloat(entry.miles) || 0, notes: entry.notes || null,
    });
    if (error) alert('Error: ' + error.message);
    else {
      await fetchDailyLogs(); setShowModal(false); setSelUser(null);
      setEntry({ workDate: new Date().toISOString().split('T')[0], rt: '', ot: '', miles: '', notes: '' });
    }
    setSaving(false);
  }
  async function deleteLog(id) {
    if (!confirm('Delete this entry?')) return;
    setSaving(true);
    await supabase.from('daily_hours_log').delete().eq('id', id);
    await fetchDailyLogs(); setSaving(false);
  }

  function calcTotals() {
    if (!workOrder) return { lLab:0,lHrs:0,lMi:0,dLab:0,dHrs:0,dMi:0,tLab:0,tHrs:0,tMi:0,costs:0 };
    const lt = users.find(u => u.user_id === workOrder.lead_tech_id);
    const lLab = ((workOrder.hours_regular||0)*(lt?.hourly_rate_regular||64))+((workOrder.hours_overtime||0)*(lt?.hourly_rate_overtime||96))
      + teamMembers.reduce((s,m)=>s+((m.hours_regular||0)*(m.users?.hourly_rate_regular||64))+((m.hours_overtime||0)*(m.users?.hourly_rate_overtime||96)),0);
    const lHrs = (workOrder.hours_regular||0)+(workOrder.hours_overtime||0)+teamMembers.reduce((s,m)=>s+(m.hours_regular||0)+(m.hours_overtime||0),0);
    const lMi  = (workOrder.miles||0)+teamMembers.reduce((s,m)=>s+(m.miles||0),0);
    const dLab = dailyLogs.reduce((s,l)=>s+((l.hours_regular||0)*64)+((l.hours_overtime||0)*96),0);
    const dHrs = dailyLogs.reduce((s,l)=>s+(l.hours_regular||0)+(l.hours_overtime||0),0);
    const dMi  = dailyLogs.reduce((s,l)=>s+(l.miles||0),0);
    const costs= (workOrder.material_cost||0)+(workOrder.emf_equipment_cost||0)+(workOrder.trailer_cost||0)+(workOrder.rental_cost||0);
    return { lLab, lHrs, lMi, dLab, dHrs, dMi, tLab:lLab+dLab, tHrs:lHrs+dHrs, tMi:lMi+dMi, costs };
  }

  function getAssigned() {
    const list = [];
    if (workOrder?.lead_tech_id) {
      const lt = users.find(u => u.user_id === workOrder.lead_tech_id);
      if (lt) list.push({ ...lt, role: 'Lead Tech' });
    }
    teamMembers.forEach(tm => {
      if (tm.users && !list.find(u => u.user_id === tm.users.user_id))
        list.push({ ...tm.users, role: tm.role_on_job || 'Helper' });
    });
    return list;
  }

  function groupByUser() {
    const g = {};
    dailyLogs.forEach(l => {
      if (!g[l.user_id]) g[l.user_id] = { user: l.user, logs: [], rt: 0, ot: 0, mi: 0 };
      g[l.user_id].logs.push(l);
      g[l.user_id].rt += l.hours_regular||0;
      g[l.user_id].ot += l.hours_overtime||0;
      g[l.user_id].mi += l.miles||0;
    });
    return g;
  }

  if (loading) return (
    <AppShell activeLink="/dashboard">
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin"/>
          <p className="text-slate-500 text-sm">Loading work order...</p>
        </div>
      </div>
    </AppShell>
  );

  if (!workOrder) return (
    <AppShell activeLink="/dashboard">
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Card className="max-w-sm w-full text-center p-8 space-y-4">
          <p className="text-slate-400">Work order not found.</p>
          <Btn onClick={() => router.push('/')} variant="primary">Dashboard</Btn>
        </Card>
      </div>
    </AppShell>
  );

  const t = calcTotals();
  const adminCost  = 2 * 64;
  const grandTotal = t.tLab + adminCost + t.tMi + t.costs;
  const remaining  = (workOrder.nte||0) - grandTotal;
  const byUser     = groupByUser();
  const assigned   = getAssigned();
  const sCfg       = STATUS_CFG[workOrder.status] || STATUS_CFG.pending;
  const avail      = users.filter(u =>
    u.user_id !== workOrder.lead_tech_id &&
    !teamMembers.find(tm => tm.user_id === u.user_id) &&
    ['tech','helper','lead_tech'].includes(u.role)
  );

  return (
    <AppShell activeLink="/dashboard">
      <div className="min-h-screen bg-[#0a0a0f] text-slate-200">

        {/* Sticky header */}
        <div className="sticky top-0 z-20 border-b border-[#1e1e2e] bg-[#0a0a0f]/95 backdrop-blur px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => router.push('/')}
                className="text-slate-500 hover:text-slate-300 flex-shrink-0 flex items-center gap-1 text-sm transition">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                Dashboard
              </button>
              <span className="text-slate-700">/</span>
              <h1 className="text-lg font-bold text-slate-100 truncate">WO #{workOrder.wo_number}</h1>
            </div>
            <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border uppercase flex-shrink-0 ${sCfg.color}`}>
              {sCfg.label}
            </span>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">

          {/* Needs return alert */}
          {workOrder.status === 'needs_return' && (
            <div className="mb-5 bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400 flex-shrink-0 mt-0.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div>
                <p className="text-orange-400 font-bold text-sm">Returned from Invoicing Team</p>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Review comments below for details. After updating, set status to{' '}
                  <span className="text-emerald-400 font-semibold">Completed</span> to send back for invoicing.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* LEFT COLUMN */}
            <div className="lg:col-span-2 space-y-5">

              {/* WO Details */}
              <Card>
                <CardHeader><h2 className="text-sm font-semibold text-slate-200">Work Order Details</h2></CardHeader>
                <CardBody className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Sel label="Status" value={workOrder.status} disabled={saving} onChange={e => updateWO({ status: e.target.value })}>
                      <option value="pending">Pending</option>
                      <option value="assigned">Assigned</option>
                      <option value="in_progress">In Progress</option>
                      <option value="needs_return">Review for Invoice</option>
                      <option value="completed">Completed</option>
                    </Sel>
                    <Sel label="Priority" value={workOrder.priority} disabled={saving} onChange={e => updateWO({ priority: e.target.value })}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="emergency">Emergency</option>
                    </Sel>
                  </div>
                  <Inp label="Building" value={workOrder.building||''}
                    onChange={e => setWorkOrder(p => ({ ...p, building: e.target.value }))}
                    onBlur={() => updateWO({ building: workOrder.building })} />
                  <TA label="Description" rows={4} value={workOrder.work_order_description||''}
                    onChange={e => setWorkOrder(p => ({ ...p, work_order_description: e.target.value }))}
                    onBlur={() => updateWO({ work_order_description: workOrder.work_order_description })} />
                  <Inp label="Requestor" value={workOrder.requestor||''}
                    onChange={e => setWorkOrder(p => ({ ...p, requestor: e.target.value }))}
                    onBlur={() => updateWO({ requestor: workOrder.requestor })} />
                  <Sel label="Lead Technician" value={workOrder.lead_tech_id||''} disabled={saving}
                    onChange={e => updateWO({ lead_tech_id: e.target.value || null })}>
                    <option value="">Unassigned</option>
                    {users.filter(u => ['lead_tech','tech'].includes(u.role)).map(u => (
                      <option key={u.user_id} value={u.user_id}>{u.first_name} {u.last_name} ({u.role})</option>
                    ))}
                  </Sel>
                  <Inp label="NTE Budget ($)" type="number" step="0.01" value={workOrder.nte||''}
                    onChange={e => setWorkOrder(p => ({ ...p, nte: parseFloat(e.target.value)||0 }))}
                    onBlur={() => updateWO({ nte: workOrder.nte })} />
                </CardBody>
              </Card>

              {/* Legacy Hours */}
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-200">Legacy Hours</h2>
                  <span className="text-[10px] bg-[#1e1e2e] border border-[#2d2d44] text-slate-500 px-2 py-1 rounded-full">Original entry system</span>
                </CardHeader>
                <CardBody className="space-y-5">
                  <p className="text-slate-600 text-xs">Hours entered directly on the work order. Use the Daily Hours Log for new entries.</p>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">
                      Lead Tech — {workOrder.lead_tech?.first_name} {workOrder.lead_tech?.last_name}
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <Inp label="Regular Hrs" type="number" step="0.5" value={workOrder.hours_regular||''}
                        onChange={e => setWorkOrder(p => ({ ...p, hours_regular: parseFloat(e.target.value)||0 }))}
                        onBlur={() => updateWO({ hours_regular: workOrder.hours_regular })} />
                      <Inp label="Overtime Hrs" type="number" step="0.5" value={workOrder.hours_overtime||''}
                        onChange={e => setWorkOrder(p => ({ ...p, hours_overtime: parseFloat(e.target.value)||0 }))}
                        onBlur={() => updateWO({ hours_overtime: workOrder.hours_overtime })} />
                      <Inp label="Miles" type="number" step="0.1" value={workOrder.miles||''}
                        onChange={e => setWorkOrder(p => ({ ...p, miles: parseFloat(e.target.value)||0 }))}
                        onBlur={() => updateWO({ miles: workOrder.miles })} />
                    </div>
                  </div>

                  {teamMembers.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Team Members</p>
                      {teamMembers.map(m => (
                        <div key={m.assignment_id} className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl p-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="font-semibold text-slate-200 text-sm">{m.users?.first_name} {m.users?.last_name}</p>
                              <p className="text-slate-600 text-xs capitalize">{m.role_on_job?.replace('_',' ')||'Helper'}</p>
                            </div>
                            <Btn variant="danger" size="sm" onClick={() => removeMember(m.assignment_id, m.users?.first_name)}>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                              Remove
                            </Btn>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {[['Regular Hrs','hours_regular','0.5'],['Overtime Hrs','hours_overtime','0.5'],['Miles','miles','0.1']].map(([lbl,fld,stp]) => (
                              <Inp key={fld} label={lbl} type="number" step={stp} value={m[fld]||''}
                                onChange={e => setTeamMembers(p => p.map(tm =>
                                  tm.assignment_id === m.assignment_id ? { ...tm, [fld]: parseFloat(e.target.value)||0 } : tm
                                ))}
                                onBlur={() => updateMember(m.assignment_id, { [fld]: m[fld] })} />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-[#1e1e2e]">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2 font-semibold">Add Team Member</p>
                    <div className="flex gap-2">
                      <select value={addUserId} onChange={e => setAddUserId(e.target.value)}
                        className="flex-1 bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition">
                        <option value="">Select person...</option>
                        {avail.map(u => <option key={u.user_id} value={u.user_id}>{u.first_name} {u.last_name} ({u.role})</option>)}
                      </select>
                      <select value={addRole} onChange={e => setAddRole(e.target.value)}
                        className="bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition">
                        <option value="helper">Helper</option>
                        <option value="tech">Tech</option>
                      </select>
                      <Btn onClick={addMember} disabled={!addUserId||saving} variant="primary" size="md">+ Add</Btn>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Daily Hours Log */}
              <Card>
                <CardHeader className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-200">Daily Hours Log</h2>
                    <p className="text-slate-600 text-xs mt-0.5">Track hours by date per team member</p>
                  </div>
                  <Btn onClick={() => setShowModal(true)} variant="success" size="md">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Log Hours
                  </Btn>
                </CardHeader>
                <CardBody>
                  {Object.keys(byUser).length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-12 h-12 rounded-xl bg-[#1e1e2e] flex items-center justify-center mx-auto mb-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-600"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </div>
                      <p className="text-slate-600 text-sm">No daily hours logged yet</p>
                      <p className="text-slate-700 text-xs mt-1">Click "Log Hours" to add entries</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(byUser).map(([uid, ud]) => (
                        <div key={uid} className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl overflow-hidden">
                          <div className="px-4 py-3 border-b border-[#1e1e2e] flex items-center justify-between">
                            <p className="font-semibold text-slate-200 text-sm">{ud.user?.first_name} {ud.user?.last_name}</p>
                            <span className="text-xs text-slate-600 font-mono">
                              {ud.rt.toFixed(1)} RT + {ud.ot.toFixed(1)} OT = {(ud.rt+ud.ot).toFixed(1)} hrs · {ud.mi.toFixed(1)} mi
                            </span>
                          </div>
                          <div className="divide-y divide-[#1e1e2e]">
                            {ud.logs.map(l => (
                              <div key={l.id} className="px-4 py-3 flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium text-slate-300">
                                    {new Date(l.work_date).toLocaleDateString('en-US',{ weekday:'short', month:'short', day:'numeric' })}
                                  </p>
                                  <p className="text-xs text-slate-600 font-mono mt-0.5">RT: {l.hours_regular||0} · OT: {l.hours_overtime||0} · Miles: {l.miles||0}</p>
                                  {l.notes && <p className="text-xs text-slate-700 italic mt-0.5">{l.notes}</p>}
                                </div>
                                <Btn onClick={() => deleteLog(l.id)} variant="danger" size="sm">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                                </Btn>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* Additional Costs */}
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-slate-200">Additional Costs</h2>
                  <p className="text-slate-600 text-xs mt-0.5">25% markup applied automatically in cost summary</p>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-2 gap-4">
                    {[['Material Cost ($)','material_cost'],['Equipment Cost ($)','emf_equipment_cost'],['Trailer Cost ($)','trailer_cost'],['Rental Cost ($)','rental_cost']].map(([lbl,fld]) => (
                      <Inp key={fld} label={lbl} type="number" step="0.01" value={workOrder[fld]||''}
                        onChange={e => setWorkOrder(p => ({ ...p, [fld]: parseFloat(e.target.value)||0 }))}
                        onBlur={() => updateWO({ [fld]: workOrder[fld] })} />
                    ))}
                  </div>
                </CardBody>
              </Card>

              {/* Comments */}
              <Card>
                <CardHeader><h2 className="text-sm font-semibold text-slate-200">Comments and Notes</h2></CardHeader>
                <CardBody>
                  <TA rows={5} value={workOrder.comments||''} placeholder="Add notes, updates, or comments..."
                    onChange={e => setWorkOrder(p => ({ ...p, comments: e.target.value }))}
                    onBlur={() => updateWO({ comments: workOrder.comments })} />
                </CardBody>
              </Card>
            </div>

            {/* RIGHT COLUMN - Cost Summary */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader><h2 className="text-sm font-semibold text-slate-200">Cost Summary</h2></CardHeader>
                <CardBody className="space-y-0">
                  {t.lHrs > 0 && t.dHrs > 0 && (
                    <div className="mb-3 bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      <p className="text-blue-400 text-xs">Includes legacy hours + daily log entries</p>
                    </div>
                  )}
                  {t.lHrs > 0 && <SRow label={`Legacy Labor (${t.lHrs.toFixed(1)} hrs)`} value={`$${t.lLab.toFixed(2)}`} />}
                  {t.dHrs > 0 && <SRow label={`Daily Log Labor (${t.dHrs.toFixed(1)} hrs)`} value={`$${t.dLab.toFixed(2)}`} />}
                  <SRow label={`Total Labor (${t.tHrs.toFixed(1)} hrs)`} value={`$${t.tLab.toFixed(2)}`} />
                  <SRow label="Admin (2 hrs)" value={`$${adminCost.toFixed(2)}`} hi />
                  <SRow label={`Mileage (${t.tMi.toFixed(1)} mi)`} value={`$${t.tMi.toFixed(2)}`} />
                  <SRow label="Materials"  value={`$${(workOrder.material_cost||0).toFixed(2)}`} />
                  <SRow label="Equipment"  value={`$${(workOrder.emf_equipment_cost||0).toFixed(2)}`} />
                  <SRow label="Trailer"    value={`$${(workOrder.trailer_cost||0).toFixed(2)}`} />
                  <SRow label="Rental"     value={`$${(workOrder.rental_cost||0).toFixed(2)}`} />
                  <SRow label="TOTAL" value={`$${grandTotal.toFixed(2)}`} bold top />

                  <div className="mt-4 pt-3 border-t border-[#1e1e2e] space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">NTE Budget</span>
                      <span className="font-mono text-slate-300 font-semibold">${(workOrder.nte||0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Remaining</span>
                      <span className={`font-mono font-bold text-lg ${remaining >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ${remaining.toFixed(2)}
                      </span>
                    </div>
                    {workOrder.nte > 0 && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${remaining >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min((grandTotal/(workOrder.nte||1))*100, 100)}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-700 mt-1 text-right">
                          {((grandTotal/(workOrder.nte||1))*100).toFixed(1)}% of NTE used
                        </p>
                      </div>
                    )}
                  </div>

                  {remaining < 0 && (
                    <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                      <p className="text-red-400 text-xs font-semibold">Over budget by ${Math.abs(remaining).toFixed(2)}</p>
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </div>

        {/* Daily Hours Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="border-b border-[#1e1e2e] px-6 py-5 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-100">Log Daily Hours</h3>
                <button onClick={() => { setShowModal(false); setSelUser(null); }}
                  className="text-slate-500 hover:text-slate-300 text-2xl leading-none">x</button>
              </div>
              <div className="p-6 space-y-4">
                <Sel label="Team Member *" value={selUser?.user_id||''}
                  onChange={e => setSelUser(assigned.find(u => u.user_id === parseInt(e.target.value)) || null)}>
                  <option value="">Select a person...</option>
                  {assigned.map(u => <option key={u.user_id} value={u.user_id}>{u.first_name} {u.last_name} ({u.role})</option>)}
                </Sel>
                <Inp label="Work Date *" type="date" value={entry.workDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={e => setEntry(p => ({ ...p, workDate: e.target.value }))} />
                <div className="grid grid-cols-2 gap-3">
                  <Inp label="Regular Hours" type="number" step="0.5" min="0" max="24"
                    value={entry.rt} placeholder="0.0" hint="@ $64/hr"
                    onChange={e => setEntry(p => ({ ...p, rt: e.target.value }))} />
                  <Inp label="Overtime Hours" type="number" step="0.5" min="0" max="24"
                    value={entry.ot} placeholder="0.0" hint="@ $96/hr"
                    onChange={e => setEntry(p => ({ ...p, ot: e.target.value }))} />
                </div>
                <Inp label="Miles" type="number" step="0.1" min="0" value={entry.miles}
                  placeholder="0.0" hint="@ $1.00/mi"
                  onChange={e => setEntry(p => ({ ...p, miles: e.target.value }))} />
                <TA label="Notes (Optional)" rows={3} maxLength={500} value={entry.notes}
                  placeholder="Notes about work performed..."
                  onChange={e => setEntry(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <div className="border-t border-[#1e1e2e] px-6 py-4 flex gap-3">
                <Btn onClick={() => { setShowModal(false); setSelUser(null); }} variant="default" size="lg" className="flex-1">Cancel</Btn>
                <Btn onClick={addHours} disabled={saving || !selUser} variant="success" size="lg" className="flex-1">
                  {saving ? 'Saving...' : 'Save Hours'}
                </Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
