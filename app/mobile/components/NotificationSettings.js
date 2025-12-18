// app/mobile/components/NotificationSettings.js
'use client';
import { useState } from 'react';
import usePushNotifications from '../hooks/usePushNotifications';

export default function NotificationSettings({ userId, onClose }) {
  const {
    isSupported,
    permission,
    isSubscribed,
    isSubscribing,
    error,
    subscribe,
    unsubscribe
  } = usePushNotifications(userId);
  
  const [showIOSHelp, setShowIOSHelp] = useState(false);

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

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      // On iOS, check if installed as PWA first
      if (isIOS() && !isInstalledPWA()) {
        setShowIOSHelp(true);
        return;
      }
      await subscribe();
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          🔔 Push Notifications
        </h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        )}
      </div>

      {!isSupported ? (
        <div className="bg-yellow-900/50 text-yellow-300 p-3 rounded-lg text-sm">
          ⚠️ Push notifications are not supported in this browser.
          {isIOS() && (
            <p className="mt-2">
              On iPhone/iPad, you need to add this app to your home screen first.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Status Display */}
          <div className="flex items-center justify-between bg-gray-700 p-3 rounded-lg mb-4">
            <div>
              <p className="text-white font-medium">
                {isSubscribed ? '✅ Notifications Enabled' : '🔕 Notifications Disabled'}
              </p>
              <p className="text-gray-400 text-sm">
                {isSubscribed 
                  ? "You'll receive alerts for new work orders"
                  : "Enable to get instant work order alerts"
                }
              </p>
            </div>
            
            {/* Toggle Button */}
            <button
              onClick={handleToggle}
              disabled={isSubscribing || permission === 'denied'}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                isSubscribed ? 'bg-green-600' : 'bg-gray-600'
              } ${isSubscribing ? 'opacity-50' : ''}`}
            >
              <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                isSubscribed ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Permission Denied Warning */}
          {permission === 'denied' && (
            <div className="bg-red-900/50 text-red-300 p-3 rounded-lg text-sm mb-4">
              ⛔ Notifications are blocked. To enable them:
              <ol className="list-decimal ml-4 mt-2 space-y-1">
                <li>Tap the lock/info icon in your browser's address bar</li>
                <li>Find "Notifications" and change to "Allow"</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-900/50 text-red-300 p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {/* Loading State */}
          {isSubscribing && (
            <div className="flex items-center justify-center gap-2 text-blue-400 py-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Setting up notifications...</span>
            </div>
          )}

          {/* Info Section */}
          <div className="bg-gray-700/50 p-3 rounded-lg text-sm text-gray-300">
            <p className="font-medium text-white mb-2">You'll be notified when:</p>
            <ul className="space-y-1">
              <li>📋 A new work order is assigned to you</li>
              <li>🚨 Emergency work orders need attention</li>
              <li>📝 Status updates on your jobs</li>
            </ul>
          </div>
        </>
      )}

      {/* iOS Installation Help Modal */}
      {showIOSHelp && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl max-w-sm w-full p-6">
            <div className="text-center mb-4">
              <span className="text-4xl">📲</span>
            </div>
            
            <h3 className="text-xl font-bold text-center text-white mb-4">
              Add to Home Screen First
            </h3>
            
            <p className="text-gray-300 text-sm mb-4 text-center">
              To receive push notifications on iPhone/iPad, you need to install this app:
            </p>
            
            <ol className="text-sm text-gray-300 space-y-3 mb-6">
              <li className="flex items-start gap-3">
                <span className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 text-white">1</span>
                <span>Tap the <strong>Share</strong> button ⬆️ at the bottom of Safari</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 text-white">2</span>
                <span>Scroll down and tap <strong>"Add to Home Screen"</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 text-white">3</span>
                <span>Tap <strong>"Add"</strong> in the top right</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="bg-blue-600 rounded-full w-6 h-6 flex items-center justify-center text-xs flex-shrink-0 text-white">4</span>
                <span>Open the app from your home screen</span>
              </li>
            </ol>
            
            <button
              onClick={() => setShowIOSHelp(false)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
