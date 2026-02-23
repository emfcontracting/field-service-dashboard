// components/CompletedWorkOrders.js - Bilingual Completed Work Orders with Search & Filter
import { useState, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import LanguageToggle from './LanguageToggle';
import { formatDate, calculateAge, getPriorityColor, getPriorityBadge } from '../utils/helpers';

export default function CompletedWorkOrders({
  currentUser,
  completedWorkOrders,
  onBack,
  onSelectWO,
  onShowChangePin,
  onLogout
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language]?.[key] || key;

  // Search and Filter State
  const [searchText, setSearchText] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState('all'); // all, week, month, custom
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // newest, oldest, building

  // Filter and search logic
  const filteredWorkOrders = useMemo(() => {
    let filtered = [...completedWorkOrders];

    // Text search - search in WO number, building, description
    if (searchText.trim()) {
      const search = searchText.toLowerCase().trim();
      filtered = filtered.filter(wo => 
        (wo.wo_number && wo.wo_number.toLowerCase().includes(search)) ||
        (wo.building && wo.building.toLowerCase().includes(search)) ||
        (wo.work_order_description && wo.work_order_description.toLowerCase().includes(search)) ||
        (wo.lead_tech?.first_name && wo.lead_tech.first_name.toLowerCase().includes(search)) ||
        (wo.lead_tech?.last_name && wo.lead_tech.last_name.toLowerCase().includes(search))
      );
    }

    // Date filter
    const now = new Date();
    if (dateFilter === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(wo => {
        const completedDate = new Date(wo.date_completed);
        return completedDate >= weekAgo;
      });
    } else if (dateFilter === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(wo => {
        const completedDate = new Date(wo.date_completed);
        return completedDate >= monthAgo;
      });
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999); // Include entire end day
      filtered = filtered.filter(wo => {
        const completedDate = new Date(wo.date_completed);
        return completedDate >= start && completedDate <= end;
      });
    }

    // Sorting
    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.date_completed) - new Date(a.date_completed));
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.date_completed) - new Date(b.date_completed));
    } else if (sortBy === 'building') {
      filtered.sort((a, b) => (a.building || '').localeCompare(b.building || ''));
    } else if (sortBy === 'wo_number') {
      filtered.sort((a, b) => (a.wo_number || '').localeCompare(b.wo_number || ''));
    }

    return filtered;
  }, [completedWorkOrders, searchText, dateFilter, customStartDate, customEndDate, sortBy]);

  // Clear all filters
  function clearFilters() {
    setSearchText('');
    setDateFilter('all');
    setCustomStartDate('');
    setCustomEndDate('');
    setSortBy('newest');
  }

  // Check if any filters are active
  const hasActiveFilters = searchText || dateFilter !== 'all' || sortBy !== 'newest';

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-3">
          <button
            onClick={onBack}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg"
          >
            ← {t('back')}
          </button>
          <h1 className="text-xl font-bold">✅ {t('completedWorkOrders')}</h1>
          <div className="flex gap-2">
            <LanguageToggle />
            <button
              onClick={onShowChangePin}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm"
            >
              🔒
            </button>
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
            >
              🚪
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex gap-2 mb-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={language === 'en' ? '🔍 Search WO#, building, description...' : '🔍 Buscar WO#, edificio, descripción...'}
              className="w-full px-4 py-3 bg-gray-700 rounded-lg text-white placeholder-gray-400"
            />
            {searchText && (
              <button
                onClick={() => setSearchText('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg font-bold ${
              showFilters || hasActiveFilters
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            🎛️ {hasActiveFilters && '•'}
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="bg-gray-700 rounded-lg p-4 space-y-4">
            {/* Date Filter */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {language === 'en' ? 'Date Range' : 'Rango de Fechas'}
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setDateFilter('all')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                    dateFilter === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {language === 'en' ? 'All' : 'Todo'}
                </button>
                <button
                  onClick={() => setDateFilter('week')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                    dateFilter === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {language === 'en' ? '7 Days' : '7 Días'}
                </button>
                <button
                  onClick={() => setDateFilter('month')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                    dateFilter === 'month'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {language === 'en' ? '30 Days' : '30 Días'}
                </button>
                <button
                  onClick={() => setDateFilter('custom')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                    dateFilter === 'custom'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {language === 'en' ? 'Custom' : 'Personal'}
                </button>
              </div>

              {/* Custom Date Range */}
              {dateFilter === 'custom' && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      {language === 'en' ? 'From' : 'Desde'}
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-600 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      {language === 'en' ? 'To' : 'Hasta'}
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-600 rounded-lg text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {language === 'en' ? 'Sort By' : 'Ordenar Por'}
              </label>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => setSortBy('newest')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                    sortBy === 'newest'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {language === 'en' ? 'Newest' : 'Reciente'}
                </button>
                <button
                  onClick={() => setSortBy('oldest')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                    sortBy === 'oldest'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {language === 'en' ? 'Oldest' : 'Antiguo'}
                </button>
                <button
                  onClick={() => setSortBy('building')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                    sortBy === 'building'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  {language === 'en' ? 'Building' : 'Edificio'}
                </button>
                <button
                  onClick={() => setSortBy('wo_number')}
                  className={`py-2 px-3 rounded-lg text-sm font-medium transition ${
                    sortBy === 'wo_number'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                  }`}
                >
                  WO#
                </button>
              </div>
            </div>

            {/* Clear Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="w-full py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium"
              >
                {language === 'en' ? '✕ Clear All Filters' : '✕ Limpiar Filtros'}
              </button>
            )}
          </div>
        )}

        {/* Results Count */}
        <div className="flex justify-between items-center text-sm text-gray-400">
          <span>
            {language === 'en' 
              ? `Showing ${filteredWorkOrders.length} of ${completedWorkOrders.length} completed`
              : `Mostrando ${filteredWorkOrders.length} de ${completedWorkOrders.length} completadas`}
          </span>
          {hasActiveFilters && (
            <span className="text-blue-400">
              {language === 'en' ? 'Filters active' : 'Filtros activos'}
            </span>
          )}
        </div>
      </div>

      {/* Work Orders List */}
      <div className="p-4 space-y-4">
        {filteredWorkOrders.length === 0 ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            {completedWorkOrders.length === 0 ? (
              <div>
                <div className="text-5xl mb-4">📋</div>
                <p className="text-gray-400">{t('noCompletedWorkOrders')}</p>
              </div>
            ) : (
              <div>
                <div className="text-5xl mb-4">🔍</div>
                <p className="text-gray-400">
                  {language === 'en' 
                    ? 'No work orders match your search/filters' 
                    : 'No hay órdenes que coincidan con su búsqueda/filtros'}
                </p>
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
                >
                  {language === 'en' ? 'Clear Filters' : 'Limpiar Filtros'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="bg-blue-900 rounded-lg p-3 text-center">
              <p className="text-sm text-blue-200">
                👆 {t('tapToView')}
              </p>
            </div>
            
            {filteredWorkOrders.map(wo => {
              const isEsc = wo.cbre_status === 'escalation';
              const isRej = wo.cbre_status === 'quote_rejected' || wo.cbre_status === 'invoice_rejected';
              const border = isEsc ? 'border-l-4 border-red-500' : isRej ? 'border-l-4 border-orange-500' : '';
              
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
              
              return (
              <div
                key={wo.wo_id}
                onClick={() => onSelectWO(wo)}
                className={`bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer active:scale-[0.99] ${border}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold text-lg">{wo.wo_number}</span>
                    <span className={`ml-2 text-sm ${getPriorityColor(wo.priority)}`}>
                      {getPriorityBadge(wo.priority)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 text-sm">✅ {t('completedLabel')}</span>
                  </div>
                </div>
                
                {/* CBRE Status Badge */}
                {cbreConfig && (
                  <div className="mb-2">
                    <span className={`${cbreConfig.bg} text-white text-xs px-2 py-0.5 rounded-full font-semibold`}>
                      {cbreConfig.text}
                    </span>
                  </div>
                )}
                
                <div className="text-sm space-y-1">
                  <p className="font-semibold">{wo.building}</p>
                  <p className="text-gray-400 line-clamp-2">{wo.work_order_description}</p>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-gray-500">
                      {t('completedDate')} {formatDate(wo.date_completed)}
                    </p>
                    <p className="text-orange-500 text-xs">
                      {calculateAge(wo.date_entered)} {t('days')}
                    </p>
                  </div>
                  {wo.lead_tech && (
                    <p className="text-gray-500 text-xs">
                      👷 {wo.lead_tech.first_name} {wo.lead_tech.last_name}
                    </p>
                  )}
                </div>

                {(wo.hours_regular || wo.hours_overtime || wo.miles) && (
                  <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400 flex gap-4">
                    <span>⏱️ RT: {wo.hours_regular || 0}</span>
                    <span>OT: {wo.hours_overtime || 0}</span>
                    <span>🚗 {wo.miles || 0} mi</span>
                  </div>
                )}
              </div>
            );
            })}
          </>
        )}
      </div>
    </div>
  );
}
