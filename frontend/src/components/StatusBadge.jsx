/**
 * StatusBadge component
 * Visually distinguishes status values with high contrast, honest indicators.
 */
export function ScrapeStatusBadge({ status }) {
  const normalized = (status || '').toLowerCase();

  let className = 'badge-neutral';
  let label = status || 'unknown';

  if (normalized === 'success') {
    className = 'badge-success';
    label = 'Success';
  } else if (normalized === 'retried') {
    className = 'badge-retried';
    label = 'Retried';
  } else if (normalized === 'failed') {
    className = 'badge-failed';
    label = 'Failed';
  }

  return (
    <span className={`status-badge ${className}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}

export function StockStatusBadge({ status }) {
  const normalized = (status || '').toLowerCase().replace(/[-_]/g, ' ');

  let className = 'badge-neutral';
  let label = status || 'Unknown';

  if (normalized.includes('in stock') || normalized === 'available') {
    className = 'badge-success';
    label = 'In Stock';
  } else if (normalized.includes('out') || normalized.includes('unavailable')) {
    className = 'badge-failed';
    label = 'Out of Stock';
  } else if (normalized.includes('low') || normalized.includes('limited') || /\b\d+\s+left\b/.test(normalized) || normalized.includes('only')) {
    className = 'badge-retried';
    label = status || 'Low Stock';
  }

  return (
    <span className={`status-badge ${className}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}
