'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import Link from 'next/link';

const supabase = getSupabase();

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const isSuperuser = currentUser?.email === 'jones.emfcontracting@gmail.com';

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  async function fetchCurrentUser() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('auth_id', user.id)
        .single();

      setCurrentUser(userData);
    } catch (error) {
      console.error('Error fetching user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setChangingPassword(true);

    try {
      const response = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          userEmail: currentUser?.email
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => setPasswordSuccess(''), 5000);

    } catch (error) {
      console.error('Password change error:', error);
      setPasswordError(error.message);
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2"
            >
              ← Back to Dashboard
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <img src="/emf-logo.png" alt="EMF" className="h-8 w-8" onError={(e) => e.target.style.display = 'none'} />
                ⚙️ Settings
              </h1>
              {isSuperuser && (
                <p className="text-sm text-green-400 mt-1">🔑 Superuser Account</p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        
        {/* Profile Information */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            👤 Profile Information
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-400">Name</p>
              <p className="text-lg font-medium">
                {currentUser?.first_name} {currentUser?.last_name}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Email</p>
              <p className="text-lg font-medium">{currentUser?.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Role</p>
              <p className="text-lg font-medium capitalize">
                {currentUser?.role?.replace('_', ' ')}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Status</p>
              <span className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                currentUser?.is_active 
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}>
                {currentUser?.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </div>

        {/* Admin Tools - Moved up for superusers */}
        {isSuperuser && (
          <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-xl border border-blue-500/30 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              🔧 Admin Tools
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button
                onClick={() => router.push('/users')}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-semibold py-4 px-4 rounded-xl transition flex flex-col items-center gap-2"
              >
                <span className="text-2xl">👥</span>
                <span>Manage Users</span>
              </button>
              <button
                onClick={() => router.push('/settings/automations')}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-semibold py-4 px-4 rounded-xl transition flex flex-col items-center gap-2"
              >
                <span className="text-2xl">🤖</span>
                <span>Automations</span>
              </button>
              <button
                onClick={() => router.push('/settings/subcontractors')}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-semibold py-4 px-4 rounded-xl transition flex flex-col items-center gap-2"
              >
                <span className="text-2xl">🧱</span>
                <span>Subcontractors</span>
              </button>
              <button
                onClick={() => router.push('/admin/subcontractor-invoices')}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-semibold py-4 px-4 rounded-xl transition flex flex-col items-center gap-2"
              >
                <span className="text-2xl">🔍</span>
                <span>Invoice Review</span>
              </button>
              <button
                onClick={() => router.push('/admin/invoice-verification')}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-semibold py-4 px-4 rounded-xl transition flex flex-col items-center gap-2"
              >
                <span className="text-2xl">🧾</span>
                <span>External Invoices</span>
              </button>
              <button
                onClick={() => router.push('/messages')}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-semibold py-4 px-4 rounded-xl transition flex flex-col items-center gap-2"
              >
                <span className="text-2xl">💬</span>
                <span>Send Messages</span>
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white font-semibold py-4 px-4 rounded-xl transition flex flex-col items-center gap-2"
              >
                <span className="text-2xl">📊</span>
                <span>Dashboard</span>
              </button>
            </div>
            <p className="text-sm text-gray-400 mt-4">
              As superuser, you can manage users, configure automated messages, and send notifications to the team.
            </p>
          </div>
        )}

        {/* Change Password */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            🔒 Change Password
          </h2>
          <p className="text-gray-400 mb-6">
            Update your password to keep your account secure. Minimum 6 characters.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Current Password *
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
                placeholder="Enter your current password"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                New Password *
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
                placeholder="Enter new password (min 6 characters)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Confirm New Password *
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
                placeholder="Confirm your new password"
              />
            </div>

            {passwordError && (
              <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-sm">❌ {passwordError}</p>
              </div>
            )}

            {passwordSuccess && (
              <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-3">
                <p className="text-green-400 text-sm">✓ {passwordSuccess}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={changingPassword}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {changingPassword ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/20 rounded-lg max-w-md">
            <h3 className="font-medium text-blue-300 mb-2">💡 Password Tips:</h3>
            <ul className="text-sm text-blue-200/70 space-y-1">
              <li>• Use at least 6 characters</li>
              <li>• Mix letters, numbers, and symbols</li>
              <li>• Don't use common passwords</li>
              <li>• Change your password regularly</li>
            </ul>
          </div>
        </div>

        {/* SMS/Notification Settings */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
            📱 Notification Settings
          </h2>
          <p className="text-gray-400 mb-4">
            Your phone and carrier for receiving SMS notifications.
          </p>
          <div className="grid grid-cols-2 gap-6 max-w-md">
            <div>
              <p className="text-sm text-gray-400">Phone</p>
              <p className="text-lg font-medium">
                {currentUser?.phone || <span className="text-gray-500">Not set</span>}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">SMS Carrier</p>
              <p className="text-lg font-medium capitalize">
                {currentUser?.sms_carrier?.replace('_', ' ') || <span className="text-gray-500">Not set</span>}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Contact an admin to update your phone number and carrier.
          </p>
        </div>

      </div>
    </div>
  );
}
