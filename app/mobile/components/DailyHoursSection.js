// components/DailyHoursSection.js - Mobile Daily Hours Tracking
'use client';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useLanguage } from '../contexts/LanguageContext';
import { translations } from '../utils/translations';

export default function DailyHoursSection({ workOrder, currentUser, status, saving: parentSaving }) {
  const { language } = useLanguage();
  const t = (key) => translations[language]?.[key] || key;
  
  const supabase = createClientComponentClient();
  
  const [dailyEntries, setDailyEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state for adding new hours (always create new entry)
  const [formData, setFormData] = useState({
    hours_regular: '',
    hours_overtime: '',
    miles: '',
    notes: ''
  });

  const wo = workOrder || {};

  useEffect(() => {
    if (wo.wo_id && currentUser?.user_id) {
      loadDailyEntries();
    }
  }, [wo.wo_id, currentUser?.user_id]);

  async function loadDailyEntries() {
    try {
      setLoading(true);
      
      // Get all entries for this work order by the current user
      const { data, error } = await supabase
        .from('daily_hours_log')
        .select('*')
        .eq('wo_id', wo.wo_id)
        .eq('user_id', currentUser.user_id)
        .order('work_date', { ascending: false });

      if (error) throw error;

      setDailyEntries(data || []);
      
      // Always reset form to blank for new entry
      setFormData({
        hours_regular: '',
        hours_overtime: '',
        miles: '',
        notes: ''
      });
    } catch (err) {
      console.error('Error loading daily entries:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveHours() {
    if (!currentUser?.user_id || !wo.wo_id) return;

    const rt = parseFloat(formData.hours_regular) || 0;
    const ot = parseFloat(formData.hours_overtime) || 0;
    const miles = parseFloat(formData.miles) || 0;

    if (rt === 0 && ot === 0 && miles === 0) {
      alert(language === 'en' ? 'Please enter at least hours or miles' : 'Por favor ingrese horas o millas');
      return;
    }

    try {
      setSaving(true);
      const today = new Date().toISOString().split('T')[0];

      // Always insert new entry (allows multiple entries per day)
      const { error } = await supabase
        .from('daily_hours_log')
        .insert({
          wo_id: wo.wo_id,
          user_id: currentUser.user_id,
          work_date: today,
          hours_regular: rt,
          hours_overtime: ot,
          miles: miles,
          notes: formData.notes || null,
          created_at: new Date().toISOString()
        });

      if (error) throw error;
      alert(language === 'en' ? '✅ Hours added!' : '✅ ¡Horas agregadas!');

      await loadDailyEntries();
      setShowAddForm(false);
    } catch (err) {
      console.error('Error saving hours:', err);
      alert((language === 'en' ? 'Error saving hours: ' : 'Error al guardar horas: ') + err.message);
    } finally {
      setSaving(false);
    }
  }

  // Calculate totals for this user
  const myTotals = dailyEntries.reduce((acc, entry) => {
    acc.rt += parseFloat(entry.hours_regular) || 0;
    acc.ot += parseFloat(entry.hours_overtime) || 0;
    acc.miles += parseFloat(entry.miles) || 0;
    return acc;
  }, { rt: 0, ot: 0, miles: 0 });

  const isCompleted = status === 'completed';
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">
          ⏱️ {language === 'en' ? 'My Daily Hours' : 'Mis Horas Diarias'}
        </h3>
        {!isCompleted && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm font-semibold"
          >
            {showAddForm ? '✕' : '+ ' + (language === 'en' ? 'Add Hours' : 'Agregar Horas')}
          </button>
        )}
      </div>

      {/* My Totals Summary */}
      <div className="bg-gray-700 rounded-lg p-3 mb-3">
        <p className="text-xs text-gray-400 mb-1">{language === 'en' ? 'My Total on This WO' : 'Mi Total en Esta OT'}:</p>
        <div className="flex gap-4 text-sm">
          <span className="text-green-400">RT: {myTotals.rt.toFixed(1)}h</span>
          <span className="text-orange-400">OT: {myTotals.ot.toFixed(1)}h</span>
          <span className="text-blue-400">{language === 'en' ? 'Miles' : 'Millas'}: {myTotals.miles.toFixed(1)}</span>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && !isCompleted && (
        <div className="bg-gray-700 rounded-lg p-3 mb-3 border-2 border-blue-500">
          <p className="text-sm font-semibold mb-2 text-blue-300">
            📅 {language === 'en' ? 'Add Hours for Today' : 'Agregar Horas de Hoy'} ({today})
          </p>
          
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {language === 'en' ? 'Regular Hours' : 'Horas Regulares'}
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.hours_regular}
                onChange={(e) => setFormData({ ...formData, hours_regular: e.target.value })}
                className="w-full px-2 py-2 bg-gray-600 rounded text-white text-sm"
                placeholder="0"
                disabled={saving}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {language === 'en' ? 'Overtime Hours' : 'Horas Extra'}
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.hours_overtime}
                onChange={(e) => setFormData({ ...formData, hours_overtime: e.target.value })}
                className="w-full px-2 py-2 bg-gray-600 rounded text-white text-sm"
                placeholder="0"
                disabled={saving}
              />
            </div>
          </div>
          
          <div className="mb-2">
            <label className="block text-xs text-gray-400 mb-1">
              {language === 'en' ? 'Miles Driven' : 'Millas Conducidas'}
            </label>
            <input
              type="number"
              step="0.1"
              value={formData.miles}
              onChange={(e) => setFormData({ ...formData, miles: e.target.value })}
              className="w-full px-2 py-2 bg-gray-600 rounded text-white text-sm"
              placeholder="0"
              disabled={saving}
            />
          </div>

          <div className="mb-3">
            <label className="block text-xs text-gray-400 mb-1">
              {language === 'en' ? 'Notes (optional)' : 'Notas (opcional)'}
            </label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-2 py-2 bg-gray-600 rounded text-white text-sm"
              placeholder={language === 'en' ? 'What did you work on?' : '¿En qué trabajó?'}
              disabled={saving}
            />
          </div>

          <button
            onClick={handleSaveHours}
            disabled={saving}
            className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-semibold disabled:bg-gray-600"
          >
            {saving ? (language === 'en' ? 'Saving...' : 'Guardando...') : '✓ ' + (language === 'en' ? 'Save Hours' : 'Guardar Horas')}
          </button>
        </div>
      )}

      {/* Daily Entries List */}
      {loading ? (
        <p className="text-gray-500 text-sm text-center py-2">{t('loading')}</p>
      ) : dailyEntries.length > 0 ? (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {dailyEntries.map((entry) => (
            <div key={entry.id} className="bg-gray-700 rounded p-2 text-sm">
              <div className="flex justify-between items-start">
                <span className="text-gray-400">{entry.work_date}</span>
                <div className="flex gap-2 text-xs">
                  <span className="text-green-400">RT: {entry.hours_regular || 0}h</span>
                  <span className="text-orange-400">OT: {entry.hours_overtime || 0}h</span>
                  <span className="text-blue-400">{entry.miles || 0} mi</span>
                </div>
              </div>
              {entry.notes && (
                <p className="text-gray-500 text-xs mt-1 italic">{entry.notes}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-sm text-center py-2">
          {language === 'en' ? 'No hours logged yet. Tap "Add Hours" to add.' : 'Sin horas registradas. Toque "Agregar Horas" para agregar.'}
        </p>
      )}

      {/* Info Banner */}
      <div className="mt-3 bg-blue-900 rounded p-2 text-xs text-blue-200">
        <p>💡 {language === 'en' 
          ? 'Add hours as you work. You can add multiple entries per day.' 
          : 'Agregue horas mientras trabaja. Puede agregar múltiples entradas por día.'}
        </p>
      </div>
    </div>
  );
}
