// components/DailyHoursLog.js - Clean, Simple Daily Hours Section (One Line Per Tech)
'use client';
import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import AddDailyHoursModal from './modals/AddDailyHoursModal';

export default function DailyHoursLog({
  workOrder,
  currentUser,
  currentTeamList,
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
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [showDetails, setShowDetails] = useState(null); // userId to show details for

  const wo = workOrder || {};
  const leadTech = wo.lead_tech || {};
  const isCompleted = status === 'completed';

  // Build list of all techs (primary + team)
  const allTechs = [];
  
  // Add lead tech first
  if (wo.lead_tech_id) {
    allTechs.push({
      user_id: wo.lead_tech_id,
      name: `${leadTech.first_name || 'Lead'} ${leadTech.last_name || ''}`.trim(),
      role: 'lead',
      assignment_id: null
    });
  }

  // Add team members
  (currentTeamList || []).forEach(member => {
    allTechs.push({
      user_id: member.user_id,
      name: `${member.user?.first_name || '?'} ${member.user?.last_name || ''}`.trim(),
      role: member.role_on_job || 'helper',
      assignment_id: member.assignment_id
    });
  });

  // Get totals for a user
  function getUserTotals(userId) {
    const userLogs = dailyLogs.filter(log => log.user_id === userId);
    return {
      rt: userLogs.reduce((sum, log) => sum + (parseFloat(log.hours_regular) || 0), 0),
      ot: userLogs.reduce((sum, log) => sum + (parseFloat(log.hours_overtime) || 0), 0),
      miles: userLogs.reduce((sum, log) => sum + (parseFloat(log.miles) || 0), 0),
      logs: userLogs
    };
  }

  // Grand totals
  const grandTotals = dailyLogs.reduce((acc, log) => ({
    rt: acc.rt + (parseFloat(log.hours_regular) || 0),
    ot: acc.ot + (parseFloat(log.hours_overtime) || 0),
    miles: acc.miles + (parseFloat(log.miles) || 0)
  }), { rt: 0, ot: 0, miles: 0 });

  function handleLogHours(tech) {
    if (tech.user_id !== currentUser?.user_id) {
      alert(language === 'en' ? 'You can only log your own hours' : 'Solo puede registrar sus propias horas');
      return;
    }
    setSelectedUserId(tech.user_id);
    setSelectedUserName(tech.name);
    setShowAddModal(true);
  }

  async function handleSaveHours(hoursData) {
    const tech = allTechs.find(t => t.user_id === selectedUserId);
    await onAddDailyHours({
      ...hoursData,
      userId: selectedUserId,
      assignmentId: tech?.assignment_id || null
    });
    setShowAddModal(false);
  }

  return (
    <>
      <div className="bg-gray-800 rounded-lg p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold">⏱️ {language === 'en' ? 'Daily Hours Log' : 'Registro de Horas'}</h3>
          <div className="flex gap-2">
            {dailyLogs.length > 0 && (
              <button
                onClick={() => onDownloadLogs()}
                className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
                title="Download CSV"
              >
                📥 CSV
              </button>
            )}
            {!isCompleted && (
              <button
                onClick={onLoadTeamMembers}
                className="bg-gray-600 hover:bg-gray-500 px-2 py-1 rounded text-xs"
              >
                + {language === 'en' ? 'Add Tech' : 'Agregar'}
              </button>
            )}
          </div>
        </div>

        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-1 text-xs text-gray-400 mb-2 px-2">
          <div className="col-span-4">{language === 'en' ? 'Name' : 'Nombre'}</div>
          <div className="col-span-2 text-center">RT</div>
          <div className="col-span-2 text-center">OT</div>
          <div className="col-span-2 text-center">{language === 'en' ? 'Miles' : 'Mi'}</div>
          <div className="col-span-2 text-center"></div>
        </div>

        {/* Tech Rows */}
        <div className="space-y-1">
          {allTechs.map(tech => {
            const totals = getUserTotals(tech.user_id);
            const isMe = tech.user_id === currentUser?.user_id;
            const isExpanded = showDetails === tech.user_id;

            return (
              <div key={tech.user_id}>
                {/* Main Row */}
                <div 
                  className={`grid grid-cols-12 gap-1 items-center py-2 px-2 rounded ${
                    isMe ? 'bg-blue-900/50' : 'bg-gray-700'
                  }`}
                >
                  {/* Name */}
                  <div className="col-span-4 flex items-center gap-1">
                    <button
                      onClick={() => setShowDetails(isExpanded ? null : tech.user_id)}
                      className="text-gray-400 hover:text-white text-xs"
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <span className="text-sm truncate">
                      {tech.name}
                      {isMe && <span className="text-blue-400 text-xs ml-1">•</span>}
                    </span>
                  </div>
                  
                  {/* RT */}
                  <div className="col-span-2 text-center text-green-400 text-sm font-medium">
                    {totals.rt > 0 ? totals.rt.toFixed(1) : '-'}
                  </div>
                  
                  {/* OT */}
                  <div className="col-span-2 text-center text-yellow-400 text-sm font-medium">
                    {totals.ot > 0 ? totals.ot.toFixed(1) : '-'}
                  </div>
                  
                  {/* Miles */}
                  <div className="col-span-2 text-center text-blue-400 text-sm font-medium">
                    {totals.miles > 0 ? totals.miles.toFixed(1) : '-'}
                  </div>
                  
                  {/* Action */}
                  <div className="col-span-2 text-right">
                    {!isCompleted && isMe && (
                      <button
                        onClick={() => handleLogHours(tech)}
                        className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs"
                      >
                        + {language === 'en' ? 'Log' : 'Add'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && totals.logs.length > 0 && (
                  <div className="ml-6 mt-1 mb-2 bg-gray-900 rounded p-2 text-xs">
                    {totals.logs.map(log => (
                      <div key={log.id || log.log_id} className="flex justify-between py-1 border-b border-gray-800 last:border-0">
                        <span className="text-gray-400">
                          {new Date(log.work_date).toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', { month: 'short', day: 'numeric' })}
                        </span>
                        <span>
                          {log.hours_regular > 0 && <span className="text-green-400 mr-2">RT:{log.hours_regular}</span>}
                          {log.hours_overtime > 0 && <span className="text-yellow-400 mr-2">OT:{log.hours_overtime}</span>}
                          {log.miles > 0 && <span className="text-blue-400">{log.miles}mi</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* No techs message */}
        {allTechs.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">
            {language === 'en' ? 'No technicians assigned' : 'Sin técnicos asignados'}
          </p>
        )}

        {/* Totals Row */}
        {allTechs.length > 0 && (
          <div className="grid grid-cols-12 gap-1 items-center py-2 px-2 mt-2 border-t border-gray-600 font-bold">
            <div className="col-span-4 text-sm text-gray-300">
              {language === 'en' ? 'TOTAL' : 'TOTAL'}
            </div>
            <div className="col-span-2 text-center text-green-400 text-sm">{grandTotals.rt.toFixed(1)}</div>
            <div className="col-span-2 text-center text-yellow-400 text-sm">{grandTotals.ot.toFixed(1)}</div>
            <div className="col-span-2 text-center text-blue-400 text-sm">{grandTotals.miles.toFixed(1)}</div>
            <div className="col-span-2"></div>
          </div>
        )}
      </div>

      {/* Add Hours Modal */}
      <AddDailyHoursModal
        show={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSave={handleSaveHours}
        saving={saving}
        userId={selectedUserId}
        userName={selectedUserName}
        isTeamMember={false}
      />
    </>
  );
}
