// app/dashboard/utils/styleHelpers.js

export function getStatusColor(status) {
  const colors = {
    pending: 'bg-gray-600',
    assigned: 'bg-blue-600',
    in_progress: 'bg-yellow-600',
    tech_review: 'bg-purple-600',
    completed: 'bg-green-600'
  };
  return colors[status] || 'bg-gray-600';
}

export function getPriorityColor(priority) {
  const colors = {
    low: 'bg-green-600',
    medium: 'bg-yellow-600',
    high: 'bg-orange-600',
    emergency: 'bg-red-600'
  };
  return colors[priority] || 'bg-gray-600';
}

export function formatDate(dateString) {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount || 0);
}