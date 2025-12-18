// app/mobile/components/NotificationBell.js
// Simple notification toggle button for the mobile app header
'use client';
import { useState, useEffect } from 'react';

export default function NotificationBell({ userId }) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    // Check if supported
    const supported = 'serviceWorker' in navigator && 
                      'PushManager' in window && 
                      'Notification' in window;
    setIsSupported(supported);

    if (!supported) return;

    // Check permission
    setPermission(Notification.permission);

    // Check existing subscription
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (e) {
      console.error('Error checking subscription:', e);
    }
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

  const handleClick = async () => {
    if (!isSupported || !userId) {
      alert('Push notifications are not supported on this device/browser. Try using Chrome.');
      return;
    }

    if (permission === 'denied') {
      alert('Notifications are blocked. Please enable them in your browser settings:\n\n1. Tap the lock icon in the address bar\n2. Find "Notifications"\n3. Change to "Allow"\n4. Refresh the page');
      return;
    }

    if (isSubscribed) {
      // Already subscribed - show status
      alert('✅ Notifications are enabled!\n\nYou will receive alerts when assigned new work orders.');
      return;
    }

    // Subscribe
    setLoading(true);
    try {
      // Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      
      if (perm !== 'granted') {
        alert('Please allow notifications to receive work order alerts.');
        setLoading(false);
        return;
      }

      // Get VAPID key
      const res = await fetch('/api/push/send');
      const { publicKey, configured } = await res.json();
      
      if (!configured || !publicKey) {
        throw new Error('Push notifications not configured on server');
      }

      // Get service worker
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Save to server
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          user_id: userId
        })
      });

      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error || 'Failed to save subscription');
      }

      setIsSubscribed(true);
      alert('✅ Notifications enabled!\n\nYou will now receive alerts when assigned new work orders.');

    } catch (error) {
      console.error('Subscription error:', error);
      alert('Failed to enable notifications: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Don't show if not supported
  if (!isSupported) return null;

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 flex items-center gap-1 ${
        isSubscribed 
          ? 'bg-green-600 hover:bg-green-700' 
          : permission === 'denied'
          ? 'bg-red-600 hover:bg-red-700'
          : 'bg-yellow-600 hover:bg-yellow-700 animate-pulse'
      }`}
      title={isSubscribed ? 'Notifications enabled' : 'Enable notifications'}
    >
      {loading ? (
        <span className="animate-spin">⟳</span>
      ) : isSubscribed ? (
        '🔔'
      ) : permission === 'denied' ? (
        '🔕'
      ) : (
        '🔔'
      )}
      {!isSubscribed && !loading && (
        <span className="hidden sm:inline">
          {permission === 'denied' ? 'Blocked' : 'Enable'}
        </span>
      )}
    </button>
  );
}
