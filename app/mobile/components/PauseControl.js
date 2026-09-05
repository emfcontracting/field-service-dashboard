// app/mobile/components/PauseControl.js — stop-the-clock control for techs
// (PWA twin of pcs-mobile PauseSection). Opening a pause requires a reason +
// note; while open, the WO's KPI clock is stopped. Online-only: pauses are
// compliance records and go straight to the server.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useLanguage } from '../contexts/LanguageContext';

const supabase = createClientComponentClient();

const REASONS = [
  { key: 'equipment_backorder', en: 'Equipment on backorder', es: 'Equipo en espera (backorder)' },
  { key: 'parts_ordered',       en: 'Waiting for parts',      es: 'Esperando repuestos' },
  { key: 'site_access',         en: 'No site access',         es: 'Sin acceso al sitio' },
  { key: 'other',               en: 'Other (explain)',        es: 'Otro (explicar)' },
];

export default function PauseControl({ wo, currentUser }) {
  const { language } = useLanguage();
  const es = language === 'es';

  const [open, setOpen] = useState(null);
  const [modal, setModal] = useState(false);
  const [reason, setReason] = useState('parts_ordered');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!navigator.onLine) return;
    const { data } = await supabase
      .from('work_order_clock_pauses')
      .select('pause_id, reason, note, started_at')
      .eq('wo_id', wo.wo_id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1);
    setOpen(data?.[0] ?? null);
  }, [wo.wo_id]);

  useEffect(() => { reload(); }, [reload]);

  const requireOnline = () => {
    if (!navigator.onLine) {
      alert(es ? 'Las pausas se registran solo con conexión.' : 'Pauses can only be set while online.');
      return false;
    }
    return true;
  };

  const start = async () => {
    const trimmed = note.trim();
    if (!trimmed) { alert(es ? 'Describe brevemente el motivo.' : 'Please describe the reason briefly.'); return; }
    if (!requireOnline()) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from('work_order_clock_pauses').insert({
        wo_id: wo.wo_id, reason, source: 'tech', note: trimmed,
        started_at: now, created_by: currentUser?.user_id ?? null,
      });
      if (error) throw error;
      await supabase.from('work_orders')
        .update({ waiting_reason: reason, waiting_since: now })
        .eq('wo_id', wo.wo_id);
      setModal(false); setNote('');
      await reload();
    } catch (e) {
      alert('Error: ' + (e?.message || 'failed'));
    } finally { setBusy(false); }
  };

  const end = async () => {
    if (!open || !requireOnline()) return;
    setBusy(true);
    try {
      await supabase.from('work_order_clock_pauses')
        .update({ ended_at: new Date().toISOString() })
        .eq('pause_id', open.pause_id);
      await supabase.from('work_orders')
        .update({ waiting_reason: null, waiting_since: null })
        .eq('wo_id', wo.wo_id);
      setOpen(null);
      await reload();
    } catch (e) {
      alert('Error: ' + (e?.message || 'failed'));
    } finally { setBusy(false); }
  };

  const reasonLabel = (key) => {
    const r = REASONS.find((x) => x.key === key);
    if (r) return es ? r.es : r.en;
    if (key === 'cbre_approval') return es ? 'Esperando aprobación CBRE' : 'Waiting on CBRE approver';
    return key;
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
      <h3 className="font-bold mb-2">⏸ {es ? 'Pausa del reloj' : 'Clock Pause'}</h3>
      {open ? (
        <>
          <div className="bg-amber-900/30 border border-amber-600/50 rounded-lg p-3 mb-3 text-sm">
            <p className="text-amber-300 font-semibold">{reasonLabel(open.reason)}{open.note ? ` — ${open.note}` : ''}</p>
            <p className="text-gray-400 text-xs mt-1">
              {es ? 'desde' : 'since'} {new Date(open.started_at).toLocaleDateString()} · {es ? 'el tiempo NO corre en tu contra' : 'time is NOT counting against you'}
            </p>
          </div>
          {open.reason !== 'cbre_approval' && (
            <button onClick={end} disabled={busy}
              className="w-full bg-emerald-700 hover:bg-emerald-600 py-3 rounded-lg font-semibold disabled:bg-gray-600">
              ▶ {es ? 'Reanudar (llegó lo necesario)' : 'Resume — parts/equipment arrived'}
            </button>
          )}
        </>
      ) : (
        <button onClick={() => setModal(true)} disabled={busy}
          className="w-full bg-amber-700 hover:bg-amber-600 py-3 rounded-lg font-semibold disabled:bg-gray-600">
          ⏸ {es ? 'En espera de repuestos/equipo…' : 'Waiting for parts/equipment…'}
        </button>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-sm w-full p-5">
            <h4 className="font-bold mb-3">{es ? '¿Por qué está en espera?' : 'Why is this job waiting?'}</h4>
            <div className="space-y-2 mb-3">
              {REASONS.map((r) => (
                <button key={r.key} onClick={() => setReason(r.key)}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-sm ${reason === r.key ? 'border-amber-500 bg-amber-900/30 text-amber-300 font-semibold' : 'border-gray-700 text-gray-300'}`}>
                  {es ? r.es : r.en}
                </button>
              ))}
            </div>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)}
              placeholder={es ? 'Detalle (obligatorio) — p. ej. qué pieza falta' : 'Details (required) — e.g. which part is missing'}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg p-2 text-sm min-h-[64px] mb-3"
            />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setModal(false)} className="bg-gray-700 py-2.5 rounded-lg font-semibold">
                {es ? 'Cancelar' : 'Cancel'}
              </button>
              <button onClick={start} disabled={busy} className="bg-amber-700 hover:bg-amber-600 py-2.5 rounded-lg font-semibold disabled:bg-gray-600">
                ⏸ {es ? 'Pausar' : 'Start pause'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
