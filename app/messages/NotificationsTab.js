// app/messages/NotificationsTab.js
'use client';

import { useState, useEffect, useMemo } from 'react';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

// ─── Notification type registry ─────────────────────────────────────────────
// Add new event types here and they appear as columns in the matrix.
const NOTIFICATION_TYPES = [
  {
    id: 'work_orders_imported',
    icon: '📥',
    label: 'Imported',
    tooltip: 'When new work orders are auto-imported from email'
  },
  {
    id: 'missing_data_flagged',
    icon: '🚩',
    label: 'Flagged',
    tooltip: 'When office flags a WO as having missing data'
  },
  {
    id: 'missing_data_fixed',
    icon: '✅',
    label: 'Fixed',
    tooltip: 'When a tech marks missing data as fixed'
  },
  {
    id: 'work_order_completed',
    icon: '✅',
    label: 'Completed',
    tooltip: 'When a WO status changes to completed'
  },
  {
    id: 'update_required_flagged',
    icon: '🔵',
    label: 'Update Flagged',
    tooltip: 'When office flags a WO for a status update'
  },
  {
    id: 'update_required_followed_up',
    icon: '🔵',
    label: 'Followed Up',
    tooltip: 'When a tech marks a status update as followed up'
  }
];

const ROLE_BADGE = {
  admin: { icon: '👑', label: 'Admin', color: 'text-purple-400' },
  office_staff: { icon: '🏢', label: 'Office', color: 'text-blue-400' },
  office: { icon: '🏢', label: 'Office', color: 'text-blue-400' },
  operations: { icon: '📋', label: 'Ops', color: 'text-indigo-400' },
  lead_tech: { icon: '⭐', label: 'Lead Tech', color: 'text-emerald-400' },
  tech: { icon: '🔧', label: 'Tech', color: 'text-teal-400' },
  helper: { icon: '🤝', label: 'Helper', color: 'text-slate-400' }
};

