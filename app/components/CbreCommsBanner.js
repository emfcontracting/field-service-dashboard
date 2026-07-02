// app/components/CbreCommsBanner.js
// ─────────────────────────────────────────────────────────────────────────────
// Time/day-aware CBRE communication banner (US Eastern).
// Shown on CBRE tickets whenever the NEWEST non-rejected NTE increase is
// pending/submitted. Techs see exactly what they may (not) do:
//
//   Mon–Fri 08:00–16:00 ET → "Do NOT contact CBRE. Admin will call
//                             Chris/Adriana directly."
//   Outside / weekends / holiday override → "Notify admin and WAIT for
//                             green light before contacting the CBRE
//                             call center."
//
// Re-evaluates every 60s so a ticket left open flips modes correctly at
// 08:00 / 16:00 ET. Holiday override is read from app_settings.
//
// Props:
//   workOrder (required) — must be a CBRE WO for the banner to render
//   supabase  (required) — client instance from the caller
//   quotes    (optional) — quote rows if the caller already has them;
//                          otherwise the banner fetches the newest itself
//   language  (optional) — 'en' | 'es' (default 'en')
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect } from 'react';
import { getClientType } from '@/lib/clientType';
import { getCbreHolidayOverride, getCbreCommsState } from '@/lib/cbreCommsWindow';

const ACTIVE_STATUSES = ['pending', 'submitted'];

function newestActiveStatus(quotes) {
  const list = (quotes || []).filter(q => q && q.nte_status !== 'rejected');
  if (list.length === 0) return null;
  const sorted = [...list].sort(
    (a, b) =>
      (b.sequence_number || 0) - (a.sequence_number || 0) ||
      new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
  const newest = sorted[0];
  const status = newest.nte_status || (newest.is_verbal_nte ? 'verbal_approved' : 'pending');
  return ACTIVE_STATUSES.includes(status) ? status : null;
}

export default function CbreCommsBanner({ workOrder, supabase, quotes, language = 'en' }) {
  const wo = workOrder || {};
  const isCbre = getClientType(wo) === 'CBRE';

  const [holidayOverride, setHolidayOverride] = useState(false);
  const [tick, setTick] = useState(0); // minute ticker → live window re-eval
  const [fetchedQuotes, setFetchedQuotes] = useState(null);

  // Minute ticker keeps the banner correct across the 08:00 / 16:00 boundary
  useEffect(() => {
    if (!isCbre) return;
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, [isCbre]);

  // Holiday override from app_settings (refreshed with the ticker every 5 min)
  useEffect(() => {
    if (!isCbre || !supabase) return;
    if (tick % 5 !== 0) return;
    let active = true;
    (async () => {
      const ov = await getCbreHolidayOverride(supabase);
      if (active) setHolidayOverride(ov);
    })();
    return () => { active = false; };
  }, [isCbre, supabase, tick]);

  // If the caller didn't pass quotes, fetch the newest ones ourselves
  useEffect(() => {
    if (!isCbre || !supabase || quotes !== undefined || !wo.wo_id) return;
    let active = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('work_order_quotes')
          .select('quote_id, nte_status, is_verbal_nte, sequence_number, created_at')
          .eq('wo_id', wo.wo_id)
          .order('created_at', { ascending: false })
          .limit(10);
        if (active) setFetchedQuotes(data || []);
      } catch {
        if (active) setFetchedQuotes([]);
      }
    })();
    return () => { active = false; };
  }, [isCbre, supabase, wo.wo_id, quotes]);

  if (!isCbre) return null;

  const effectiveQuotes = quotes !== undefined ? quotes : fetchedQuotes;
  const activeStatus = newestActiveStatus(effectiveQuotes);
  if (!activeStatus) return null;

  const state = getCbreCommsState({ now: new Date(), holidayOverride });
  const isOfficeHours = state.mode === 'office_hours';
  const message = language === 'es' ? state.es : state.en;

  return (
    <div
      className={`rounded-lg border-2 p-4 ${
        isOfficeHours
          ? 'border-emerald-500 bg-emerald-900/70'
          : 'border-amber-500 bg-amber-900/70'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex-shrink-0 text-2xl">{isOfficeHours ? '🛑' : '⏳'}</span>
        <div className="min-w-0">
          <div
            className={`mb-1 text-xs font-bold uppercase tracking-wide ${
              isOfficeHours ? 'text-emerald-300' : 'text-amber-300'
            }`}
          >
            {language === 'es' ? 'Comunicación CBRE' : 'CBRE Communication'}
            {holidayOverride && (
              <span className="ml-2 rounded bg-red-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {language === 'es' ? 'FERIADO ACTIVO' : 'HOLIDAY OVERRIDE ACTIVE'}
              </span>
            )}
          </div>
          <p className={`text-sm font-semibold leading-relaxed ${
            isOfficeHours ? 'text-emerald-100' : 'text-amber-100'
          }`}>
            {message}
          </p>
        </div>
      </div>
    </div>
  );
}
