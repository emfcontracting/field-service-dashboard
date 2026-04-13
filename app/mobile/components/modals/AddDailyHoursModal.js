// components/modals/AddDailyHoursModal.js - Bilingual Add Daily Hours Modal
'use client';
import { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { translations } from '../../utils/translations';

export default function AddDailyHoursModal({ 
  show, 
  onClose, 
  onSave, 
  saving,
  userId,
  userName,
  isTeamMember = false 
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key];
  
  const [workDate, setWorkDate] = useState('');
  const [hoursRegular, setHoursRegular] = useState('');
  const [hoursOvertime, setHoursOvertime] = useState('');
  const [miles, setMiles] = useState('');
  const [techMaterialCost, setTechMaterialCost] = useState('');
  const [notes, setNotes] = useState('');
  const [materialOnly, setMaterialOnly] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Helper function to get local date string in YYYY-MM-DD format
  // This prevents timezone issues where UTC conversion shifts the date
  function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Set default date to today when modal opens
  // FIXED: Use local timezone instead of UTC to prevent date shift
  useEffect(() => {
    if (show && !isInitialized) {
      const today = getLocalDateString();
      setWorkDate(today);
      setIsInitialized(true);
      console.log('Modal opened, set default date to:', today);
    }
    if (!show) {
      setIsInitialized(false);
    }
  }, [show, isInitialized]);

  if (!show) return null;

  function validateAndSubmit() {
    // Debug logging
    console.log('Validation - workDate:', workDate);
    console.log('Validation - hoursRegular:', hoursRegular);
    console.log('Validation - hoursOvertime:', hoursOvertime);
    console.log('Validation - miles:', miles);
    
    // Validation
    if (!workDate || workDate.trim() === '') {
      alert(t('selectWorkDate') || 'Please select a work date');
      return;
    }

    const rt = parseFloat(hoursRegular);
    const ot = parseFloat(hoursOvertime);
    const rtValue = isNaN(rt) ? 0 : rt;
    const otValue = isNaN(ot) ? 0 : ot;
    const totalHours = rtValue + otValue;
    const milesValue = parseFloat(miles) || 0;
    const materialValue = parseFloat(techMaterialCost) || 0;

    if (materialOnly) {
      // Material-only mode: no hours required, but material or miles must be > 0
      if (materialValue <= 0 && milesValue <= 0) {
        alert(
          language === 'en'
            ? 'Please enter material cost or miles for a material-only entry'
            : 'Por favor ingrese costo de material o millas para una entrada solo de material'
        );
        return;
      }
    } else {
      // Normal mode: at least one hour required
      if (isNaN(rt) && isNaN(ot)) {
        alert(t('enterAtLeastOneHour') || 'Please enter at least one hour (regular or overtime)');
        return;
      }

      if (totalHours === 0) {
        alert(t('enterAtLeastOneHour') || 'Please enter at least one hour (regular or overtime)');
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

    // Prepare data - workDate is already in YYYY-MM-DD format
    // In material-only mode, force hours to 0
    const hoursData = {
      userId,
      workDate: workDate.trim(),
      hoursRegular: materialOnly ? 0 : rtValue,
      hoursOvertime: materialOnly ? 0 : otValue,
      miles: milesValue,
      techMaterialCost: materialValue,
      notes: notes.trim() || null,
      materialOnly
    };

    console.log('Submitting hours data:', hoursData);
    onSave(hoursData);
    handleClose();
  }

  function handleClose() {
    console.log('Closing modal and resetting state');
    setWorkDate('');
    setHoursRegular('');
    setHoursOvertime('');
    setMiles('');
    setTechMaterialCost('');
    setNotes('');
    setMaterialOnly(false);
    setIsInitialized(false);
    onClose();
  }

  // Get max date for date picker (today in local time)
  const maxDate = getLocalDateString();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">
            📝 {t('logDailyHours') || 'Log Daily Hours'}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* User Info */}
        <div className="bg-blue-900 rounded-lg p-3 mb-4">
          <p className="text-sm text-blue-200">
            {t('loggingHoursFor') || 'Logging hours for'}: <span className="font-bold">{userName}</span>
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
          {/* Work Date */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              {t('workDate') || 'Work Date'} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => {
                console.log('Date changed to:', e.target.value);
                setWorkDate(e.target.value);
              }}
              max={maxDate}
              className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              {t('cannotLogFutureDates') || 'Cannot log hours for future dates'}
            </p>
          </div>

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
              onChange={(e) => {
                console.log('Regular hours changed to:', e.target.value);
                setHoursRegular(e.target.value);
              }}
              placeholder={materialOnly ? '—' : '0.0'}
              className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">
              @ $64/{t('hrs') || 'hr'}
            </p>
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
              onChange={(e) => {
                console.log('Overtime hours changed to:', e.target.value);
                setHoursOvertime(e.target.value);
              }}
              placeholder={materialOnly ? '—' : '0.0'}
              className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">
              @ $96/{t('hrs') || 'hr'}
            </p>
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
            <p className="text-xs text-gray-400 mt-1">
              @ $1.00/mi
            </p>
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

          {/* Important Info */}
          <div className="bg-blue-900 rounded-lg p-3 text-sm text-blue-200">
            <p className="font-semibold mb-1">ℹ️ {t('important') || 'Important'}:</p>
            <ul className="text-xs space-y-1 ml-4">
              <li>• {language === 'en' ? 'You can add multiple entries for the same date' : 'Puede agregar múltiples entradas para la misma fecha'}</li>
              <li>• {t('totalHoursMust24') || 'Total hours (RT + OT) must not exceed 24 hours per entry'}</li>
              <li>• {t('hoursWillBeAddedToSummary') || 'Hours will be added to work order summary'}</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleClose}
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
              {saving ? (t('saving') || 'Saving...') : `✓ ${t('saveHours') || 'Save Hours'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}