// Per-user, device-local record of which work orders the CURRENT user is
// checked in on. time_in/time_out on work_orders are shared by ALL techs on a
// WO, so they cannot tell WHO checked in — which made the pinned card + green
// banner show for every assigned tech. This localStorage-backed store limits
// the pin/banner to the tech who actually checked in on THIS device.
// Cleared per WO on check-out, and wholesale on logout.

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
