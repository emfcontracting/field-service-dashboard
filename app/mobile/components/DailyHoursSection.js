// components/DailyHoursSection.js - Bilingual Daily Hours Logging (Improved UI)
import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import * as dailyHoursService from '../services/dailyHoursService';

export default function DailyHoursSection({ workOrder, currentUser, currentTeamList, status }) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key] || key;
  const supabase = createClientComponentClient();

  // State
  const [dailyLogs, setDailyLogs] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFullLog, setShowFullLog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingLogId, setEditingLogId] = useState(null);

  // Form state
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [hoursRegular, setHoursRegular] = useState('');
  const [hoursOvertime, setHoursOvertime] = useState('');
  const [miles, setMiles] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(currentUser?.user_id);

  // Load daily hours on mount
  useEffect(() => {
    if (workOrder && workOrder.wo_id) {
      loadDailyHours();
    }
  }, [workOrder?.wo_id]);

  // Update selectedUserId when currentUser changes
  useEffect(() => {
    if (currentUser?.user_id) {
      setSelectedUserId(currentUser.user_id);
    }
  }, [currentUser?.user_id]);

  async function loadDailyHours() {
    if (!workOrder || !workOrder.wo_id) return;

    try {
      setLoading(true);
      const logs = await dailyHoursService.loadDailyHoursForWorkOrder(supabase, workOrder.wo_id);
      setDailyLogs(logs);
    } catch (err) {
      console.error('Error loading daily hours:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddHours() {
    // Validate using the object format expected by the service
    const validation = dailyHoursService.validateHoursEntry({
      workDate: workDate,
      hoursRegular: hoursRegular,
      hoursOvertime: hoursOvertime,
      miles: miles
    });
    
    if (!validation.isValid) {
      alert(validation.errors.join('\n'));
      return;
    }

    try {
      setSaving(true);

      // Find assignment_id if this is for a team member
      let assignmentId = null;
      if (selectedUserId !== currentUser.user_id) {
        const teamMember = currentTeamList.find(m => m.user_id === selectedUserId);
        assignmentId = teamMember?.assignment_id || null;
      }

      await dailyHoursService.addDailyHours(supabase, {
        woId: workOrder.wo_id,
        userId: selectedUserId,
        assignmentId: assignmentId,
        workDate: workDate,
        hoursRegular: parseFloat(hoursRegular) || 0,
        hoursOvertime: parseFloat(hoursOvertime) || 0,
        miles: parseFloat(miles) || 0,
        notes: notes.trim() || null
      });

      // Reset form
      resetForm();
      setShowAddForm(false);

      // Reload logs
      await loadDailyHours();

      alert(t('hoursAddedSuccess') || '✅ Hours logged successfully!');
    } catch (err) {
      console.error('Error adding hours:', err);
      alert(err.message || t('errorAddingHours') || 'Error adding hours');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateHours(logId) {
    try {
      setSaving(true);

      await dailyHoursService.updateDailyHours(supabase, logId, {
        hoursRegular: parseFloat(hoursRegular) || 0,
        hoursOvertime: parseFloat(hoursOvertime) || 0,
        miles: parseFloat(miles) || 0,
        notes: notes.trim() || null
      });

      // Reset form
      resetForm();
      setEditingLogId(null);

      // Reload logs
      await loadDailyHours();

      alert('✅ Hours updated successfully!');
    } catch (err) {
      console.error('Error updating hours:', err);
      alert(err.message || 'Error updating hours');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteHours(logId) {
    const confirmMsg = language === 'en' 
      ? 'Are you sure you want to delete this entry?' 
      : '¿Está seguro de que desea eliminar esta entrada?';
    
    if (!window.confirm(confirmMsg)) return;

    try {
      setSaving(true);
      await dailyHoursService.deleteDailyHours(supabase, logId);
      await loadDailyHours();
      alert('✅ Entry deleted!');
    } catch (err) {
      console.error('Error deleting hours:', err);
      alert(err.message || 'Error deleting hours');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(log) {
    setEditingLogId(log.log_id);
    setWorkDate(log.work_date);
    setHoursRegular(log.hours_regular?.toString() || '');
    setHoursOvertime(log.hours_overtime?.toString() || '');
    setMiles(log.miles?.toString() || '');
    setNotes(log.notes || '');
    setSelectedUserId(log.user_id);
  }

  function cancelEdit() {
    setEditingLogId(null);
    resetForm();
  }

  function resetForm() {
    setWorkDate(new Date().toISOString().split('T')[0]);
    setHoursRegular('');
    setHoursOvertime('');
    setMiles('');
    setNotes('');
    setSelectedUserId(currentUser?.user_id);
  }

  async function handleDownloadCSV() {
    try {
      const logs = await dailyHoursService.loadDailyHoursForWorkOrder(supabase, workOrder.wo_id);
      const csvContent = dailyHoursService.generateCSV(logs);
      const filename = `${workOrder.wo_number}_daily_hours_${new Date().toISOString().split('T')[0]}.csv`;
      dailyHoursService.downloadCSV(csvContent, filename);
    } catch (err) {
      console.error('Error downloading CSV:', err);
      alert(t('errorDownloadingCSV') || 'Error downloading CSV');
    }
  }

  // Calculate summary totals
  const summary = dailyLogs.reduce((acc, log) => {
    if (log.user_id === currentUser?.user_id) {
      acc.myRegular += parseFloat(log.hours_regular || 0);
      acc.myOvertime += parseFloat(log.hours_overtime || 0);
      acc.myMiles += parseFloat(log.miles || 0);
    }
    acc.totalRegular += parseFloat(log.hours_regular || 0);
    acc.totalOvertime += parseFloat(log.hours_overtime || 0);
    acc.totalMiles += parseFloat(log.miles || 0);
    return acc;
  }, {
    myRegular: 0,
    myOvertime: 0,
    myMiles: 0,
    totalRegular: 0,
    totalOvertime: 0,
    totalMiles: 0
  });

  // Group logs by date for better display
  const logsByDate = dailyLogs.reduce((acc, log) => {
    const date = log.work_date;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(log);
    return acc;
  }, {});

  const isCompleted = status === 'completed';

  // Format date for display
  function formatDateDisplay(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return date.toLocaleDateString(language === 'en' ? 'en-US' : 'es-ES', options);
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-blue-400">📊 {t('dailyHoursLog')}</h3>
        <div className="flex gap-2">
          {dailyLogs.length > 0 && (
            <button
              onClick={() => setShowFullLog(!showFullLog)}
              className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-sm"
            >
              {showFullLog ? '📋 ' + (language === 'en' ? 'Hide Log' : 'Ocultar') : '📋 ' + (language === 'en' ? 'View Log' : 'Ver Registro')}
            </button>
          )}
          <button
            onClick={handleDownloadCSV}
            disabled={dailyLogs.length === 0}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-1 rounded-lg text-sm"
          >
            📥 CSV
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {/* My Totals */}
        <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-300 mb-2 font-semibold">{t('myTotals')}</p>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">RT:</span>
              <span className="font-bold text-white">{summary.myRegular.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">OT:</span>
              <span className="font-bold text-yellow-400">{summary.myOvertime.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">{t('miles')}:</span>
              <span className="font-bold text-cyan-400">{summary.myMiles.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Team Totals */}
        <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-lg p-3">
          <p className="text-xs text-green-300 mb-2 font-semibold">{t('teamTotals')}</p>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">RT:</span>
              <span className="font-bold text-white">{summary.totalRegular.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">OT:</span>
              <span className="font-bold text-yellow-400">{summary.totalOvertime.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-300">{t('miles')}:</span>
              <span className="font-bold text-cyan-400">{summary.totalMiles.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Add Hours Button */}
      {!isCompleted && !showAddForm && !editingLogId && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold mb-4 flex items-center justify-center gap-2"
        >
          <span className="text-xl">➕</span>
          {t('addHoursForToday')}
        </button>
      )}

      {/* Add/Edit Hours Form */}
      {(showAddForm || editingLogId) && (
        <div className="bg-gray-700 rounded-lg p-4 mb-4 border-2 border-blue-500">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold text-lg">
              {editingLogId ? (language === 'en' ? '✏️ Edit Entry' : '✏️ Editar Entrada') : '➕ ' + t('logHours')}
            </h4>
            <button
              onClick={() => {
                setShowAddForm(false);
                cancelEdit();
              }}
              className="text-gray-400 hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="space-y-3">
            {/* Date Selector */}
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-semibold">{t('workDate')}</label>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-3 bg-gray-600 rounded-lg text-white text-lg"
                disabled={saving || editingLogId}
              />
            </div>

            {/* User Selection (if lead tech with team) - only for new entries */}
            {currentTeamList && currentTeamList.length > 0 && !editingLogId && (
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-semibold">{t('loggingFor')}</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(parseInt(e.target.value))}
                  className="w-full px-3 py-3 bg-gray-600 rounded-lg text-white"
                  disabled={saving}
                >
                  <option value={currentUser?.user_id}>
                    👤 {currentUser?.first_name} {currentUser?.last_name} ({t('me')})
                  </option>
                  {currentTeamList.map(member => (
                    <option key={member.user_id} value={member.user_id}>
                      👥 {member.user?.first_name} {member.user?.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Hours Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-semibold">
                  RT ({t('hrs')})
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={hoursRegular}
                  onChange={(e) => setHoursRegular(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-3 bg-gray-600 rounded-lg text-white text-center text-lg font-bold"
                  disabled={saving}
                />
                <p className="text-xs text-green-400 text-center mt-1">@$64/hr</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-semibold">
                  OT ({t('hrs')})
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={hoursOvertime}
                  onChange={(e) => setHoursOvertime(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-3 bg-gray-600 rounded-lg text-white text-center text-lg font-bold"
                  disabled={saving}
                />
                <p className="text-xs text-yellow-400 text-center mt-1">@$96/hr</p>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1 font-semibold">
                  {t('miles')}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={miles}
                  onChange={(e) => setMiles(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-3 bg-gray-600 rounded-lg text-white text-center text-lg font-bold"
                  disabled={saving}
                />
                <p className="text-xs text-cyan-400 text-center mt-1">@$1/mi</p>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-semibold">
                {t('notes')} <span className="text-gray-500">({t('optional')})</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('addNotesHere')}
                rows="2"
                className="w-full px-3 py-2 bg-gray-600 rounded-lg text-white text-sm"
                disabled={saving}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  cancelEdit();
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-500 py-3 rounded-lg font-bold"
                disabled={saving}
              >
                {language === 'en' ? 'Cancel' : 'Cancelar'}
              </button>
              <button
                onClick={editingLogId ? () => handleUpdateHours(editingLogId) : handleAddHours}
                disabled={saving}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-3 rounded-lg font-bold"
              >
                {saving 
                  ? (t('saving') || 'Saving...') 
                  : editingLogId 
                    ? (language === 'en' ? '✅ Update' : '✅ Actualizar')
                    : '✅ ' + t('logHours')
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Daily Log Entries - Collapsible */}
      {showFullLog && (
        <div className="border-t border-gray-700 pt-4">
          <h4 className="font-semibold text-sm text-gray-400 mb-3">
            📋 {language === 'en' ? 'All Entries' : 'Todas las Entradas'} ({dailyLogs.length})
          </h4>
          
          {loading ? (
            <div className="text-center text-gray-400 py-4">{t('loading')}...</div>
          ) : dailyLogs.length === 0 ? (
            <div className="text-center text-gray-400 py-6">
              <p className="text-3xl mb-2">📝</p>
              <p>{t('noHoursLogged')}</p>
              <p className="text-xs mt-1">{t('clickAboveToStart')}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {Object.keys(logsByDate).sort((a, b) => new Date(b) - new Date(a)).map(date => (
                <div key={date} className="bg-gray-750 rounded-lg overflow-hidden">
                  {/* Date Header */}
                  <div className="bg-gray-700 px-3 py-2 flex justify-between items-center">
                    <span className="font-bold text-sm">{formatDateDisplay(date)}</span>
                    <span className="text-xs text-gray-400">
                      {logsByDate[date].length} {logsByDate[date].length === 1 
                        ? (language === 'en' ? 'entry' : 'entrada') 
                        : (language === 'en' ? 'entries' : 'entradas')}
                    </span>
                  </div>
                  
                  {/* Entries for this date */}
                  <div className="p-2 space-y-2">
                    {logsByDate[date].map((log) => (
                      <div
                        key={log.log_id}
                        className={`rounded-lg p-3 ${
                          log.user_id === currentUser?.user_id
                            ? 'bg-blue-900/50 border-l-4 border-blue-500'
                            : 'bg-gray-700/50'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-sm flex items-center gap-2">
                              {log.user?.first_name} {log.user?.last_name}
                              {log.user_id === currentUser?.user_id && (
                                <span className="text-xs bg-blue-600 px-2 py-0.5 rounded">{t('you')}</span>
                              )}
                            </p>
                            <div className="flex gap-3 mt-1 text-sm">
                              {log.hours_regular > 0 && (
                                <span className="text-green-400">RT: {log.hours_regular}h</span>
                              )}
                              {log.hours_overtime > 0 && (
                                <span className="text-yellow-400">OT: {log.hours_overtime}h</span>
                              )}
                              {log.miles > 0 && (
                                <span className="text-cyan-400">{log.miles} mi</span>
                              )}
                            </div>
                            {log.notes && (
                              <p className="text-xs text-gray-400 mt-2 italic">
                                💬 {log.notes}
                              </p>
                            )}
                          </div>
                          
                          {/* Edit/Delete buttons for own entries */}
                          {!isCompleted && log.user_id === currentUser?.user_id && (
                            <div className="flex gap-1 ml-2">
                              <button
                                onClick={() => startEdit(log)}
                                className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
                                disabled={saving}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDeleteHours(log.log_id)}
                                className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs"
                                disabled={saving}
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Preview - Show last 3 entries when log is collapsed */}
      {!showFullLog && dailyLogs.length > 0 && (
        <div className="border-t border-gray-700 pt-3 mt-3">
          <p className="text-xs text-gray-500 mb-2">
            {language === 'en' ? 'Recent entries:' : 'Entradas recientes:'}
          </p>
          <div className="space-y-1">
            {dailyLogs.slice(0, 3).map((log) => (
              <div key={log.log_id} className="flex justify-between text-xs text-gray-400 bg-gray-700/30 px-2 py-1 rounded">
                <span>{formatDateDisplay(log.work_date)} - {log.user?.first_name}</span>
                <span>
                  {log.hours_regular > 0 && <span className="text-green-400 mr-2">RT:{log.hours_regular}</span>}
                  {log.hours_overtime > 0 && <span className="text-yellow-400 mr-2">OT:{log.hours_overtime}</span>}
                  {log.miles > 0 && <span className="text-cyan-400">{log.miles}mi</span>}
                </span>
              </div>
            ))}
          </div>
          {dailyLogs.length > 3 && (
            <button
              onClick={() => setShowFullLog(true)}
              className="text-xs text-blue-400 hover:text-blue-300 mt-2"
            >
              + {dailyLogs.length - 3} {language === 'en' ? 'more entries' : 'más entradas'}...
            </button>
          )}
        </div>
      )}
    </div>
  );
}
