// components/PrimaryTechDailyHours.js - Bilingual Primary Tech Daily Hours with Logging
// FIXED: Type-safe user ID comparison
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
  const t = (key) => translations[language]?.[key] || key;
  
  const [showAddModal, setShowAddModal] = useState(false);
  const wo = workOrder || {};
  
  // Get the PRIMARY TECH (lead tech) from the work order - NOT the current user
  const leadTechId = wo.lead_tech_id;
  const leadTech = wo.lead_tech || {};
  const leadTechName = leadTech.first_name 
    ? `${leadTech.first_name} ${leadTech.last_name || ''}`.trim()
    : (language === 'en' ? 'Primary Tech' : 'Técnico Principal');
  
  // Check if current user IS the primary tech (type-safe comparison)
  const isCurrentUserPrimaryTech = String(currentUser?.user_id) === String(leadTechId);

  // Filter logs for the PRIMARY TECH (lead_tech_id), not current user
  // Use string comparison for safety
  const primaryTechLogs = dailyLogs.filter(log => String(log.user_id) === String(leadTechId));
  const totalRT = primaryTechLogs.reduce((sum, log) => sum + (parseFloat(log.hours_regular) || 0), 0);
  const totalOT = primaryTechLogs.reduce((sum, log) => sum + (parseFloat(log.hours_overtime) || 0), 0);
  const totalMiles = primaryTechLogs.reduce((sum, log) => sum + (parseFloat(log.miles) || 0), 0);
  const totalHours = totalRT + totalOT;

  async function handleSaveDailyHours(hoursData) {
    // Only allow if current user is the primary tech
    if (!isCurrentUserPrimaryTech) {
      alert(language === 'en' 
        ? 'Only the primary tech can log hours in this section' 
        : 'Solo el técnico principal puede registrar horas en esta sección');
      return;
    }
    
    try {
      await onAddDailyHours({
        ...hoursData,
        userId: leadTechId, // Use lead tech ID, not current user
        assignmentId: null // Primary tech doesn't have assignment_id
      });
      setShowAddModal(false);
    } catch (err) {
      // Error handling is done in parent
      console.error('Error saving daily hours:', err);
    }
  }

  return (
    <>
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="font-bold">🔧 {language === 'en' ? 'Primary Tech Hours' : 'Horas del Técnico Principal'}</h3>
            <p className="text-sm text-gray-400">{leadTechName}</p>
          </div>
          <div className="flex gap-2">
            {primaryTechLogs.length > 0 && (
              <button
                onClick={() => onDownloadLogs(leadTechId)}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-xs font-semibold"
                title={language === 'en' ? 'Download Logs' : 'Descargar Registros'}
              >
                📥 CSV
              </button>
            )}
            {status !== 'completed' && isCurrentUserPrimaryTech && (
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-semibold"
              >
                + {t('logHours') || 'Log Hours'}
              </button>
            )}
          </div>
        </div>

        {/* Show message if viewing as non-primary tech */}
        {!isCurrentUserPrimaryTech && status !== 'completed' && (
          <div className="bg-blue-900/30 rounded-lg p-2 mb-3 text-xs text-blue-300">
            💡 {language === 'en' 
              ? `Only ${leadTechName} can log hours here. Your hours go in Team Members below.`
              : `Solo ${leadTechName} puede registrar horas aquí. Tus horas van en Miembros del Equipo abajo.`}
          </div>
        )}

        {/* Summary Totals */}
        <div className="bg-gray-700 rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-400 mb-2">{language === 'en' ? 'Totals Summary' : 'Resumen de Totales'}</p>
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
            <p className="text-xs text-gray-400">{language === 'en' ? 'Total Hours' : 'Total de Horas'}</p>
            <p className="text-2xl font-bold text-white">{totalHours.toFixed(1)} {t('hrs') || 'hrs'}</p>
          </div>
        </div>

        {/* Daily Hours Log */}
        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-semibold mb-2">
            📅 {language === 'en' ? 'Daily Breakdown' : 'Desglose Diario'} ({primaryTechLogs.length} {language === 'en' ? 'entries' : 'registros'})
          </p>
          
          {primaryTechLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-4xl mb-2">📝</p>
              <p>{t('noHoursLogged') || 'No hours logged yet'}</p>
              {isCurrentUserPrimaryTech && (
                <p className="text-xs mt-1">{language === 'en' ? 'Click "Log Hours" above to start' : 'Haga clic en "Registrar Horas" arriba para comenzar'}</p>
              )}
            </div>
          ) : (
            primaryTechLogs.map((log) => (
              <div
                key={log.log_id || log.id}
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

      {/* Add Daily Hours Modal - only for primary tech */}
      {isCurrentUserPrimaryTech && (
        <AddDailyHoursModal
          show={showAddModal}
          onClose={() => setShowAddModal(false)}
          onSave={handleSaveDailyHours}
          saving={saving}
          userId={leadTechId}
          userName={leadTechName}
          isTeamMember={false}
        />
      )}
    </>
  );
}
