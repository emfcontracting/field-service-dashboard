// Per-user record of which work orders the CURRENT user is checked in on.
// time_in/time_out on work_orders are shared by ALL techs on a WO, so they
// cannot tell WHO checked in — which made the pinned card + green banner show
// for every assigned tech.
//
// Source of truth is work_order_time_log (one event per tech: check_in,
// break_start/end, check_out) — the same table the native app writes, so a
// check-in on the phone shows on the laptop and vice versa (M6). This
// localStorage copy is the offline mirror: seeded from the server on every
// load (setCheckedInFromServer), updated immediately on check-in/out so the
// UI does not wait for the round trip, cleared wholesale on logout.

const keyFor = (userId) => `checked_in_wos:${userId}`;

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function getCheckedInWos(userId) {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return new Set(raw ? JSON.parse(raw).map(String) : []);
  } catch {
    return new Set();
  }
}

function save(userId, set) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify([...set]));
  } catch {
    /* best effort — worst case the pin is missing after a reload */
  }
  emit();
}

export function markCheckedIn(userId, woId) {
  if (!userId || !woId) return;
  const set = getCheckedInWos(userId);
  set.add(String(woId));
  save(userId, set);
}

export function markCheckedOut(userId, woId) {
  if (!userId || !woId) return;
  const set = getCheckedInWos(userId);
  set.delete(String(woId));
  save(userId, set);
}

/** Replace the set with what the server says this user is checked in on. */
export function setCheckedInFromServer(userId, woIds) {
  if (!userId) return;
  save(userId, new Set((woIds || []).map(String)));
}

export function isCheckedIn(userId, woId) {
  return getCheckedInWos(userId).has(String(woId));
}

/** Work orders a user is currently checked in on, from work_order_time_log. */
export async function fetchCheckedInWos(supabase, userId) {
  const { data, error } = await supabase
    .from('work_order_time_log')
    .select('wo_id, event_type, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  const lastByWo = new Map();
  for (const ev of data || []) if (!lastByWo.has(ev.wo_id)) lastByWo.set(ev.wo_id, ev.event_type);
  return [...lastByWo.entries()].filter(([, t]) => t === 'check_in' || t === 'break_end').map(([wo]) => wo);
}

export function clearCheckedIn(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(keyFor(userId));
  } catch {
    /* best effort */
  }
  emit();
}

export function subscribeCheckedIn(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
