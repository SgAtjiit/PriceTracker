import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { StockStatusBadge } from './StatusBadge';
import { formatShortDateTime as formatShortDate } from '../utils/formatters';

/**
 * Custom tooltip rendering price, stock_status, and full timestamp
 */
function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const date = new Date(data.scraped_at);
    const formattedTime = !isNaN(date.getTime())
      ? date.toLocaleString()
      : data.scraped_at;

    return (
      <div className="custom-chart-tooltip">
        <div className="tooltip-date">{formattedTime}</div>
        <div className="tooltip-price">₹{Number(data.price).toFixed(2)}</div>
        <div className="tooltip-stock">
          <StockStatusBadge status={data.stock_status} />
        </div>
      </div>
    );
  }
  return null;
}

export function PriceChart({ history = [], onScrapeNow, isScraping = false, isInitialPolling = false }) {
  if (!history || history.length === 0) {
    if (isInitialPolling) {
      return (
        <div className="chart-container">
          <div className="chart-header">
            <h3 className="chart-title">Price & Stock History</h3>
          </div>
          <div className="state-box">
            <span
              className="spinner"
              style={{ width: '28px', height: '28px', borderWidth: '3px', marginBottom: '0.75rem' }}
            />
            <div className="state-box-title">Scraping in progress</div>
            <p className="state-box-text" style={{ maxWidth: '460px' }}>
              This product was just added and its first price check is running (usually takes under a minute).
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="chart-container">
        <div className="chart-header">
          <h3 className="chart-title">Price & Stock History</h3>
        </div>
        <div className="state-box">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--text-muted)' }}
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <div className="state-box-title">No Price History</div>
          <p className="state-box-text">
            No price data yet — the next scheduled scrape will populate this.
          </p>
          {onScrapeNow && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onScrapeNow}
              disabled={isScraping}
              style={{ marginTop: '0.5rem' }}
            >
              {isScraping ? (
                <>
                  <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                  Scraping Price with Playwright...
                </>
              ) : (
                'Scrape Price Now'
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Pre-process history data
  const chartData = history.map((item) => ({
    ...item,
    numericPrice: Number(item.price),
    formattedDate: formatShortDate(item.scraped_at),
  }));

  // Calculate min & max for better y-axis padding
  const prices = chartData.map((d) => d.numericPrice).filter((p) => !isNaN(p));
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 100;
  const padding = Math.max((maxPrice - minPrice) * 0.15, 1);
  const domainMin = Math.max(0, Math.floor(minPrice - padding));
  const domainMax = Math.ceil(maxPrice + padding);

  return (
    <div className="chart-container">
      <div className="chart-header">
        <h3 className="chart-title">Price & Stock History</h3>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {chartData.length} data point{chartData.length === 1 ? '' : 's'} recorded
        </span>
      </div>

      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
            <XAxis
              dataKey="formattedDate"
              stroke="var(--text-muted)"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              interval="preserveStartEnd"
              dy={10}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={12}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              domain={[domainMin, domainMax]}
              tickFormatter={(val) => `₹${val}`}
              width={55}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="numericPrice"
              stroke="#2563eb"
              strokeWidth={2.5}
              activeDot={{ r: 6, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
              dot={{ r: 4, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
