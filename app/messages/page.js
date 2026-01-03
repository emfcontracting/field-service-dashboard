'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';

const supabase = getSupabase();

export default function MessagesPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('custom');
  const [deliveryMethod, setDeliveryMethod] = useState('email'); // 'email' or 'sms'
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedWO, setSelectedWO] = useState(null);
  const [sendResults, setSendResults] = useState(null);
  const [messageHistory, setMessageHistory] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchWorkOrders();
    fetchMessageHistory();
  }, []);

  async function fetchUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('is_active', true)
        .order('first_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWorkOrders() {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('wo_id, wo_number, building, priority, status')
        .in('status', ['pending', 'assigned', 'in_progress'])
        .order('date_entered', { ascending: false })
        .limit(50);

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    }
  }

  async function fetchMessageHistory() {
    try {
      const { data, error } = await supabase
        .from('message_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        setMessageHistory(data);
      }
    } catch (error) {
      // Table might not exist yet, that's ok
      console.log('Message history not available');
    }
  }

  function toggleUserSelection(userId) {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }

  function selectAllUsers() {
    const availableUsers = deliveryMethod === 'sms' 
      ? users.filter(u => u.phone && u.sms_carrier)
      : users.filter(u => u.email);
    setSelectedUsers(availableUsers.map(u => u.user_id));
  }

  function clearSelection() {
    setSelectedUsers([]);
  }

  function getMessagePreview() {
    if (messageType === 'custom') {
      return message || '(Enter your message above)';
    }
    
    if (messageType === 'work_order' && selectedWO) {
      const wo = workOrders.find(w => w.wo_id === selectedWO);
      if (wo) {
        return `EMF: New WO ${wo.wo_number} assigned.\n${wo.building || 'No location'}\nPriority: ${wo.priority?.toUpperCase() || 'NORMAL'}`;
      }
    }
    
    if (messageType === 'emergency' && selectedWO) {
      const wo = workOrders.find(w => w.wo_id === selectedWO);
      if (wo) {
        return `🚨 EMF EMERGENCY!\nWO: ${wo.wo_number}\n${wo.building || 'No location'}\nCheck app NOW!`;
      }
    }

    if (messageType === 'reminder') {
      return `EMF Reminder: Please log your daily hours in the mobile app. This is required for CBRE compliance.`;
    }

    if (messageType === 'availability') {
      return `EMF: Please submit your availability for tomorrow in the mobile app.`;
    }

    return '(Select options above)';
  }

  async function sendMessages() {
    const recipients = users.filter(u => selectedUsers.includes(u.user_id));
    
    if (recipients.length === 0) {
      alert('Please select at least one recipient');
      return;
    }

    const finalMessage = getMessagePreview();
    if (!finalMessage || finalMessage.includes('(')) {
      alert('Please complete the message');
      return;
    }

    if (!confirm(`Send this message to ${recipients.length} recipient(s)?\n\n"${finalMessage}"`)) {
      return;
    }

    setSending(true);
    setSendResults(null);

    try {
      // Determine notification type for API
      let apiType = 'custom';
      let workOrder = null;

      if (messageType === 'work_order' && selectedWO) {
        apiType = 'work_order_assigned';
        workOrder = workOrders.find(w => w.wo_id === selectedWO);
      } else if (messageType === 'emergency' && selectedWO) {
        apiType = 'emergency_work_order';
        workOrder = workOrders.find(w => w.wo_id === selectedWO);
      }

      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: apiType,
          deliveryMethod: deliveryMethod, // 'email' or 'sms'
          recipients: recipients.map(r => ({
            user_id: r.user_id,
            phone: r.phone,
            sms_carrier: r.sms_carrier,
            email: r.email,
            first_name: r.first_name,
            last_name: r.last_name
          })),
          workOrder: workOrder,
          customMessage: messageType === 'custom' || messageType === 'reminder' || messageType === 'availability' 
            ? finalMessage 
            : null
        })
      });

      const result = await response.json();

      if (result.success) {
        setSendResults(result);
        
        // Log the message (if table exists)
        try {
          await supabase.from('message_log').insert({
            message_type: messageType,
            message_text: finalMessage,
            recipient_count: recipients.length,
            sent_count: result.sent,
            failed_count: result.failed,
            sent_at: new Date().toISOString()
          });
        } catch (e) {
          // Table might not exist
        }

        // Clear form on success
        if (result.sent > 0) {
          setMessage('');
          setSelectedUsers([]);
          setSelectedWO(null);
          fetchMessageHistory();
        }
      } else {
        alert('Error sending messages: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Send error:', error);
      alert('Error sending messages: ' + error.message);
    } finally {
      setSending(false);
    }
  }

  const usersAvailable = deliveryMethod === 'sms' 
    ? users.filter(u => u.phone && u.sms_carrier)
    : users.filter(u => u.email);
  const usersUnavailable = deliveryMethod === 'sms'
    ? users.filter(u => !u.phone || !u.sms_carrier)
    : users.filter(u => !u.email);
  const selectedCount = selectedUsers.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <img 
              src="/emf-logo.png" 
              alt="EMF Contracting LLC" 
              className="h-12 w-auto"
            />
            <div>
              <h1 className="text-2xl font-bold">💬 Team Messaging</h1>
              <p className="text-sm text-gray-400">Send SMS notifications to field technicians</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/dashboard')}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-semibold transition"
          >
            ← Back to Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Recipients */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">{deliveryMethod === 'sms' ? '📱' : '📧'} Recipients</h2>
                <div className="flex gap-2">
                  <button
                    onClick={selectAllUsers}
                    className="text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-xs bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded"
                  >
                    Clear
                  </button>
                </div>
              </div>

              {/* Delivery Method Toggle */}
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => { setDeliveryMethod('email'); clearSelection(); }}
                  className={`flex-1 py-2 px-3 rounded-lg font-semibold transition ${
                    deliveryMethod === 'email'
                      ? 'bg-blue-600 ring-2 ring-blue-400'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  📧 Email
                </button>
                <button
                  onClick={() => { setDeliveryMethod('sms'); clearSelection(); }}
                  className={`flex-1 py-2 px-3 rounded-lg font-semibold transition ${
                    deliveryMethod === 'sms'
                      ? 'bg-blue-600 ring-2 ring-blue-400'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  📱 SMS
                </button>
              </div>

              {/* Available users */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {usersAvailable.map(user => (
                  <label
                    key={user.user_id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition ${
                      selectedUsers.includes(user.user_id)
                        ? 'bg-blue-600/30 border border-blue-500'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(user.user_id)}
                      onChange={() => toggleUserSelection(user.user_id)}
                      className="w-5 h-5 rounded"
                    />
                    <div className="flex-1">
                      <div className="font-semibold">{user.first_name} {user.last_name}</div>
                      <div className="text-xs text-gray-400 capitalize">{user.role.replace('_', ' ')}</div>
                    </div>
                    {deliveryMethod === 'sms' ? (
                      <span className="text-xs px-2 py-1 bg-green-900 text-green-300 rounded">
                        📱 {user.sms_carrier}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-blue-900 text-blue-300 rounded truncate max-w-[120px]">
                        📧 {user.email?.split('@')[0]}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {/* Unavailable users */}
              {usersUnavailable.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-sm text-yellow-400 mb-2">⚠️ Cannot receive {deliveryMethod === 'sms' ? 'SMS' : 'email'}:</p>
                  <div className="space-y-1">
                    {usersUnavailable.map(user => (
                      <div key={user.user_id} className="text-sm text-gray-500 flex justify-between">
                        <span>{user.first_name} {user.last_name}</span>
                        <span className="text-xs">{deliveryMethod === 'sms' ? 'No carrier set' : 'No email'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Selection Summary */}
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="text-center">
                  <span className="text-2xl font-bold text-blue-400">{selectedCount}</span>
                  <span className="text-gray-400 ml-2">selected</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Message Composer */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-4">
              <h2 className="text-lg font-bold mb-4">✉️ Compose Message</h2>

              {/* Message Type */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">Message Type</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {[
                    { id: 'custom', label: '📝 Custom', color: 'blue' },
                    { id: 'work_order', label: '📋 Work Order', color: 'green' },
                    { id: 'emergency', label: '🚨 Emergency', color: 'red' },
                    { id: 'reminder', label: '⏰ Hours Reminder', color: 'yellow' },
                    { id: 'availability', label: '📅 Availability', color: 'purple' },
                  ].map(type => (
                    <button
                      key={type.id}
                      onClick={() => setMessageType(type.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-semibold transition ${
                        messageType === type.id
                          ? `bg-${type.color}-600 ring-2 ring-${type.color}-400`
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Work Order Selection (for WO types) */}
              {(messageType === 'work_order' || messageType === 'emergency') && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Select Work Order</label>
                  <select
                    value={selectedWO || ''}
                    onChange={(e) => setSelectedWO(e.target.value)}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">-- Select Work Order --</option>
                    {workOrders.map(wo => (
                      <option key={wo.wo_id} value={wo.wo_id}>
                        {wo.wo_number} - {wo.building} ({wo.priority?.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Custom Message Input */}
              {messageType === 'custom' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-400 mb-2">Your Message</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message here... (Keep it short - SMS limit is ~160 characters)"
                    rows={4}
                    maxLength={160}
                    className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
                  />
                  <div className="text-right text-xs text-gray-500 mt-1">
                    {message.length}/160 characters
                  </div>
                </div>
              )}

              {/* Message Preview */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-400 mb-2">Preview</label>
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-lg">
                      📱
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-500 mb-1">EMF Contracting</div>
                      <div className="bg-gray-700 rounded-lg p-3 text-sm whitespace-pre-wrap">
                        {getMessagePreview()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Send Button */}
              <button
                onClick={sendMessages}
                disabled={sending || selectedCount === 0}
                className={`w-full py-4 rounded-lg font-bold text-lg transition ${
                  sending || selectedCount === 0
                    ? 'bg-gray-600 cursor-not-allowed'
                    : messageType === 'emergency'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {sending ? (
                  '⏳ Sending...'
                ) : (
                  `📤 Send to ${selectedCount} Recipient${selectedCount !== 1 ? 's' : ''}`
                )}
              </button>

              {/* Send Results */}
              {sendResults && (
                <div className={`mt-4 p-4 rounded-lg ${
                  sendResults.failed === 0 ? 'bg-green-900/50 border border-green-600' : 'bg-yellow-900/50 border border-yellow-600'
                }`}>
                  <h3 className="font-bold mb-2">
                    {sendResults.failed === 0 ? '✅ Messages Sent Successfully!' : '⚠️ Partial Success'}
                  </h3>
                  <div className="text-sm space-y-1">
                    <p className="text-green-400">✓ {sendResults.sent} sent successfully</p>
                    {sendResults.failed > 0 && (
                      <p className="text-red-400">✗ {sendResults.failed} failed</p>
                    )}
                  </div>
                  {sendResults.errors?.length > 0 && (
                    <div className="mt-2 text-xs text-gray-400">
                      <p className="font-semibold">Failed:</p>
                      {sendResults.errors.map((err, i) => (
                        <p key={i}>{err.name}: {err.error}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent Messages */}
            {messageHistory.length > 0 && (
              <div className="bg-gray-800 rounded-lg p-4 mt-6">
                <h2 className="text-lg font-bold mb-4">📜 Recent Messages</h2>
                <div className="space-y-2">
                  {messageHistory.slice(0, 5).map((msg, i) => (
                    <div key={i} className="bg-gray-700 rounded-lg p-3 text-sm">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-semibold capitalize">{msg.message_type.replace('_', ' ')}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(msg.sent_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-gray-300 text-xs truncate">{msg.message_text}</p>
                      <div className="text-xs text-gray-500 mt-1">
                        Sent to {msg.sent_count} of {msg.recipient_count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
