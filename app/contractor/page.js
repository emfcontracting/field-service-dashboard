'use client';

import { useState } from 'react';
import { setAppToken } from '@/lib/apiClient';
import { useRouter } from 'next/navigation';


export default function ContractorLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState('email'); // email, pin
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // Both steps go through /api/contractor/login (server-side checks with the
  // service role). The PIN step returns the app token every /api/contractor/*
  // route requires — the portal used to verify the PIN in the browser and
  // never had a token, so PDF downloads and tax records failed with
  // "Sign in required".
  async function callLogin(payload) {
    const res = await fetch('/api/contractor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await callLogin({ email: email.toLowerCase().trim(), step: 'email' });
      setUser({ email: email.toLowerCase().trim(), first_name: data.first_name, last_name: data.last_name, hasPin: data.hasPin });
      setStep('pin');
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePinSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await callLogin({ email: user.email, pin });
      setAppToken(data.token);
      sessionStorage.setItem('contractor_user', JSON.stringify({
        user_id: data.user.user_id,
        email: data.user.email,
        first_name: data.user.first_name,
        last_name: data.user.last_name,
        profile: data.profile,
        ...(data.needsPinSetup ? { needsPinSetup: true } : {}),
      }));
      router.push(data.needsPinSetup ? '/contractor/settings' : '/contractor/dashboard');
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🧾</div>
          <h1 className="text-3xl font-bold text-white mb-2">Subcontractor Portal</h1>
          <p className="text-gray-400">Track hours & create invoices</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit}>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none mb-4"
                placeholder="your@email.com"
                required
                autoFocus
              />

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePinSubmit}>
              <div className="text-center mb-4">
                <p className="text-gray-300">Welcome back,</p>
                <p className="text-xl font-bold text-white">{user?.first_name} {user?.last_name}</p>
              </div>

              <label className="block text-sm font-medium text-gray-300 mb-2">
                {user?.hasPin ? 'Enter your PIN' : 'Create a PIN (4-6 digits)'}
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white text-center text-2xl tracking-widest placeholder-gray-400 focus:border-blue-500 focus:outline-none mb-4"
                placeholder="••••"
                required
                autoFocus
                minLength={4}
                maxLength={6}
              />

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || pin.length < 4}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 mb-3"
              >
                {loading ? 'Verifying...' : user?.hasPin ? 'Login' : 'Set PIN & Continue'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setPin(''); setError(''); }}
                className="w-full text-gray-400 hover:text-white text-sm"
              >
                ← Use different email
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <a href="/mobile" className="text-gray-500 hover:text-gray-400 text-sm">
            ← Back to Mobile App
          </a>
        </div>
      </div>
    </div>
  );
}
