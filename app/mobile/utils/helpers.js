// Helper Functions and Utilities
import { fmtDateMed, fmtET, daysBetweenET } from '@/lib/dates';
import { getPriorityInfo, extractPriorityCode } from '@/lib/priorityCodes';

// DATE columns ('YYYY-MM-DD') and tz-less timestamps go through lib/dates —
// `new Date('2026-09-05')` showed Sep 4 to a technician in Eastern time.
export function formatDate(dateString) {
  return fmtDateMed(dateString, 'N/A');
}

export function formatDateTime(dateString) {
  return fmtET(dateString, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }, 'N/A');
}

export function calculateAge(dateString) {
  if (!dateString) return 0;
  return Math.abs(daysBetweenET(dateString) ?? 0);
}

export function getPriorityColor(priority) {
  const TW = {
    P1: 'text-red-500', P2: 'text-orange-500', P3: 'text-amber-500', P4: 'text-yellow-500',
    P5: 'text-green-500', P6: 'text-gray-400', P7: 'text-sky-300', P10: 'text-blue-400', P11: 'text-sky-400', P23: 'text-violet-400',
    emergency: 'text-red-500', urgent: 'text-orange-500', high: 'text-orange-500', medium: 'text-yellow-500', low: 'text-green-500',
  };
  const code = extractPriorityCode(priority);
  if (code && TW[code]) return TW[code];
  const lower = (priority || '').toString().trim().toLowerCase();
  return TW[lower] || 'text-gray-500';
}

// Canonical label, e.g. "P1 · Emergency" (single source of truth: lib/priorityCodes).
export function getPriorityBadge(priority) {
  return getPriorityInfo(priority).label;
}

export function getStatusBadge(status) {
  const statusMap = {
    'new': '🆕 New',
    'assigned': '📋 Assigned',
    'in_progress': '🔄 In Progress',
    'completed': '✅ Completed',
    'on_hold': '⏸️ On Hold',
    'tech_review': '🔍 Tech Review',
    'return_trip': '🔁 Return Trip',
    'rejected': '❌ Rejected',
    'missing_data': '🚩 MISSING DATA',
    'update_required': '🔵 UPDATE REQUIRED'
  };
  return statusMap[status] || status;
}

export function formatCurrency(amount) {
  return `$${(amount || 0).toFixed(2)}`;
}
