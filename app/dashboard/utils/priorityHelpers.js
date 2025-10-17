// app/dashboard/utils/priorityHelpers.js

/**
 * Priority badge configurations
 */
export const PRIORITY_BADGES = {
  'P1': { text: '🔴 P1 - Emergency', color: 'bg-red-600', sort: 1 },
  'P2': { text: '🟠 P2 - Urgent', color: 'bg-orange-600', sort: 2 },
  'P3': { text: '🟡 P3 - Urgent (Non-Emerg)', color: 'bg-yellow-600', sort: 3 },
  'P4': { text: '🔵 P4 - Non-Urgent', color: 'bg-blue-600', sort: 4 },
  'P5': { text: '🟢 P5 - Handyman', color: 'bg-green-600', sort: 5 },
  'P6': { text: '🟣 P6 - Tech/Vendor', color: 'bg-purple-600', sort: 6 },
  'P10': { text: '🔷 P10 - PM', color: 'bg-cyan-600', sort: 10 },
  'P11': { text: '💎 P11 - PM Compliance', color: 'bg-indigo-600', sort: 11 },
  'P23': { text: '💬 P23 - Complaints', color: 'bg-pink-600', sort: 23 }
};

/**
 * Get priority badge configuration
 */
export const getPriorityBadge = (priority) => {
  return PRIORITY_BADGES[priority] || { 
    text: priority, 
    color: 'bg-gray-600', 
    sort: 999 
  };
};

/**
 * Get all priority options for dropdowns
 */
export const getPriorityOptions = () => {
  return Object.keys(PRIORITY_BADGES).map(key => ({
    value: key,
    label: PRIORITY_BADGES[key].text,
    color: PRIORITY_BADGES[key].color
  }));
};

/**
 * Parse priority from import string
 */
export const parsePriorityFromImport = (priorityStr) => {
  const str = String(priorityStr || '').toUpperCase().trim();
  
  // Direct P-code matches
  if (PRIORITY_BADGES[str]) {
    return str;
  }
  
  // Legacy text-based priorities
  if (str.includes('EMERGENCY')) return 'P1';
  if (str.includes('URGENT') && !str.includes('NON')) return 'P2';
  if (str.includes('URGENT') && str.includes('NON')) return 'P3';
  if (str.includes('HANDYMAN')) return 'P5';
  if (str.includes('VENDOR') || str.includes('TECH')) return 'P6';
  if (str.includes('PM') && str.includes('COMPLIANCE')) return 'P11';
  if (str.includes('PM')) return 'P10';
  if (str.includes('COMPLAINT')) return 'P23';
  
  // Default
  return 'P4';
};