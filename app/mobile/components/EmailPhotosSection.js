// app/mobile/components/EmailPhotosSection.js
'use client';

export default function EmailPhotosSection({ workOrder, currentUser }) {
  // Simple placeholder for now - full photo functionality can be added later
  // This component exists so WorkOrderDetail doesn't error on import
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <h3 className="font-bold text-white mb-3">📧 Email Photos</h3>
      
      <div className="bg-gray-700 rounded p-3 text-center">
        <p className="text-gray-400 text-sm mb-2">
          Photo email functionality coming soon
        </p>
        <p className="text-xs text-gray-500">
          For now, photos can be added through the main dashboard
        </p>
      </div>
    </div>
  );
}