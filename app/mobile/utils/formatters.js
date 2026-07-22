// mobile/utils/formatters.js
import { getPriorityInfo, extractPriorityCode } from '@/lib/priorityCodes';

export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });
}

export function formatTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  return `${formatDate(dateString)} ${formatTime(dateString)}`;
}

export function calculateAge(dateString) {
  if (!dateString) return 0;
  const enteredDate = new Date(dateString);
  const today = new Date();
  const diffTime = Math.abs(today - enteredDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Canonical badge with emoji + label, e.g. "🚨 P1 · Emergency"
// (single source of truth: lib/priorityCodes).
export function getPriorityBadge(priority) {
  return getPriorityInfo(priority).badge;
}

export function getPriorityColor(priority) {
  const TW = {
    P1: 'text-red-500 font-bold', P2: 'text-orange-500 font-bold', P3: 'text-amber-500 font-bold',
    P4: 'text-yellow-500', P5: 'text-green-500', P6: 'text-gray-400',
    P10: 'text-blue-400', P11: 'text-sky-400', P23: 'text-violet-400',
    emergency: 'text-red-500 font-bold', urgent: 'text-orange-500 font-bold',
    high: 'text-orange-500 font-bold', medium: 'text-yellow-500', low: 'text-green-500',
  };
  const code = extractPriorityCode(priority);
  if (code && TW[code]) return TW[code];
  const lower = (priority || '').toString().trim().toLowerCase();
  return TW[lower] || 'text-gray-400';
}

export function getStatusBadge(status) {
  const statusMap = {
    'pending': '⏳ Pending',
    'assigned': '📋 Assigned',
    'in-progress': '🔧 In Progress',
    'in_progress': '🔧 In Progress',
    'tech_review': '🔍 Tech Review',
    'return_trip': '🔄 Return Trip',
    'completed': '✅ Completed',
    'acknowledged': '👀 Acknowledged'
  };
  return statusMap[status] || status;
}

export function getStatusColor(status) {
  const colorMap = {
    'pending': 'bg-gray-600',
    'assigned': 'bg-blue-600',
    'in-progress': 'bg-orange-600',
    'in_progress': 'bg-orange-600',
    'tech_review': 'bg-yellow-400 text-black font-bold animate-pulse',
    'return_trip': 'bg-orange-600',
    'completed': 'bg-green-600',
    'acknowledged': 'bg-cyan-600'
  };
  return colorMap[status] || 'bg-gray-600';
}