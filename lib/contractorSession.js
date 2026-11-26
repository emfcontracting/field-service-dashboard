// lib/contractorSession.js  (browser)
// -----------------------------------------------------------------------------
// The signed-in subcontractor for the portal pages: name, e-mail and the public
// profile (lib/contractorProfile.publicProfile — no PIN, masked tax id).
// Kept in localStorage so closing the tab no longer logs the sub out; the app
// token (lib/apiClient, 90 days) is what actually authorizes the API calls.
// No token → no session. Old sessionStorage entries are taken over once.
// -----------------------------------------------------------------------------
import { getAppToken, setAppToken } from './apiClient';

const KEY = 'contractor_user';

export function readContractorSession() {
  try {
    if (!getAppToken()) return null;
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      raw = sessionStorage.getItem(KEY);
      if (raw) { localStorage.setItem(KEY, raw); sessionStorage.removeItem(KEY); }
    }
    return raw || null;
  } catch {
    return null;
  }
}

export function saveContractorSession(value) {
  try { localStorage.setItem(KEY, typeof value === 'string' ? value : JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export function clearContractorSession() {
  try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  setAppToken(null);
}
