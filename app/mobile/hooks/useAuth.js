// Custom Hook - Authentication Management
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import * as authService from '../services/authService';

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
      authService.saveCredentials(email, pin);
      return true;
    } catch (err) {
      setError(err.message);
      authService.clearCredentials();
      return false;
    }
  }

  function logout() {
    authService.clearCredentials();
    setCurrentUser(null);
  }

  async function changePin(newPin) {
    try {
      await authService.changeUserPin(supabase, currentUser.user_id, newPin);
      const savedEmail = authService.getSavedCredentials().email;
      authService.saveCredentials(savedEmail, newPin);
      setCurrentUser({ ...currentUser, pin: newPin });
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
