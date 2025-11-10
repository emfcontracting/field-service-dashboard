// app/mobile/components/PrimaryTechFieldData.js
'use client';

import { useState } from 'react';

export default function PrimaryTechFieldData({ workOrder, onUpdate, saving }) {
  const [isEditing, setIsEditing] = useState(false);
  const [localData, setLocalData] = useState({
    hours_regular: workOrder?.hours_regular || 0,
    hours_overtime: workOrder?.hours_overtime || 0,
    miles: workOrder?.miles || 0
  });

  const handleSave = async () => {
    // Update each field that changed
    if (localData.hours_regular !== workOrder?.hours_regular) {
      await onUpdate('hours_regular', parseFloat(localData.hours_regular));
    }
    if (localData.hours_overtime !== workOrder?.hours_overtime) {
      await onUpdate('hours_overtime', parseFloat(localData.hours_overtime));
    }
    if (localData.miles !== workOrder?.miles) {
      await onUpdate('miles', parseFloat(localData.miles));
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setLocalData({
      hours_regular: workOrder?.hours_regular || 0,
      hours_overtime: workOrder?.hours_overtime || 0,
      miles: workOrder?.miles || 0
    });
    setIsEditing(false);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold text-white">⏱️ Field Data</h3>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm text-white"
          >
            Edit
          </button>
        ) : null}
      </div>

      {isEditing ? (
        // Edit Mode
        <div className="space-y-3">
          {/* Regular Hours */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Regular Hours
            </label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={localData.hours_regular}
              onChange={(e) => setLocalData({
                ...localData,
                hours_regular: e.target.value
              })}
              className="w-full px-3 py-2 bg-gray-700 rounded text-white"
              disabled={saving}
            />
          </div>

          {/* Overtime Hours */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Overtime Hours
            </label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={localData.hours_overtime}
              onChange={(e) => setLocalData({
                ...localData,
                hours_overtime: e.target.value
              })}
              className="w-full px-3 py-2 bg-gray-700 rounded text-white"
              disabled={saving}
            />
          </div>

          {/* Mileage */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Mileage
            </label>
            <input
              type="number"
              step="1"
              min="0"
              value={localData.miles}
              onChange={(e) => setLocalData({
                ...localData,
                miles: e.target.value
              })}
              className="w-full px-3 py-2 bg-gray-700 rounded text-white"
              disabled={saving}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded font-semibold text-white disabled:bg-gray-600"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        // View Mode
        <div className="space-y-2">
          {/* Regular Hours Display */}
          <div className="bg-gray-700 rounded p-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Regular Hours</span>
              <span className="text-white font-semibold">
                {(workOrder?.hours_regular || 0).toFixed(2)} hrs
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              @ $64/hr = ${((workOrder?.hours_regular || 0) * 64).toFixed(2)}
            </div>
          </div>

          {/* Overtime Hours Display */}
          <div className="bg-gray-700 rounded p-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Overtime Hours</span>
              <span className="text-white font-semibold">
                {(workOrder?.hours_overtime || 0).toFixed(2)} hrs
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              @ $96/hr = ${((workOrder?.hours_overtime || 0) * 96).toFixed(2)}
            </div>
          </div>

          {/* Mileage Display */}
          <div className="bg-gray-700 rounded p-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-sm">Mileage</span>
              <span className="text-white font-semibold">
                {(workOrder?.miles || 0).toFixed(0)} miles
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              @ $1.00/mile = ${((workOrder?.miles || 0) * 1.00).toFixed(2)}
            </div>
          </div>

          {/* Total Display */}
          <div className="bg-blue-900 rounded p-3 mt-3">
            <div className="flex justify-between items-center">
              <span className="text-blue-200 font-semibold">Total (Labor + Mileage)</span>
              <span className="text-white font-bold text-lg">
                ${(
                  ((workOrder?.hours_regular || 0) * 64) +
                  ((workOrder?.hours_overtime || 0) * 96) +
                  ((workOrder?.miles || 0) * 1.00)
                ).toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        Enter your time and mileage for this work order
      </div>
    </div>
  );
}