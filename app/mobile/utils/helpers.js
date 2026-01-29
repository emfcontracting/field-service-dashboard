// Helper Functions and Utilities

export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function calculateAge(dateString) {
  if (!dateString) return 0;
  const entered = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - entered);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function getPriorityColor(priority) {
  const priorityMap = {
    'P1': 'text-red-500',
    'P2': 'text-orange-500',
    'P3': 'text-yellow-500',
    'P4': 'text-blue-500',
    'P5': 'text-green-500'
  };
  return priorityMap[priority] || 'text-gray-500';
}

export function getPriorityBadge(priority) {
  return priority || 'N/A';
}

export function getStatusBadge(status) {
  const statusMap = {
    'new': '🆕 New',
    'assigned': '📋 Assigned',
    'in_progress': '🔄 In Progress',
    'completed': '✅ Completed',
    'on_hold': '⏸️ On Hold',
    'needs_return': '🔁 Needs Return',
    'return_trip': '🔁 Return Trip',
    'tech_review': '⚠️ REVIEW NEEDED'
  };
  return statusMap[status] || status;
}

export function formatCurrency(amount) {
  return `$${(amount || 0).toFixed(2)}`;
}
