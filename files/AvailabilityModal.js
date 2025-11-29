// components/AvailabilityModal.js

export default function AvailabilityModal({ 
  showAvailabilityModal,
  availabilityBlocked,
  scheduledWork,
  emergencyWork,
  notAvailable,
  saving,
  handleAvailabilityChange,
  handleAvailabilitySubmit
}) {
  if (!showAvailabilityModal) return null;

  const estNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = estNow.getHours();
  const dayOfWeek = estNow.getDay();
  const isAfter8PM = hour >= 20;

  // Determine what day we're asking about
  let targetDay = '';
  let showScheduledOption = true;
  let headerText = '';
  let subHeaderText = '';

  if (dayOfWeek === 5) {
    // Friday - asking about TODAY's emergencies only
    targetDay = 'today (Friday)';
    showScheduledOption = false;
    headerText = 'Friday Emergency Availability';
    subHeaderText = 'Are you available for emergency calls today?';
  } else if (dayOfWeek === 0) {
    // Sunday - asking about TOMORROW (Monday)
    targetDay = 'tomorrow (Monday)';
    showScheduledOption = true;
    headerText = 'Monday Availability';
    subHeaderText = 'Are you available for scheduled work tomorrow (Monday) and emergency calls today?';
  } else {
    // Monday-Thursday - asking about TOMORROW's scheduled + TODAY's emergency
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const tomorrowDay = days[(dayOfWeek + 1) % 7];
    const todayDay = days[dayOfWeek];
    targetDay = `tomorrow (${tomorrowDay})`;
    showScheduledOption = true;
    headerText = `${tomorrowDay} Availability`;
    subHeaderText = `Are you available for scheduled work tomorrow (${tomorrowDay}) and emergency calls today (${todayDay})?`;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-2xl p-6 max-w-md w-full border-4 border-yellow-500">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">⏰</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isAfter8PM ? '🚨 AVAILABILITY OVERDUE' : headerText}
          </h2>
          <p className="text-gray-300">
            {isAfter8PM 
              ? 'You must submit your availability to continue using the app!'
              : subHeaderText}
          </p>
          <p className="text-sm text-yellow-400 mt-2">
            Deadline: 8:00 PM EST
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
                    <div className="font-bold">📅 Scheduled Work</div>
                    <div className="text-xs opacity-75">Available for planned jobs {targetDay}</div>
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
                  <div className="font-bold">🚨 Emergency Work</div>
                  <div className="text-xs opacity-75">
                    Available for urgent calls TODAY
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
                  <div className="font-bold">🚫 Not Available</div>
                  <div className="text-xs opacity-75">
                    Cannot work {dayOfWeek === 5 ? 'today' : 'today or tomorrow'}
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="bg-blue-900 rounded-lg p-3 mb-4 text-sm text-blue-200">
          <p className="font-semibold mb-1">ℹ️ Selection Rules:</p>
          <ul className="text-xs space-y-1 ml-4">
            {showScheduledOption ? (
              <>
                <li>• Select Scheduled, Emergency, or both</li>
                <li>• OR select Not Available</li>
                <li>• Cannot combine work options with Not Available</li>
              </>
            ) : (
              <>
                <li>• Select Emergency Work if available</li>
                <li>• OR select Not Available</li>
              </>
            )}
          </ul>
        </div>

        <button
          onClick={handleAvailabilitySubmit}
          disabled={saving || (!scheduledWork && !emergencyWork && !notAvailable)}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-4 rounded-lg font-bold text-lg text-white transition"
        >
          {saving ? 'Submitting...' : '✅ Submit Availability'}
        </button>

        {isAfter8PM && (
          <div className="mt-4 bg-red-900 rounded-lg p-3 text-center">
            <p className="text-red-200 text-sm font-bold">
              ⚠️ App is locked until you submit
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
