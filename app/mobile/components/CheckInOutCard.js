// mobile/components/CheckInOutCard.js
'use client';

import { formatTimeForDisplay, calculateElapsedTime } from '../utils/timeTracking';

export default function CheckInOutCard({ 
  workOrder, 
  onCheckIn, 
  onCheckOut, 
  saving 
}) {
  const { time_in, time_out, status } = workOrder;
  const isWorking = time_in && !time_out;

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="font-bold mb-3">⏱️ Time Tracking</h3>
      
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Check In:</span>
          <span className={time_in ? 'text-green-500 font-semibold' : 'text-gray-500'}>
            {formatTimeForDisplay(time_in)}
          </span>
        </div>
        
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Check Out:</span>
          <span className={time_out ? 'text-red-500 font-semibold' : 'text-gray-500'}>
            {formatTimeForDisplay(time_out)}
          </span>
        </div>
        
        {isWorking && (
          <div className="bg-blue-900 rounded p-2 text-center">
            <span className="text-sm text-blue-200">
              Elapsed: {calculateElapsedTime(time_in)}
            </span>
          </div>
        )}
      </div>

      {!time_in ? (
        <button
          onClick={onCheckIn}
          disabled={saving}
          className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-lg font-bold transition active:scale-95 disabled:bg-gray-600"
        >
          🟢 Check In
        </button>
      ) : !time_out ? (
        <button
          onClick={onCheckOut}
          disabled={saving}
          className="w-full bg-red-600 hover:bg-red-700 py-3 rounded-lg font-bold transition active:scale-95 disabled:bg-gray-600"
        >
          🔴 Check Out
        </button>
      ) : (
        <div className="bg-gray-700 rounded-lg p-3 text-center text-sm text-gray-400">
          Time tracking complete
        </div>
      )}
    </div>
  );
}