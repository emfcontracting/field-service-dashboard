'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';

const supabase = getSupabase();

export default function ContractorSettings() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [rates, setRates] = useState({
    hourly_rate: '35.00',
    ot_rate: '52.50',
    mileage_rate: '0.67'
  });

  const [businessInfo, setBusinessInfo] = useState({
    business_name: '',
    business_address: '',
    tax_id: ''
  });

  const [pinChange, setPinChange] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  useEffect(() => {
    const userData = sessionStorage.getItem('contractor_user');
    if (!userData) {
      router.push('/contractor');
      return;
    }
    
    try {
      const parsed = JSON.parse(userData);
      setUser(parsed);
      
      // Set initial values from profile
      if (parsed.profile) {
        setRates({
          hourly_rate: parseFloat(parsed.profile.hourly_rate || 35).toFixed(2),
          ot_rate: parseFloat(parsed.profile.ot_rate || 52.50).toFixed(2),
          mileage_rate: parseFloat(parsed.profile.mileage_rate || 0.67).toFixed(2)
        });
        setBusinessInfo({
          business_name: parsed.profile.business_name || '',
          business_address: parsed.profile.business_address || '',
          tax_id: parsed.profile.tax_id || ''
        });
      }
      
      setLoading(false);
    } catch (e) {
      console.error('Error parsing user data:', e);
      router.push('/contractor');
    }
  }, [router]);

  async function saveRates(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('subcontractor_profiles')
        .update({
          hourly_rate: parseFloat(rates.hourly_rate),
          ot_rate: parseFloat(rates.ot_rate),
          mileage_rate: parseFloat(rates.mileage_rate),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.user_id);

      if (error) throw error;

      // Update session
      const updatedProfile = {
        ...user.profile,
        hourly_rate: parseFloat(rates.hourly_rate),
        ot_rate: parseFloat(rates.ot_rate),
        mileage_rate: parseFloat(rates.mileage_rate)
      };
      sessionStorage.setItem('contractor_user', JSON.stringify({
        ...user,
        profile: updatedProfile
      }));
      setUser({ ...user, profile: updatedProfile });

      setMessage({ type: 'success', text: 'Rates updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Save rates error:', error);
      setMessage({ type: 'error', text: 'Failed to update rates' });
    } finally {
      setSaving(false);
    }
  }

  async function saveBusinessInfo(e) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const { error } = await supabase
        .from('subcontractor_profiles')
        .update({
          business_name: businessInfo.business_name,
          business_address: businessInfo.business_address,
          tax_id: businessInfo.tax_id,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.user_id);

      if (error) throw error;

      // Update session
      const updatedProfile = {
        ...user.profile,
        ...businessInfo
      };
      sessionStorage.setItem('contractor_user', JSON.stringify({
        ...user,
        profile: updatedProfile
      }));

      setMessage({ type: 'success', text: 'Business info updated!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Save business info error:', error);
      setMessage({ type: 'error', text: 'Failed to update business info' });
    } finally {
      setSaving(false);
    }
  }

  async function changePin(e) {
    e.preventDefault();
    setMessage(null);

    if (pinChange.new.length < 4) {
      setMessage({ type: 'error', text: 'PIN must be at least 4 digits' });
      return;
    }

    if (pinChange.new !== pinChange.confirm) {
      setMessage({ type: 'error', text: 'PINs do not match' });
      return;
    }

    // Verify current PIN (if one exists)
    if (user.profile?.pin_hash && btoa(pinChange.current) !== user.profile.pin_hash) {
      setMessage({ type: 'error', text: 'Current PIN is incorrect' });
      return;
    }

    setSaving(true);

    try {
      const newPinHash = btoa(pinChange.new);

      const { error } = await supabase
        .from('subcontractor_profiles')
        .update({
          pin_hash: newPinHash,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.user_id);

      if (error) throw error;

      // Update session
      const updatedUser = {
        ...user,
        profile: { ...user.profile, pin_hash: newPinHash },
        needsPinSetup: false
      };
      sessionStorage.setItem('contractor_user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      setPinChange({ current: '', new: '', confirm: '' });
      setMessage({ type: 'success', text: 'PIN updated successfully!' });

      // If this was first-time setup, redirect to dashboard
      if (user.needsPinSetup) {
        setTimeout(() => router.push('/contractor/dashboard'), 1500);
      } else {
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (error) {
      console.error('Change PIN error:', error);
      setMessage({ type: 'error', text: 'Failed to update PIN' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          {!user.needsPinSetup && (
            <Link
              href="/contractor/dashboard"
              className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              ← Back
            </Link>
          )}
          <div>
            <h1 className="text-xl font-bold">⚙️ Settings</h1>
            <p className="text-sm text-gray-400">{user.first_name} {user.last_name}</p>
          </div>
        </div>
      </header>

      {/* Message Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {message.text}
        </div>
      )}

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* First-time PIN setup notice */}
        {user.needsPinSetup && (
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-4">
            <h2 className="font-bold text-yellow-400 mb-2">⚠️ Setup Required</h2>
            <p className="text-gray-300">Please set a PIN to secure your account before continuing.</p>
          </div>
        )}

        {/* PIN Change */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="font-bold mb-4">🔒 {user.profile?.pin_hash ? 'Change PIN' : 'Set PIN'}</h2>
          <form onSubmit={changePin} className="space-y-4">
            {user.profile?.pin_hash && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Current PIN</label>
                <input
                  type="password"
                  value={pinChange.current}
                  onChange={(e) => setPinChange({ ...pinChange, current: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-center tracking-widest"
                  placeholder="••••"
                  maxLength={6}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">New PIN</label>
                <input
                  type="password"
                  value={pinChange.new}
                  onChange={(e) => setPinChange({ ...pinChange, new: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-center tracking-widest"
                  placeholder="••••"
                  minLength={4}
                  maxLength={6}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Confirm PIN</label>
                <input
                  type="password"
                  value={pinChange.confirm}
                  onChange={(e) => setPinChange({ ...pinChange, confirm: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-center tracking-widest"
                  placeholder="••••"
                  minLength={4}
                  maxLength={6}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : user.profile?.pin_hash ? 'Change PIN' : 'Set PIN'}
            </button>
          </form>
        </div>

        {/* Rates */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="font-bold mb-4">💰 Your Rates</h2>
          <form onSubmit={saveRates} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Hourly Rate</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates.hourly_rate}
                    onChange={(e) => setRates({ ...rates, hourly_rate: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-7 pr-4 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">OT Rate</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates.ot_rate}
                    onChange={(e) => setRates({ ...rates, ot_rate: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-7 pr-4 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Per Mile</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={rates.mileage_rate}
                    onChange={(e) => setRates({ ...rates, mileage_rate: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-7 pr-4 py-2"
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              IRS standard mileage rate for 2024: $0.67/mile
            </p>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Rates'}
            </button>
          </form>
        </div>

        {/* Business Info */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="font-bold mb-4">🏢 Business Information</h2>
          <p className="text-sm text-gray-400 mb-4">This info appears on your invoices</p>
          <form onSubmit={saveBusinessInfo} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Business Name (optional)</label>
              <input
                type="text"
                value={businessInfo.business_name}
                onChange={(e) => setBusinessInfo({ ...businessInfo, business_name: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                placeholder="Your Business LLC"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Business Address</label>
              <textarea
                value={businessInfo.business_address}
                onChange={(e) => setBusinessInfo({ ...businessInfo, business_address: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 h-20"
                placeholder="123 Main St, City, SC 29000"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tax ID (optional, last 4 of SSN or EIN)</label>
              <input
                type="text"
                value={businessInfo.tax_id}
                onChange={(e) => setBusinessInfo({ ...businessInfo, tax_id: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2"
                placeholder="XX-XXXXXXX or ***-**-1234"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Business Info'}
            </button>
          </form>
        </div>

        {/* Subscription Status */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-4">
          <h2 className="font-bold mb-2">📋 Subscription</h2>
          <div className="flex items-center justify-between">
            <div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                user.profile?.subscription_status === 'active'
                  ? 'bg-green-500/20 text-green-400'
                  : user.profile?.subscription_status === 'trial'
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
              }`}>
                {(user.profile?.subscription_status || 'trial').toUpperCase()}
              </span>
            </div>
            {user.profile?.subscription_expires_at && (
              <p className="text-sm text-gray-400">
                Expires: {new Date(user.profile.subscription_expires_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
