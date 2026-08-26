// app/dashboard/components/MessageTechModal.js
// ─────────────────────────────────────────────────────────────────────────────
// Message the work order's assigned tech straight from the ticket — no more
// memorizing the WO number and switching to the messages page.
//
//   recipient  = the WO's lead tech (auto)
//   WO context = wo_number + building are attached automatically
//   channel    = Push (native app) / SMS / Email, chosen per message
//   text       = free-form (blank)
//
// Reuses the existing pipeline: Email/SMS go through /api/notifications, native
// Push through /api/push/notify-tech. Logged to message_log.
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect } from 'react';

const CHANNELS = [
  { id: 'push',  label: '📲 Push (App)', hint: 'In der Mobile-App, öffnet das Ticket.' },
  { id: 'sms',   label: '📱 SMS',        hint: 'Aufs Handy (braucht Nummer + Carrier).' },
  { id: 'email', label: '📧 Email',      hint: 'An die Tech-Email.' },
];

export default function MessageTechModal({ workOrder, supabase, currentUser, onClose }) {
  const wo = workOrder || {};
  const [tech, setTech] = useState(null);
  const [loadingTech, setLoadingTech] = useState(true);
  const [channel, setChannel] = useState('push');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  useEffect(() => {
    let alive = true;
    if (!wo.lead_tech_id || !supabase) { setLoadingTech(false); return; }
    supabase
      .from('users')
      .select('user_id, first_name, last_name, email, phone, sms_carrier')
      .eq('user_id', wo.lead_tech_id)
      .maybeSingle()
      .then(({ data }) => { if (alive) { setTech(data || null); setLoadingTech(false); } });
    return () => { alive = false; };
  }, [wo.lead_tech_id, supabase]);

  const building = wo.ups_building_code || wo.building || '';
  const techName = tech ? `${tech.first_name || ''} ${tech.last_name || ''}`.trim() : '';

  const canSMS = !!(tech && tech.phone && tech.sms_carrier);
  const canEmail = !!(tech && tech.email);
  const channelBlocked =
    (channel === 'sms' && !canSMS) ? 'Dieser Tech hat keine Nummer/Carrier hinterlegt.' :
    (channel === 'email' && !canEmail) ? 'Dieser Tech hat keine Email hinterlegt.' : null;

  async function send() {
    setError(null);
    if (!tech) { setError('Kein Tech für diese Work Order zugewiesen.'); return; }
    if (!text.trim()) { setError('Bitte eine Nachricht eingeben.'); return; }
    if (channelBlocked) { setError(channelBlocked); return; }

    const woRef = `WO ${wo.wo_number || ''}${building ? ' (' + building + ')' : ''}`;
    const fullMsg = `${woRef}: ${text.trim()}`;
    setBusy(true);
    try {
      let sent = 0, failed = 0;
      if (channel === 'push') {
        const res = await fetch('/api/push/notify-tech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: tech.user_id,
            title: woRef,
            body: text.trim(),
            data: { woId: wo.wo_id },
          }),
        });
        const r = await res.json().catch(() => ({}));
        if (res.ok && r.ok !== false) sent = 1; else { failed = 1; setError(r.error || 'Push fehlgeschlagen.'); }
      } else {
        const res = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'custom',
            deliveryMethod: channel, // 'sms' | 'email'
            recipients: [{
              user_id: tech.user_id, phone: tech.phone, sms_carrier: tech.sms_carrier,
              email: tech.email, first_name: tech.first_name, last_name: tech.last_name,
            }],
            workOrder: { wo_id: wo.wo_id, wo_number: wo.wo_number, building },
            customMessage: fullMsg,
          }),
        });
        const r = await res.json().catch(() => ({}));
        if (r.success) { sent = r.sent || 0; failed = r.failed || 0; }
        else { failed = 1; setError(r.error || 'Versand fehlgeschlagen.'); }
      }

      // Best-effort log (table may not exist in every env).
      try {
        await supabase.from('message_log').insert({
          message_type: 'wo_tech_message',
          message_text: fullMsg,
          recipient_count: 1,
          sent_count: sent,
          failed_count: failed,
          sent_at: new Date().toISOString(),
        });
      } catch { /* ignore */ }

      if (sent > 0) setDone(`Gesendet an ${techName || 'Tech'} (${channel.toUpperCase()}).`);
      else if (!error) setError('Nicht zugestellt — bitte anderen Kanal versuchen.');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-[#1a1a2e] rounded-xl border border-[#2d2d44] w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2d2d44]">
          <h2 className="text-lg font-semibold text-slate-100">✉️ Nachricht an Tech</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-2xl leading-none">×</button>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <p className="text-emerald-400 font-semibold">✅ {done}</p>
            <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold">Fertig</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="rounded-lg border border-[#2d2d44] bg-[#0a0a0f] p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-100 font-semibold">{wo.wo_number || '—'}</span>
                <span className="text-slate-400">{building || 'no building'}</span>
              </div>
              <div className="text-slate-400 mt-1">
                <span className="text-slate-500">An:</span>{' '}
                {loadingTech ? 'lädt…' : techName ? techName : <span className="text-rose-400">kein Tech zugewiesen</span>}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-400">Kanal</label>
              <div className="flex gap-2">
                {CHANNELS.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setChannel(c.id); setError(null); }}
                    className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold border transition ${
                      channel === c.id
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-[#0a0a0f] border-[#2d2d44] text-slate-300 hover:bg-[#2d2d44]'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500">{CHANNELS.find((c) => c.id === channel)?.hint}</p>
              {channel === 'sms' && !canSMS && !loadingTech && <p className="text-xs text-amber-400">⚠ Keine Nummer/Carrier hinterlegt.</p>}
              {channel === 'email' && !canEmail && !loadingTech && <p className="text-xs text-amber-400">⚠ Keine Email hinterlegt.</p>}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-400">Nachricht</label>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                className="w-full bg-[#0a0a0f] border border-[#2d2d44] rounded-lg px-3 py-2 text-sm text-slate-100"
                placeholder={`Was fehlt / was der Tech wissen muss…`}
              />
              <p className="text-xs text-slate-500">Die WO-Nummer wird automatisch vorangestellt.</p>
            </div>

            {error && <p className="text-sm text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-[#2d2d44]">Abbrechen</button>
              <button
                onClick={send}
                disabled={busy || loadingTech || !tech}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                {busy ? 'Sende…' : 'Senden'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
