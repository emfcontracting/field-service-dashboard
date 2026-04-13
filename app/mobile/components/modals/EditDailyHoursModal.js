// components/modals/EditDailyHoursModal.js - Bilingual Edit Daily Hours Modal
// Allows a tech to edit or delete their own existing daily hours entry
'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { translations } from '../../utils/translations';
import { parseLocalDate } from '../../utils/dateUtils';

export default function EditDailyHoursModal({
  show,
  onClose,
  onSave,
  onDelete,
  saving,
  log,
  userName
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language]?.[key] || key;

  const [hoursRegular, setHoursRegular] = useState('');
  const [hoursOvertime, setHoursOvertime] = useState('');
  const [miles, setMiles] = useState('');
  const [techMaterialCost, setTechMaterialCost] = useState('');
  const [notes, setNotes] = useState('');
  const [materialOnly, setMaterialOnly] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Pre-populate form when log changes
  useEffect(() => {
    if (show && log) {
      const rt = parseFloat(log.hours_regular) || 0;
      const ot = parseFloat(log.hours_overtime) || 0;
      const mi = parseFloat(log.miles) || 0;
      const mat = parseFloat(log.tech_material_cost) || 0;

      setHoursRegular(rt > 0 ? String(rt) : '');
      setHoursOvertime(ot > 0 ? String(ot) : '');
      setMiles(mi > 0 ? String(mi) : '');
      setTechMaterialCost(mat > 0 ? String(mat) : '');
      setNotes(log.notes || '');

      // Auto-detect material-only mode: no hours but has material or miles
      setMaterialOnly(rt === 0 && ot === 0 && (mat > 0 || mi > 0));
      setConfirmDelete(false);
    }
  }, [show, log]);

  if (!show || !log) return null;

  const displayDate = parseLocalDate(log.work_date);
  const formattedDate = displayDate.toLocaleDateString(
    language === 'en' ? 'en-US' : 'es-ES',
    { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }
  );

  function validateAndSubmit() {
    const rt = parseFloat(hoursRegular);
    const ot = parseFloat(hoursOvertime);
    const rtValue = isNaN(rt) ? 0 : rt;
    const otValue = isNaN(ot) ? 0 : ot;
    const totalHours = rtValue + otValue;
    const milesValue = parseFloat(miles) || 0;
    const materialValue = parseFloat(techMaterialCost) || 0;

    if (materialOnly) {
      if (materialValue <= 0 && milesValue <= 0) {
        alert(
          language === 'en'
            ? 'Please enter material cost or miles for a material-only entry'
            : 'Por favor ingrese costo de material o millas para una entrada solo de material'
        );
        return;
      }
    } else {
      if (totalHours === 0 && milesValue === 0 && materialValue === 0) {
        alert(
          language === 'en'
            ? 'Please enter at least hours, miles, or material cost'
            : 'Por favor ingrese al menos horas, millas, o costo de material'
        );
        return;
      }
      if (totalHours > 24) {
        alert(t('hoursCannotExceed24') || 'Total hours cannot exceed 24 hours per day');
        return;
      }
      if (rtValue < 0 || otValue < 0) {
        alert(t('hoursCannotBeNegative') || 'Hours cannot be negative');
        return;
      }
    }

    const updatedData = {
      logId: log.log_id,
      hoursRegular: materialOnly ? 0 : rtValue,
      hoursOvertime: materialOnly ? 0 : otValue,
      miles: milesValue,
      techMaterialCost: materialValue,
      notes: notes.trim() || null
    };

    onSave(updatedData);
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(log.log_id);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">
            ✏️ {language === 'en' ? 'Edit Daily Hours' : 'Editar Horas Diarias'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* User + Date Info (read-only) */}
        <div className="bg-blue-900 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-200">
            {userName} — <span className="font-bold">{formattedDate}</span>
          </p>
          <p className="text-xs text-blue-300 mt-1">
            {language === 'en'
              ? 'Date cannot be changed. Delete and re-add if you need a different date.'
              : 'La fecha no se puede cambiar. Elimine y agregue de nuevo si necesita otra fecha.'}
          </p>
        </div>

        {/* Material-Only Toggle */}
        <div className={`rounded-lg p-3 mb-4 border-2 transition-colors ${
          materialOnly
            ? 'bg-orange-900 border-orange-500'
            : 'bg-gray-700 border-gray-600'
        }`}>
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex-1">
              <p className="font-semibold text-white">
                📦 {language === 'en' ? 'Material Only (No Hours)' : 'Solo Material (Sin Horas)'}
              </p>
              <p className="text-xs text-gray-300 mt-1">
                {language === 'en'
                  ? 'Log material cost or miles without labor hours'
                  : 'Registrar costo de material o millas sin horas de trabajo'}
              </p>
            </div>
            <div className="relative inline-block w-12 h-6 ml-3">
              <input
                type="checkbox"
                checked={materialOnly}
                onChange={(e) => {
                  setMaterialOnly(e.target.checked);
                  if (e.target.checked) {
                    setHoursRegular('');
                    setHoursOvertime('');
                  }
                }}
                className="sr-only peer"
              />
              <div className="w-12 h-6 bg-gray-600 rounded-full peer-checked:bg-orange-500 transition-colors"></div>
              <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                materialOnly ? 'translate-x-6' : ''
              }`}></div>
            </div>
          </label>
        </div>

        <div className="space-y-4">
          {/* Regular Hours */}
          <div className={materialOnly ? 'opacity-50' : ''}>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              {t('regularHours') || 'Regular Hours (RT)'}
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={materialOnly ? '' : hoursRegular}
              disabled={materialOnly}
              onChange={(e) => setHoursRegular(e.target.value)}
              placeholder={materialOnly ? '—' : '0.0'}
              className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">@ $64/{t('hrs') || 'hr'}</p>
          </div>

          {/* Overtime Hours */}
          <div className={materialOnly ? 'opacity-50' : ''}>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              {t('overtimeHours') || 'Overtime Hours (OT)'}
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={materialOnly ? '' : hoursOvertime}
              disabled={materialOnly}
              onChange={(e) => setHoursOvertime(e.target.value)}
              placeholder={materialOnly ? '—' : '0.0'}
              className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">@ $96/{t('hrs') || 'hr'}</p>
          </div>

          {/* Miles */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              {t('miles') || 'Miles'}
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
              placeholder="0.0"
              className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">@ $1.00/mi</p>
          </div>

          {/* Tech Material Cost */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              {language === 'en' ? 'Tech Material Cost' : 'Costo de Material (Técnico)'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-400 text-lg">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={techMaterialCost}
                onChange={(e) => setTechMaterialCost(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {language === 'en'
                ? '💰 For materials YOU purchased (for reimbursement)'
                : '💰 Para materiales que USTED compró (para reembolso)'}
            </p>
          </div>

          {/* Total Hours Display */}
          {!materialOnly && (hoursRegular || hoursOvertime) && (
            <div className="bg-gray-700 rounded-lg p-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-300">{t('totalHours') || 'Total Hours'}:</span>
                <span className={`text-lg font-bold ${
                  (parseFloat(hoursRegular) || 0) + (parseFloat(hoursOvertime) || 0) > 24
                    ? 'text-red-500'
                    : 'text-green-500'
                }`}>
                  {((parseFloat(hoursRegular) || 0) + (parseFloat(hoursOvertime) || 0)).toFixed(1)} {t('hrs') || 'hrs'}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              {t('notes') || 'Notes'} ({t('optional') || 'Optional'})
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('addNotesAboutWork') || 'Add notes about the work performed...'}
              rows="3"
              maxLength="500"
              className="w-full px-4 py-3 text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              {notes.length}/500 {t('characters') || 'characters'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-semibold disabled:bg-gray-800"
            >
              {t('cancel') || 'Cancel'}
            </button>
            <button
              onClick={validateAndSubmit}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 py-3 rounded-lg font-semibold disabled:bg-gray-600"
            >
              {saving ? (t('saving') || 'Saving...') : `✓ ${language === 'en' ? 'Save Changes' : 'Guardar Cambios'}`}
            </button>
          </div>

          {/* Delete Button (two-step confirm) */}
          <button
            onClick={handleDelete}
            disabled={saving}
            className={`w-full py-3 rounded-lg font-semibold transition-colors ${
              confirmDelete
                ? 'bg-red-700 hover:bg-red-800 text-white border-2 border-red-400'
                : 'bg-gray-700 hover:bg-red-900 text-red-400 border border-red-900'
            } disabled:bg-gray-800 disabled:text-gray-500`}
          >
            {confirmDelete
              ? (language === 'en' ? '⚠️ Tap again to confirm delete' : '⚠️ Toque de nuevo para confirmar')
              : `🗑️ ${language === 'en' ? 'Delete Entry' : 'Eliminar Entrada'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
