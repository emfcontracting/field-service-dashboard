// app/mobile/hooks/usePushNotifications.js
'use client';
import { useState, useEffect, useCallback } from 'react';

export function usePushNotifications(userId) {
  const [permission, setPermission] = useState('default');
  const [subscription, setSubscription] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState(null);

  // Check if push notifications are supported
  useEffect(() => {
    const supported = 
      'serviceWorker' in navigator && 
      'PushManager' in window &&
      'Notification' in window;
    
    setIsSupported(supported);
    
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Check existing subscription on mount
  useEffect(() => {
    if (!isSupported) return;

    const checkExistingSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        
        if (existingSub) {
          setSubscription(existingSub);
          console.log('✅ Existing push subscription found');
        }
      } catch (err) {
        console.error('Error checking subscription:', err);
      }
    };

    checkExistingSubscription();
  }, [isSupported]);

  // Get VAPID public key from server
  const getVapidKey = async () => {
    try {
      const response = await fetch('/api/push/send');
      const data = await response.json();
      
      if (!data.configured || !data.publicKey) {
        throw new Error('Push notifications not configured on server');
      }
      
      return data.publicKey;
    } catch (err) {
      console.error('Error getting VAPID key:', err);
      throw err;
    }
  };

  // Convert VAPID key to Uint8Array
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!isSupported || !userId) {
      setError('Push not supported or user not logged in');
      return false;
    }

    setIsSubscribing(true);
    setError(null);

    try {
      // Request permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        setError('Notification permission denied');
        setIsSubscribing(false);
        return false;
      }

      // Get VAPID public key
      const vapidKey = await getVapidKey();
      const applicationServerKey = urlBase64ToUint8Array(vapidKey);

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      // Send subscription to server
      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: pushSubscription.toJSON(),
          user_id: userId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to save subscription on server');
      }

      setSubscription(pushSubscription);
      console.log('✅ Push notification subscription successful');
      
      setIsSubscribing(false);
      return true;

    } catch (err) {
      console.error('Push subscription error:', err);
      setError(err.message);
      setIsSubscribing(false);
      return false;
    }
  }, [isSupported, userId]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async () => {
    if (!subscription || !userId) return false;

    try {
      // Unsubscribe from browser
      await subscription.unsubscribe();

      // Remove from server
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          user_id: userId
        })
      });

      setSubscription(null);
      console.log('✅ Unsubscribed from push notifications');
      return true;

    } catch (err) {
      console.error('Unsubscribe error:', err);
      setError(err.message);
      return false;
    }
  }, [subscription, userId]);

  return {
    isSupported,
    permission,
    subscription,
    isSubscribed: !!subscription,
    isSubscribing,
    error,
    subscribe,
    unsubscribe
  };
}

export default usePushNotifications;
