import { ScrapeStatusBadge } from './StatusBadge';
import { formatDuration, formatFullTimestamp as formatTimestamp } from '../utils/formatters';

export function ScrapeLogsTable({ logs = [], isInitialPolling = false }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="table-container" style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {isInitialPolling ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
              Scraper is currently executing — audit logs will appear here once complete.
            </span>
          ) : (
            'No scrape attempts logged yet.'
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="dense-table" aria-label="Scrape History Logs">
        <thead>
          <tr>
            <th style={{ width: '210px' }}>Timestamp</th>
            <th style={{ width: '120px' }}>Status</th>
            <th>Detail</th>
            <th style={{ width: '110px', textAlign: 'right' }}>Duration</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, index) => {
            const isFailed = (log.status || '').toLowerCase() === 'failed';
            return (
              <tr
                key={log.id || index}
                className={isFailed ? 'row-failed' : ''}
              >
                <td className="timestamp-cell">
                  {formatTimestamp(log.attempt_at)}
                </td>
                <td>
                  <ScrapeStatusBadge status={log.status} />
                </td>
                <td className="detail-cell" style={{ wordBreak: 'break-word' }}>
                  {log.detail || '—'}
                </td>
                <td className="duration-cell" style={{ textAlign: 'right' }}>
                  {formatDuration(log.duration_ms)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
