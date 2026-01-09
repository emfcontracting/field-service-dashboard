// app/dashboard/utils/dateUtils.js - Centralized Date/Time Utilities for EST Timezone
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
 * This properly handles UTC dates and displays them correctly in EST
 * @param {string|Date} date - Date to format
 * @param {string} locale - Locale for formatting (default: 'en-US')
 * @param {object} options - Intl.DateTimeFormat options
 */
export function formatDateEST(date, locale = 'en-US', options = {}) {
  if (!date) return 'N/A';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (isNaN(dateObj.getTime())) return 'Invalid';
  if (dateObj.getFullYear() < 2000) return 'Invalid';
  
  const defaultOptions = {
    timeZone: 'America/New_York',
    year: '2-digit',
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
  
  if (isNaN(dateObj.getTime())) return 'Invalid';
  
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'America/New_York',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(dateObj);
}

/**
 * Format date for display - short format (MM/DD/YY)
 * @param {string|Date} date - Date to format
 */
export function formatDateShort(date) {
  return formatDateEST(date, 'en-US', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format date for display - long format (January 7, 2026)
 * @param {string|Date} date - Date to format
 */
export function formatDateLong(date) {
  return formatDateEST(date, 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
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
