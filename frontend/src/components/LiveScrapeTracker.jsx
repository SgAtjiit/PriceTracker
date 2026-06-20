import React from 'react';
import { formatDuration } from '../utils/formatters';

export function LiveScrapeTracker({
  currentAttempt = 1,
  maxAttempts = 3,
  attempts = [],
  nextRetryDelay = 0,
  isComplete = false,
  success = null,
  error = null,
  finalPrice = null,
  finalStock = null,
}) {
  const steps = Array.from({ length: maxAttempts }, (_, i) => i + 1);

  // Derive status text
  let statusBannerText = '';
  if (isComplete) {
    if (success) {
      statusBannerText = `Price check succeeded! Live price extracted: ₹${finalPrice ? Number(finalPrice).toFixed(2) : '—'}${finalStock ? ` (${finalStock})` : ''}`;
    } else {
      statusBannerText = `All ${maxAttempts} scrape attempts completed without extracting price: ${error || 'Scrape failed'}`;
    }
  } else if (nextRetryDelay > 0) {
    statusBannerText = `Attempt ${currentAttempt - 1 || 1} failed. Backing off with retry in ${nextRetryDelay}s before Attempt ${currentAttempt}...`;
  } else {
    statusBannerText = `Attempt ${currentAttempt} of ${maxAttempts} in progress — running Playwright headless browser...`;
  }

  return (
    <div
      className="live-scrape-tracker"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--primary-border)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.75rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {!isComplete && (
            <span
              className="spinner"
              style={{
                width: '18px',
                height: '18px',
                borderWidth: '2.5px',
                borderColor: 'var(--primary)',
                borderTopColor: 'transparent',
              }}
            />
          )}
          {isComplete && success && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: 'var(--status-success-bg, #dcfce7)',
                color: 'var(--status-success-text, #15803d)',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              ✓
            </span>
          )}
          {isComplete && !success && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: 'var(--status-failed-bg, #fee2e2)',
                color: 'var(--status-failed-text, #b91c1c)',
                fontSize: '13px',
                fontWeight: 'bold',
              }}
            >
              ✕
            </span>
          )}
          <div>
            <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {isComplete
                ? success
                  ? 'Price Scrape Succeeded'
                  : 'Price Scrape Unsuccessful'
                : 'Live Scraper Execution in Progress'}
            </h4>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {statusBannerText}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            padding: '0.25rem 0.6rem',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: isComplete ? 'var(--bg-surface-subtle)' : 'var(--primary-subtle)',
            color: isComplete ? 'var(--text-muted)' : 'var(--primary)',
            fontWeight: 600,
          }}
        >
          {isComplete
            ? 'STREAM CLOSED'
            : nextRetryDelay > 0
            ? `WAITING ${nextRetryDelay}S...`
            : `RUNNING ATTEMPT ${currentAttempt}/${maxAttempts}`}
        </div>
      </div>

      {/* 3-Step Visual Attempt Progress Indicator */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${maxAttempts}, 1fr)`,
          gap: '0.75rem',
          marginBottom: '1.25rem',
        }}
      >
        {steps.map((stepNum) => {
          const pastAttempt = attempts.find((a) => a.attempt === stepNum);
          const isCurrent = currentAttempt === stepNum && !isComplete && nextRetryDelay === 0;
          const isWaiting = currentAttempt === stepNum && !isComplete && nextRetryDelay > 0;
          const isDone = Boolean(pastAttempt);
          const isPending = stepNum > currentAttempt && !pastAttempt;

          let borderColor = 'var(--border-subtle)';
          let bgColor = 'var(--bg-surface-subtle)';
          let badgeText = 'Waiting';
          let badgeClass = 'badge-neutral';

          if (pastAttempt) {
            if (pastAttempt.status === 'success' || pastAttempt.status === 'retried') {
              borderColor = 'var(--status-success-border)';
              bgColor = 'rgba(34, 197, 94, 0.05)';
              badgeText = 'Success';
              badgeClass = 'badge-success';
            } else {
              borderColor = 'var(--status-failed-border)';
              bgColor = 'rgba(239, 68, 68, 0.05)';
              badgeText = 'Failed';
              badgeClass = 'badge-failed';
            }
          } else if (isCurrent) {
            borderColor = 'var(--primary)';
            bgColor = 'var(--primary-subtle)';
            badgeText = 'Running';
            badgeClass = 'badge-retried';
          } else if (isWaiting) {
            borderColor = 'var(--primary-border)';
            bgColor = 'var(--primary-subtle)';
            badgeText = `Retry in ${nextRetryDelay}s`;
            badgeClass = 'badge-neutral';
          }

          return (
            <div
              key={stepNum}
              style={{
                border: `1px solid ${borderColor}`,
                borderRadius: 'var(--radius-md)',
                backgroundColor: bgColor,
                padding: '0.75rem 0.9rem',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Attempt {stepNum}
                </span>
                <span className={`status-badge ${badgeClass}`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem' }}>
                  {isCurrent && (
                    <span
                      className="spinner"
                      style={{ width: '8px', height: '8px', borderWidth: '1.5px', display: 'inline-block' }}
                    />
                  )}
                  {badgeText}
                </span>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {pastAttempt ? (
                  <span>
                    Duration: <strong>{formatDuration(pastAttempt.duration_ms)}</strong>
                  </span>
                ) : isCurrent ? (
                  <span>Extracting price & stock...</span>
                ) : isWaiting ? (
                  <span>Exponential backoff pause</span>
                ) : (
                  <span>Pending next try</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-Time Previous Attempts Log Details */}
      {attempts.length > 0 && (
        <div
          style={{
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '0.9rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Live Try Audit Logs ({attempts.length} recorded)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {attempts.map((att, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  fontSize: '0.8rem',
                  padding: '0.45rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--bg-surface-subtle)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      color: att.status === 'failed' ? 'var(--status-failed-text)' : 'var(--status-success-text)',
                    }}
                  >
                    Try #{att.attempt}:
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>{att.detail || '—'}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {formatDuration(att.duration_ms)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveScrapeTracker;
