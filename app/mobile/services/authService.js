// Authentication Service (WITH OFFLINE SUPPORT)
import { apiFetch, setAppToken } from '@/lib/apiClient';

async function sha256(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

async function offlineLogin(email, pin) {
  const cachedUser = getCachedUser();
  if (!cachedUser || cachedUser.email !== email) {
    throw new Error('Cannot login offline. Please connect to internet for first login.');
  }
  const hash = await sha256(pin);
  if (cachedUser.pin_hash && hash === cachedUser.pin_hash) {
    console.log('✅ Offline login successful with cached credentials');
    return cachedUser;
  }
  throw new Error('Invalid PIN - PIN does not match');
}

export async function loginUser(supabase, email, pin) {
  // The PIN is verified on the server (/api/auth/login); the browser never
  // reads the users table for authentication any more.
  if (!navigator.onLine) {
    console.log('📴 Offline - checking cached user');
    return offlineLogin(email, pin);
  }

  let res;
  try {
    res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pin }),
    });
  } catch (err) {
    console.log('⚠️ Network error - trying cached login');
    return offlineLogin(email, pin);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Login failed');

  setAppToken(data.token);
  const user = { ...data.user, pin_hash: await sha256(pin) };
  cacheUser(user);
  return user;
}

export async function changeUserPin(supabase, userId, newPin) {
  if (!navigator.onLine) {
    throw new Error('Cannot change PIN while offline. Please connect to internet.');
  }
  const res = await apiFetch('/api/auth/change-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, newPin }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not change PIN');

  const cachedUser = getCachedUser();
  if (cachedUser && cachedUser.user_id === userId) {
    cachedUser.pin_hash = await sha256(newPin);
    cacheUser(cachedUser);
  }
  return true;
}

export function saveCredentials(email, pin) {
  localStorage.setItem('mobileEmail', email);
  localStorage.setItem('mobilePin', pin);
}

export function getSavedCredentials() {
  return {
    email: localStorage.getItem('mobileEmail'),
    pin: localStorage.getItem('mobilePin')
  };
}

export function clearCredentials() {
  localStorage.removeItem('mobileEmail');
  localStorage.removeItem('mobilePin');
  setAppToken(null);
}

// ==================== OFFLINE USER CACHE ====================

export function cacheUser(user) {
  try {
    localStorage.setItem('cachedUser', JSON.stringify({
      ...user,
      cached_at: new Date().toISOString()
    }));
    console.log('✅ User cached for offline use');
  } catch (err) {
    console.error('Failed to cache user:', err);
  }
}

export function getCachedUser() {
  try {
    const cached = localStorage.getItem('cachedUser');
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (err) {
    console.error('Failed to get cached user:', err);
  }
  return null;
}

export function clearCachedUser() {
  localStorage.removeItem('cachedUser');
  setAppToken(null);
}
