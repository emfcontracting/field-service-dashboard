// components/WorkOrdersList.js - Bilingual Work Orders List (Mobile Responsive) - WITH OFFLINE SUPPORT + SORT/FILTER/SELECT
import { useState, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import LanguageToggle from './LanguageToggle';
import ConnectionStatus from './ConnectionStatus';
import WeatherWidget from './WeatherWidget';
import NotificationBell from './NotificationBell';
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
  const [weatherExpanded, setWeatherExpanded] = useState(false);

  // SORT, FILTER, SELECT STATE
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date_entered'); // date_entered, priority, nte, age, status
  const [sortOrder, setSortOrder] = useState('desc'); // asc, desc
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWOs, setSelectedWOs] = useState(new Set());
  const [selectMode, setSelectMode] = useState(false);

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

  // FILTERED AND SORTED WORK ORDERS
  const filteredAndSortedWOs = useMemo(() => {
    let filtered = [...workOrders];

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(wo => 
        wo.wo_number?.toLowerCase().includes(term) ||
        wo.building?.toLowerCase().includes(term) ||
        wo.work_order_description?.toLowerCase().includes(term)
      );
    }

    // Priority filter
    if (filterPriority !== 'all') {
      filtered = filtered.filter(wo => wo.priority === filterPriority);
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(wo => wo.status === filterStatus);
    }

    // Sort
    filtered.sort((a, b) => {
      let valA, valB;
      
      switch (sortBy) {
        case 'date_entered':
          valA = new Date(a.date_entered).getTime();
          valB = new Date(b.date_entered).getTime();
          break;
        case 'priority':
          const priorityOrder = { urgent: 3, high: 2, normal: 1, low: 0 };
          valA = priorityOrder[a.priority] || 0;
          valB = priorityOrder[b.priority] || 0;
          break;
        case 'nte':
          valA = a.nte || 0;
          valB = b.nte || 0;
          break;
        case 'age':
          valA = calculateAge(a.date_entered);
          valB = calculateAge(b.date_entered);
          break;
        case 'status':
          valA = a.status || '';
          valB = b.status || '';
          break;
        default:
          valA = 0;
          valB = 0;
      }

      if (sortOrder === 'asc') {
        return valA > valB ? 1 : valA < valB ? -1 : 0;
      } else {
        return valA < valB ? 1 : valA > valB ? -1 : 0;
      }
    });

    return filtered;
  }, [workOrders, sortBy, sortOrder, filterPriority, filterStatus, searchTerm]);

  // SELECT HANDLERS
  const toggleSelectMode = () => {
    setSelectMode(!selectMode);
    setSelectedWOs(new Set());
  };

  const toggleSelectWO = (woId) => {
    const newSelected = new Set(selectedWOs);
    if (newSelected.has(woId)) {
      newSelected.delete(woId);
    } else {
      newSelected.add(woId);
    }
    setSelectedWOs(newSelected);
  };

  const selectAll = () => {
    setSelectedWOs(new Set(filteredAndSortedWOs.map(wo => wo.wo_id)));
  };

  const deselectAll = () => {
    setSelectedWOs(new Set());
  };

  const handleBatchAction = (action) => {
    // TODO: Implement batch actions (e.g., bulk status update, bulk export, etc.)
    alert(`Batch action "${action}" on ${selectedWOs.size} work orders - Coming soon!`);
  };

  // Get unique values for filters
  const uniqueBuildings = useMemo(() => {
    const buildings = [...new Set(workOrders.map(wo => wo.building))].filter(Boolean);
    return buildings.sort();
  }, [workOrders]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterPriority !== 'all') count++;
    if (filterStatus !== 'all') count++;
    if (searchTerm.trim()) count++;
    return count;
  }, [filterPriority, filterStatus, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-20">
      {/* Header - Fixed at top */}
      <div className="bg-gray-800 p-3 sticky top-0 z-20">
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
          <NotificationBell userId={currentUser?.user_id} />
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
        {/* Weather Widget */}
        {isOnline && (
          <WeatherWidget 
            expanded={weatherExpanded} 
            onToggle={() => setWeatherExpanded(!weatherExpanded)} 
          />
        )}

        {/* HEADER WITH SORT/FILTER/SELECT */}
        <div className="mb-4">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="text-xl font-bold">{t('myWorkOrders')}</h2>
              <p className="text-gray-400 text-sm">
                {filteredAndSortedWOs.length} of {workOrders.length} {t('activeWork')} {workOrders.length === 1 ? t('order') : t('orders')}
                {activeFiltersCount > 0 && (
                  <span className="ml-1 text-yellow-500">({activeFiltersCount} filter{activeFiltersCount > 1 ? 's' : ''})</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              {/* Select Mode Toggle */}
              <button
                onClick={toggleSelectMode}
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  selectMode 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                {selectMode ? '✓ Select' : '☐ Select'}
              </button>
              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold ${
                  showFilters || activeFiltersCount > 0
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                🔍 Filter
                {activeFiltersCount > 0 && (
                  <span className="ml-1 bg-yellow-500 text-gray-900 rounded-full px-1.5 text-xs">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* SEARCH BAR */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="Search by WO#, building, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* FILTER/SORT PANEL */}
          {showFilters && (
            <div className="bg-gray-800 rounded-lg p-3 space-y-3 mb-3">
              {/* Sort By */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Sort By</label>
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm"
                  >
                    <option value="date_entered">Date Entered</option>
                    <option value="age">Age (Days Old)</option>
                    <option value="priority">Priority</option>
                    <option value="nte">NTE Amount</option>
                    <option value="status">Status</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded text-sm font-semibold"
                  >
                    {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                  </button>
                </div>
              </div>

              {/* Filter by Priority */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Priority</label>
                <div className="grid grid-cols-5 gap-1">
                  <button
                    onClick={() => setFilterPriority('all')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold ${
                      filterPriority === 'all' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterPriority('urgent')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold ${
                      filterPriority === 'urgent' 
                        ? 'bg-red-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Urgent
                  </button>
                  <button
                    onClick={() => setFilterPriority('high')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold ${
                      filterPriority === 'high' 
                        ? 'bg-orange-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    High
                  </button>
                  <button
                    onClick={() => setFilterPriority('normal')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold ${
                      filterPriority === 'normal' 
                        ? 'bg-yellow-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Normal
                  </button>
                  <button
                    onClick={() => setFilterPriority('low')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold ${
                      filterPriority === 'low' 
                        ? 'bg-green-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Low
                  </button>
                </div>
              </div>

              {/* Filter by Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Status</label>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    onClick={() => setFilterStatus('all')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold ${
                      filterStatus === 'all' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterStatus('assigned')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold ${
                      filterStatus === 'assigned' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Assigned
                  </button>
                  <button
                    onClick={() => setFilterStatus('in_progress')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold ${
                      filterStatus === 'in_progress' 
                        ? 'bg-yellow-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    In Progress
                  </button>
                  <button
                    onClick={() => setFilterStatus('pending_approval')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold ${
                      filterStatus === 'pending_approval' 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => setFilterStatus('tech_review')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold ${
                      filterStatus === 'tech_review' 
                        ? 'bg-red-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    Returned
                  </button>
                  <button
                    onClick={() => setFilterStatus('on_hold')}
                    className={`py-1.5 px-2 rounded text-xs font-semibold ${
                      filterStatus === 'on_hold' 
                        ? 'bg-gray-600 text-white' 
                        : 'bg-gray-700 text-gray-300'
                    }`}
                  >
                    On Hold
                  </button>
                </div>
              </div>

              {/* Clear Filters */}
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => {
                    setFilterPriority('all');
                    setFilterStatus('all');
                    setSearchTerm('');
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 py-2 rounded text-sm font-semibold"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* SELECT MODE HEADER */}
        {selectMode && (
          <div className="mb-3 bg-blue-900/30 border border-blue-700 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">
                {selectedWOs.size} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs font-semibold"
                >
                  Select All ({filteredAndSortedWOs.length})
                </button>
                {selectedWOs.size > 0 && (
                  <button
                    onClick={deselectAll}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs font-semibold"
                  >
                    Deselect All
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* WORK ORDERS LIST */}
        <div className="space-y-3">
          {filteredAndSortedWOs.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <div className="text-4xl mb-3">📋</div>
              {workOrders.length === 0 ? (
                <>
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
                </>
              ) : (
                <>
                  <p className="text-gray-400 text-lg">No work orders match your filters</p>
                  <button
                    onClick={() => {
                      setFilterPriority('all');
                      setFilterStatus('all');
                      setSearchTerm('');
                    }}
                    className="mt-4 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    Clear Filters
                  </button>
                </>
              )}
            </div>
          ) : (
            filteredAndSortedWOs.map(wo => {
              // CBRE status badge config
              const cbreConfigs = {
                'pending_quote': { bg: 'bg-orange-600', text: language === 'en' ? '📋 NTE Pending' : '📋 NTE Pendiente' },
                'quote_submitted': { bg: 'bg-blue-600', text: language === 'en' ? '📤 NTE Submitted' : '📤 NTE Enviado' },
                'quote_approved': { bg: 'bg-green-600', text: language === 'en' ? '✅ NTE Approved' : '✅ NTE Aprobado' },
                'quote_rejected': { bg: 'bg-red-600', text: language === 'en' ? '❌ NTE Rejected' : '❌ NTE Rechazado' },
                'escalation': { bg: 'bg-red-600 animate-pulse', text: language === 'en' ? '🚨 Escalation' : '🚨 Escalación' },
                'reassigned': { bg: 'bg-purple-600', text: language === 'en' ? '🔄 Reassigned' : '🔄 Reasignado' },
                'invoice_rejected': { bg: 'bg-red-600', text: language === 'en' ? '❌ Invoice Rejected' : '❌ Factura Rechazada' },
                'cancelled': { bg: 'bg-gray-600', text: language === 'en' ? '🚫 Cancelled' : '🚫 Cancelado' },
              };
              const cbreConfig = wo.cbre_status ? cbreConfigs[wo.cbre_status] : null;
              const isEscalation = wo.cbre_status === 'escalation';
              const isRejected = wo.cbre_status === 'quote_rejected' || wo.cbre_status === 'invoice_rejected';
              const cbreBorder = isEscalation ? 'border-l-4 border-red-500' : isRejected ? 'border-l-4 border-orange-500' : '';
              
              return (
              <div
                key={wo.wo_id}
                onClick={() => {
                  if (selectMode) {
                    toggleSelectWO(wo.wo_id);
                  } else {
                    onSelectWO(wo);
                  }
                }}
                className={`rounded-lg p-4 transition cursor-pointer active:scale-[0.99] ${cbreBorder} ${
                  wo.status === 'tech_review' 
                    ? 'bg-red-900 border-2 border-red-500 animate-pulse' 
                    : selectedWOs.has(wo.wo_id)
                    ? 'bg-blue-900 border-2 border-blue-500'
                    : 'bg-gray-800 hover:bg-gray-750'
                }`}
              >
                {/* SELECT CHECKBOX */}
                {selectMode && (
                  <div className="flex justify-end mb-2">
                    <input
                      type="checkbox"
                      checked={selectedWOs.has(wo.wo_id)}
                      onChange={() => toggleSelectWO(wo.wo_id)}
                      className="w-5 h-5 rounded cursor-pointer"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}

                {/* TECH REVIEW ALERT BANNER */}
                {wo.status === 'tech_review' && (
                  <div className="bg-red-600 text-white text-center py-2 px-3 rounded-lg mb-3 font-bold text-sm">
                    ⚠️ RETURNED FROM INVOICE - ACTION REQUIRED ⚠️
                  </div>
                )}
                
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
                  <span className={`text-xs px-2 py-1 rounded-full ml-2 flex-shrink-0 ${
                    wo.status === 'tech_review' 
                      ? 'bg-red-600 text-white font-bold' 
                      : 'bg-gray-700'
                  }`}>
                    {getStatusBadge(wo.status)}
                  </span>
                </div>
                
                {/* CBRE Status Badge */}
                {cbreConfig && (
                  <div className="mb-2">
                    <span className={`${cbreConfig.bg} text-white text-xs px-2 py-0.5 rounded-full font-semibold`}>
                      {cbreConfig.text}
                    </span>
                  </div>
                )}
                
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
            );
            })
          )}
        </div>
      </div>

      {/* FLOATING ACTION BAR (when items selected) */}
      {selectMode && selectedWOs.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-blue-900 border-t-2 border-blue-500 p-4 z-30">
          <div className="max-w-md mx-auto flex items-center justify-between">
            <span className="font-bold text-lg">{selectedWOs.size} Selected</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBatchAction('export')}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                📄 Export
              </button>
              <button
                onClick={() => handleBatchAction('print')}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm font-semibold"
              >
                🖨️ Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
