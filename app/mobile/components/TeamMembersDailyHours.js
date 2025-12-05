// components/TeamMembersDailyHours.js - Team Members Daily Hours (VIEW ALL, LOG OWN ONLY)
// FIXED: Improved user matching, added self-add capability, and timezone-safe date display
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import AddDailyHoursModal from './modals/AddDailyHoursModal';

export default function TeamMembersDailyHours({
  currentTeamList,
  currentUser,
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

  // Helper function to parse date string without timezone issues
  // work_date is stored as YYYY-MM-DD, parse it as local date
  function parseLocalDate(dateStr) {
    if (!dateStr) return new Date();
    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date(dateStr);
    return new Date(
      parseInt(parts[0]), 
      parseInt(parts[1]) - 1, 
      parseInt(parts[2])
    );
  }

  // Check if current user is in the team list
  // Use string comparison to handle potential type mismatches
  const currentUserInTeam = currentTeamList.find(member => 
    String(member.user_id) === String(currentUser?.user_id)
  );

  // Check if member is the current user (with type-safe comparison)
  function isCurrentUserMember(member) {
    return String(member.user_id) === String(currentUser?.user_id);
  }

  // Open modal for logging hours
  function handleOpenAddModal(member) {
    // Check if this member is the current user
    if (!isCurrentUserMember(member)) {
      alert(language === 'en' 
        ? 'You can only log your own hours' 
        : 'Solo puede registrar sus propias horas');
      return;
    }
    setSelectedMember(member);
    setShowAddModal(true);
  }

  // Allow current user to log hours even if viewing someone else's card
  function handleLogOwnHours() {
    if (!currentUserInTeam) {
      alert(language === 'en' 
        ? 'You must be added to the team first. Ask the lead tech to add you.' 
        : 'Primero debe ser agregado al equipo. Pídale al técnico principal que lo agregue.');
      return;
    }
    setSelectedMember(currentUserInTeam);
    setShowAddModal(true);
  }

  async function handleSaveDailyHours(hoursData) {
    try {
      await onAddDailyHours({
        ...hoursData,
        userId: selectedMember.user_id,
        assignmentId: selectedMember.assignment_id
      });
      setShowAddModal(false);
      setSelectedMember(null);
    } catch (err) {
      // Error is handled in parent
      console.error('Error saving daily hours:', err);
    }
  }

  function getMemberLogs(userId) {
    // Use string comparison for safety
    return dailyLogs.filter(log => String(log.user_id) === String(userId));
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
          <div className="flex gap-2">
            {/* Quick Log Button for current user if they're in team */}
            {status !== 'completed' && currentUserInTeam && (
              <button
                onClick={handleLogOwnHours}
                className="bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg text-sm font-semibold"
              >
                + {language === 'en' ? 'Log My Hours' : 'Registrar Mis Horas'}
              </button>
            )}
            {status !== 'completed' && (
              <button
                onClick={onLoadTeamMembers}
                className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-semibold"
              >
                + {t('addHelperTech') || 'Add Helper'}
              </button>
            )}
          </div>
        </div>

        {/* Show message if current user is NOT in team list */}
        {status !== 'completed' && !currentUserInTeam && currentTeamList.length === 0 && (
          <div className="bg-yellow-900/30 rounded-lg p-3 mb-3 text-sm text-yellow-200">
            ⚠️ {language === 'en' 
              ? 'No team members assigned yet. If you are helping on this job, ask the lead tech to add you to the team.' 
              : 'No hay miembros del equipo asignados todavía. Si está ayudando en este trabajo, pídale al técnico principal que lo agregue al equipo.'}
          </div>
        )}

        {currentTeamList.length > 0 ? (
          <div className="space-y-4">
            {currentTeamList.map((member) => {
              const memberLogs = getMemberLogs(member.user_id);
              const totals = calculateMemberTotals(member.user_id);
              const totalHours = totals.totalRT + totals.totalOT;
              const isCurrentUser = isCurrentUserMember(member);

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
                      {memberLogs.slice(0, 3).map((log) => {
                        // Parse the date string directly to avoid timezone conversion issues
                        const displayDate = parseLocalDate(log.work_date);
                        
                        return (
                          <div
                            key={log.log_id || log.id}
                            className="bg-gray-800 rounded p-2 text-xs"
                          >
                            <div className="flex justify-between items-start">
                              <span className="text-gray-400">
                                {displayDate.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', {
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
                        );
                      })}
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