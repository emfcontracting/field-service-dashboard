// helpers.js - All helper and utility functions

import { PRIORITY_LABELS } from './constants';

// Date and Time Functions
export function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatDateTime(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function calculateAge(dateEntered) {
  if (!dateEntered) return 0;
  const entered = new Date(dateEntered);
  const today = new Date();
  const diffTime = Math.abs(today - entered);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Status and Priority Functions
export function getPriorityBadge(priority) {
  return PRIORITY_LABELS[priority] || priority;
}

export function getPriorityColor(priority) {
  const p = priority?.toLowerCase();
  if (p === 'p1') return 'text-red-500 font-bold';
  if (p === 'p2') return 'text-orange-500 font-semibold';
  if (p === 'p3') return 'text-yellow-500';
  return 'text-gray-400';
}

export function getStatusBadge(status) {
  if (status === 'pending') return '⏳ Pending';
  if (status === 'in_progress') return '🔄 In Progress';
  if (status === 'completed') return '✅ Completed';
  return status;
}

export function getStatusColor(status) {
  if (status === 'pending') return 'text-yellow-500';
  if (status === 'in_progress') return 'text-blue-500';
  if (status === 'completed') return 'text-green-500';
  return 'text-gray-500';
}

// Validation Functions
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPin(pin) {
  return /^\d{4}$/.test(pin);
}

// Array and Object Helpers
export function sortByField(array, field, descending = false) {
  return [...array].sort((a, b) => {
    if (a[field] < b[field]) return descending ? 1 : -1;
    if (a[field] > b[field]) return descending ? -1 : 1;
    return 0;
  });
}

export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) result[group] = [];
    result[group].push(item);
    return result;
  }, {});
}
