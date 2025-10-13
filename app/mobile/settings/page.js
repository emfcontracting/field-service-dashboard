'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function MobileSettings() {
  const [user, setUser] = useState(null);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const userData = localStorage.getItem('mobile_user');
    if (!userData) {
      window.location.href = '/mobile/login';
      return;
    }
    setUser(JSON.parse(userData));
  }, []);

  const handleChangePin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    // Validation
    if (newPin.length !== 4) {
      setError('New PIN must be 4 digits');
      setLoading(false);
      return;
    }

    if (newPin !== confirmPin) {
      setError('New PINs do not match');
      setLoading(false);
      return;
    }

    if (currentPin === newPin) {
      setError('New PIN must be different from current PIN');
      setLoading(false);
      return;
    }

    try {
      // Verify current PIN
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('pin')
        .eq('user_id', user.user_id)
        .single();

      if (fetchError || userData.pin !== currentPin) {
        setError('Current PIN is incorrect');
        setLoading(false);
        return;
      }

      // Update PIN
      const { error: updateError } = await supabase
        .from('users')
        .update({ pin: newPin })
        .eq('user_id', user.user_id);

      if (updateError) {
        setError('Failed to update PIN');
      } else {
        setSuccess('✅ PIN changed successfully!');
        setCurrentPin('');
        setNewPin('');
        setConfirmPin('');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-blue-600 text-white p-6 shadow-lg">
        <button
          onClick={() => window.location.href = '/mobile/dashboard'}
          className="mb-4 text-blue-100 hover:text-white"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Change PIN Form */}
      <div className="p-4">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-6">Change PIN</h2>

          <form onSubmit={handleChangePin} className="space-y-4">
            {/* Current PIN */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Current PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength="4"
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••"
                required
              />
            </div>

            {/* New PIN */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                New PIN (4 digits)
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength="4"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••"
                required
              />
            </div>

            {/* Confirm PIN */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm New PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength="4"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••"
                required
              />
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <p className="text-red-600 font-medium">{error}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <p className="text-green-600 font-medium">{success}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !currentPin || !newPin || !confirmPin}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition"
            >
              {loading ? '⏳ Updating...' : '✅ Change PIN'}
            </button>
          </form>
        </div>

        {/* User Info */}
        <div className="bg-white rounded-xl shadow-lg p-6 mt-4">
          <h2 className="text-xl font-bold mb-4">Account Info</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-semibold">{user.first_name} {user.last_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Email:</span>
              <span className="font-semibold">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Role:</span>
              <span className="font-semibold capitalize">{user.role?.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}