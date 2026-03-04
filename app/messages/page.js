'use client';

import { useState, useEffect } from 'react';
import { getSupabase } from '@/lib/supabase';
import AppShell from '@/app/components/AppShell';

const supabase = getSupabase();

// ── Role config ──────────────────────────────────────────────────────────────
const ROLE_COLORS = {
  admin: 'from-purple-600 to-purple-800', office_staff: 'from-blue-600 to-blue-800',
  office: 'from-blue-600 to-blue-800',    lead_tech: 'from-emerald-600 to-emerald-800',
  tech: 'from-teal-600 to-teal-800',      helper: 'from-slate-600 to-slate-800',
};
const Avatar = ({ name, role }) => (
  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${ROLE_COLORS[role] || 'from-slate-600 to-slate-800'} flex items-center justify-center flex-shrink-0`}>
    <span className="text-white text-xs font-bold">{name?.charAt(0)?.toUpperCase()}</span>
  </div>
);

// ── Message type config ──────────────────────────────────────────────────────
const MSG_TYPES = [
  { id: 'custom',       label: 'Custom',       icon: '✏️', color: 'blue' },
  { id: 'work_order',   label: 'Work Order',   icon: '📋', color: 'emerald' },
  { id: 'emergency',    label: 'Emergency',    icon: '🚨', color: 'red' },
  { id: 'reminder',     label: 'Hours Reminder', icon: '⏰', color: 'yellow' },
  { id: 'availability', label: 'Availability', icon: '📅', color: 'purple' },
];

const TYPE_COLORS = {
  blue:    { active: 'bg-blue-600/20 text-blue-400 border-blue-500/40',    icon: 'text-blue-400' },
  emerald: { active: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/40', icon: 'text-emerald-400' },
  red:     { active: 'bg-red-600/20 text-red-400 border-red-500/40',        icon: 'text-red-400' },
  yellow:  { active: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/40', icon: 'text-yellow-400' },
  purple:  { active: 'bg-purple-600/20 text-purple-400 border-purple-500/40', icon: 'text-purple-400' },
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

const Btn = ({ children, onClick, disabled, variant = 'default', size = 'md', className = '' }) => {
  const variants = {
    default: 'bg-[#1e1e2e] border border-[#2d2d44] text-slate-300 hover:text-slate-100 hover:bg-[#2d2d44]',
    primary: 'bg-blue-600 hover:bg-blue-500 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    danger:  'bg-red-600 hover:bg-red-500 text-white',
    ghost:   'text-slate-400 hover:text-slate-200 hover:bg-[#1e1e2e]',
  };
  const sizes = { xs: 'px-2 py-1 text-xs', sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-5 py-3 text-base', xl: 'px-6 py-4 text-lg' };
  return (
    <button onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors duration-150
        disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

// ════════════════════════════════════════════════════════════════════════════
export default function MessagesPage() {
  const [users, setUsers]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [sending, setSending]           = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [message, setMessage]           = useState('');
  const [messageType, setMessageType]   = useState('custom');
  const [deliveryMethod, setDeliveryMethod] = useState('email');
  const [workOrders, setWorkOrders]     = useState([]);
  const [selectedWO, setSelectedWO]     = useState(null);
  const [sendResults, setSendResults]   = useState(null);
  const [messageHistory, setMessageHistory] = useState([]);

  useEffect(() => { fetchUsers(); fetchWorkOrders(); fetchMessageHistory(); }, []);

  async function fetchUsers() {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('is_active', true).order('first_name');
      if (error) throw error;
      setUsers(data || []);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function fetchWorkOrders() {
    try {
      const { data } = await supabase.from('work_orders')
        .select('wo_id, wo_number, building, priority, status')
        .in('status', ['pending', 'assigned', 'in_progress'])
        .order('date_entered', { ascending: false }).limit(50);
      setWorkOrders(data || []);
    } catch (err) { console.error(err); }
  }

  async function fetchMessageHistory() {
    try {
      const { data } = await supabase.from('message_log').select('*').order('sent_at', { ascending: false }).limit(20);
      if (data) setMessageHistory(data);
    } catch { /* table may not exist */ }
  }

  const toggleUser   = (id) => setSelectedUsers(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const clearSelect  = ()   => setSelectedUsers([]);
  const selectAll    = ()   => setSelectedUsers(available.map(u => u.user_id));

  const available   = deliveryMethod === 'sms' ? users.filter(u => u.phone && u.sms_carrier) : users.filter(u => u.email);
  const unavailable = deliveryMethod === 'sms' ? users.filter(u => !u.phone || !u.sms_carrier) : users.filter(u => !u.email);

  function getPreview() {
    if (messageType === 'custom')      return message || null;
    if (messageType === 'reminder')    return `EMF Reminder: Please log your daily hours in the mobile app. This is required for CBRE compliance.`;
    if (messageType === 'availability') return `EMF: Please submit your availability for tomorrow in the mobile app.`;
    if ((messageType === 'work_order' || messageType === 'emergency') && selectedWO) {
      const wo = workOrders.find(w => w.wo_id === selectedWO);
      if (wo) return messageType === 'emergency'
        ? `🚨 EMF EMERGENCY!\nWO: ${wo.wo_number}\n${wo.building || 'No location'}\nCheck app NOW!`
        : `EMF: New WO ${wo.wo_number} assigned.\n${wo.building || 'No location'}\nPriority: ${wo.priority?.toUpperCase() || 'NORMAL'}`;
    }
    return null;
  }

  async function sendMessages() {
    const recipients = users.filter(u => selectedUsers.includes(u.user_id));
    if (!recipients.length) { alert('Select at least one recipient'); return; }
    const finalMsg = getPreview();
    if (!finalMsg) { alert('Complete the message first'); return; }
    if (!confirm(`Send to ${recipients.length} recipient(s)?`)) return;

    setSending(true); setSendResults(null);
    try {
      let apiType = 'custom', workOrder = null;
      if (messageType === 'work_order' && selectedWO) { apiType = 'work_order_assigned'; workOrder = workOrders.find(w => w.wo_id === selectedWO); }
      else if (messageType === 'emergency' && selectedWO) { apiType = 'emergency_work_order'; workOrder = workOrders.find(w => w.wo_id === selectedWO); }

      const res = await fetch('/api/notifications', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: apiType, deliveryMethod,
          recipients: recipients.map(r => ({ user_id:r.user_id, phone:r.phone, sms_carrier:r.sms_carrier, email:r.email, first_name:r.first_name, last_name:r.last_name })),
          workOrder,
          customMessage: ['custom','reminder','availability'].includes(messageType) ? finalMsg : null,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setSendResults(result);
        try { await supabase.from('message_log').insert({ message_type:messageType, message_text:finalMsg, recipient_count:recipients.length, sent_count:result.sent, failed_count:result.failed, sent_at:new Date().toISOString() }); } catch {}
        if (result.sent > 0) { setMessage(''); setSelectedUsers([]); setSelectedWO(null); fetchMessageHistory(); }
      } else { alert('Error: ' + (result.error || 'Unknown')); }
    } catch (err) { alert('Error: ' + err.message); }
    finally { setSending(false); }
  }

  const preview = getPreview();
  const currentType = MSG_TYPES.find(t => t.id === messageType);

  if (loading) {
    return (
      <AppShell activeLink="/messages">
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
    <AppShell activeLink="/messages">
      <div className="min-h-screen bg-[#0a0a0f] text-slate-200">

        {/* ── Header ── */}
        <div className="border-b border-[#1e1e2e] bg-[#0d0d14] px-6 py-5">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-100">Team Messaging</h1>
            <p className="text-slate-500 text-sm mt-0.5">Send SMS &amp; email notifications to field technicians</p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* ══════════════════════════════════════════════════════════════
                LEFT — Recipients
            ══════════════════════════════════════════════════════════════ */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader className="flex justify-between items-center">
                  <h2 className="text-sm font-semibold text-slate-200">Recipients</h2>
                  <div className="flex gap-1.5">
                    <Btn onClick={selectAll}   variant="ghost" size="xs">All</Btn>
                    <Btn onClick={clearSelect} variant="ghost" size="xs">Clear</Btn>
                  </div>
                </CardHeader>

                {/* Delivery toggle */}
                <div className="px-5 pt-4 pb-3">
                  <div className="flex gap-1.5 bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-1">
                    {[{ id:'email', icon:'📧', label:'Email' }, { id:'sms', icon:'📱', label:'SMS' }].map(m => (
                      <button key={m.id}
                        onClick={() => { setDeliveryMethod(m.id); clearSelect(); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-semibold transition
                          ${deliveryMethod === m.id
                            ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                            : 'text-slate-500 hover:text-slate-300'}`}>
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Available users */}
                <div className="px-5 pb-3 space-y-1.5 max-h-80 overflow-y-auto">
                  {available.map(user => {
                    const sel = selectedUsers.includes(user.user_id);
                    return (
                      <label key={user.user_id}
                        className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition
                          ${sel ? 'bg-blue-500/10 border-blue-500/30' : 'bg-[#0a0a0f] border-[#1e1e2e] hover:border-[#2d2d44]'}`}>
                        <div className={`w-4 h-4 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition
                          ${sel ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`}>
                          {sel && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                        <input type="checkbox" checked={sel} onChange={() => toggleUser(user.user_id)} className="sr-only" />
                        <Avatar name={user.first_name} role={user.role} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-xs font-semibold truncate ${sel ? 'text-blue-300' : 'text-slate-300'}`}>{user.first_name} {user.last_name}</p>
                          <p className="text-[10px] text-slate-600 capitalize">{user.role?.replace('_', ' ')}</p>
                        </div>
                        {deliveryMethod === 'sms'
                          ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex-shrink-0">{user.sms_carrier}</span>
                          : <span className="text-[10px] text-slate-600 flex-shrink-0 truncate max-w-[80px]">{user.email?.split('@')[0]}</span>
                        }
                      </label>
                    );
                  })}

                  {available.length === 0 && (
                    <p className="text-center py-6 text-slate-600 text-sm">
                      No users available for {deliveryMethod === 'sms' ? 'SMS (missing carrier)' : 'email'}.
                    </p>
                  )}
                </div>

                {/* Unavailable */}
                {unavailable.length > 0 && (
                  <div className="px-5 pb-4 pt-2 border-t border-[#1e1e2e]">
                    <p className="text-xs text-yellow-400 mb-2 font-semibold">⚠ Cannot receive {deliveryMethod === 'sms' ? 'SMS' : 'email'}:</p>
                    <div className="space-y-1">
                      {unavailable.map(u => (
                        <div key={u.user_id} className="flex justify-between text-xs text-slate-600">
                          <span>{u.first_name} {u.last_name}</span>
                          <span>{deliveryMethod === 'sms' ? 'No carrier' : 'No email'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Selection count */}
                <div className="px-5 py-3 border-t border-[#1e1e2e] flex items-center justify-between">
                  <span className="text-slate-500 text-xs">Selected</span>
                  <span className={`text-xl font-bold font-mono ${selectedUsers.length > 0 ? 'text-blue-400' : 'text-slate-600'}`}>
                    {selectedUsers.length}
                  </span>
                </div>
              </Card>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                RIGHT — Composer
            ══════════════════════════════════════════════════════════════ */}
            <div className="lg:col-span-2 space-y-4">

              {/* Message type picker */}
              <Card>
                <CardHeader><h2 className="text-sm font-semibold text-slate-200">Message Type</h2></CardHeader>
                <CardBody>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {MSG_TYPES.map(type => {
                      const cfg = TYPE_COLORS[type.color];
                      const isActive = messageType === type.id;
                      return (
                        <button key={type.id} onClick={() => setMessageType(type.id)}
                          className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-semibold transition
                            ${isActive ? `${cfg.active} border` : 'bg-[#0a0a0f] border-[#1e1e2e] text-slate-500 hover:text-slate-300 hover:border-[#2d2d44]'}`}>
                          <span className="text-base">{type.icon}</span>
                          <span>{type.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </CardBody>
              </Card>

              {/* Composer */}
              <Card>
                <CardHeader>
                  <h2 className="text-sm font-semibold text-slate-200">Compose</h2>
                </CardHeader>
                <CardBody className="space-y-4">

                  {/* WO selector */}
                  {(messageType === 'work_order' || messageType === 'emergency') && (
                    <div>
                      <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Select Work Order</label>
                      <select value={selectedWO || ''} onChange={e => setSelectedWO(e.target.value)}
                        className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition">
                        <option value="">— Select Work Order —</option>
                        {workOrders.map(wo => (
                          <option key={wo.wo_id} value={wo.wo_id}>{wo.wo_number} — {wo.building} ({wo.priority?.toUpperCase() || 'NORMAL'})</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Custom message input */}
                  {messageType === 'custom' && (
                    <div>
                      <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Your Message</label>
                      <textarea value={message} onChange={e => setMessage(e.target.value)}
                        placeholder="Type your message… (SMS limit ~160 characters)"
                        rows={4} maxLength={160}
                        className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 placeholder-slate-600
                          rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-blue-500/60 transition resize-none" />
                      <p className="text-right text-xs text-slate-600 mt-1">{message.length}/160</p>
                    </div>
                  )}

                  {/* Preview bubble */}
                  <div>
                    <label className="block text-xs text-slate-500 uppercase tracking-wider mb-1.5 font-semibold">Preview</label>
                    <div className="bg-[#0a0a0f] border border-[#2d2d44] rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm">{deliveryMethod === 'sms' ? '📱' : '📧'}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-slate-600 mb-1.5 font-semibold uppercase tracking-wider">EMF Contracting</p>
                          {preview
                            ? <div className="bg-[#1e1e2e] rounded-xl rounded-tl-none px-4 py-3 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{preview}</div>
                            : <div className="bg-[#1e1e2e] rounded-xl rounded-tl-none px-4 py-3 text-sm text-slate-600 italic">Fill in the fields above to preview…</div>
                          }
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Send button */}
                  <Btn
                    onClick={sendMessages}
                    disabled={sending || selectedUsers.length === 0 || !preview}
                    variant={messageType === 'emergency' ? 'danger' : 'success'}
                    size="xl"
                    className="w-full">
                    {sending
                      ? 'Sending…'
                      : selectedUsers.length === 0
                        ? 'Select recipients first'
                        : `${currentType?.icon} Send to ${selectedUsers.length} recipient${selectedUsers.length !== 1 ? 's' : ''}`
                    }
                  </Btn>

                  {/* Results */}
                  {sendResults && (
                    <div className={`rounded-xl border p-4 ${
                      sendResults.failed === 0
                        ? 'bg-emerald-500/10 border-emerald-500/20'
                        : 'bg-yellow-500/10 border-yellow-500/20'}`}>
                      <p className={`font-semibold text-sm mb-2 ${sendResults.failed === 0 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                        {sendResults.failed === 0 ? '✅ All messages sent!' : '⚠ Partial success'}
                      </p>
                      <div className="text-xs space-y-1">
                        <p className="text-emerald-400">✓ {sendResults.sent} sent</p>
                        {sendResults.failed > 0 && <p className="text-red-400">✗ {sendResults.failed} failed</p>}
                      </div>
                      {sendResults.errors?.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[#2d2d44] text-xs text-slate-500 space-y-0.5">
                          {sendResults.errors.map((e, i) => <p key={i}>{e.name}: {e.error}</p>)}
                        </div>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>

              {/* ── Recent message history ── */}
              {messageHistory.length > 0 && (
                <Card>
                  <CardHeader><h2 className="text-sm font-semibold text-slate-200">Recent Messages</h2></CardHeader>
                  <CardBody className="space-y-2">
                    {messageHistory.slice(0, 5).map((msg, i) => (
                      <div key={i} className="bg-[#0a0a0f] border border-[#1e1e2e] rounded-xl p-3">
                        <div className="flex justify-between items-start mb-1.5">
                          <span className="text-xs font-semibold text-slate-300 capitalize">
                            {msg.message_type?.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-600">
                            {new Date(msg.sent_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">{msg.message_text}</p>
                        <p className="text-[10px] text-slate-700 mt-1">
                          {msg.sent_count} / {msg.recipient_count} delivered
                        </p>
                      </div>
                    ))}
                  </CardBody>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
