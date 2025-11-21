// Availability Modal Component - SPANISH VERSION
export default function AvailabilityModal({
  showAvailabilityModal,
  availabilityBlocked,
  scheduledWork,
  emergencyWork,
  notAvailable,
  saving,
  handleAvailabilityChange,
  submitAvailability
}) {
  if (!showAvailabilityModal) return null;

  const estNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = estNow.getHours();
  const dayOfWeek = estNow.getDay();
  const isAfter8PM = hour >= 20;

  // Determine what day we're asking about - SPANISH DAYS
  let targetDay = '';
  let showScheduledOption = true;
  let headerText = '';
  let subHeaderText = '';

  if (dayOfWeek === 5) {
    // Friday - asking about TODAY's emergencies only
    targetDay = 'hoy (viernes)';
    showScheduledOption = false;
    headerText = 'Disponibilidad de Emergencia Viernes';
    subHeaderText = '¿Está disponible para llamadas de emergencia hoy?';
  } else if (dayOfWeek === 0) {
    // Sunday - asking about TOMORROW (Monday)
    targetDay = 'mañana (lunes)';
    showScheduledOption = true;
    headerText = 'Disponibilidad Lunes';
    subHeaderText = '¿Está disponible para trabajo programado mañana (lunes) y llamadas de emergencia hoy?';
  } else {
    // Monday-Thursday - asking about TOMORROW's scheduled + TODAY's emergency
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const tomorrowDay = days[(dayOfWeek + 1) % 7];
    const todayDay = days[dayOfWeek];
    targetDay = `mañana (${tomorrowDay})`;
    showScheduledOption = true;
    headerText = `Disponibilidad ${tomorrowDay.charAt(0).toUpperCase() + tomorrowDay.slice(1)}`;
    subHeaderText = `¿Está disponible para trabajo programado mañana (${tomorrowDay}) y llamadas de emergencia hoy (${todayDay})?`;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border-4 border-yellow-500">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">⏰</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isAfter8PM ? '🚨 DISPONIBILIDAD VENCIDA' : headerText}
          </h2>
          <p className="text-gray-300">
            {isAfter8PM 
              ? '¡Debe enviar su disponibilidad para continuar usando la aplicación!'
              : subHeaderText}
          </p>
          <p className="text-sm text-yellow-400 mt-2">
            Fecha límite: 8:00 PM EST
          </p>
        </div>

        <div className="space-y-4 mb-6">
          {showScheduledOption && (
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
                    <div className="font-bold">📅 Trabajo Programado</div>
                    <div className="text-xs opacity-75">Disponible para trabajos planificados {targetDay}</div>
                  </div>
                </div>
              </div>
            </button>
          )}

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
                  <div className="font-bold">🚨 Trabajo de Emergencia</div>
                  <div className="text-xs opacity-75">
                    Disponible para llamadas urgentes HOY
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
                  <div className="font-bold">🚫 No Disponible</div>
                  <div className="text-xs opacity-75">
                    No puedo trabajar {dayOfWeek === 5 ? 'hoy' : 'hoy ni mañana'}
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="bg-blue-900 rounded-lg p-3 mb-4 text-sm text-blue-200">
          <p className="font-semibold mb-1">ℹ️ Reglas de Selección:</p>
          <ul className="text-xs space-y-1 ml-4">
            {showScheduledOption ? (
              <>
                <li>• Seleccione Programado, Emergencia, o ambos</li>
                <li>• O seleccione No Disponible</li>
                <li>• No puede combinar opciones de trabajo con No Disponible</li>
              </>
            ) : (
              <>
                <li>• Seleccione Trabajo de Emergencia si está disponible</li>
                <li>• O seleccione No Disponible</li>
              </>
            )}
          </ul>
        </div>

        <button
          onClick={submitAvailability}
          disabled={saving || (!scheduledWork && !emergencyWork && !notAvailable)}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-4 rounded-lg font-bold text-lg text-white transition"
        >
          {saving ? 'Enviando...' : '✅ Enviar Disponibilidad'}
        </button>

        {isAfter8PM && (
          <div className="mt-4 bg-red-900 rounded-lg p-3 text-center">
            <p className="text-red-200 text-sm font-bold">
              ⚠️ La aplicación está bloqueada hasta que envíe
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
