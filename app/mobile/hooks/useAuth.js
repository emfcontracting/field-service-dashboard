// Custom Hook - Authentication Management
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import * as authService from '../services/authService';
import { clearCheckedIn } from '../utils/checkedInStore';
import { setOfflineUser, clearCachesKeepQueue } from '../services/offline/offlineService';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const supabase = createClientComponentClient();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { email, pin } = authService.getSavedCredentials();
    if (email && pin) {
      await login(email, pin);
    }
    setLoading(false);
  }

  async function login(email, pin) {
    try {
      setError('');
      const user = await authService.loginUser(supabase, email, pin);
      setCurrentUser(user);
      setOfflineUser(user?.user_id);
      authService.saveCredentials(email, pin);
      return true;
    } catch (err) {
      setError(err.message);
      authService.clearCredentials();
      return false;
    }
  }

  async function logout() {
    clearCheckedIn(currentUser?.user_id); // per-tech pin ends at logout
    authService.clearCredentials();
    authService.clearCachedUser(); // Also clear cached user data
    setOfflineUser(null);
    // Drop cached tickets/team so the next tech on this phone starts clean;
    // unsynced queue items stay (tagged with user_id) so nothing is lost.
    try { await clearCachesKeepQueue(); } catch (e) { console.warn('offline cache cleanup skipped:', e?.message); }
    // Force page reload to ensure clean state
    window.location.href = '/mobile';
  }

  async function changePin(newPin) {
    try {
      await authService.changeUserPin(supabase, currentUser.user_id, newPin);
      const savedEmail = authService.getSavedCredentials().email;
      authService.saveCredentials(savedEmail, newPin);
      setCurrentUser({ ...currentUser });
      return true;
    } catch (err) {
      throw err;
    }
  }

  return {
    currentUser,
    loading,
    error,
    setError,
    login,
    logout,
    changePin
  };
}
