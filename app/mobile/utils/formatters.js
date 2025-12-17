// mobile/utils/formatters.js

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

export function getPriorityBadge(priority) {
  const priorityMap = {
    'P1': '🚨 P1',
    'P2': '⚡ P2',
    'P3': '🔥 P3',
    'P4': '📢 P4',
    'P5': '⚠️ P5',
    'P6': '🟠 P6',
    'P7': '🔶 P7',
    'P8': '🟡 P8',
    'P9': '🟢 P9',
    'P10': '🔵 P10',
    'P11': '🟣 P11',
    'P12': '⚪ P12',
    'P13': '⚫ P13',
    'P14': '🟤 P14',
    'P15': '🔘 P15',
    'P16': '💠 P16',
    'P17': '🔷 P17',
    'P18': '🔹 P18',
    'P19': '🔸 P19',
    'P20': '🔶 P20',
    'P21': '🟨 P21',
    'P22': '🟩 P22',
    'P23': '🟦 P23',
    'high': '🔴 HIGH',
    'medium': '🟡 MEDIUM',
    'low': '🟢 LOW'
  };
  return priorityMap[priority] || '⚪ NORMAL';
}

export function getPriorityColor(priority) {
  const colorMap = {
    'P1': 'text-red-500 font-bold',
    'P2': 'text-red-400 font-bold',
    'P3': 'text-orange-500 font-bold',
    'P4': 'text-orange-400',
    'P5': 'text-yellow-500',
    'P6': 'text-yellow-400',
    'P7': 'text-yellow-300',
    'P8': 'text-green-300',
    'P9': 'text-green-400',
    'P10': 'text-blue-300',
    'P11': 'text-blue-400',
    'P12': 'text-purple-300',
    'P13': 'text-purple-400',
    'P14': 'text-gray-400',
    'P15': 'text-gray-300',
    'P16': 'text-cyan-300',
    'P17': 'text-cyan-400',
    'P18': 'text-indigo-300',
    'P19': 'text-indigo-400',
    'P20': 'text-pink-300',
    'P21': 'text-pink-400',
    'P22': 'text-teal-300',
    'P23': 'text-teal-400',
    'high': 'text-red-500 font-bold',
    'medium': 'text-yellow-500',
    'low': 'text-green-500'
  };
  return colorMap[priority] || 'text-gray-400';
}

export function getStatusBadge(status) {
  const statusMap = {
    'pending': '⏳ Pending',
    'assigned': '📋 Assigned',
    'in-progress': '🔧 In Progress',
    'in_progress': '🔧 In Progress',
    'tech_review': '🔍 Tech Review',
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
    'tech_review': 'bg-purple-600',
    'completed': 'bg-green-600',
    'acknowledged': 'bg-cyan-600'
  };
  return colorMap[status] || 'bg-gray-600';
}