// useAuth.js - Authentication hook

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export function useAuth() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const supabase = createClientComponentClient();

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const savedEmail = localStorage.getItem('mobileEmail');
    const savedPin = localStorage.getItem('mobilePin');
    if (savedEmail && savedPin) {
      await loginWithCredentials(savedEmail, savedPin);
    }
    setLoading(false);
  }

  async function loginWithCredentials(emailValue, pinValue) {
    try {
      console.log('Attempting login with email:', emailValue);
      
      const { data: users, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailValue)
        .single();

      console.log('User query result:', users, error);

      if (error || !users) {
        setError('Invalid email - user not found');
        localStorage.removeItem('mobileEmail');
        localStorage.removeItem('mobilePin');
        return false;
      }

      if (!users.pin) {
        setError('No PIN set for this user. Contact admin to set up your PIN.');
        localStorage.removeItem('mobileEmail');
        localStorage.removeItem('mobilePin');
        return false;
      }

      if (users.pin !== pinValue) {
        setError('Invalid PIN - PIN does not match');
        localStorage.removeItem('mobileEmail');
        localStorage.removeItem('mobilePin');
        return false;
      }

      console.log('Login successful! User:', users);
      setCurrentUser(users);
      localStorage.setItem('mobileEmail', emailValue);
      localStorage.setItem('mobilePin', pinValue);
      setError('');
      return true;
    } catch (err) {
      console.error('Login error:', err);
      setError('Login failed: ' + err.message);
      localStorage.removeItem('mobileEmail');
      localStorage.removeItem('mobilePin');
      return false;
    }
  }

  async function login(email, pin) {
    setError('');
    
    if (!email || !pin) {
      setError('Please enter both email and PIN');
      return false;
    }
    
    return await loginWithCredentials(email, pin);
  }

  function logout() {
    localStorage.removeItem('mobileEmail');
    localStorage.removeItem('mobilePin');
    setCurrentUser(null);
    setError('');
  }

  async function changePin(newPin, confirmPin) {
    if (!newPin || !confirmPin) {
      throw new Error('Please enter both PIN fields');
    }

    if (newPin.length !== 4 || !/^\d+$/.test(newPin)) {
      throw new Error('PIN must be exactly 4 digits');
    }

    if (newPin !== confirmPin) {
      throw new Error('PINs do not match');
    }

    const { error } = await supabase
      .from('users')
      .update({ pin: newPin })
      .eq('user_id', currentUser.user_id);

    if (error) throw error;

    localStorage.setItem('mobilePin', newPin);
    setCurrentUser({ ...currentUser, pin: newPin });
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
