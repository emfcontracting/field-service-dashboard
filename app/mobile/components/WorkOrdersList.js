// components/WorkOrdersList.js - Bilingual Work Orders List
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import LanguageToggle from './LanguageToggle';
import { formatDate, calculateAge, getPriorityColor, getPriorityBadge, getStatusBadge } from '../utils/helpers';

export default function WorkOrdersList({
  currentUser,
  workOrders,
  onSelectWO,
  onShowCompleted,
  onShowChangePin,
  onLogout
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
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
              <h1 className="text-lg font-bold">👋 {currentUser.first_name}</h1>
              <p className="text-xs text-gray-400">{currentUser.role.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Language Toggle */}
            <LanguageToggle />
            
            {/* Only show Dashboard button for admin and office roles */}
            {(currentUser.role === 'admin' || currentUser.role === 'office') && (
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-semibold"
              >
                💻 {t('dashboard')}
              </button>
            )}
            <button
              onClick={onShowCompleted}
              className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-semibold"
            >
              ✅ {t('completed')}
            </button>
            <button
              onClick={onShowChangePin}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg text-sm font-semibold"
            >
              🔒 {t('pin')}
            </button>
            <button
              onClick={onLogout}
              className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm"
            >
              {t('logout')}
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">{t('myWorkOrders')}</h2>
          <p className="text-gray-400">
            {workOrders.length} {t('activeWork')} {workOrders.length === 1 ? t('order') : t('orders')}
          </p>
        </div>

        <div className="space-y-4">
          {workOrders.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 text-lg">{t('noActiveWorkOrders')}</p>
              <p className="text-gray-500 text-sm mt-2">{t('checkBackLater')}</p>
            </div>
          ) : (
            workOrders.map(wo => (
              <div
                key={wo.wo_id}
                onClick={() => onSelectWO(wo)}
                className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition cursor-pointer active:scale-98"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-bold text-lg">{wo.wo_number}</span>
                    <span className={`ml-2 text-sm ${getPriorityColor(wo.priority)}`}>
                      {getPriorityBadge(wo.priority)}
                    </span>
                  </div>
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded-full">
                    {getStatusBadge(wo.status)}
                  </span>
                </div>
                
                <h3 className="font-semibold mb-1">{wo.building}</h3>
                <p className="text-sm text-gray-400 mb-2">{wo.work_order_description}</p>
                
                <div className="flex justify-between items-center text-xs text-gray-500">
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
