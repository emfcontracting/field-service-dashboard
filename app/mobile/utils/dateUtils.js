// utils/dateUtils.js - Centralized Date/Time Utilities for EST Timezone
// All date/time operations should use these functions to ensure consistency

/**
 * Get current date in EST timezone as YYYY-MM-DD string
 * This prevents timezone shifts when working with dates
 */
export function getTodayEST() {
  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const year = estTime.getFullYear();
  const month = String(estTime.getMonth() + 1).padStart(2, '0');
  const day = String(estTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current timestamp in EST timezone as ISO string
 * Use this for created_at, updated_at, submitted_at fields
 */
export function getNowEST() {
  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return estTime.toISOString();
}

/**
 * Convert a local date to YYYY-MM-DD string without timezone conversion
 * Use this when getting date from date picker or creating work_date
 */
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD date string as local date (not UTC)
 * This prevents dates from shifting by one day when displayed
 */
export function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  return new Date(
    parseInt(parts[0]), 
    parseInt(parts[1]) - 1, 
    parseInt(parts[2])
  );
}

/**
 * Format date for display in EST timezone
 * @param {string|Date} date - Date to format
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @param {object} options - Intl.DateTimeFormat options
 */
export function formatDateEST(date, locale = 'en-US', options = {}) {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  const defaultOptions = {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  };
  
  return new Intl.DateTimeFormat(locale, defaultOptions).format(dateObj);
}

/**
 * Format datetime for display in EST timezone
 * @param {string|Date} datetime - Datetime to format
 * @param {string} locale - Locale for formatting (default: 'en-US')
 */
export function formatDateTimeEST(datetime, locale = 'en-US') {
  if (!datetime) return 'N/A';
  
  const dateObj = typeof datetime === 'string' ? new Date(datetime) : datetime;
  
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }).format(dateObj);
}

/**
 * Get EST time information for availability checks
 */
export function getESTTimeInfo() {
  const now = new Date();
  const estTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  return {
    hour: estTime.getHours(),
    dayOfWeek: estTime.getDay(), // 0 = Sunday, 6 = Saturday
    date: getLocalDateString(estTime),
    fullDate: estTime
  };
}

/**
 * Check if a date is today in EST
 */
export function isTodayEST(dateStr) {
  const today = getTodayEST();
  return dateStr === today;
}

/**
 * Check if a date is in the future (EST)
 */
export function isFutureDate(dateStr) {
  const inputDate = parseLocalDate(dateStr);
  const today = parseLocalDate(getTodayEST());
  
  // Set both to end of day for comparison
  inputDate.setHours(23, 59, 59, 999);
  today.setHours(23, 59, 59, 999);
  
  return inputDate > today;
}

/**
 * Get max date for date picker (today in EST)
 */
export function getMaxDateForPicker() {
  return getTodayEST();
}

/**
 * Validate that a date string is in YYYY-MM-DD format
 */
export function isValidDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  
  const date = parseLocalDate(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Get date range for filtering (EST)
 * @param {number} days - Number of days to go back
 * @returns {object} - { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 */
export function getDateRangeEST(days) {
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  
  return {
    startDate: getLocalDateString(start),
    endDate: getLocalDateString(end)
  };
}

/**
 * Format duration in hours to readable string
 * @param {number} hours - Total hours
 * @returns {string} - Formatted string like "8.5 hrs" or "8h 30m"
 */
export function formatHours(hours, detailed = false) {
  if (!hours || hours === 0) return '0 hrs';
  
  if (detailed) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  
  return `${hours.toFixed(1)} hrs`;
}

/**
 * Get week start and end dates (EST)
 * @param {Date} date - Reference date (defaults to today)
 * @returns {object} - { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 */
export function getWeekRange(date = new Date()) {
  const estTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dayOfWeek = estTime.getDay();
  
  // Get Sunday of current week
  const start = new Date(estTime);
  start.setDate(estTime.getDate() - dayOfWeek);
  start.setHours(0, 0, 0, 0);
  
  // Get Saturday of current week
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return {
    startDate: getLocalDateString(start),
    endDate: getLocalDateString(end)
  };
}

/**
 * Get month start and end dates (EST)
 * @param {Date} date - Reference date (defaults to today)
 * @returns {object} - { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' }
 */
export function getMonthRange(date = new Date()) {
  const estTime = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  
  // First day of month
  const start = new Date(estTime.getFullYear(), estTime.getMonth(), 1);
  
  // Last day of month
  const end = new Date(estTime.getFullYear(), estTime.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);
  
  return {
    startDate: getLocalDateString(start),
    endDate: getLocalDateString(end)
  };
}
