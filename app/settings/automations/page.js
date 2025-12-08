'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Default automation templates
const DEFAULT_AUTOMATIONS = [
  {
    automation_key: 'availability_reminder',
    name: 'Availability Reminder',
    description: 'Reminds field techs to submit their daily availability',
    schedule_time: '19:00',
    schedule_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'sunday'],
    target_roles: ['lead_tech', 'tech', 'helper'],
    send_sms: true,
    send_email: true,
    sms_message: 'EMF: Please submit your availability for tomorrow in the mobile app.',
    email_subject: '⏰ Daily Availability Reminder - EMF',
    is_enabled: true,
    condition_type: 'missing_submission',
    condition_table: 'daily_availability',
    icon: '📅'
  },
  {
    automation_key: 'hours_reminder',
    name: 'Hours Entry Reminder',
    description: 'Reminds techs to log their hours for the day',
    schedule_time: '18:00',
    schedule_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    target_roles: ['lead_tech', 'tech', 'helper'],
    send_sms: true,
    send_email: true,
    sms_message: 'EMF: Please log your hours for today in the mobile app before EOD.',
    email_subject: '⏰ Daily Hours Reminder - EMF',
    is_enabled: false,
    condition_type: 'always',
    icon: '⏱️'
  },
  {
    automation_key: 'aging_alert',
    name: 'Aging Work Order Alert',
    description: 'Alerts techs about work orders open 2+ days',
    schedule_time: '08:00',
    schedule_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    target_roles: ['lead_tech', 'tech'],
    send_sms: false,
    send_email: true,
    sms_message: 'EMF: You have aging work orders. Check your email or app for details.',
    email_subject: '⚠️ Aging Work Orders Alert - EMF',
    is_enabled: false,
    condition_type: 'has_aging_wo',
    icon: '⚠️'
  },
  {
    automation_key: 'weekly_schedule',
    name: 'Weekly Schedule Summary',
    description: 'Sends weekly schedule to all techs on Sunday evening',
    schedule_time: '18:00',
    schedule_days: ['sunday'],
    target_roles: ['lead_tech', 'tech', 'helper'],
    send_sms: false,
    send_email: true,
    sms_message: 'EMF: Your weekly schedule has been sent to your email.',
    email_subject: '📋 Your Week Ahead - EMF Schedule',
    is_enabled: false,
    condition_type: 'always',
    icon: '📋'
  }
];

const DAYS_OF_WEEK = [
  { key: 'sunday', label: 'Sun' },
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' }
];

const ROLES = [
  { key: 'admin', label: 'Admin' },
  { key: 'office', label: 'Office' },
  { key: 'lead_tech', label: 'Lead Tech' },
  { key: 'tech', label: 'Tech' },
  { key: 'helper', label: 'Helper' }
];

