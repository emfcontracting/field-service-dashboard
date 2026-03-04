'use client';

import { useState, useEffect } from 'react';

const getLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const parseLocalDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// ── Status config ─────────────────────────────────────────────────────────────
const getStatus = (user) => {
  if (!user.submitted)                            return { label: 'Pending',         dot: 'bg-yellow-400',  pill: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' };
  if (user.not_available)                         return { label: 'Not Available',    dot: 'bg-red-400',     pill: 'bg-red-500/15 text-red-400 border-red-500/30' };
  if (user.scheduled_work && user.emergency_work) return { label: 'Fully Available',  dot: 'bg-emerald-400', pill: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (user.scheduled_work)                        return { label: 'Scheduled Only',   dot: 'bg-blue-400',    pill: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
  if (user.emergency_work)                        return { label: 'Emergency Only',   dot: 'bg-orange-400',  pill: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
  return                                               { label: 'Unknown',            dot: 'bg-slate-500',   pill: 'bg-slate-500/15 text-slate-400 border-slate-500/30' };
};

// ── Stat chip ─────────────────────────────────────────────────────────────────
const Stat = ({ value, label, color = 'text-slate-200' }) => (
  <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl px-4 py-3 text-center flex-shrink-0 min-w-[72px] md:min-w-0">
    <p className={`text-2xl font-black font-mono ${color}`}>{value}</p>
    <p className="text-[10px] text-slate-600 mt-0.5 whitespace-nowrap">{label}</p>
  </div>
);

// ── Role section header colors ────────────────────────────────────────────────
const ROLE_CFG = {
  lead_tech: { label: 'Lead Technicians', bar: 'bg-purple-500/20 border-purple-500/30', dot: 'bg-purple-400' },
  tech:      { label: 'Technicians',      bar: 'bg-blue-500/20 border-blue-500/30',     dot: 'bg-blue-400' },
  helper:    { label: 'Helpers',          bar: 'bg-slate-500/20 border-slate-500/30',   dot: 'bg-slate-400' },
};

export default function AvailabilityView({ supabase, users }) {
  const [avail,   setAvail]   = useState({});
  const [date,    setDate]    = useState(() => { const t = new Date(); t.setHours(0,0,0,0); return t; });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    load();
    const ch = supabase.channel('avail-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_availability' }, load)
      .subscribe();
    const iv = setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(iv); };
  }, [date]);

  async function load() {
    setLoading(true);
    try {
      const { data: techUsers } = await supabase.from('users')
        .select('user_id, first_name, last_name, role, email, phone')
        .in('role', ['tech','helper','lead_tech']).eq('is_active', true)
        .order('role').order('first_name');

      const { data: availability } = await supabase.from('daily_availability')
        .select('*').eq('availability_date', getLocalDate(date));

      const combined = (techUsers || []).map(u => {
        const a = availability?.find(x => x.user_id === u.user_id);
        return {
          ...u,
          submitted: !!a,
          scheduled_work: a?.scheduled_work || false,
          emergency_work: a?.emergency_work || false,
          not_available:  a?.not_available  || false,
          submitted_at:   a?.submitted_at,
        };
      });

      setAvail({
        lead_tech: combined.filter(u => u.role === 'lead_tech'),
        tech:      combined.filter(u => u.role === 'tech'),
        helper:    combined.filter(u => u.role === 'helper'),
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  // Stats
  const all = [...(avail.lead_tech||[]), ...(avail.tech||[]), ...(avail.helper||[])];
  const stats = {
    total:         all.length,
    submitted:     all.filter(u => u.submitted).length,
    fully:         all.filter(u => u.scheduled_work && u.emergency_work).length,
    scheduled:     all.filter(u => u.scheduled_work && !u.emergency_work && !u.not_available).length,
    emergency:     all.filter(u => !u.scheduled_work && u.emergency_work && !u.not_available).length,
    notAvailable:  all.filter(u => u.not_available).length,
    pending:       all.filter(u => !u.submitted).length,
  };

  const stepDate = (d) => {
    const nd = new Date(date);
    nd.setDate(nd.getDate() + d);
    setDate(nd);
  };

  const fmtTime = (ts) => {
    if (!ts) return null;
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const renderUser = (user) => {
    const s = getStatus(user);
    return (
      <div key={user.user_id} className="px-4 py-3 border-t border-[#1e1e2e] hover:bg-[#1e1e2e]/30 transition">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
          {/* Name + badge */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Avatar dot */}
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-200 text-sm truncate">{user.first_name} {user.last_name}</p>
              <p className="text-[10px] text-slate-600 truncate">{user.email}</p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide flex-shrink-0 ${s.pill}`}>
              {s.label}
            </span>
          </div>

          {/* Details */}
          <div className="flex items-center gap-4 text-xs pl-5 md:pl-0">
            {user.submitted && fmtTime(user.submitted_at) && (
              <span className="text-slate-600 font-mono text-[10px]">{fmtTime(user.submitted_at)}</span>
            )}
            <div className="hidden md:flex items-center gap-4">
              <span className={user.scheduled_work ? 'text-blue-400' : 'text-slate-700'}>
                {user.scheduled_work
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="inline mr-1"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1"><circle cx="12" cy="12" r="10"/></svg>
                }
                Scheduled
              </span>
              <span className={user.emergency_work ? 'text-orange-400' : 'text-slate-700'}>
                {user.emergency_work
                  ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="inline mr-1"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="inline mr-1"><circle cx="12" cy="12" r="10"/></svg>
                }
                Emergency
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const isEmpty = !avail.lead_tech?.length && !avail.tech?.length && !avail.helper?.length;

  return (
    <div className="space-y-4">

      {/* ── Date nav ── */}
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl px-5 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold text-slate-200">Daily Availability Tracker</h2>

          <div className="flex items-center gap-2">
            <button onClick={() => stepDate(-1)}
              className="bg-[#1e1e2e] hover:bg-[#2d2d44] border border-[#2d2d44] text-slate-300 px-3 py-2 rounded-lg text-sm transition">
              ←
            </button>
            <input type="date" value={getLocalDate(date)}
              onChange={e => setDate(parseLocalDate(e.target.value))}
              className="bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-blue-500/60 transition" />
            <button onClick={() => stepDate(1)}
              className="bg-[#1e1e2e] hover:bg-[#2d2d44] border border-[#2d2d44] text-slate-300 px-3 py-2 rounded-lg text-sm transition">
              →
            </button>
            {loading && <div className="w-4 h-4 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin" />}
          </div>
        </div>
        <div className="flex justify-between items-center text-xs text-slate-600">
          <span>{date.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</span>
          <span>Auto-refresh: 30s</span>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 md:grid md:grid-cols-7 md:overflow-visible">
        <Stat value={stats.total}        label="Total"     />
        <Stat value={stats.submitted}    label="Submitted"   color="text-emerald-400" />
        <Stat value={stats.fully}        label="Fully Avail" color="text-emerald-300" />
        <Stat value={stats.scheduled}    label="Scheduled"   color="text-blue-400" />
        <Stat value={stats.emergency}    label="Emergency"   color="text-orange-400" />
        <Stat value={stats.notAvailable} label="Not Avail"   color="text-red-400" />
        <Stat value={stats.pending}      label="Pending"     color="text-yellow-400" />
      </div>

      {/* ── By role ── */}
      <div className="space-y-3">
        {['lead_tech','tech','helper'].map(role => {
          const group = avail[role] || [];
          if (!group.length) return null;
          const cfg = ROLE_CFG[role];
          return (
            <div key={role} className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
              <div className={`px-5 py-3 border-b ${cfg.bar} flex items-center gap-2`}>
                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                <h3 className="font-semibold text-slate-200 text-sm">{cfg.label}</h3>
                <span className="text-slate-600 text-xs ml-auto">{group.length} members</span>
              </div>
              <div>{group.map(renderUser)}</div>
            </div>
          );
        })}

        {!loading && isEmpty && (
          <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-10 text-center">
            <p className="text-slate-600 text-sm">No field workers found</p>
          </div>
        )}
      </div>
    </div>
  );
}
