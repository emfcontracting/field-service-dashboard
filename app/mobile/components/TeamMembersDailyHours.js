// components/TeamMembersDailyHours.js - Team Members Daily Hours (VIEW ALL, LOG OWN ONLY)
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import AddDailyHoursModal from './modals/AddDailyHoursModal';

export default function TeamMembersDailyHours({
  currentTeamList,
  currentUser,  // ADDED: Current logged-in user
  dailyLogs,
  status,
  saving,
  onLoadTeamMembers,
  onAddDailyHours,
  onDownloadLogs
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language]?.[key] || key;
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);

  // Only allow adding hours for yourself
  function handleOpenAddModal(member) {
    // Check if this member is the current user
    if (member.user_id !== currentUser?.user_id) {
      alert(language === 'en' 
        ? 'You can only log your own hours' 
        : 'Solo puede registrar sus propias horas');
      return;
    }
    setSelectedMember(member);
    setShowAddModal(true);
  }

  async function handleSaveDailyHours(hoursData) {
    await onAddDailyHours({
      ...hoursData,
      userId: selectedMember.user_id,
      assignmentId: selectedMember.assignment_id
    });
    setShowAddModal(false);
    setSelectedMember(null);
  }

  function getMemberLogs(userId) {
    return dailyLogs.filter(log => log.user_id === userId);
  }

  function calculateMemberTotals(userId) {
    const memberLogs = getMemberLogs(userId);
    return {
      totalRT: memberLogs.reduce((sum, log) => sum + (parseFloat(log.hours_regular) || 0), 0),
      totalOT: memberLogs.reduce((sum, log) => sum + (parseFloat(log.hours_overtime) || 0), 0),
      totalMiles: memberLogs.reduce((sum, log) => sum + (parseFloat(log.miles) || 0), 0)
    };
  }

  return (
    <>
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold">👥 {t('teamMembers') || 'Team Members'}</h3>
          {status !== 'completed' && (
            <button
              onClick={onLoadTeamMembers}
              className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-semibold"
            >
              + {t('addHelperTech') || 'Add Helper/Tech'}
            </button>
          )}
        </div>

        {currentTeamList.length > 0 ? (
          <div className="space-y-4">
            {currentTeamList.map((member) => {
              const memberLogs = getMemberLogs(member.user_id);
              const totals = calculateMemberTotals(member.user_id);
              const totalHours = totals.totalRT + totals.totalOT;
              const isCurrentUser = member.user_id === currentUser?.user_id;

              return (
                <div key={member.assignment_id} className={`bg-gray-700 rounded-lg p-3 ${isCurrentUser ? 'border-2 border-blue-500' : ''}`}>
                  {/* Member Header */}
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <p className="font-semibold flex items-center gap-2">
                        {member.user?.first_name || t('unknown') || 'Unknown'} {member.user?.last_name || ''}
                        {isCurrentUser && (
                          <span className="text-xs bg-blue-600 px-2 py-0.5 rounded">
                            {language === 'en' ? 'YOU' : 'TÚ'}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {totals.totalRT.toFixed(1)} RT • {totals.totalOT.toFixed(1)} OT • {totals.totalMiles.toFixed(1)} mi
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {memberLogs.length > 0 && (
                        <button
                          onClick={() => onDownloadLogs(member.user_id)}
                          className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs font-semibold"
                          title={t('downloadLogs') || 'Download Logs'}
                        >
                          📥
                        </button>
                      )}
                      {/* Only show Log button if this is the current user AND not completed */}
                      {status !== 'completed' && isCurrentUser && (
                        <button
                          onClick={() => handleOpenAddModal(member)}
                          className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs font-semibold"
                        >
                          + {t('logHours') || 'Log'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Member Summary */}
                  <div className="bg-gray-600 rounded p-2 mb-3">
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <p className="text-gray-400">RT</p>
                        <p className="font-bold text-green-400">{totals.totalRT.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">OT</p>
                        <p className="font-bold text-yellow-400">{totals.totalOT.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">{t('miles') || 'Mi'}</p>
                        <p className="font-bold text-blue-400">{totals.totalMiles.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">{t('total') || 'Total'}</p>
                        <p className="font-bold text-white">{totalHours.toFixed(1)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Member Daily Logs - VIEWABLE BY ALL */}
                  {memberLogs.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-400 font-semibold">
                        📅 {memberLogs.length} {t('entries') || 'entries'}
                      </p>
                      {memberLogs.slice(0, 3).map((log) => (
                        <div
                          key={log.log_id || log.id}
                          className="bg-gray-800 rounded p-2 text-xs"
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-gray-400">
                              {new Date(log.work_date).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
                                month: 'short',
                                day: 'numeric'
                              })}
                            </span>
                            <div className="flex gap-2">
                              {log.hours_regular > 0 && (
                                <span className="text-green-400">RT:{log.hours_regular}</span>
                              )}
                              {log.hours_overtime > 0 && (
                                <span className="text-yellow-400">OT:{log.hours_overtime}</span>
                              )}
                              {log.miles > 0 && (
                                <span className="text-blue-400">{log.miles}mi</span>
                              )}
                            </div>
                          </div>
                          {log.notes && (
                            <p className="text-gray-500 mt-1 italic truncate">{log.notes}</p>
                          )}
                        </div>
                      ))}
                      {memberLogs.length > 3 && (
                        <p className="text-xs text-gray-500 text-center">
                          ... +{memberLogs.length - 3} {t('moreEntries') || 'more entries'}
                        </p>
                      )}
                    </div>
                  )}

                  {memberLogs.length === 0 && (
                    <p className="text-center text-gray-500 text-xs py-2">
                      {t('noHoursLogged') || 'No hours logged yet'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-4">
            {t('noTeamMembers') || 'No additional team members yet'}
          </p>
        )}

        {/* Info note about logging */}
        <div className="mt-3 bg-blue-900/50 rounded p-2 text-xs text-blue-200">
          💡 {language === 'en' 
            ? 'Each person can only log their own hours. You can view everyone\'s logged hours.' 
            : 'Cada persona solo puede registrar sus propias horas. Puede ver las horas de todos.'}
        </div>
      </div>

      {/* Add Daily Hours Modal - Only for current user */}
      {selectedMember && (
        <AddDailyHoursModal
          show={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setSelectedMember(null);
          }}
          onSave={handleSaveDailyHours}
          saving={saving}
          userId={selectedMember.user_id}
          userName={`${selectedMember.user?.first_name || ''} ${selectedMember.user?.last_name || ''}`}
          isTeamMember={true}
        />
      )}
    </>
  );
}
