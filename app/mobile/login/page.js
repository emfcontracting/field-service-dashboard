'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function MobileLogin() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const supabase = createClientComponentClient();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // First, sign in with Supabase auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: pin // Using PIN as password for now
      });

      if (authError) {
        // If auth fails, check if user exists and verify PIN
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('user_id, pin, first_name, role')
          .eq('email', email.toLowerCase().trim())
          .single();

        if (userError || !userData) {
          setError('Invalid email or PIN');
          setLoading(false);
          return;
        }

        // Verify PIN
        if (userData.pin !== pin) {
          setError('Invalid PIN');
          setLoading(false);
          return;
        }

        // PIN verified - redirect to mobile dashboard
        localStorage.setItem('mobile_user', JSON.stringify(userData));
        window.location.href = '/mobile/dashboard';
      } else {
        // Auth successful - verify PIN
        const { data: userData } = await supabase
          .from('users')
          .select('user_id, pin, first_name, role')
          .eq('email', email.toLowerCase().trim())
          .single();

        if (userData && userData.pin === pin) {
          localStorage.setItem('mobile_user', JSON.stringify(userData));
          window.location.href = '/mobile/dashboard';
        } else {
          setError('Invalid PIN');
        }
      }
    } catch (err) {
      setError('Login failed. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (digit) => {
    if (pin.length < 4) {
      setPin(pin + digit);
    }
  };

  const handleBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="bg-white w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-4xl">🔧</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">FSM Mobile</h1>
          <p className="text-blue-100">Field Service Management</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-4 text-lg border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="your.email@company.com"
                required
                autoComplete="email"
              />
            </div>

            {/* PIN Input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                PIN Code
              </label>
              <div className="flex justify-center gap-3 mb-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="w-14 h-14 border-2 border-gray-300 rounded-xl flex items-center justify-center text-2xl font-bold bg-gray-50"
                  >
                    {pin[i] ? '•' : ''}
                  </div>
                ))}
              </div>

              {/* PIN Pad */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handlePinInput(num.toString())}
                    className="h-16 bg-gray-100 hover:bg-gray-200 rounded-xl text-2xl font-bold text-gray-800 active:bg-gray-300 transition"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-16 bg-red-100 hover:bg-red-200 rounded-xl text-xl font-bold text-red-600 active:bg-red-300 transition"
                >
                  ⌫
                </button>
                <button
                  type="button"
                  onClick={() => handlePinInput('0')}
                  className="h-16 bg-gray-100 hover:bg-gray-200 rounded-xl text-2xl font-bold text-gray-800 active:bg-gray-300 transition"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPin('')}
                  className="h-16 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-bold text-gray-600 active:bg-gray-300 transition"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <p className="text-red-600 text-center font-medium">{error}</p>
              </div>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading || !email || pin.length !== 4}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-bold text-lg shadow-lg transition active:scale-95"
            >
              {loading ? '⏳ Signing In...' : '🔓 Sign In'}
            </button>
          </form>

          {/* Help Text */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Default PIN: <span className="font-mono font-bold">5678</span>
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Change your PIN in Settings after first login
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-blue-100 text-sm">
            Need help? Contact your administrator
          </p>
        </div>
      </div>
    </div>
  );
}