export default function AutomationsPage() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showAddNew, setShowAddNew] = useState(false);
  const [message, setMessage] = useState(null);
  
  const [newAutomation, setNewAutomation] = useState({
    automation_key: '',
    name: '',
    description: '',
    schedule_time: '19:00',
    schedule_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    target_roles: ['lead_tech', 'tech', 'helper'],
    send_sms: true,
    send_email: true,
    sms_message: '',
    email_subject: '',
    is_enabled: true,
    condition_type: 'always',
    icon: '📨'
  });

  useEffect(() => {
    fetchAutomations();
  }, []);

  async function fetchAutomations() {
    try {
      const { data, error } = await supabase
        .from('automated_messages')
        .select('*')
        .order('name');

      if (error) {
        // Table might not exist, use defaults
        console.log('Using default automations');
        setAutomations(DEFAULT_AUTOMATIONS.map((a, i) => ({ ...a, id: `default-${i}` })));
      } else if (data && data.length > 0) {
        setAutomations(data);
      } else {
        // Table exists but empty, seed with defaults
        setAutomations(DEFAULT_AUTOMATIONS.map((a, i) => ({ ...a, id: `default-${i}` })));
      }
    } catch (error) {
      console.error('Error:', error);
      setAutomations(DEFAULT_AUTOMATIONS.map((a, i) => ({ ...a, id: `default-${i}` })));
    } finally {
      setLoading(false);
    }
  }

  async function toggleAutomation(automation) {
    const newEnabled = !automation.is_enabled;
    
    // Update local state immediately
    setAutomations(prev => prev.map(a => 
      a.id === automation.id ? { ...a, is_enabled: newEnabled } : a
    ));

    try {
      // Try to update in database
      if (!automation.id.toString().startsWith('default-')) {
        await supabase
          .from('automated_messages')
          .update({ is_enabled: newEnabled, updated_at: new Date().toISOString() })
          .eq('id', automation.id);
      } else {
        // Save to database for the first time
        await saveAutomation({ ...automation, is_enabled: newEnabled });
      }
      
      setMessage({ type: 'success', text: `${automation.name} ${newEnabled ? 'enabled' : 'disabled'}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error toggling:', error);
      // Revert on error
      setAutomations(prev => prev.map(a => 
        a.id === automation.id ? { ...a, is_enabled: !newEnabled } : a
      ));
    }
  }

  async function saveAutomation(automation) {
    setSaving(true);
    try {
      const dataToSave = {
        automation_key: automation.automation_key,
        name: automation.name,
        description: automation.description,
        schedule_time: automation.schedule_time,
        schedule_days: automation.schedule_days,
        target_roles: automation.target_roles,
        send_sms: automation.send_sms,
        send_email: automation.send_email,
        sms_message: automation.sms_message,
        email_subject: automation.email_subject,
        is_enabled: automation.is_enabled,
        condition_type: automation.condition_type,
        icon: automation.icon,
        updated_at: new Date().toISOString()
      };

      if (automation.id && !automation.id.toString().startsWith('default-')) {
        // Update existing
        const { error } = await supabase
          .from('automated_messages')
          .update(dataToSave)
          .eq('id', automation.id);
        
        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('automated_messages')
          .insert(dataToSave)
          .select()
          .single();
        
        if (error) throw error;
        
        // Update local state with real ID
        setAutomations(prev => prev.map(a => 
          a.automation_key === automation.automation_key ? { ...a, id: data.id } : a
        ));
      }

      setMessage({ type: 'success', text: 'Automation saved!' });
      setTimeout(() => setMessage(null), 3000);
      setEditingId(null);
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'Failed to save. Database table may not exist.' });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setSaving(false);
    }
  }

  async function addNewAutomation() {
    if (!newAutomation.name || !newAutomation.sms_message) {
      setMessage({ type: 'error', text: 'Name and SMS message are required' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    const key = newAutomation.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const automation = {
      ...newAutomation,
      automation_key: key,
      id: `new-${Date.now()}`
    };

    setAutomations(prev => [...prev, automation]);
    await saveAutomation(automation);
    setShowAddNew(false);
    setNewAutomation({
      automation_key: '',
      name: '',
      description: '',
      schedule_time: '19:00',
      schedule_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      target_roles: ['lead_tech', 'tech', 'helper'],
      send_sms: true,
      send_email: true,
      sms_message: '',
      email_subject: '',
      is_enabled: true,
      condition_type: 'always',
      icon: '📨'
    });
  }

  async function deleteAutomation(automation) {
    if (!confirm(`Delete "${automation.name}"?`)) return;

    try {
      if (!automation.id.toString().startsWith('default-') && !automation.id.toString().startsWith('new-')) {
        await supabase.from('automated_messages').delete().eq('id', automation.id);
      }
      setAutomations(prev => prev.filter(a => a.id !== automation.id));
      setMessage({ type: 'success', text: 'Automation deleted' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting:', error);
    }
  }

  function updateAutomation(id, field, value) {
    setAutomations(prev => prev.map(a => 
      a.id === id ? { ...a, [field]: value } : a
    ));
  }

  function toggleDay(automationId, day) {
    setAutomations(prev => prev.map(a => {
      if (a.id !== automationId) return a;
      const days = a.schedule_days || [];
      const newDays = days.includes(day) 
        ? days.filter(d => d !== day)
        : [...days, day];
      return { ...a, schedule_days: newDays };
    }));
  }

  function toggleRole(automationId, role) {
    setAutomations(prev => prev.map(a => {
      if (a.id !== automationId) return a;
      const roles = a.target_roles || [];
      const newRoles = roles.includes(role)
        ? roles.filter(r => r !== role)
        : [...roles, role];
      return { ...a, target_roles: newRoles };
    }));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading automations...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/settings" 
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm flex items-center gap-2"
            >
              ← Back to Settings
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                🤖 Automated Messages
              </h1>
              <p className="text-gray-400 text-sm">Configure automatic SMS and email notifications</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddNew(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium flex items-center gap-2"
          >
            + Add Automation
          </button>
        </div>
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 ${
          message.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {message.text}
        </div>
      )}

      {/* Main Content */}
      <div className="p-6 max-w-6xl mx-auto">
        
        {/* Automations List */}
        <div className="space-y-4">
          {automations.map(automation => (
            <div 
              key={automation.id}
              className={`bg-gray-800 rounded-xl border ${
                automation.is_enabled ? 'border-green-500/30' : 'border-gray-700'
              } overflow-hidden`}
            >
              {/* Automation Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{automation.icon || '📨'}</span>
                  <div>
                    <h3 className="font-bold text-lg">{automation.name}</h3>
                    <p className="text-gray-400 text-sm">{automation.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Enable/Disable Toggle */}
                  <button
                    onClick={() => toggleAutomation(automation)}
                    className={`relative w-14 h-7 rounded-full transition-colors ${
                      automation.is_enabled ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                      automation.is_enabled ? 'left-8' : 'left-1'
                    }`} />
                  </button>
                  <span className={`text-sm font-medium w-16 ${
                    automation.is_enabled ? 'text-green-400' : 'text-gray-500'
                  }`}>
                    {automation.is_enabled ? 'Active' : 'Off'}
                  </span>
                  
                  {/* Edit Button */}
                  <button
                    onClick={() => setEditingId(editingId === automation.id ? null : automation.id)}
                    className="p-2 hover:bg-gray-700 rounded-lg"
                  >
                    {editingId === automation.id ? '✕' : '⚙️'}
                  </button>
                </div>
              </div>

              {/* Quick Info Bar */}
              <div className="px-4 pb-3 flex flex-wrap gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1">
                  🕐 {automation.schedule_time} EST
                </span>
                <span className="flex items-center gap-1">
                  📅 {(automation.schedule_days || []).map(d => d.slice(0,3)).join(', ')}
                </span>
                <span className="flex items-center gap-1">
                  👥 {(automation.target_roles || []).map(r => r.replace('_', ' ')).join(', ')}
                </span>
                {automation.send_sms && <span className="text-blue-400">📱 SMS</span>}
                {automation.send_email && <span className="text-purple-400">📧 Email</span>}
              </div>

              {/* Expanded Edit Panel */}
              {editingId === automation.id && (
                <div className="border-t border-gray-700 p-4 bg-gray-800/50 space-y-4">
                  
                  {/* Schedule Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Send Time (EST)</label>
                      <input
                        type="time"
                        value={automation.schedule_time}
                        onChange={(e) => updateAutomation(automation.id, 'schedule_time', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1">Icon</label>
                      <input
                        type="text"
                        value={automation.icon || '📨'}
                        onChange={(e) => updateAutomation(automation.id, 'icon', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  {/* Days of Week */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Send On Days</label>
                    <div className="flex gap-2">
                      {DAYS_OF_WEEK.map(day => (
                        <button
                          key={day.key}
                          onClick={() => toggleDay(automation.id, day.key)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            (automation.schedule_days || []).includes(day.key)
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Target Roles */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Send To Roles</label>
                    <div className="flex flex-wrap gap-2">
                      {ROLES.map(role => (
                        <button
                          key={role.key}
                          onClick={() => toggleRole(automation.id, role.key)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            (automation.target_roles || []).includes(role.key)
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                          }`}
                        >
                          {role.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Delivery Methods */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Delivery Methods</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={automation.send_sms}
                          onChange={(e) => updateAutomation(automation.id, 'send_sms', e.target.checked)}
                          className="w-5 h-5 rounded bg-gray-700 border-gray-600"
                        />
                        <span>📱 SMS Text</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={automation.send_email}
                          onChange={(e) => updateAutomation(automation.id, 'send_email', e.target.checked)}
                          className="w-5 h-5 rounded bg-gray-700 border-gray-600"
                        />
                        <span>📧 Email</span>
                      </label>
                    </div>
                  </div>

                  {/* SMS Message */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      SMS Message <span className="text-gray-500">({(automation.sms_message || '').length}/160)</span>
                    </label>
                    <textarea
                      value={automation.sms_message || ''}
                      onChange={(e) => updateAutomation(automation.id, 'sms_message', e.target.value.slice(0, 160))}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 h-20"
                      placeholder="SMS message text..."
                      maxLength={160}
                    />
                  </div>

                  {/* Email Subject */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email Subject</label>
                    <input
                      type="text"
                      value={automation.email_subject || ''}
                      onChange={(e) => updateAutomation(automation.id, 'email_subject', e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                      placeholder="Email subject line..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between pt-2">
                    <button
                      onClick={() => deleteAutomation(automation)}
                      className="px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg text-sm"
                    >
                      🗑️ Delete
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => saveAutomation(automation)}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {saving ? 'Saving...' : '💾 Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add New Modal */}
        {showAddNew && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-bold">➕ New Automation</h2>
                <button onClick={() => setShowAddNew(false)} className="text-gray-400 hover:text-white text-2xl">
                  ✕
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newAutomation.name}
                    onChange={(e) => setNewAutomation({ ...newAutomation, name: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                    placeholder="e.g., Morning Check-in"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={newAutomation.description}
                    onChange={(e) => setNewAutomation({ ...newAutomation, description: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                    placeholder="What does this automation do?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Send Time (EST)</label>
                    <input
                      type="time"
                      value={newAutomation.schedule_time}
                      onChange={(e) => setNewAutomation({ ...newAutomation, schedule_time: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Icon</label>
                    <input
                      type="text"
                      value={newAutomation.icon}
                      onChange={(e) => setNewAutomation({ ...newAutomation, icon: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                      placeholder="📨"
                      maxLength={2}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Send On Days</label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day.key}
                        type="button"
                        onClick={() => {
                          const days = newAutomation.schedule_days;
                          const newDays = days.includes(day.key)
                            ? days.filter(d => d !== day.key)
                            : [...days, day.key];
                          setNewAutomation({ ...newAutomation, schedule_days: newDays });
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          newAutomation.schedule_days.includes(day.key)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Send To Roles</label>
                  <div className="flex flex-wrap gap-2">
                    {ROLES.map(role => (
                      <button
                        key={role.key}
                        type="button"
                        onClick={() => {
                          const roles = newAutomation.target_roles;
                          const newRoles = roles.includes(role.key)
                            ? roles.filter(r => r !== role.key)
                            : [...roles, role.key];
                          setNewAutomation({ ...newAutomation, target_roles: newRoles });
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium ${
                          newAutomation.target_roles.includes(role.key)
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-700 text-gray-400'
                        }`}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Delivery Methods</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAutomation.send_sms}
                        onChange={(e) => setNewAutomation({ ...newAutomation, send_sms: e.target.checked })}
                        className="w-5 h-5 rounded"
                      />
                      <span>📱 SMS</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newAutomation.send_email}
                        onChange={(e) => setNewAutomation({ ...newAutomation, send_email: e.target.checked })}
                        className="w-5 h-5 rounded"
                      />
                      <span>📧 Email</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    SMS Message * <span className="text-gray-500">({newAutomation.sms_message.length}/160)</span>
                  </label>
                  <textarea
                    value={newAutomation.sms_message}
                    onChange={(e) => setNewAutomation({ ...newAutomation, sms_message: e.target.value.slice(0, 160) })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 h-20"
                    placeholder="SMS message..."
                    maxLength={160}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Email Subject</label>
                  <input
                    type="text"
                    value={newAutomation.email_subject}
                    onChange={(e) => setNewAutomation({ ...newAutomation, email_subject: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2"
                    placeholder="Email subject..."
                  />
                </div>
              </div>

              <div className="p-4 border-t border-gray-700 flex justify-end gap-2">
                <button
                  onClick={() => setShowAddNew(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={addNewAutomation}
                  disabled={saving}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-medium disabled:opacity-50"
                >
                  {saving ? 'Creating...' : '✓ Create Automation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-blue-900/30 border border-blue-700/50 rounded-lg p-4">
          <h3 className="font-bold text-blue-300 mb-2">ℹ️ How Automations Work</h3>
          <ul className="text-sm text-blue-200/80 space-y-1">
            <li>• Automations run at the scheduled time each day they're enabled</li>
            <li>• SMS requires users to have phone number and carrier set in their profile</li>
            <li>• Email requires users to have email address in their profile</li>
            <li>• The availability reminder only sends to users who haven't submitted yet</li>
            <li>• All times are in Eastern Standard Time (EST)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
