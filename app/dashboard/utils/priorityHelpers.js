// app/dashboard/utils/priorityHelpers.js

/**
 * Priority badge configurations - supports both P-codes and legacy text values
 */
export const PRIORITY_BADGES = {
  // P-code priorities (new format)
  'P1': { text: '🔴 P1 - Emergency', color: 'bg-red-600', sort: 1 },
  'P2': { text: '🟠 P2 - Urgent', color: 'bg-orange-600', sort: 2 },
  'P3': { text: '🟡 P3 - Urgent (Non-Emerg)', color: 'bg-yellow-600', sort: 3 },
  'P4': { text: '🔵 P4 - Non-Urgent', color: 'bg-blue-600', sort: 4 },
  'P5': { text: '🟢 P5 - Handyman', color: 'bg-green-600', sort: 5 },
  'P6': { text: '🟣 P6 - Tech/Vendor', color: 'bg-purple-600', sort: 6 },
  'P10': { text: '🔷 P10 - PM', color: 'bg-cyan-600', sort: 10 },
  'P11': { text: '💎 P11 - PM Compliance', color: 'bg-indigo-600', sort: 11 },
  'P23': { text: '💬 P23 - Complaints', color: 'bg-pink-600', sort: 23 },
  
  // Legacy text-based priorities (for backward compatibility)
  'emergency': { text: '🔴 P1 - Emergency', color: 'bg-red-600', sort: 1 },
  'high': { text: '🟠 P2 - High', color: 'bg-orange-600', sort: 2 },
  'medium': { text: '🟡 P3 - Medium', color: 'bg-yellow-600', sort: 3 },
  'low': { text: '🔵 P4 - Low', color: 'bg-blue-600', sort: 4 }
};

/**
 * Get priority badge configuration
 * Handles both P-codes (P1, P2, etc.) and legacy text values (emergency, high, medium, low)
 */
export const getPriorityBadge = (priority) => {
  // Handle null/undefined
  if (!priority) {
    return { text: '⚪ — Unknown', color: 'bg-gray-600', sort: 999 };
  }
  
  // Normalize priority string
  const normalizedPriority = String(priority).trim();
  
  // Check exact match first
  if (PRIORITY_BADGES[normalizedPriority]) {
    return PRIORITY_BADGES[normalizedPriority];
  }
  
  // Check lowercase match (for legacy text values)
  const lowerPriority = normalizedPriority.toLowerCase();
  if (PRIORITY_BADGES[lowerPriority]) {
    return PRIORITY_BADGES[lowerPriority];
  }
  
  // Default fallback with proper formatting
  return { 
    text: `⚪ — ${normalizedPriority}`, 
    color: 'bg-gray-600', 
    sort: 999 
  };
};

/**
 * Get all priority options for dropdowns
 * Returns only P-code options (not legacy text values)
 */
export const getPriorityOptions = () => {
  return ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P10', 'P11', 'P23'].map(key => ({
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
  
  // Check for P-code pattern (P followed by number)
  const pCodeMatch = str.match(/P(\d+)/);
  if (pCodeMatch) {
    const pCode = `P${pCodeMatch[1]}`;
    if (PRIORITY_BADGES[pCode]) {
      return pCode;
    }
  }
  
  // Legacy text-based priorities
  if (str.includes('EMERGENCY')) return 'P1';
  if (str.includes('URGENT') && !str.includes('NON')) return 'P2';
  if (str.includes('URGENT') && str.includes('NON')) return 'P3';
  if (str.includes('HIGH')) return 'P2';
  if (str.includes('MEDIUM')) return 'P3';
  if (str.includes('LOW')) return 'P4';
  if (str.includes('HANDYMAN')) return 'P5';
  if (str.includes('VENDOR') || str.includes('TECH')) return 'P6';
  if (str.includes('PM') && str.includes('COMPLIANCE')) return 'P11';
  if (str.includes('PM')) return 'P10';
  if (str.includes('COMPLAINT')) return 'P23';
  
  // Default
  return 'P4';
};
