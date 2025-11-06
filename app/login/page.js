'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('auth_id', user.id)
        .single();

      if (userData && ['admin', 'office_staff'].includes(userData.role)) {
        router.push('/dashboard');
      }
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: password
      });

      if (authError) {
        throw new Error('Invalid email or password');
      }

      // Get user profile to check role
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', authData.user.id)
        .eq('is_active', true)
        .single();

      if (userError || !userData) {
        await supabase.auth.signOut();
        throw new Error('User not found or inactive');
      }

      // Check if user has dashboard access
      if (!['admin', 'office_staff'].includes(userData.role)) {
        await supabase.auth.signOut();
        throw new Error('Access denied. Please use the Mobile App for field workers.');
      }

      // Redirect to dashboard
      router.push('/dashboard');

    } catch (err) {
      console.error('Login error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4" 
      style={{
        background: 'linear-gradient(135deg, #0f1d3a 0%, #1a2d5a 50%, #2a3f6f 100%)'
      }}
    >
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="bg-white w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg p-3">
            <img 
              src="/emf-logo.png" 
              alt="EMF Contracting LLC" 
              className="w-full h-full object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<div class="text-4xl">🔧</div>';
              }}
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard Login</h1>
          <p className="text-gray-300">Admin & Office Access Only</p>
        </div>

        {/* Login Form */}
        <div className="bg-white bg-opacity-10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-gray-700">
          <form onSubmit={handleLogin}>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@emfcontracting.com"
                className="w-full px-4 py-3 text-white bg-gray-800 bg-opacity-50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                required
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-1">
                Use your registered email address
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 text-white bg-gray-800 bg-opacity-50 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Standard password for all admin/office users
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 bg-red-900 bg-opacity-50 border border-red-600 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed py-3 rounded-lg text-white font-bold text-lg transition transform hover:scale-105"
            >
              {loading ? 'Verifying...' : 'Login to Dashboard'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-700">
            <div className="text-center">
              <button
                onClick={() => router.push('/')}
                className="text-gray-400 hover:text-white transition text-sm"
              >
                ← Back to Home
              </button>
            </div>
            <div className="mt-4 text-center">
              <p className="text-gray-400 text-sm mb-2">Field Worker?</p>
              <button
                onClick={() => router.push('/mobile')}
                className="inline-block bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg text-white font-semibold transition"
              >
                Open Mobile App →
              </button>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Forgot password? Contact your system administrator
          </p>
          <p className="text-gray-500 text-xs mt-2">
            Default password: ask your administrator
          </p>
        </div>
      </div>
    </div>
  );
}