export default function NotificationsTab() {
  const [users, setUsers] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]); // raw rows
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null); // key being saved (userId-type)
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, subsRes] = await Promise.all([
        supabase.from('users')
          .select('user_id, first_name, last_name, email, role, is_active')
          .eq('is_active', true)
          .order('first_name'),
        supabase.from('notification_subscriptions')
          .select('subscription_id, user_id, notification_type, enabled, is_default_subscriber')
      ]);

      if (usersRes.error) throw usersRes.error;
      if (subsRes.error) throw subsRes.error;

      setUsers(usersRes.data || []);
      setSubscriptions(subsRes.data || []);
    } catch (err) {
      console.error('Failed to load subscriptions:', err);
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  // Build a quick lookup: subs[`${userId}-${type}`] = { enabled, is_default_subscriber, subscription_id }
  const subsLookup = useMemo(() => {
    const m = {};
    subscriptions.forEach(s => {
      m[`${s.user_id}-${s.notification_type}`] = s;
    });
    return m;
  }, [subscriptions]);

  // Users that have at least one subscription row (regardless of enabled state)
  // OR are office/admin (default subscribers even if seed missed them)
  const visibleUsers = useMemo(() => {
    const officeRoles = ['admin', 'office_staff', 'operations', 'office'];
    const subscribedUserIds = new Set(subscriptions.map(s => s.user_id));
    return users.filter(u =>
      officeRoles.includes(u.role) || subscribedUserIds.has(u.user_id)
    );
  }, [users, subscriptions]);

  // Toggle a single checkbox: insert if missing, update if exists
  async function handleToggle(userId, type, currentEnabled) {
    const key = `${userId}-${type}`;
    const existing = subsLookup[key];
    const newEnabled = !currentEnabled;

    try {
      setSaving(key);

      if (existing) {
        const { error } = await supabase
          .from('notification_subscriptions')
          .update({ enabled: newEnabled, updated_at: new Date().toISOString() })
          .eq('subscription_id', existing.subscription_id);
        if (error) throw error;

        setSubscriptions(prev => prev.map(s =>
          s.subscription_id === existing.subscription_id
            ? { ...s, enabled: newEnabled }
            : s
        ));
      } else {
        const { data, error } = await supabase
          .from('notification_subscriptions')
          .insert({
            user_id: userId,
            notification_type: type,
            enabled: newEnabled,
            is_default_subscriber: false
          })
          .select()
          .single();
        if (error) throw error;
        setSubscriptions(prev => [...prev, data]);
      }
    } catch (err) {
      console.error('Toggle failed:', err);
      alert('Failed to save: ' + err.message);
    } finally {
      setSaving(null);
    }
  }

  // Add a non-office user as a subscriber to all events
  async function handleAddSubscriber(userId) {
    try {
      setSaving(`add-${userId}`);
      const rows = NOTIFICATION_TYPES.map(t => ({
        user_id: userId,
        notification_type: t.id,
        enabled: true,
        is_default_subscriber: false
      }));
      const { data, error } = await supabase
        .from('notification_subscriptions')
        .upsert(rows, { onConflict: 'user_id,notification_type' })
        .select();
      if (error) throw error;

      // Replace any existing entries with these
      setSubscriptions(prev => {
        const filtered = prev.filter(s =>
          !(s.user_id === userId && NOTIFICATION_TYPES.some(t => t.id === s.notification_type))
        );
        return [...filtered, ...data];
      });
      setShowAddPicker(false);
    } catch (err) {
      console.error('Add subscriber failed:', err);
      alert('Failed to add: ' + err.message);
    } finally {
      setSaving(null);
    }
  }

  // Fully remove a non-default subscriber from all event types
  async function handleRemoveSubscriber(userId) {
    const user = users.find(u => u.user_id === userId);
    if (!user) return;
    if (!window.confirm(`Remove ${user.first_name} ${user.last_name} from all notification subscriptions?`)) return;

    try {
      setSaving(`remove-${userId}`);
      const { error } = await supabase
        .from('notification_subscriptions')
        .delete()
        .eq('user_id', userId)
        .eq('is_default_subscriber', false);
      if (error) throw error;

      setSubscriptions(prev => prev.filter(s =>
        !(s.user_id === userId && !s.is_default_subscriber)
      ));
    } catch (err) {
      console.error('Remove subscriber failed:', err);
      alert('Failed to remove: ' + err.message);
    } finally {
      setSaving(null);
    }
  }

  // Reset to defaults: clear all non-default rows, re-seed defaults for office/admin
  async function handleResetDefaults() {
    if (!window.confirm(
      'Reset notification subscriptions to defaults?\n\n' +
      '• All office/admin users will be re-subscribed to all events\n' +
      '• Manually-added subscribers will be removed\n' +
      '• Custom toggle settings will be lost\n\n' +
      'Continue?'
    )) return;

    try {
      setSaving('reset');

      // Wipe all subscriptions
      const { error: delErr } = await supabase
        .from('notification_subscriptions')
        .delete()
        .neq('subscription_id', '00000000-0000-0000-0000-000000000000');
      if (delErr) throw delErr;

      // Re-seed defaults
      const officeRoles = ['admin', 'office_staff', 'operations', 'office'];
      const officeUsers = users.filter(u => officeRoles.includes(u.role));
      const rows = [];
      officeUsers.forEach(u => {
        NOTIFICATION_TYPES.forEach(t => {
          rows.push({
            user_id: u.user_id,
            notification_type: t.id,
            enabled: true,
            is_default_subscriber: true
          });
        });
      });

      if (rows.length > 0) {
        const { data, error } = await supabase
          .from('notification_subscriptions')
          .insert(rows)
          .select();
        if (error) throw error;
        setSubscriptions(data || []);
      } else {
        setSubscriptions([]);
      }
    } catch (err) {
      console.error('Reset failed:', err);
      alert('Failed to reset: ' + err.message);
    } finally {
      setSaving(null);
    }
  }

  // Helper: is this user a default (auto-added) subscriber?
  function isDefaultSubscriber(userId) {
    const userSubs = subscriptions.filter(s => s.user_id === userId);
    return userSubs.length > 0 && userSubs.some(s => s.is_default_subscriber);
  }

  if (loading) {
    return (
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-10 text-center text-slate-500">
        Loading subscriptions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-950/40 border border-red-500/40 rounded-xl p-5 text-red-300">
        <div className="font-bold mb-1">Failed to load notification settings</div>
        <div className="text-sm">{error}</div>
        <button
          onClick={loadAll}
          className="mt-3 bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header / actions */}
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-200 mb-1">
              🔔 Notification Subscriptions
            </h2>
            <p className="text-xs text-slate-400">
              Choose who gets emailed and push-notified when work orders change.
              Office staff is subscribed by default... add other people below.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAddPicker(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold"
            >
              + Add Subscriber
            </button>
            <button
              onClick={handleResetDefaults}
              disabled={saving === 'reset'}
              className="bg-[#1e1e2e] hover:bg-[#2d2d44] border border-[#2d2d44] text-slate-300 px-3 py-1.5 rounded-md text-xs font-semibold"
            >
              {saving === 'reset' ? 'Resetting...' : '↺ Reset Defaults'}
            </button>
          </div>
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2e] bg-[#0a0a0f]">
                <th className="px-4 py-3 text-left text-xs text-slate-500 font-medium uppercase tracking-wide">
                  Person
                </th>
                {NOTIFICATION_TYPES.map(t => (
                  <th
                    key={t.id}
                    className="px-3 py-3 text-center text-xs text-slate-500 font-medium uppercase tracking-wide"
                    title={t.tooltip}
                  >
                    <div className="text-lg">{t.icon}</div>
                    <div className="text-[10px] mt-0.5">{t.label}</div>
                  </th>
                ))}
                <th className="px-3 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {visibleUsers.length === 0 ? (
                <tr>
                  <td colSpan={NOTIFICATION_TYPES.length + 2} className="px-4 py-8 text-center text-slate-500 text-sm">
                    No subscribers yet. Click "+ Add Subscriber" to get started.
                  </td>
                </tr>
              ) : (
                visibleUsers.map(user => {
                  const roleMeta = ROLE_BADGE[user.role] || { icon: '👤', label: user.role, color: 'text-slate-400' };
                  const isDefault = isDefaultSubscriber(user.user_id);

                  return (
                    <tr key={user.user_id} className="border-b border-[#1a1a28] hover:bg-[#1e1e2e]/40 transition">
                      {/* Person */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-base ${roleMeta.color}`}>{roleMeta.icon}</span>
                          <div>
                            <div className="text-sm text-slate-200 font-medium">
                              {user.first_name} {user.last_name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {roleMeta.label} · {user.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Checkbox per event type */}
                      {NOTIFICATION_TYPES.map(t => {
                        const key = `${user.user_id}-${t.id}`;
                        const sub = subsLookup[key];
                        const enabled = sub?.enabled || false;
                        const isSaving = saving === key;
                        return (
                          <td key={t.id} className="px-3 py-3 text-center">
                            <label className={`inline-flex items-center justify-center ${isSaving ? 'opacity-50' : 'cursor-pointer'}`}>
                              <input
                                type="checkbox"
                                checked={enabled}
                                disabled={isSaving}
                                onChange={() => handleToggle(user.user_id, t.id, enabled)}
                                className="w-4 h-4 accent-blue-500 cursor-pointer"
                              />
                            </label>
                          </td>
                        );
                      })}

                      {/* Remove button — only for non-default subscribers */}
                      <td className="px-3 py-3 text-center">
                        {!isDefault && (
                          <button
                            onClick={() => handleRemoveSubscriber(user.user_id)}
                            disabled={saving === `remove-${user.user_id}`}
                            className="text-slate-500 hover:text-red-400 transition"
                            title="Remove subscriber"
                          >
                            ×
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info footer */}
      <div className="bg-[#0d0d14] border border-[#1e1e2e] rounded-xl p-3 text-xs text-slate-500">
        ℹ️  Default office/admin staff is auto-subscribed and cannot be removed (only individual events can be toggled off).
        Changes save automatically. Notifications are sent via email and push.
      </div>

      {/* Add subscriber picker */}
      {showAddPicker && (
        <AddSubscriberModal
          allUsers={users}
          alreadySubscribed={new Set(visibleUsers.map(u => u.user_id))}
          onAdd={handleAddSubscriber}
          onClose={() => setShowAddPicker(false)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ─── Add Subscriber modal ───────────────────────────────────────────────────
function AddSubscriberModal({ allUsers, alreadySubscribed, onAdd, onClose, saving }) {
  const [search, setSearch] = useState('');

  const candidates = useMemo(() => {
    const term = search.toLowerCase().trim();
    return allUsers
      .filter(u => !alreadySubscribed.has(u.user_id))
      .filter(u => u.email) // must have email to receive notifications
      .filter(u => {
        if (!term) return true;
        const haystack = `${u.first_name} ${u.last_name} ${u.email} ${u.role}`.toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
  }, [allUsers, alreadySubscribed, search]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0d0d14] border border-[#2d2d44] rounded-2xl max-w-md w-full shadow-2xl">
        <div className="border-b border-[#2d2d44] p-4 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-200">+ Add Subscriber</h3>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-200 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#2d2d44]"
          >
            ×
          </button>
        </div>
        <div className="p-4 space-y-3">
          <input
            type="text"
            placeholder="Search name, email, or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="w-full bg-[#0a0a0f] border border-[#2d2d44] text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:border-blue-500/60 text-sm"
          />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {candidates.length === 0 ? (
              <div className="text-center text-slate-500 text-sm py-6">
                {search ? 'No matches' : 'Everyone is already subscribed'}
              </div>
            ) : (
              candidates.map(u => {
                const roleMeta = ROLE_BADGE[u.role] || { icon: '👤', label: u.role, color: 'text-slate-400' };
                const isAdding = saving === `add-${u.user_id}`;
                return (
                  <button
                    key={u.user_id}
                    onClick={() => onAdd(u.user_id)}
                    disabled={isAdding}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[#1e1e2e] text-left transition disabled:opacity-50"
                  >
                    <span className={`text-base ${roleMeta.color}`}>{roleMeta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-slate-200 font-medium truncate">
                        {u.first_name} {u.last_name}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {roleMeta.label} · {u.email}
                      </div>
                    </div>
                    {isAdding && <span className="text-blue-400 text-xs">Adding...</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="border-t border-[#2d2d44] p-3 text-xs text-slate-500 text-center">
          New subscribers get all events enabled. You can toggle individual events afterward.
        </div>
      </div>
    </div>
  );
}
