'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SubcontractorManagement() {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Get all active users (techs)
      const { data: usersData } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, email, role')
        .eq('is_active', true)
        .in('role', ['lead_tech', 'tech', 'helper'])
        .order('first_name');

      // Get existing subcontractor profiles
      const { data: profilesData } = await supabase
        .from('subcontractor_profiles')
        .select('*');

      const profilesMap = {};
      (profilesData || []).forEach(p => {
        profilesMap[p.user_id] = p;
      });

      setUsers(usersData || []);
      setProfiles(profilesMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSubcontractor(userId, enable) {
    setSaving(userId);
    setMessage(null);

    try {
      if (enable) {
        // Create or update profile
        const { error } = await supabase
          .from('subcontractor_profiles')
          .upsert({
            user_id: userId,
            is_enabled: true,
            subscription_status: 'trial',
            hourly_rate: 35.00,
            ot_rate: 52.50,
            mileage_rate: 0.67,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (error) throw error;

        setProfiles(prev => ({
          ...prev,
          [userId]: {
            ...prev[userId],
            user_id: userId,
            is_enabled: true,
            subscription_status: 'trial'
          }
        }));
      } else {
        // Disable
        const { error } = await supabase
          .from('subcontractor_profiles')
          .update({ is_enabled: false, updated_at: new Date().toISOString() })
          .eq('user_id', userId);

        if (error) throw error;

        setProfiles(prev => ({
          ...prev,
          [userId]: { ...prev[userId], is_enabled: false }
        }));
      }

      setMessage({ type: 'success', text: enable ? 'Subcontractor access enabled' : 'Subcontractor access disabled' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error:', error);
      setMessage({ type: 'error', text: 'Failed to update. Make sure the subcontractor tables exist.' });
    } finally {
      setSaving(null);
    }
  }

  async function updateSubscription(userId, status) {
    setSaving(userId);

    try {
      const { error } = await supabase
        .from('subcontractor_profiles')
        .update({ 
          subscription_status: status,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) throw error;

      setProfiles(prev => ({
        ...prev,
        [userId]: { ...prev[userId], subscription_status: status }
      }));

      setMessage({ type: 'success', text: 'Subscription updated' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update subscription' });
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link
            href="/settings"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
          >
            ← Back to Settings
          </Link>
          <div>
            <h1 className="text-2xl font-bold">🧾 Subcontractor Management</h1>
            <p className="text-sm text-gray-400">Enable/disable subcontractor portal access</p>
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {message.text}
        </div>
      )}

      <div className="max-w-4xl mx-auto p-6">
        {/* Info Box */}
        <div className="bg-blue-900/30 border border-blue-500/30 rounded-xl p-4 mb-6">
          <h3 className="font-bold text-blue-300 mb-2">ℹ️ About Subcontractor Portal</h3>
          <ul className="text-sm text-blue-200/80 space-y-1">
            <li>• Subcontractors can access <code className="bg-blue-900/50 px-1 rounded">/contractor</code> with their own PIN</li>
            <li>• They pull hours/mileage from their EMF work and generate invoices</li>
            <li>• Invoices are emailed directly to emfcontractingsc2@gmail.com</li>
            <li>• They can set their own rates (hourly, OT, mileage)</li>
            <li>• Use subscription status to control access for billing</li>
          </ul>
        </div>

        {/* Users Table */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="font-bold">Field Workers</h2>
          </div>
          <div className="divide-y divide-gray-700">
            {users.map(user => {
              const profile = profiles[user.user_id];
              const isEnabled = profile?.is_enabled;
              const status = profile?.subscription_status || 'none';

              return (
                <div key={user.user_id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{user.first_name} {user.last_name}</p>
                    <p className="text-sm text-gray-400">{user.email}</p>
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      user.role === 'lead_tech' ? 'bg-purple-500/20 text-purple-400' :
                      user.role === 'tech' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {isEnabled && (
                      <select
                        value={status}
                        onChange={(e) => updateSubscription(user.user_id, e.target.value)}
                        disabled={saving === user.user_id}
                        className={`bg-gray-700 border rounded-lg px-3 py-1.5 text-sm ${
                          status === 'active' ? 'border-green-500 text-green-400' :
                          status === 'trial' ? 'border-yellow-500 text-yellow-400' :
                          status === 'expired' ? 'border-red-500 text-red-400' :
                          'border-gray-600'
                        }`}
                      >
                        <option value="trial">Trial</option>
                        <option value="active">Active</option>
                        <option value="expired">Expired</option>
                      </select>
                    )}

                    <button
                      onClick={() => toggleSubcontractor(user.user_id, !isEnabled)}
                      disabled={saving === user.user_id}
                      className={`relative w-14 h-7 rounded-full transition-colors ${
                        isEnabled ? 'bg-green-600' : 'bg-gray-600'
                      } ${saving === user.user_id ? 'opacity-50' : ''}`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                        isEnabled ? 'left-8' : 'left-1'
                      }`} />
                    </button>

                    <span className={`text-sm w-20 ${isEnabled ? 'text-green-400' : 'text-gray-500'}`}>
                      {isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SQL Setup Notice */}
        <div className="mt-6 bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
          <h3 className="font-bold text-yellow-400 mb-2">⚠️ Database Setup Required</h3>
          <p className="text-sm text-yellow-200/80 mb-2">
            If you get errors, run the migration SQL in Supabase:
          </p>
          <code className="text-xs bg-gray-800 p-2 rounded block">
            database/migrations/create_subcontractor_tables.sql
          </code>
        </div>
      </div>
    </div>
  );
}
