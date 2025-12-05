// mobile/components/MobileHeader.js
'use client';

import ConnectionStatus from './ConnectionStatus';

export default function MobileHeader({ 
  currentUser, 
  onCompletedClick, 
  onChangePinClick, 
  onLogout,
  showDashboardButton = false,
  // Offline mode props
  isOnline = true,
  pendingSyncCount = 0,
  syncStatus = 'idle',
  onForceSync = null,
  lastSyncTime = null,
  showOfflineStatus = true
}) {
  return (
    <div className="mb-4">
      {/* Main Header Row */}
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <img 
            src="/emf-logo.png" 
            alt="EMF" 
            className="h-10 w-auto"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.innerHTML += '<div class="h-10 w-10 bg-white rounded-lg flex items-center justify-center text-gray-900 font-bold">EMF</div>';
            }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold">👋 {currentUser.first_name}</h1>
              {/* Compact Connection Indicator */}
              {showOfflineStatus && (
                <ConnectionStatus
                  isOnline={isOnline}
                  pendingSyncCount={pendingSyncCount}
                  syncStatus={syncStatus}
                  compact={true}
                />
              )}
            </div>
            <p className="text-xs text-gray-400">
              {currentUser.role.replace('_', ' ').toUpperCase()}
            </p>
          </div>
        </div>
        
        {/* Action Buttons - Horizontal Scroll on Mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 max-w-[60vw] scrollbar-hide">
          {/* Only show Dashboard button for admin and office roles */}
          {showDashboardButton && (currentUser.role === 'admin' || currentUser.role === 'office') && (
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap flex-shrink-0"
            >
              💻 Dashboard
            </button>
          )}
          
          <button
            onClick={onCompletedClick}
            className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap flex-shrink-0"
          >
            ✅ Completed
          </button>
          
          <button
            onClick={onChangePinClick}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap flex-shrink-0"
          >
            🔑 PIN
          </button>
          
          <button
            onClick={onLogout}
            className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm whitespace-nowrap flex-shrink-0"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Offline Banner - Shows when offline or has pending changes */}
      {showOfflineStatus && (!isOnline || pendingSyncCount > 0) && (
        <div className={`px-3 py-2 rounded-lg text-sm flex items-center justify-between ${
          !isOnline 
            ? 'bg-red-900/50 border border-red-700' 
            : 'bg-yellow-900/50 border border-yellow-700'
        }`}>
          <div className="flex items-center gap-2">
            <span>{!isOnline ? '📴' : '⏳'}</span>
            <span className={!isOnline ? 'text-red-400' : 'text-yellow-400'}>
              {!isOnline 
                ? 'Working Offline - Changes saved locally' 
                : `${pendingSyncCount} change${pendingSyncCount > 1 ? 's' : ''} pending sync`
              }
            </span>
          </div>
          {isOnline && onForceSync && (
            <button
              onClick={onForceSync}
              disabled={syncStatus === 'syncing'}
              className="text-yellow-400 hover:text-yellow-300 text-xs font-medium"
            >
              {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
