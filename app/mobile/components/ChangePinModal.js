// mobile/components/ChangePinModal.js
'use client';

import { useState } from 'react';

export default function ChangePinModal({ isOpen, onClose, onSubmit, saving }) {
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit(newPin, confirmPin);
    setNewPin('');
    setConfirmPin('');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Change PIN</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2">New PIN</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="4"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4-digit PIN"
              className="w-full px-4 py-2 bg-gray-700 rounded-lg"
              disabled={saving}
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold mb-2">Confirm PIN</label>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength="4"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Confirm 4-digit PIN"
              className="w-full px-4 py-2 bg-gray-700 rounded-lg"
              disabled={saving}
            />
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || !newPin || !confirmPin}
              className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold disabled:bg-gray-600"
            >
              {saving ? 'Changing...' : 'Change PIN'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}