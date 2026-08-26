// app/dashboard/components/MessageTechModal.js
// ─────────────────────────────────────────────────────────────────────────────
// Message the people assigned to THIS work order — straight from the ticket.
//
//   recipients = the WO's crew, scoped to this WO only:
//                • lead tech (lead_tech_id)            → "Lead"
//                • work_order_assignments users        → "Crew"
//                • anyone who logged daily_hours_log   → "Crew"
//                (deduped; pick one or several)
//   WO context = wo_number + building attached automatically
//   channel    = Push (native app) / SMS / Email, chosen per message
//   text       = free-form (blank)
//
// Email/SMS go through /api/notifications (loops recipients); native Push through
// /api/push/notify-tech (one call per recipient). Logged to message_log.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect } from 'react';

const CHANNELS = [
  { id: 'push',  label: '📲 Push (App)', hint: 'In the mobile app; opens the ticket.' },
  { id: 'sms',   label: '📱 SMS',        hint: 'To the phone (needs number + carrier).' },
  { id: 'email', label: '📧 Email',      hint: 'To the tech email.' },
];

export default function MessageTechModal({ workOrder, supabase, currentUser, onClose }) {
  const wo = workOrder || {};
  const [recipients, setRecipients] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState('push');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  // Build the recipient list from everyone assigned to / working this WO.
  useEffect(() => {
    let alive = true;
    if (!wo.wo_id || !supabase) { setLoading(false); return; }
    (async () => {
      const ids = new Set();
      if (wo.lead_tech_id) ids.add(wo.lead_tech_id);
      const [asg, dh] = await Promise.all([
        supabase.from('work_order_assignments').select('user_id').eq('wo_id', wo.wo_id),
        supabase.from('daily_hours_log').select('user_id').eq('wo_id', wo.wo_id),
      ]);
      (asg.data || []).forEach((a) => a.user_id && ids.add(a.user_id));
      (dh.data || []).forEach((d) => d.user_id && ids.add(d.user_id));

      if (!ids.size) { if (alive) { setRecipients([]); setLoading(false); } return; }

      const { data: users } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, email, phone, sms_carrier')
        .in('user_id', [...ids]);

      const list = (users || []).map((u) => ({
        ...u,
        role: u.user_id === wo.lead_tech_id ? 'Lead' : 'Crew',
      }));
      // Lead first, then alphabetical.
      list.sort((a, b) => (a.role === 'Lead' ? -1 : b.role === 'Lead' ? 1 : (a.first_name || '').localeCompare(b.first_name || '')));

      if (alive) {
        setRecipients(list);
        // Default: preselect the lead (or the only person).
        const lead = list.find((r) => r.role === 'Lead');
        setSelected(new Set(lead ? [lead.user_id] : list.length === 1 ? [list[0].user_id] : []));
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [wo.wo_id, wo.lead_tech_id, supabase]);

  const building = wo.ups_building_code || wo.building || '';
  const toggle = (uid) => setSelected((prev) => {
    const n = new Set(prev);
    n.has(uid) ? n.delete(uid) : n.add(uid);
    return n;
  });

  const chosen = recipients.filter((r) => selected.has(r.user_id));
  const missingContact = (r) =>
    channel === 'sms' ? !(r.phone && r.sms_carrier) : channel === 'email' ? !r.email : false;
  const chosenMissing = chosen.filter(missingContact);

  async function send() {
    setError(null);
    if (!chosen.length) { setError('Select at least one recipient.'); return; }
    if (!text.trim()) { setError('Please enter a message.'); return; }
    if (chosenMissing.length === chosen.length) {
      setError(`No selected recipient has ${channel === 'sms' ? 'a phone/carrier' : 'an email'} on file.`);
      return;
    }

    const woRef = `WO ${wo.wo_number || ''}${building ? ' (' + building + ')' : ''}`;
    const fullMsg = `${woRef}: ${text.trim()}`;
    // Recipients we can actually reach on this channel.
    const reachable = chosen.filter((r) => !missingContact(r));

    setBusy(true);
    try {
      let sent = 0, failed = 0;

      if (channel === 'push') {
        for (const r of reachable) {
          try {
            const res = await fetch('/api/push/notify-tech', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: r.user_id, title: woRef, body: text.trim(), data: { woId: wo.wo_id } }),
            });
            const j = await res.json().catch(() => ({}));
            if (res.ok && j.ok !== false) sent++; else failed++;
          } catch { failed++; }
        }
      } else {
        const res = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'custom',
            deliveryMethod: channel,
            recipients: reachable.map((r) => ({
              user_id: r.user_id, phone: r.phone, sms_carrier: r.sms_carrier,
              email: r.email, first_name: r.first_name, last_name: r.last_name,
            })),
            workOrder: { wo_id: wo.wo_id, wo_number: wo.wo_number, building },
            customMessage: fullMsg,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (j.success) { sent = j.sent || 0; failed = j.failed || 0; }
        else { failed = reachable.length; setError(j.error || 'Send failed.'); }
      }

      try {
        await supabase.from('message_log').insert({
          message_type: 'wo_tech_message',
          message_text: fullMsg,
          recipient_count: reachable.length,
          sent_count: sent,
          failed_count: failed,
          sent_at: new Date().toISOString(),
        });
      } catch { /* ignore */ }

      const skipped = chosen.length - reachable.length;
      if (sent > 0) {
        setDone(`Sent to ${sent} recipient${sent === 1 ? '' : 's'} (${channel.toUpperCase()})${skipped ? ` · ${skipped} skipped (no ${channel})` : ''}.`);
      } else if (!error) {
        setError('Not delivered — try another channel.');
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-[#1a1a2e] rounded-xl border border-[#2d2d44] w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2d2d44]">
          <h2 className="text-lg font-semibold text-slate-100">✉️ Message Crew</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-2xl leading-none">×</button>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <p className="text-emerald-400 font-semibold">✅ {done}</p>
            <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold">Done</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="rounded-lg border border-[#2d2d44] bg-[#0a0a0f] p-3 text-sm flex items-center justify-between">
              <span className="text-slate-100 font-semibold">{wo.wo_number || '—'}</span>
              <span className="text-slate-400">{building || 'no building'}</span>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-400">Recipients (assigned to this WO)</label>
              {loading ? (
                <p className="text-sm text-slate-500">loading…</p>
              ) : recipients.length === 0 ? (
                <p className="text-sm text-rose-400">No techs assigned to this work order.</p>
              ) : (
                <div className="space-y-1">
                  {recipients.map((r) => {
                    const on = selected.has(r.user_id);
                    const noContact = missingContact(r);
                    return (
                      <button
                        key={r.user_id}
                        onClick={() => toggle(r.user_id)}
                        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition ${
                          on ? 'bg-blue-600/20 border-blue-500/50' : 'bg-[#0a0a0f] border-[#2d2d44] hover:bg-[#2d2d44]'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] ${on ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-500'}`}>{on ? '✓' : ''}</span>
                          <span className="text-slate-100">{`${r.first_name || ''} ${r.last_name || ''}`.trim() || '—'}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${r.role === 'Lead' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}`}>{r.role}</span>
                        </span>
                        {on && noContact && <span className="text-[10px] text-amber-400">no {channel}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-400">Channel</label>
              <div className="flex gap-2">
                {CHANNELS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setChannel(c.id); setError(null); }}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold border transition ${
                      channel === c.id ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#0a0a0f] border-[#2d2d44] text-slate-300 hover:bg-[#2d2d44]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">{CHANNELS.find((c) => c.id === channel)?.hint}</p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-400">Message</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm text-slate-100"
                placeholder={`What's missing / what the crew needs to know…`}
              />
              <p className="text-xs text-slate-500">The WO number is added automatically.</p>
            </div>

            {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-[#2d2d44]">Cancel</button>
              <button
                onClick={send}
                disabled={busy || loading || !chosen.length}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                {busy ? 'Sending…' : `Send${chosen.length ? ` (${chosen.length})` : ''}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
