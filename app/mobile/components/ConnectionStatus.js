// ConnectionStatus.js - Visual indicator for online/offline status and sync queue
'use client';

import { useState, useEffect } from 'react';

export default function ConnectionStatus({ 
  isOnline, 
  pendingSyncCount = 0, 
  syncStatus = 'idle',
  onForceSync,
  lastSyncTime,
  compact = false 
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [animatePulse, setAnimatePulse] = useState(false);

  // Pulse animation when sync status changes
  useEffect(() => {
    if (syncStatus === 'syncing') {
      setAnimatePulse(true);
    } else {
      const timer = setTimeout(() => setAnimatePulse(false), 300);
      return () => clearTimeout(timer);
    }
  }, [syncStatus]);

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    const diff = Date.now() - new Date(lastSyncTime).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Get status color and icon
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        color: 'bg-red-500',
        textColor: 'text-red-400',
        icon: '📴',
        text: 'Offline',
        subtext: pendingSyncCount > 0 ? `${pendingSyncCount} pending` : 'Changes saved locally'
      };
    }

    if (syncStatus === 'syncing') {
      return {
        color: 'bg-yellow-500',
        textColor: 'text-yellow-400',
        icon: '🔄',
        text: 'Syncing...',
        subtext: 'Uploading changes'
      };
    }

    if (syncStatus === 'error') {
      return {
        color: 'bg-orange-500',
        textColor: 'text-orange-400',
        icon: '⚠️',
        text: 'Sync Error',
        subtext: 'Tap to retry'
      };
    }

    if (pendingSyncCount > 0) {
      return {
        color: 'bg-yellow-500',
        textColor: 'text-yellow-400',
        icon: '⏳',
        text: 'Pending',
        subtext: `${pendingSyncCount} to sync`
      };
    }

    return {
      color: 'bg-green-500',
      textColor: 'text-green-400',
      icon: '🌐',
      text: 'Online',
      subtext: `Synced ${formatLastSync()}`
    };
  };

  const statusInfo = getStatusInfo();

  // Compact version for header
  if (compact) {
    return (
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
          animatePulse ? 'scale-110' : 'scale-100'
        }`}
        style={{
          backgroundColor: isOnline 
            ? (pendingSyncCount > 0 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(34, 197, 94, 0.2)')
            : 'rgba(239, 68, 68, 0.2)'
        }}
      >
        <span className={`w-2 h-2 rounded-full ${statusInfo.color} ${
          syncStatus === 'syncing' ? 'animate-pulse' : ''
        }`} />
        <span className={statusInfo.textColor}>
          {pendingSyncCount > 0 ? pendingSyncCount : (isOnline ? '✓' : '!')}
        </span>
      </button>
    );
  }

  return (
    <div className="relative">
      {/* Main Status Bar */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`w-full flex items-center justify-between px-4 py-2 rounded-lg transition-all ${
          !isOnline ? 'bg-red-900/50 border border-red-700' : 
          pendingSyncCount > 0 ? 'bg-yellow-900/50 border border-yellow-700' :
          'bg-green-900/50 border border-green-700'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className={`text-lg ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}>
            {statusInfo.icon}
          </span>
          <div className="text-left">
            <div className={`font-medium ${statusInfo.textColor}`}>
              {statusInfo.text}
            </div>
            <div className="text-xs text-gray-400">
              {statusInfo.subtext}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {pendingSyncCount > 0 && (
            <span className="bg-yellow-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">
              {pendingSyncCount}
            </span>
          )}
          <span className="text-gray-500">
            {showDetails ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {/* Expanded Details */}
      {showDetails && (
        <div className="mt-2 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="space-y-3">
            {/* Connection Status */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Connection</span>
              <span className={`font-medium ${isOnline ? 'text-green-400' : 'text-red-400'}`}>
                {isOnline ? '🌐 Online' : '📴 Offline'}
              </span>
            </div>

            {/* Pending Changes */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Pending Changes</span>
              <span className={`font-medium ${pendingSyncCount > 0 ? 'text-yellow-400' : 'text-gray-300'}`}>
                {pendingSyncCount} items
              </span>
            </div>

            {/* Last Sync */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Last Sync</span>
              <span className="text-gray-300">
                {formatLastSync()}
              </span>
            </div>

            {/* Sync Button */}
            {isOnline && (
              <button
                onClick={onForceSync}
                disabled={syncStatus === 'syncing'}
                className={`w-full py-2 rounded-lg font-medium transition-all ${
                  syncStatus === 'syncing'
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : pendingSyncCount > 0
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {syncStatus === 'syncing' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⟳</span>
                    Syncing...
                  </span>
                ) : pendingSyncCount > 0 ? (
                  `Sync Now (${pendingSyncCount} pending)`
                ) : (
                  '↻ Refresh Data'
                )}
              </button>
            )}

            {/* Offline Mode Info */}
            {!isOnline && (
              <div className="bg-red-900/30 rounded-lg p-3 border border-red-800">
                <div className="text-red-400 text-sm font-medium mb-1">
                  📴 Working Offline
                </div>
                <div className="text-gray-400 text-xs">
                  Your changes are being saved locally. They will automatically sync when you reconnect to the internet.
                </div>
              </div>
            )}

            {/* Pending Items Warning */}
            {pendingSyncCount > 0 && isOnline && (
              <div className="bg-yellow-900/30 rounded-lg p-3 border border-yellow-800">
                <div className="text-yellow-400 text-sm font-medium mb-1">
                  ⏳ Changes Pending
                </div>
                <div className="text-gray-400 text-xs">
                  You have {pendingSyncCount} change{pendingSyncCount > 1 ? 's' : ''} waiting to be synced. 
                  Tap "Sync Now" to upload them.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Mini floating indicator for corners
export function FloatingConnectionIndicator({ isOnline, pendingSyncCount, syncStatus }) {
  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg ${
      !isOnline 
        ? 'bg-red-600' 
        : pendingSyncCount > 0 
          ? 'bg-yellow-600' 
          : 'bg-green-600'
    }`}>
      <span className={`w-2 h-2 rounded-full bg-white ${
        syncStatus === 'syncing' ? 'animate-pulse' : ''
      }`} />
      <span className="text-white text-xs font-medium">
        {!isOnline ? 'Offline' : pendingSyncCount > 0 ? `${pendingSyncCount} pending` : 'Synced'}
      </span>
    </div>
  );
}

// Sync notification toast
export function SyncNotification({ show, message, type = 'success', onDismiss }) {
  if (!show) return null;

  const bgColor = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-yellow-600',
    info: 'bg-blue-600'
  }[type];

  const icon = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }[type];

  return (
    <div className={`fixed top-4 left-4 right-4 z-50 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center justify-between animate-slide-down`}>
      <div className="flex items-center gap-2">
        <span>{icon}</span>
        <span className="font-medium">{message}</span>
      </div>
      <button onClick={onDismiss} className="text-white/80 hover:text-white">
        ✕
      </button>
    </div>
  );
}
