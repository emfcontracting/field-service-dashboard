// components/DailyHoursSection.js - Bilingual Daily Hours Logging
import { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import * as dailyHoursService from '../services/dailyHoursService';

export default function DailyHoursSection({ workOrder, currentUser, currentTeamList, status }) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key];
  const supabase = createClientComponentClient();

  // State
  const [dailyLogs, setDailyLogs] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0]);
  const [hoursRegular, setHoursRegular] = useState('');
  const [hoursOvertime, setHoursOvertime] = useState('');
  const [miles, setMiles] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(currentUser.user_id);

  // Load daily hours on mount
  useEffect(() => {
    if (workOrder && workOrder.wo_id) {
      loadDailyHours();
    }
  }, [workOrder?.wo_id]);

  async function loadDailyHours() {
    if (!workOrder || !workOrder.wo_id) return;

    try {
      setLoading(true);
      const logs = await dailyHoursService.loadDailyHoursForWorkOrder(supabase, workOrder.wo_id);
      setDailyLogs(logs);
    } catch (err) {
      console.error('Error loading daily hours:', err);
      alert(t('errorLoadingDailyHours') || 'Error loading daily hours');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddHours() {
    // Validate
    const validation = dailyHoursService.validateHoursEntry(hoursRegular, hoursOvertime, miles);
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
      setHoursRegular('');
      setHoursOvertime('');
      setMiles('');
      setNotes('');
      setShowAddForm(false);

      // Reload logs
      await loadDailyHours();

      alert(t('hoursAddedSuccess') || '✅ Hours logged successfully!');
    } catch (err) {
      console.error('Error adding hours:', err);
      alert(err.message || (t('errorAddingHours') || 'Error adding hours'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadCSV() {
    try {
      const logs = await dailyHoursService.loadDailyHoursForWorkOrder(supabase, workOrder.wo_id);
      const csvContent = dailyHoursService.generateDailyHoursCSV(logs);
      const filename = `${workOrder.wo_number}_daily_hours_${new Date().toISOString().split('T')[0]}.csv`;
      dailyHoursService.downloadCSV(csvContent, filename);
    } catch (err) {
      console.error('Error downloading CSV:', err);
      alert(t('errorDownloadingCSV') || 'Error downloading CSV');
    }
  }

  // Calculate summary totals
  const summary = dailyLogs.reduce((acc, log) => {
    if (log.user_id === currentUser.user_id) {
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

  const isCompleted = status === 'completed';

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-blue-400">📊 {t('dailyHoursLog') || 'Daily Hours Log'}</h3>
        <button
          onClick={handleDownloadCSV}
          disabled={dailyLogs.length === 0}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-3 py-1 rounded-lg text-sm"
        >
          📥 {t('downloadCSV') || 'Download CSV'}
        </button>
      </div>

      {/* Summary Section */}
      <div className="bg-gradient-to-r from-blue-900 to-purple-900 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          {/* My Totals */}
          <div>
            <p className="text-xs text-gray-300 mb-2">{t('myTotals') || 'My Totals'}</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">RT:</span>
                <span className="font-bold text-white">{summary.myRegular.toFixed(1)} {t('hrs')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">OT:</span>
                <span className="font-bold text-white">{summary.myOvertime.toFixed(1)} {t('hrs')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">{t('miles')}:</span>
                <span className="font-bold text-white">{summary.myMiles.toFixed(1)} mi</span>
              </div>
            </div>
          </div>

          {/* Team Totals */}
          <div>
            <p className="text-xs text-gray-300 mb-2">{t('teamTotals') || 'Team Totals'}</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">RT:</span>
                <span className="font-bold text-green-400">{summary.totalRegular.toFixed(1)} {t('hrs')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">OT:</span>
                <span className="font-bold text-green-400">{summary.totalOvertime.toFixed(1)} {t('hrs')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">{t('miles')}:</span>
                <span className="font-bold text-green-400">{summary.totalMiles.toFixed(1)} mi</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Hours Button */}
      {!isCompleted && !showAddForm && (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold mb-4"
        >
          + {t('addHoursForToday') || 'Add Hours for Today'}
        </button>
      )}

      {/* Add Hours Form */}
      {showAddForm && (
        <div className="bg-gray-700 rounded-lg p-4 mb-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-bold">{t('logHours') || 'Log Hours'}</h4>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-gray-400 hover:text-white text-xl"
            >
              ×
            </button>
          </div>

          <div className="space-y-3">
            {/* Date */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('workDate') || 'Work Date'}</label>
              <input
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 bg-gray-600 rounded-lg text-white"
                disabled={saving}
              />
            </div>

            {/* User Selection (if lead tech with team) */}
            {currentTeamList.length > 0 && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('loggingFor') || 'Logging For'}</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(parseInt(e.target.value))}
                  className="w-full px-3 py-2 bg-gray-600 rounded-lg text-white"
                  disabled={saving}
                >
                  <option value={currentUser.user_id}>
                    {currentUser.first_name} {currentUser.last_name} ({t('me') || 'Me'})
                  </option>
                  {currentTeamList.map(member => (
                    <option key={member.user_id} value={member.user_id}>
                      {member.user?.first_name} {member.user?.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Hours */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('regularHours')}</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={hoursRegular}
                  onChange={(e) => setHoursRegular(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-3 py-2 bg-gray-600 rounded-lg text-white"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t('overtimeHours')}</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={hoursOvertime}
                  onChange={(e) => setHoursOvertime(e.target.value)}
                  placeholder="0.0"
                  className="w-full px-3 py-2 bg-gray-600 rounded-lg text-white"
                  disabled={saving}
                />
              </div>
            </div>

            {/* Miles */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('miles')}</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
                placeholder="0.0"
                className="w-full px-3 py-2 bg-gray-600 rounded-lg text-white"
                disabled={saving}
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('notes') || 'Notes'} ({t('optional') || 'optional'})</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('addNotesHere') || 'Add notes here...'}
                rows="2"
                className="w-full px-3 py-2 bg-gray-600 rounded-lg text-white text-sm"
                disabled={saving}
              />
            </div>

            {/* Submit Button */}
            <button
              onClick={handleAddHours}
              disabled={saving}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-3 rounded-lg font-bold"
            >
              {saving ? (t('saving') || 'Saving...') : `✅ ${t('logHours') || 'Log Hours'}`}
            </button>
          </div>
        </div>
      )}

      {/* Hours Log Entries */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="text-center text-gray-400 py-4">{t('loading')}...</div>
        ) : dailyLogs.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p className="mb-2">📝</p>
            <p>{t('noHoursLogged') || 'No hours logged yet'}</p>
            <p className="text-xs mt-1">{t('clickAboveToStart') || 'Click above to start logging'}</p>
          </div>
        ) : (
          dailyLogs.map((log) => (
            <div
              key={log.log_id}
              className={`rounded-lg p-3 ${
                log.user_id === currentUser.user_id
                  ? 'bg-blue-900 border-l-4 border-blue-500'
                  : 'bg-gray-700'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-sm">
                    {log.user?.first_name} {log.user?.last_name}
                    {log.user_id === currentUser.user_id && (
                      <span className="ml-2 text-xs bg-blue-600 px-2 py-0.5 rounded">{t('you') || 'You'}</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">
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
                <p className="text-xs text-gray-300 mt-2 italic border-t border-gray-600 pt-2">
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
  );
}
