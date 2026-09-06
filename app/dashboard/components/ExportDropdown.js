// app/dashboard/components/ExportDropdown.js
'use client';

import { useState } from 'react';
import { 
  exportActiveWorkOrders, 
  exportCompletedWorkOrders, 
  exportAllWorkOrders,
  exportCostDetailCSV
} from '../utils/exportHelpers';

export default function ExportDropdown({ workOrders, supabase }) {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async (type) => {
    setIsOpen(false);
    
    switch(type) {
      case 'active':
        exportActiveWorkOrders(workOrders);
        break;
      case 'completed':
        exportCompletedWorkOrders(workOrders);
        break;
      case 'all':
        exportAllWorkOrders(workOrders);
        break;
      case 'cost_detail':
        if (!supabase) {
          alert('Unable to export cost detail. Please try again.');
          return;
        }
        setExporting(true);
        try {
          await exportCostDetailCSV(supabase, workOrders);
        } finally {
          setExporting(false);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={exporting}
        className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 px-4 py-2 rounded-lg font-semibold transition flex items-center gap-2"
      >
        {exporting ? '⏳ Exporting...' : '📊 Export'}
        <svg 
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute right-0 mt-2 w-72 bg-[#0d0d14] rounded-lg shadow-xl border border-[#2d2d44] z-20">
            <div className="py-2">
              <button
                onClick={() => handleExport('active')}
                className="w-full text-left px-4 py-3 hover:bg-[#1e1e2e] transition text-white flex items-center gap-3"
              >
                <span className="text-2xl">📋</span>
                <div>
                  <div className="font-semibold">Export Active</div>
                  <div className="text-xs text-slate-400">Pending, Assigned, In Progress</div>
                </div>
              </button>

              <button
                onClick={() => handleExport('completed')}
                className="w-full text-left px-4 py-3 hover:bg-[#1e1e2e] transition text-white flex items-center gap-3"
              >
                <span className="text-2xl">✅</span>
                <div>
                  <div className="font-semibold">Export Completed</div>
                  <div className="text-xs text-slate-400">Finished & Locked Orders</div>
                </div>
              </button>

              <div className="border-t border-[#2d2d44] my-1"></div>

              <button
                onClick={() => handleExport('all')}
                className="w-full text-left px-4 py-3 hover:bg-[#1e1e2e] transition text-white flex items-center gap-3"
              >
                <span className="text-2xl">📊</span>
                <div>
                  <div className="font-semibold">Export All</div>
                  <div className="text-xs text-slate-400">All Work Orders</div>
                </div>
              </button>

              <div className="border-t border-[#2d2d44] my-1"></div>

              <button
                onClick={() => handleExport('cost_detail')}
                className="w-full text-left px-4 py-3 hover:bg-[#1e1e2e] transition text-white flex items-center gap-3"
              >
                <span className="text-2xl">💰</span>
                <div>
                  <div className="font-semibold text-green-400">Cost Detail Report</div>
                  <div className="text-xs text-slate-400">Per-tech hours, mileage & all costs with totals</div>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
