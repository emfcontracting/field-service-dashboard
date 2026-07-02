// lib/cbreCommsWindow.js
// ─────────────────────────────────────────────────────────────────────────────
// CBRE communication-window logic (US Eastern, DST-safe).
//
// Business rule: ALL CBRE contact routes through the admin (Daniel).
//   - Mon–Fri, 08:00–16:00 ET  → techs do NOT contact CBRE at all.
//                                 Admin calls Chris/Adriana directly.
//   - Outside that window (evenings, weekends) → techs notify admin and
//                                 WAIT for the green light before calling
//                                 the CBRE call center.
//   - Holiday override (app_settings key 'cbre_holiday_override') forces
//     the "outside hours" path regardless of the clock — for federal
//     holidays that land on a weekday.
//
// IMPORTANT: never use Date#getHours()/getDay() here. Vercel runs in UTC and
// user devices run in whatever zone they're in — Intl with an explicit
// America/New_York timeZone is the only reliable way (see the parseCbreDate
// fix for the same class of bug on the import side).
// ─────────────────────────────────────────────────────────────────────────────

export const CBRE_SETTINGS_KEY = 'cbre_holiday_override';

// Pure clock check: Mon–Fri 08:00–15:59 ET.
export function isWithinCbreOfficeHours(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(date);

  const weekday = parts.find(p => p.type === 'weekday')?.value || '';
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value, 10);

  const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday);
  return isWeekday && Number.isFinite(hour) && hour >= 8 && hour < 16;
}

// Read the holiday override flag from app_settings. Fail-safe: any error
// reads as "no override" so the normal clock logic applies.
export async function getCbreHolidayOverride(supabase) {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', CBRE_SETTINGS_KEY)
      .maybeSingle();
    if (error || !data) return false;
    const v = data.value;
    if (v === true) return true;
    return !!(v && v.enabled === true);
  } catch {
    return false;
  }
}

// Persist the holiday override flag (admin action, dashboard settings page).
export async function setCbreHolidayOverride(supabase, enabled, updatedBy = null) {
  const { error } = await supabase
    .from('app_settings')
    .upsert(
      {
        key: CBRE_SETTINGS_KEY,
        value: { enabled: !!enabled },
        updated_at: new Date().toISOString(),
        updated_by: updatedBy
      },
      { onConflict: 'key' }
    );
  if (error) throw error;
  return !!enabled;
}

// Resolve the message techs should see on a CBRE ticket with an active
// (pending/submitted) NTE increase. `holidayOverride` forces after-hours mode.
export function getCbreCommsState({ now = new Date(), holidayOverride = false } = {}) {
  const inWindow = isWithinCbreOfficeHours(now);
  const officeHoursMode = inWindow && !holidayOverride;

  if (officeHoursMode) {
    return {
      mode: 'office_hours',
      inWindow,
      holidayOverride,
      en: 'NTE submitted. Do NOT contact CBRE. Admin will call Chris/Adriana directly.',
      es: 'NTE enviado. NO contacte a CBRE. El administrador llamará directamente a Chris/Adriana.'
    };
  }

  return {
    mode: 'after_hours',
    inWindow,
    holidayOverride,
    en: 'NTE submitted. Notify admin and WAIT for green light before contacting the CBRE call center.',
    es: 'NTE enviado. Notifique al administrador y ESPERE la luz verde antes de contactar al call center de CBRE.'
  };
}
