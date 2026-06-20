/**
 * Shared formatting utilities for dates, timestamps, and durations
 */

/**
 * Formats duration in milliseconds to human-readable format (e.g. "1.45s" or "350ms")
 * @param {number|null|undefined} ms
 * @returns {string}
 */
export function formatDuration(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

/**
 * Short date and time for chart X-axis (e.g. "Oct 24, 02:30 PM")
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatShortDateTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Full detailed timestamp for audit tables (e.g. "Oct 24, 2026, 02:30:15 PM")
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatFullTimestamp(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Date with year for dashboard table (e.g. "Oct 24, 2026")
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatDateWithYear(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Standard date string format (e.g. "10/24/2026")
 * @param {string|Date} dateStr
 * @returns {string}
 */
export function formatDateOnly(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString();
}
