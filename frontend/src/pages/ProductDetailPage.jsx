import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getProductHistory,
  getProductLogs,
  getTrackedProducts,
  triggerProductScrape,
  getProductSummary,
  untrackProduct,
  getScrapeStreamUrl,
} from '../api/products';
import { useToast } from '../context/useToast';
import { PriceChart } from '../components/PriceChart';
import { ScrapeLogsTable } from '../components/ScrapeLogsTable';
import { StockStatusBadge } from '../components/StatusBadge';
import { LoadingSpinner } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { LiveScrapeTracker } from '../components/LiveScrapeTracker';
import { formatDateOnly, formatFullTimestamp } from '../utils/formatters';

export function ProductDetailPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [productInfo, setProductInfo] = useState(null);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [isUntracking, setIsUntracking] = useState(false);
  const [error, setError] = useState(null);

  // Real-time scrape stream state
  const [streamState, setStreamState] = useState({
    isActive: false,
    currentAttempt: 1,
    maxAttempts: 3,
    attempts: [],
    nextRetryDelay: 0,
    isComplete: false,
    success: null,
    error: null,
    finalPrice: null,
    finalStock: null,
  });

  const eventSourceRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const isMountedRef = useRef(true);

  const clearCountdown = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const closeStream = useCallback(() => {
    clearCountdown();
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, [clearCountdown]);

  const startCountdown = useCallback((seconds) => {
    clearCountdown();
    if (seconds <= 0) return;
    let remaining = seconds;
    setStreamState((prev) => ({ ...prev, nextRetryDelay: remaining }));

    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearCountdown();
        setStreamState((prev) => ({ ...prev, nextRetryDelay: 0 }));
      } else {
        setStreamState((prev) => ({ ...prev, nextRetryDelay: remaining }));
      }
    }, 1000);
  }, [clearCountdown]);

  const loadData = useCallback(async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    setError(null);

    try {
      // Parallel requests: history, logs, metadata, and backend-aggregated summary
      const [historyRes, logsRes, trackedRes, summaryRes] = await Promise.all([
        getProductHistory(productId),
        getProductLogs(productId),
        getTrackedProducts().catch(() => []),
        getProductSummary(productId).catch(() => null),
      ]);

      const sortedHistory = Array.isArray(historyRes)
        ? [...historyRes].sort((a, b) => new Date(a.scraped_at) - new Date(b.scraped_at))
        : [];

      const cleanLogs = Array.isArray(logsRes) ? logsRes : [];

      setHistory(sortedHistory);
      setLogs(cleanLogs);
      setSummary(summaryRes);

      if (Array.isArray(trackedRes)) {
        const matching = trackedRes.find((p) => Number(p.product_id) === Number(productId));
        if (matching) {
          setProductInfo(matching);
        }
      }

      return { history: sortedHistory, logs: cleanLogs };
    } catch (err) {
      setError(err.userMessage || `Failed to fetch tracking history for product #${productId}.`);
      return null;
    } finally {
      if (showLoadingSpinner) {
        setLoading(false);
      }
    }
  }, [productId]);

  const connectScrapeStream = useCallback((targetProductId) => {
    closeStream();

    const streamUrl = getScrapeStreamUrl(targetProductId);
    const es = new EventSource(streamUrl);
    eventSourceRef.current = es;

    es.addEventListener('status', (e) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(e.data);
        if (data.inProgress) {
          setStreamState({
            isActive: true,
            currentAttempt: data.currentAttempt || 1,
            maxAttempts: data.maxAttempts || 3,
            attempts: data.attempts || [],
            nextRetryDelay: 0,
            isComplete: false,
            success: null,
            error: null,
            finalPrice: null,
            finalStock: null,
          });
          if (data.nextRetryDelayMs > 0) {
            startCountdown(Math.round(data.nextRetryDelayMs / 1000));
          }
        }
      } catch (err) {
        console.error('Failed to parse SSE status:', err);
      }
    });

    es.addEventListener('scrape_start', (e) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(e.data);
        setStreamState({
          isActive: true,
          currentAttempt: data.currentAttempt || 1,
          maxAttempts: data.maxAttempts || 3,
          attempts: data.attempts || [],
          nextRetryDelay: 0,
          isComplete: false,
          success: null,
          error: null,
          finalPrice: null,
          finalStock: null,
        });
      } catch (err) {
        console.error('Failed to parse SSE scrape_start:', err);
      }
    });

    es.addEventListener('attempt_start', (e) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(e.data);
        clearCountdown();
        setStreamState((prev) => ({
          ...prev,
          isActive: true,
          currentAttempt: data.attempt,
          maxAttempts: data.maxAttempts || 3,
          nextRetryDelay: 0,
        }));
      } catch (err) {
        console.error('Failed to parse SSE attempt_start:', err);
      }
    });

    es.addEventListener('attempt_complete', (e) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(e.data);
        setStreamState((prev) => {
          const updatedAttempts = Array.isArray(data.attempts) && data.attempts.length > 0
            ? data.attempts
            : [...prev.attempts, data];
          return {
            ...prev,
            attempts: updatedAttempts,
          };
        });

        if (data.nextRetryDelayMs > 0) {
          startCountdown(Math.round(data.nextRetryDelayMs / 1000));
        }
      } catch (err) {
        console.error('Failed to parse SSE attempt_complete:', err);
      }
    });

    es.addEventListener('scrape_complete', (e) => {
      if (!isMountedRef.current) return;
      try {
        const data = JSON.parse(e.data);
        clearCountdown();
        setStreamState((prev) => ({
          ...prev,
          isActive: true,
          isComplete: true,
          success: data.success,
          error: data.error,
          finalPrice: data.price,
          finalStock: data.stock,
          attempts: data.attempts || prev.attempts,
        }));

        // Seamlessly refresh history, logs & stats without a full-page loading spinner
        loadData(false);

        // Keep the tracker visible with the completion status for 4 seconds then gracefully close
        setTimeout(() => {
          if (isMountedRef.current) {
            setStreamState((prev) => ({ ...prev, isActive: false }));
          }
        }, 4000);
      } catch (err) {
        console.error('Failed to parse SSE scrape_complete:', err);
      } finally {
        closeStream();
      }
    });

    es.onerror = () => {
      closeStream();
    };
  }, [closeStream, clearCountdown, startCountdown, loadData]);

  useEffect(() => {
    isMountedRef.current = true;
    let didCancel = false;

    async function initialFetch() {
      const res = await loadData(true);
      if (didCancel || !res) return;

      // Connect to scrape stream on fresh visits where initial background scrape may be running
      if (res.history.length === 0 && res.logs.length === 0) {
        connectScrapeStream(productId);
      }
    }

    initialFetch();

    return () => {
      didCancel = true;
      isMountedRef.current = false;
      closeStream();
    };
  }, [productId, loadData, connectScrapeStream, closeStream]);

  const handleScrapeNow = async () => {
    if (isScraping) return;
    setIsScraping(true);
    showToast('Scraping started', `Launching Playwright scraper for product #${productId}...`, 'info');

    // Connect to live SSE stream immediately so user sees every attempt in real time
    connectScrapeStream(productId);

    try {
      const res = await triggerProductScrape(productId);
      if (res.success) {
        showToast('Scrape Succeeded', `Live price extracted: ₹${res.price} (${res.stock})`, 'success');
      } else {
        showToast('Scrape Completed', 'Scrape completed with non-success state. Check audit logs below.', 'warning');
      }
      await loadData(false);
    } catch (err) {
      if (err.response && err.response.status === 409) {
        showToast('Scrape in Progress', 'A scrape is already running for this product.', 'info');
      } else {
        showToast('Scrape Failed', err.userMessage || 'Failed to trigger scraper.', 'error');
      }
    } finally {
      setIsScraping(false);
    }
  };

  const handleUntrack = async () => {
    const name = productInfo?.name || `Product #${productId}`;
    const confirmed = window.confirm(
      `Are you sure you want to stop tracking "${name}"? This will delete its tracked record and price history.`
    );
    if (!confirmed) return;

    closeStream();
    setIsUntracking(true);
    try {
      await untrackProduct(productId);
      showToast('Product Removed', `"${name}" was removed from tracking.`, 'success');
      navigate('/dashboard');
    } catch (err) {
      showToast('Removal Failed', err.userMessage || 'Failed to remove tracked product.', 'error');
      setIsUntracking(false);
    }
  };

  // Derive latest known price and stock status from the most recent history entry
  const latestPoint = history.length > 0 ? history[history.length - 1] : null;

  // Derive stats using summary endpoint if available, falling back to client-side calculation
  const numericPrices = history.map((h) => Number(h.price)).filter((p) => !isNaN(p));
  const clientMinPrice = numericPrices.length > 0 ? Math.min(...numericPrices) : null;
  const clientMaxPrice = numericPrices.length > 0 ? Math.max(...numericPrices) : null;

  const minPrice = summary?.lowest_price_seen != null ? Number(summary.lowest_price_seen) : clientMinPrice;
  const maxPrice = summary?.highest_price_seen != null ? Number(summary.highest_price_seen) : clientMaxPrice;

  // Derive honest scrape stats
  const totalScrapes = summary?.total_scrape_attempts != null ? summary.total_scrape_attempts : logs.length;
  const failedScrapes = summary?.failed_scrapes != null
    ? summary.failed_scrapes
    : logs.filter((l) => (l.status || '').toLowerCase() === 'failed').length;

  return (
    <div className="product-detail-page">
      {/* Navigation Breadcrumb */}
      <div style={{ marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <Link to="/dashboard" style={{ color: 'var(--primary)' }}>
            ← Tracked Products
          </Link>
          <span>/</span>
          <span>Product #{productId}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleScrapeNow}
            disabled={isScraping || loading || isUntracking || streamState.isActive}
            title="Trigger scraper immediately for this product"
          >
            {isScraping || streamState.isActive ? (
              <>
                <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                Scraping (Attempt {streamState.currentAttempt}/{streamState.maxAttempts})...
              </>
            ) : (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                Scrape Price Now
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              closeStream();
              loadData(true);
            }}
            disabled={loading || isScraping || isUntracking}
            title="Refresh history and logs"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Refresh
          </button>

          <button
            type="button"
            className="btn btn-danger-outline"
            onClick={handleUntrack}
            disabled={loading || isScraping || isUntracking}
            title="Untrack product and return to dashboard"
          >
            {isUntracking ? 'Removing...' : 'Untrack'}
          </button>
        </div>
      </div>

      {/* Header Info */}
      <div className="page-header">
        <h1 className="page-title">
          {productInfo ? productInfo.name : `Product #${productId}`}
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
          {productInfo?.brand && <span className="meta-pill">{productInfo.brand}</span>}
          {productInfo?.category && <span className="meta-pill">{productInfo.category}</span>}
          {productInfo?.slug && (
            <span className="meta-pill" style={{ color: 'var(--text-muted)' }}>
              /{productInfo.slug}
            </span>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <ErrorState
          title="Failed to Load Product Data"
          message={error}
          onRetry={() => loadData(true)}
        />
      )}

      {/* Loading state */}
      {loading && !error && (
        <LoadingSpinner message="Fetching price history and scrape logs..." />
      )}

      {!loading && !error && (
        <>
          {/* Live Scrape Attempt Stepper & Real-time Try Tracker */}
          {streamState.isActive && (
            <LiveScrapeTracker
              currentAttempt={streamState.currentAttempt}
              maxAttempts={streamState.maxAttempts}
              attempts={streamState.attempts}
              nextRetryDelay={streamState.nextRetryDelay}
              isComplete={streamState.isComplete}
              success={streamState.success}
              error={streamState.error}
              finalPrice={streamState.finalPrice}
              finalStock={streamState.finalStock}
            />
          )}

          {/* Prominent Hero Metrics */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Current / Latest Price</div>
              <div className="metric-value" style={{ color: latestPoint ? 'var(--primary)' : 'var(--text-muted)' }}>
                {latestPoint
                  ? `₹${Number(latestPoint.price).toFixed(2)}`
                  : streamState.isActive
                  ? `Attempt ${streamState.currentAttempt} running...`
                  : 'Not yet scraped'}
              </div>
              <div className="metric-sub">
                {latestPoint ? (
                  <>Recorded {formatDateOnly(latestPoint.scraped_at)}</>
                ) : streamState.isActive ? (
                  `Live attempt ${streamState.currentAttempt} of ${streamState.maxAttempts}`
                ) : (
                  'Awaiting next scraper run'
                )}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Stock Status</div>
              <div style={{ marginTop: '0.5rem' }}>
                {latestPoint ? (
                  <StockStatusBadge status={latestPoint.stock_status} />
                ) : (
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                    {streamState.isActive ? 'Checking availability...' : 'Not yet scraped'}
                  </span>
                )}
              </div>
              <div className="metric-sub">
                {latestPoint?.stock_status ? `Reported as ${latestPoint.stock_status}` : 'No stock data'}
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Price Range</div>
              <div className="metric-value" style={{ fontSize: '1.25rem' }}>
                {minPrice !== null && maxPrice !== null
                  ? `₹${minPrice.toFixed(2)} - ₹${maxPrice.toFixed(2)}`
                  : '—'}
              </div>
              <div className="metric-sub">Across {history.length} snapshots</div>
            </div>

            <div className="metric-card">
              <div className="metric-label">Scrape Reliability</div>
              <div
                className="metric-value"
                style={{
                  fontSize: '1.25rem',
                  color: totalScrapes === 0
                    ? 'var(--text-muted)'
                    : failedScrapes > 0
                    ? 'var(--status-failed-text)'
                    : '#10b981',
                }}
              >
                {totalScrapes === 0
                  ? 'No data yet'
                  : failedScrapes > 0
                  ? `${failedScrapes} failed attempt${failedScrapes === 1 ? '' : 's'}`
                  : '100% stable'}
              </div>
              <div className="metric-sub">
                {totalScrapes === 0
                  ? 'No scrape attempts recorded yet'
                  : `${failedScrapes} failed / ${totalScrapes} total attempt${totalScrapes === 1 ? '' : 's'}`}
              </div>
            </div>
          </div>

          {/* Price History Chart */}
          <PriceChart
            history={history}
            onScrapeNow={handleScrapeNow}
            isScraping={isScraping || streamState.isActive}
            isInitialPolling={streamState.isActive}
          />

          {/* Price History Snapshots Table */}
          {history.length > 0 && (
            <div style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Price & Stock History Snapshots
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Verified prices recorded by the scraper over time (newest first).
                  </p>
                </div>
                <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {history.length} snapshot{history.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="table-container">
                <table className="dense-table" aria-label="Price History Snapshots Table">
                  <thead>
                    <tr>
                      <th style={{ width: '210px' }}>Recorded At</th>
                      <th style={{ width: '140px' }}>Price</th>
                      <th>Stock Availability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...history].reverse().map((point, idx) => (
                      <tr key={point.id || idx}>
                        <td className="timestamp-cell">{formatFullTimestamp(point.scraped_at)}</td>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                          ₹{Number(point.price).toFixed(2)}
                        </td>
                        <td>
                          <StockStatusBadge status={point.stock_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Scrape Log Table */}
          <div style={{ marginTop: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Scrape Audit Log
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Detailed history of scraper executions, including durations and failure reports.
                </p>
              </div>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                Showing last {logs.length} attempts
              </span>
            </div>

            <ScrapeLogsTable logs={logs} isInitialPolling={streamState.isActive} />
          </div>
        </>
      )}
    </div>
  );
}

