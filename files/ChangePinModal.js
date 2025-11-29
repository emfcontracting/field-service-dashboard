// components/ChangePinModal.js

export default function ChangePinModal({
  showChangePinModal,
  setShowChangePinModal,
  newPin,
  setNewPin,
  confirmPin,
  setConfirmPin,
  handleChangePin,
  saving
}) {
  if (!showChangePinModal) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">Change PIN</h3>
          <button
            onClick={() => {
              setShowChangePinModal(false);
              setNewPin('');
              setConfirmPin('');
            }}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="4"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="4-digit PIN"
              className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="4"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="Re-enter PIN"
              className="w-full px-4 py-3 text-lg text-white bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleChangePin}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold transition active:scale-95 disabled:bg-gray-600"
          >
            {saving ? 'Changing...' : 'Change PIN'}
          </button>
        </div>
      </div>
    </div>
  );
}
