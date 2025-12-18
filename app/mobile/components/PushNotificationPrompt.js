// app/mobile/components/PushNotificationPrompt.js
'use client';
import { useState, useEffect } from 'react';
import usePushNotifications from '../hooks/usePushNotifications';

export default function PushNotificationPrompt({ userId, onComplete }) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  
  const {
    isSupported,
    permission,
    isSubscribed,
    isSubscribing,
    error,
    subscribe
  } = usePushNotifications(userId);

  // Check if we should show the prompt
  useEffect(() => {
    // Don't show if already subscribed or permission denied
    if (isSubscribed || permission === 'denied') {
      return;
    }

    // Check if user has dismissed the prompt before (stored in localStorage)
    const dismissed = localStorage.getItem('push_prompt_dismissed');
    const dismissedAt = dismissed ? new Date(dismissed) : null;
    
    // Show again after 7 days if dismissed
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) {
        return;
      }
    }

    // Delay showing the prompt to not interrupt initial load
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isSubscribed, permission]);

  // Detect iOS
  const isIOS = () => {
    if (typeof window === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  // Check if running as installed PWA
  const isInstalledPWA = () => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
  };

  const handleEnable = async () => {
    // On iOS, check if installed as PWA first
    if (isIOS() && !isInstalledPWA()) {
      setShowIOSInstructions(true);
      return;
    }

    const success = await subscribe();
    if (success) {
      setShowPrompt(false);
      onComplete?.();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('push_prompt_dismissed', new Date().toISOString());
    setShowPrompt(false);
  };

  const handleNeverAsk = () => {
    localStorage.setItem('push_prompt_never', 'true');
    setShowPrompt(false);
  };

  // iOS installation instructions modal
  if (showIOSInstructions) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl max-w-sm w-full p-6 text-white">
          <div className="text-center mb-4">
            <span className="text-4xl">📲</span>
          </div>
          
          <h3 className="text-xl font-bold text-center mb-4">
            Add to Home Screen
          </h3>
          
          <p className="text-gray-300 text-sm mb-4 text-center">
            To receive push notifications on iPhone/iPad, you need to install this app first:
          </p>
          
          <ol className="text-sm text-gray-300 space-y-3 mb-6">
            <li className="flex items-start gap-3">
              <span className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">1</span>
              <span>Tap the <strong>Share</strong> button <span className="text-blue-400">⬆️</span> at the bottom of Safari</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">2</span>
              <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">3</span>
              <span>Tap <strong>"Add"</strong> in the top right</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0">4</span>
              <span>Open the app from your home screen and enable notifications</span>
            </li>
          </ol>
          
          <button
            onClick={() => setShowIOSInstructions(false)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium"
          >
            Got it!
          </button>
        </div>
      </div>
    );
  }

  if (!showPrompt || !isSupported) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50">
      <div className="bg-gray-800 rounded-t-2xl sm:rounded-xl max-w-sm w-full p-6 text-white animate-slide-up">
        <div className="text-center mb-4">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-3xl">🔔</span>
          </div>
          <h3 className="text-xl font-bold">Enable Notifications</h3>
        </div>
        
        <p className="text-gray-300 text-sm text-center mb-6">
          Get instant alerts when you're assigned new work orders or when there are emergency jobs.
        </p>
        
        {error && (
          <div className="bg-red-900/50 text-red-300 text-sm p-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        
        <div className="space-y-3">
          <button
            onClick={handleEnable}
            disabled={isSubscribing}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            {isSubscribing ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Enabling...
              </>
            ) : (
              <>
                <span>🔔</span> Enable Notifications
              </>
            )}
          </button>
          
          <button
            onClick={handleDismiss}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-300 py-3 rounded-lg font-medium"
          >
            Maybe Later
          </button>
          
          <button
            onClick={handleNeverAsk}
            className="w-full text-gray-500 hover:text-gray-400 text-sm py-2"
          >
            Don't ask again
          </button>
        </div>
      </div>
      
      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
