// mobile/components/AvailabilityModal.js
'use client';

import { useState } from 'react';

export default function AvailabilityModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  saving 
}) {
  const [scheduledWork, setScheduledWork] = useState(false);
  const [emergencyWork, setEmergencyWork] = useState(false);
  const [notAvailable, setNotAvailable] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = () => {
    onSubmit({ scheduledWork, emergencyWork, notAvailable });
    setScheduledWork(false);
    setEmergencyWork(false);
    setNotAvailable(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Tomorrow's Availability</h2>
        <p className="text-sm text-gray-400 mb-4">
          Select all that apply for tomorrow:
        </p>
        
        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-650">
            <input
              type="checkbox"
              checked={scheduledWork}
              onChange={(e) => setScheduledWork(e.target.checked)}
              className="w-5 h-5"
              disabled={saving}
            />
            <div>
              <div className="font-semibold">📅 Scheduled Work</div>
              <div className="text-xs text-gray-400">I have scheduled jobs tomorrow</div>
            </div>
          </label>
          
          <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-650">
            <input
              type="checkbox"
              checked={emergencyWork}
              onChange={(e) => setEmergencyWork(e.target.checked)}
              className="w-5 h-5"
              disabled={saving}
            />
            <div>
              <div className="font-semibold">🚨 Emergency Work</div>
              <div className="text-xs text-gray-400">Available for emergencies</div>
            </div>
          </label>
          
          <label className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-650">
            <input
              type="checkbox"
              checked={notAvailable}
              onChange={(e) => setNotAvailable(e.target.checked)}
              className="w-5 h-5"
              disabled={saving}
            />
            <div>
              <div className="font-semibold">❌ Not Available</div>
              <div className="text-xs text-gray-400">I will not be available tomorrow</div>
            </div>
          </label>
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
            disabled={saving}
            className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded-lg font-semibold disabled:bg-gray-600"
          >
            {saving ? 'Submitting...' : 'Submit Availability'}
          </button>
        </div>
      </div>
    </div>
  );
}