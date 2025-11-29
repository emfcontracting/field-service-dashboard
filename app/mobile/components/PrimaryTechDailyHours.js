// components/PrimaryTechDailyHours.js - Bilingual Primary Tech Daily Hours with Logging
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import AddDailyHoursModal from './modals/AddDailyHoursModal';

export default function PrimaryTechDailyHours({
  workOrder,
  currentUser,
  dailyLogs,
  status,
  saving,
  onAddDailyHours,
  onDownloadLogs
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key];
  
  const [showAddModal, setShowAddModal] = useState(false);
  const wo = workOrder || {};

  // Calculate totals from daily logs for current user
  const userLogs = dailyLogs.filter(log => log.user_id === currentUser.user_id);
  const totalRT = userLogs.reduce((sum, log) => sum + (parseFloat(log.hours_regular) || 0), 0);
  const totalOT = userLogs.reduce((sum, log) => sum + (parseFloat(log.hours_overtime) || 0), 0);
  const totalMiles = userLogs.reduce((sum, log) => sum + (parseFloat(log.miles) || 0), 0);
  const totalHours = totalRT + totalOT;

  async function handleSaveDailyHours(hoursData) {
    await onAddDailyHours({
      ...hoursData,
      userId: currentUser.user_id,
      assignmentId: null // Primary tech doesn't have assignment_id
    });
  }

  return (
    <>
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold">{t('primaryTechDailyHours') || 'Primary Tech Daily Hours'}</h3>
          <div className="flex gap-2">
            {userLogs.length > 0 && (
              <button
                onClick={() => onDownloadLogs(currentUser.user_id)}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs font-semibold"
                title={t('downloadMyLogs') || 'Download My Logs'}
              >
                📥 CSV
              </button>
            )}
            {status !== 'completed' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-semibold"
              >
                + {t('logHours') || 'Log Hours'}
              </button>
            )}
          </div>
        </div>

        {/* Summary Totals */}
        <div className="bg-gray-700 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-400 mb-2">{t('totalsSummary') || 'Totals Summary'}</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xs text-gray-400">RT {t('hrs') || 'hrs'}</p>
              <p className="text-xl font-bold text-green-400">{totalRT.toFixed(1)}</p>
              <p className="text-xs text-gray-500">@ $64/{t('hrs') || 'hr'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">OT {t('hrs') || 'hrs'}</p>
              <p className="text-xl font-bold text-yellow-400">{totalOT.toFixed(1)}</p>
              <p className="text-xs text-gray-500">@ $96/{t('hrs') || 'hr'}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-400">{t('miles') || 'Miles'}</p>
              <p className="text-xl font-bold text-blue-400">{totalMiles.toFixed(1)}</p>
              <p className="text-xs text-gray-500">@ $1/mi</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-600 text-center">
            <p className="text-xs text-gray-400">{t('totalHours') || 'Total Hours'}</p>
            <p className="text-2xl font-bold text-white">{totalHours.toFixed(1)} {t('hrs') || 'hrs'}</p>
          </div>
        </div>

        {/* Daily Hours Log */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-semibold mb-2">
            📅 {t('dailyBreakdown') || 'Daily Breakdown'} ({userLogs.length} {t('entries') || 'entries'})
          </p>
          
          {userLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-2">📝</p>
              <p>{t('noHoursLogged') || 'No hours logged yet'}</p>
              <p className="text-xs mt-1">{t('clickAboveToStart') || 'Click "Log Hours" above to start'}</p>
            </div>
          ) : (
            userLogs.map((log) => (
              <div
                key={log.log_id}
                className="bg-blue-900 border-l-4 border-blue-500 rounded-lg p-3"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-semibold text-sm">
                      {new Date(log.work_date).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="flex gap-3">
                      {log.hours_regular > 0 && (
                        <span className="text-green-400">RT: {log.hours_regular}</span>
                      )}
                      {log.hours_overtime > 0 && (
                        <span className="text-yellow-400">OT: {log.hours_overtime}</span>
                      )}
                      {log.miles > 0 && (
                        <span className="text-blue-400">{log.miles} mi</span>
                      )}
                    </div>
                  </div>
                </div>

                {log.notes && (
                  <p className="text-xs text-gray-300 mt-2 italic border-t border-blue-800 pt-2">
                    {log.notes}
                  </p>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  {t('loggedAt') || 'Logged at'}: {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Daily Hours Modal */}
      <AddDailyHoursModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveDailyHours}
        saving={saving}
        userId={currentUser.user_id}
        userName={`${currentUser.first_name} ${currentUser.last_name}`}
        isTeamMember={false}
      />
    </>
  );
}
