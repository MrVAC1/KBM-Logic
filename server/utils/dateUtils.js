/**
 * Date utility functions for consistent date handling across the application
 */

/**
 * Normalize a date to start of day (00:00:00) in UTC
 * This ensures consistent date comparisons and prevents "off-by-one-day" errors
 * @param {Date|string|number} date - Date to normalize
 * @returns {Date} - Normalized date with time set to 00:00:00 UTC
 */
export function normalizeDate(date) {
  if (!date) {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return now;
  }

  try {
    const normalized = new Date(date);
    // Check if date is valid
    if (isNaN(normalized.getTime())) {
      const now = new Date();
      now.setUTCHours(0, 0, 0, 0);
      return now;
    }
    normalized.setUTCHours(0, 0, 0, 0);
    return normalized;
  } catch (error) {
    // If date parsing fails, return normalized current date
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return now;
  }
}

/**
 * Calculate days difference between two dates
 * @param {Date|string|number} date1 - First date
 * @param {Date|string|number} date2 - Second date
 * @returns {number} - Number of days difference (can be negative)
 */
export function daysDifference(date1, date2) {
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is before or equal to another date (ignoring time)
 * @param {Date|string|number} date1 - First date
 * @param {Date|string|number} date2 - Second date
 * @returns {boolean} - True if date1 <= date2
 */
export function isDateBeforeOrEqual(date1, date2) {
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  return d1.getTime() <= d2.getTime();
}

/**
 * Check if a date is after or equal to another date (ignoring time)
 * @param {Date|string|number} date1 - First date
 * @param {Date|string|number} date2 - Second date
 * @returns {boolean} - True if date1 >= date2
 */
export function isDateAfterOrEqual(date1, date2) {
  const d1 = normalizeDate(date1);
  const d2 = normalizeDate(date2);
  return d1.getTime() >= d2.getTime();
}

/**
 * Get the end of day for a given date (23:59:59.999)
 * This is useful for inclusive date range queries where we want to include
 * all events that happened during the entire day
 * @param {Date|string|number} date - Date to get end of day for
 * @returns {Date} - Date with time set to 23:59:59.999
 */
export function getEndOfDay(date) {
  if (!date) {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return now;
  }

  try {
    const endOfDay = new Date(date);
    // Check if date is valid
    if (isNaN(endOfDay.getTime())) {
      const now = new Date();
      now.setHours(23, 59, 59, 999);
      return now;
    }
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay;
  } catch (error) {
    // If date parsing fails, return end of current day
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    return now;
  }
}

