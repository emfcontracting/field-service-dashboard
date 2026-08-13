// components/modals/AvailabilityModal.js - Bilingual Availability Modal
import { useLanguage } from '../../contexts/LanguageContext';
import { translations } from '../../utils/translations';

export default function AvailabilityModal({
  showAvailabilityModal,
  availabilityBlocked,
  scheduledWork,
  emergencyWork,
  notAvailable,
  saving,
  hasWork,
  workReason,
  workNote,
  handleAvailabilityChange,
  onWorkChoice,
  onReasonChange,
  onNoteChange,
  submitAvailability,
  blocking = true,   // false when the tech opened it manually → closeable
  onClose,
}) {
  const { language } = useLanguage();
  const t = (key) => translations[language][key];

  const estNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dayOfWeek = estNow.getDay();

  // Sunday asks about Monday; Monday–Friday ask about "tomorrow" + today's
  // emergencies. Friday's tomorrow is Saturday, so regular Saturday work is now
  // offered on Friday just like any other weekday.
  let targetDay = '';
  let headerText = '';
  let subHeaderText = '';

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daysES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  if (dayOfWeek === 0) {
    // Sunday — asking about TOMORROW (Monday)
    const tomorrowDay = language === 'en' ? 'Monday' : 'Lunes';
    targetDay = t('tomorrow') + ' (' + tomorrowDay + ')';
    headerText = tomorrowDay + ' ' + t('availability');
    subHeaderText = language === 'en'
      ? 'Are you available for scheduled work tomorrow (Monday) and emergency calls today?'
      : '¿Está disponible para trabajo programado mañana (lunes) y llamadas de emergencia hoy?';
  } else {
    // Monday–Friday — TOMORROW's scheduled + TODAY's emergency (Fri → Saturday)
    const tomorrowDay = language === 'en' ? days[(dayOfWeek + 1) % 7] : daysES[(dayOfWeek + 1) % 7];
    const todayDay = language === 'en' ? days[dayOfWeek] : daysES[dayOfWeek];
    targetDay = t('tomorrow') + ' (' + tomorrowDay + ')';
    headerText = tomorrowDay + ' ' + t('availability');
    subHeaderText = language === 'en'
      ? `Are you available for scheduled work tomorrow (${tomorrowDay}) and emergency calls today (${todayDay})?`
      : `¿Está disponible para trabajo programado mañana (${tomorrowDay}) y llamadas de emergencia hoy (${todayDay})?`;
  }

  const available = (scheduledWork || emergencyWork) && !notAvailable;
  const workComplete = !available || hasWork === false || (hasWork === true && !!workReason);
  const canSubmit = (scheduledWork || emergencyWork || notAvailable) && workComplete && !saving;

  const REASONS = [
    ['return_trip', 'reasonReturnTrip'],
    ['waiting_material', 'reasonWaitingMaterial'],
    ['other', 'reasonOther'],
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="relative bg-gray-800 rounded-2xl p-6 max-w-md w-full border-4 border-yellow-500 max-h-[92vh] overflow-y-auto">
        {!blocking && (
          <button
            onClick={onClose}
            aria-label={t('close')}
            className="absolute top-3 right-4 text-gray-400 hover:text-white text-3xl leading-none"
          >
            ×
          </button>
        )}

        <div className="text-center mb-6">
          <div className="text-5xl mb-3">⏰</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {headerText}
          </h2>
          <p className="text-gray-300">
            {subHeaderText}
          </p>
          <p className="text-sm text-yellow-400 mt-2">
            {blocking
              ? (language === 'en' ? 'Please respond to continue using the app' : 'Por favor responda para continuar usando la app')
              : t('updateAvailability')}
          </p>
        </div>

        <div className="space-y-4 mb-6">
          <button
            onClick={() => handleAvailabilityChange('scheduledWork')}
            disabled={notAvailable}
            className={`w-full p-4 rounded-lg border-2 transition ${
              scheduledWork
                ? 'bg-green-600 border-green-400 text-white'
                : notAvailable
                ? 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 border-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                  scheduledWork ? 'bg-green-500 border-green-400' : 'border-gray-400'
                }`}>
                  {scheduledWork && <span className="text-white font-bold">✓</span>}
                </div>
                <div className="text-left">
                  <div className="font-bold">📅 {t('scheduledWork')}</div>
                  <div className="text-xs opacity-75">{t('availableForPlanned')} {targetDay}</div>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleAvailabilityChange('emergencyWork')}
            disabled={notAvailable}
            className={`w-full p-4 rounded-lg border-2 transition ${
              emergencyWork
                ? 'bg-red-600 border-red-400 text-white'
                : notAvailable
                ? 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed'
                : 'bg-gray-700 border-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                  emergencyWork ? 'bg-red-500 border-red-400' : 'border-gray-400'
                }`}>
                  {emergencyWork && <span className="text-white font-bold">✓</span>}
                </div>
                <div className="text-left">
                  <div className="font-bold">🚨 {t('emergencyWork')}</div>
                  <div className="text-xs opacity-75">
                    {t('availableForUrgent')}
                  </div>
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleAvailabilityChange('notAvailable')}
            className={`w-full p-4 rounded-lg border-2 transition ${
              notAvailable
                ? 'bg-gray-600 border-gray-400 text-white'
                : 'bg-gray-700 border-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                  notAvailable ? 'bg-gray-500 border-gray-400' : 'border-gray-400'
                }`}>
                  {notAvailable && <span className="text-white font-bold">✓</span>}
                </div>
                <div className="text-left">
                  <div className="font-bold">🚫 {t('notAvailable')}</div>
                  <div className="text-xs opacity-75">
                    {t('cannotWork')} {t('today')} {language === 'en' ? 'or' : 'o'} {t('tomorrow')}
                  </div>
                </div>
              </div>
            </div>
          </button>

          {available && (
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
              <p className="text-white font-bold text-sm mb-3">{t('workStatusPrompt')}</p>
              <div className="flex gap-3">
                <button
                  onClick={() => onWorkChoice(false)}
                  className={`flex-1 p-3 rounded-lg border-2 font-bold text-sm transition ${
                    hasWork === false
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-gray-700 border-gray-500 text-white hover:bg-gray-600'
                  }`}
                >
                  🔎 {t('needWork')}
                </button>
                <button
                  onClick={() => onWorkChoice(true)}
                  className={`flex-1 p-3 rounded-lg border-2 font-bold text-sm transition ${
                    hasWork === true
                      ? 'bg-green-600 border-green-400 text-white'
                      : 'bg-gray-700 border-gray-500 text-white hover:bg-gray-600'
                  }`}
                >
                  ✅ {t('haveWork')}
                </button>
              </div>

              {hasWork === true && (
                <div className="mt-3 space-y-2">
                  <p className="text-gray-300 text-xs font-semibold">{t('reasonPrompt')}</p>
                  <div className="flex flex-wrap gap-2">
                    {REASONS.map(([val, key]) => (
                      <button
                        key={val}
                        onClick={() => onReasonChange(val)}
                        className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                          workReason === val
                            ? 'bg-purple-600 border-purple-400 text-white'
                            : 'bg-gray-700 border-gray-500 text-gray-200 hover:bg-gray-600'
                        }`}
                      >
                        {t(key)}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={workNote}
                    onChange={(e) => onNoteChange(e.target.value)}
                    rows={2}
                    placeholder={t('workNotePlaceholder')}
                    className="w-full bg-black/40 border border-gray-600 text-white px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-blue-900 rounded-lg p-3 mb-4 text-sm text-blue-200">
          <p className="font-semibold mb-1">ℹ️ {t('selectionRules')}</p>
          <ul className="text-xs space-y-1 ml-4">
            <li>• {t('selectScheduledOrEmergency')}</li>
            <li>• {t('orSelectNotAvailable')}</li>
            <li>• {t('cannotCombineOptions')}</li>
          </ul>
        </div>

        <button
          onClick={submitAvailability}
          disabled={!canSubmit}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-4 rounded-lg font-bold text-lg text-white transition"
        >
          {saving ? t('submitting') : '✅ ' + t('submitAvailability')}
        </button>

        {!blocking && (
          <button
            onClick={onClose}
            className="w-full mt-3 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg font-semibold text-gray-200 transition"
          >
            {t('close')}
          </button>
        )}
      </div>
    </div>
  );
}
