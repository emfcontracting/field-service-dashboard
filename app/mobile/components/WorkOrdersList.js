// components/WorkOrdersList.js - Bilingual Work Orders List (Mobile Responsive) - WITH OFFLINE SUPPORT
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import LanguageToggle from './LanguageToggle';
import ConnectionStatus from './ConnectionStatus';
import { formatDate, calculateAge, getPriorityColor, getPriorityBadge, getStatusBadge } from '../utils/helpers';

export default function WorkOrdersList({
  currentUser,
  workOrders,
  onSelectWO,
  onShowCompleted,
  onShowChangePin,
  onLogout,
  // OFFLINE MODE PROPS
  isOnline = true,
  pendingSyncCount = 0,
  syncStatus = 'idle',
  onForceSync = null,
  onDownloadOffline = null,
  cachedCount = 0,
  isDownloading = false,
  lastSyncTime = null
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language]?.[key] || key;

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSyncTime) return null;
    const diff = Date.now() - new Date(lastSyncTime).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header - Fixed at top */}
      <div className="bg-gray-800 p-3 sticky top-0 z-10">
        {/* Top Row: Logo/Name, Connection Status and Logout */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <img 
              src="/emf-logo.png" 
              alt="EMF" 
              className="h-8 w-auto"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-sm leading-tight">👋 {currentUser.first_name}</p>
                {/* Compact Connection Status Indicator */}
                <ConnectionStatus
                  isOnline={isOnline}
                  pendingSyncCount={pendingSyncCount}
                  syncStatus={syncStatus}
                  compact={true}
                />
              </div>
              <p className="text-[10px] text-gray-400 leading-tight">{currentUser.role.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-lg text-sm"
          >
            {t('logout')}
          </button>
        </div>

        {/* Offline Status / Download Banner */}
        {!isOnline ? (
          // OFFLINE MODE - Show cached count
          <div className="mb-2 px-3 py-2 rounded-lg text-xs bg-red-900/50 border border-red-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>📴</span>
                <span className="text-red-400">Working Offline</span>
              </div>
              <span className="text-gray-400">
                {cachedCount > 0 ? `${cachedCount} WOs cached` : 'No cached data'}
              </span>
            </div>
            {pendingSyncCount > 0 && (
              <div className="mt-1 text-yellow-400">
                ⏳ {pendingSyncCount} change{pendingSyncCount > 1 ? 's' : ''} will sync when online
              </div>
            )}
          </div>
        ) : pendingSyncCount > 0 ? (
          // ONLINE WITH PENDING - Show sync option
          <div className="mb-2 px-3 py-2 rounded-lg text-xs bg-yellow-900/50 border border-yellow-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⏳</span>
              <span className="text-yellow-400">
                {pendingSyncCount} change{pendingSyncCount > 1 ? 's' : ''} pending sync
              </span>
            </div>
            <button
              onClick={onForceSync}
              disabled={syncStatus === 'syncing'}
              className="text-yellow-400 hover:text-yellow-300 font-medium"
            >
              {syncStatus === 'syncing' ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        ) : (
          // ONLINE - Show download button
          <div className="mb-2 px-3 py-2 rounded-lg text-xs bg-gray-700/50 border border-gray-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>📥</span>
              <span className="text-gray-300">
                {cachedCount > 0 
                  ? `${cachedCount} WOs ready for offline${lastSyncTime ? ` • ${formatLastSync()}` : ''}`
                  : 'Download work orders for offline use'
                }
              </span>
            </div>
            <button
              onClick={onDownloadOffline}
              disabled={isDownloading || syncStatus === 'downloading'}
              className={`px-3 py-1 rounded font-medium text-xs ${
                isDownloading || syncStatus === 'downloading'
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isDownloading || syncStatus === 'downloading' ? (
                <span className="flex items-center gap-1">
                  <span className="animate-spin">⟳</span> Downloading...
                </span>
              ) : (
                '📥 Download'
              )}
            </button>
          </div>
        )}

        {/* Bottom Row: Action Buttons - Scrollable on very small screens */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <LanguageToggle />
          
          {/* Only show Dashboard button for admin and office roles */}
          {(currentUser.role === 'admin' || currentUser.role === 'office') && (
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0"
            >
              💻 {t('dashboard')}
            </button>
          )}
          <button
            onClick={onShowCompleted}
            className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0"
          >
            ✅ {t('completed')}
          </button>
          <button
            onClick={onShowChangePin}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0"
          >
            🔒 {t('pin')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="mb-4">
          <h2 className="text-xl font-bold">{t('myWorkOrders')}</h2>
          <p className="text-gray-400 text-sm">
            {workOrders.length} {t('activeWork')} {workOrders.length === 1 ? t('order') : t('orders')}
          </p>
        </div>

        <div className="space-y-3">
          {workOrders.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-400 text-lg">{t('noActiveWorkOrders')}</p>
              <p className="text-gray-500 text-sm mt-2">{t('checkBackLater')}</p>
              {isOnline && onDownloadOffline && (
                <button
                  onClick={onDownloadOffline}
                  disabled={isDownloading}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium"
                >
                  {isDownloading ? '⟳ Downloading...' : '🔄 Refresh Work Orders'}
                </button>
              )}
            </div>
          ) : (
            workOrders.map(wo => (
              <div
                key={wo.wo_id}
                onClick={() => onSelectWO(wo)}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer active:scale-[0.99]"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-bold text-lg">{wo.wo_number}</span>
                    <span className={`ml-2 text-sm ${getPriorityColor(wo.priority)}`}>
                      {getPriorityBadge(wo.priority)}
                    </span>
                    {/* Show if locally modified */}
                    {wo.locally_modified && (
                      <span className="ml-2 text-xs text-yellow-500">⏳</span>
                    )}
                  </div>
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded-full ml-2 flex-shrink-0">
                    {getStatusBadge(wo.status)}
                  </span>
                </div>
                
                <h3 className="font-semibold mb-1">{wo.building}</h3>
                <p className="text-sm text-gray-400 mb-2 line-clamp-2">{wo.work_order_description}</p>
                
                <div className="flex flex-wrap justify-between items-center text-xs text-gray-500 gap-1">
                  <div>
                    <span>{t('entered')}: {formatDate(wo.date_entered)}</span>
                    <span className="ml-2 text-orange-500 font-semibold">
                      {calculateAge(wo.date_entered)} {t('daysOld')}
                    </span>
                  </div>
                  <span className="text-green-500 font-bold">{t('nte')}: ${(wo.nte || 0).toFixed(2)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
