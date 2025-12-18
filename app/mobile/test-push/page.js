// app/mobile/test-push/page.js
// Test page for debugging push notifications
'use client';
import { useState, useEffect } from 'react';

export default function TestPushPage() {
  const [status, setStatus] = useState({});
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    const newStatus = {
      serviceWorker: 'serviceWorker' in navigator,
      pushManager: 'PushManager' in window,
      notification: 'Notification' in window,
      permission: 'Notification' in window ? Notification.permission : 'N/A',
      isSecure: location.protocol === 'https:' || location.hostname === 'localhost',
      dismissed: localStorage.getItem('push_prompt_dismissed'),
      neverAsk: localStorage.getItem('push_prompt_never'),
    };

    // Check for existing subscription
    if (newStatus.serviceWorker && newStatus.pushManager) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          setSubscription(sub);
          newStatus.hasSubscription = true;
        } else {
          newStatus.hasSubscription = false;
        }
      } catch (e) {
        newStatus.subscriptionError = e.message;
      }
    }

    // Check VAPID key
    try {
      const res = await fetch('/api/push/send');
      const data = await res.json();
      newStatus.vapidConfigured = data.configured;
      newStatus.vapidKey = data.publicKey ? data.publicKey.substring(0, 20) + '...' : 'N/A';
    } catch (e) {
      newStatus.vapidError = e.message;
    }

    setStatus(newStatus);
  };

  const clearDismissals = () => {
    localStorage.removeItem('push_prompt_dismissed');
    localStorage.removeItem('push_prompt_never');
    alert('✅ Dismissals cleared! Refresh the mobile app to see the prompt.');
    checkStatus();
  };

  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const subscribe = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Notification permission denied: ' + permission);
      }

      // Get VAPID key
      const res = await fetch('/api/push/send');
      const { publicKey } = await res.json();
      if (!publicKey) throw new Error('VAPID public key not configured');

      // Get service worker
      const registration = await navigator.serviceWorker.ready;

      // Subscribe
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      setSubscription(sub);

      // Save to server (use a test user ID)
      const userId = prompt('Enter your user_id from the users table:');
      if (!userId) throw new Error('User ID required');

      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: sub.toJSON(),
          user_id: userId
        })
      });

      const saveResult = await saveRes.json();
      if (!saveRes.ok) throw new Error(saveResult.error);

      alert('✅ Subscribed successfully!');
      checkStatus();

    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const sendTestNotification = async () => {
    setLoading(true);
    setTestResult(null);
    
    try {
      const userId = prompt('Enter your user_id to send test notification:');
      if (!userId) throw new Error('User ID required');

      const res = await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_ids: [userId],
          title: '🧪 Test Notification',
          body: 'If you see this, push notifications are working!',
          data: {
            type: 'test',
            url: '/mobile'
          }
        })
      });

      const result = await res.json();
      setTestResult(result);

      if (result.sent > 0) {
        alert('✅ Test notification sent! Check your device.');
      } else {
        alert('⚠️ No notifications sent. Check result below.');
      }

    } catch (e) {
      setTestResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  const unsubscribe = async () => {
    if (!subscription) return;
    
    try {
      await subscription.unsubscribe();
      setSubscription(null);
      alert('✅ Unsubscribed');
      checkStatus();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-6">🔔 Push Notification Test</h1>

      {/* Status */}
      <div className="bg-gray-800 rounded-lg p-4 mb-4">
        <h2 className="font-bold mb-3">System Status</h2>
        <div className="space-y-2 text-sm">
          {Object.entries(status).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="text-gray-400">{key}:</span>
              <span className={
                value === true ? 'text-green-400' : 
                value === false ? 'text-red-400' : 
                'text-yellow-400'
              }>
                {String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Current Subscription */}
      {subscription && (
        <div className="bg-green-900 rounded-lg p-4 mb-4">
          <h2 className="font-bold mb-2">✅ Active Subscription</h2>
          <p className="text-xs text-green-300 break-all">
            Endpoint: {subscription.endpoint.substring(0, 50)}...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900 rounded-lg p-4 mb-4">
          <h2 className="font-bold mb-2">❌ Error</h2>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div className="bg-blue-900 rounded-lg p-4 mb-4">
          <h2 className="font-bold mb-2">📨 Test Result</h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={clearDismissals}
          className="w-full bg-yellow-600 hover:bg-yellow-700 py-3 rounded-lg font-medium"
        >
          🗑️ Clear Dismissals (Reset Prompt)
        </button>

        <button
          onClick={subscribe}
          disabled={loading || subscription}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 py-3 rounded-lg font-medium"
        >
          {loading ? '⏳ Loading...' : subscription ? '✅ Already Subscribed' : '🔔 Subscribe to Notifications'}
        </button>

        {subscription && (
          <button
            onClick={unsubscribe}
            className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-lg font-medium"
          >
            ❌ Unsubscribe
          </button>
        )}

        <button
          onClick={sendTestNotification}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-3 rounded-lg font-medium"
        >
          📨 Send Test Notification
        </button>

        <button
          onClick={checkStatus}
          className="w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-medium"
        >
          🔄 Refresh Status
        </button>

        <a
          href="/mobile"
          className="block w-full bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-medium text-center"
        >
          ← Back to Mobile App
        </a>
      </div>
    </div>
  );
}
