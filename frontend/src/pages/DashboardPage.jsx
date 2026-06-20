import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getTrackedProducts, untrackProduct, untrackAllProducts } from '../api/products';
import { useToast } from '../context/useToast';
import { LoadingSpinner } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { formatDateWithYear as formatDateTime } from '../utils/formatters';

export function DashboardPage() {
  const [trackedProducts, setTrackedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [untrackingId, setUntrackingId] = useState(null);
  const [isUntrackingAll, setIsUntrackingAll] = useState(false);

  const { showToast } = useToast();

  const fetchTracked = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getTrackedProducts();
      setTrackedProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.userMessage || 'Failed to fetch tracked products list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTracked();
  }, [fetchTracked]);

  const handleUntrackSingle = async (productId, name) => {
    const confirmed = window.confirm(
      `Are you sure you want to stop tracking "${name}"? This will delete its tracked record and price history.`
    );
    if (!confirmed) return;

    setUntrackingId(productId);
    try {
      await untrackProduct(productId);
      setTrackedProducts((prev) => prev.filter((p) => Number(p.product_id) !== Number(productId)));
      showToast('Product Removed', `"${name}" was removed from tracking.`, 'success');
    } catch (err) {
      showToast('Removal Failed', err.userMessage || 'Failed to remove tracked product.', 'error');
    } finally {
      setUntrackingId(null);
    }
  };

  const handleUntrackAll = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to remove ALL ${trackedProducts.length} tracked products? This will also remove all associated price history and logs.`
    );
    if (!confirmed) return;

    setIsUntrackingAll(true);
    try {
      await untrackAllProducts();
      setTrackedProducts([]);
      showToast('All Products Removed', 'All products have been removed from tracking.', 'success');
    } catch (err) {
      showToast('Bulk Removal Failed', err.userMessage || 'Failed to remove tracked products.', 'error');
    } finally {
      setIsUntrackingAll(false);
    }
  };

  return (
    <div className="dashboard-page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title">Tracked Products Dashboard</h1>
          <p className="page-subtitle">
            Overview of all catalog items actively being monitored by the scraper.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {trackedProducts.length > 0 && (
            <button
              type="button"
              className="btn btn-danger-outline"
              onClick={handleUntrackAll}
              disabled={isUntrackingAll || untrackingId !== null || loading}
              title="Untrack all products currently monitored"
            >
              {isUntrackingAll ? 'Removing All...' : 'Remove All'}
            </button>
          )}
          <Link to="/" className="btn btn-primary">
            + Add More Products
          </Link>
        </div>
      </div>

      {/* Metrics Summary Bar */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Tracked</div>
          <div className="metric-value">{loading ? '—' : trackedProducts.length}</div>
          <div className="metric-sub">Active product monitors</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Monitoring System</div>
          <div className="metric-value" style={{ fontSize: '1.25rem', color: '#10b981' }}>Active</div>
          <div className="metric-sub">Periodic price scraper ready</div>
        </div>
      </div>

      {/* States: Loading, Error, Empty, List */}
      {loading ? (
        <LoadingSpinner message="Loading tracked products..." />
      ) : error ? (
        <ErrorState
          title="Dashboard Error"
          message={error}
          onRetry={fetchTracked}
        />
      ) : trackedProducts.length === 0 ? (
        <div className="state-box">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: 'var(--text-muted)' }}
          >
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <div className="state-box-title">No Tracked Products</div>
          <p className="state-box-text">
            You haven&apos;t tracked any products yet — go search for one to begin tracking its price history and availability.
          </p>
          <Link to="/" className="btn btn-primary">
            Search Catalog
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table className="dense-table" aria-label="Tracked Products Table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>ID</th>
                <th>Product Name</th>
                <th style={{ width: '160px' }}>Brand</th>
                <th style={{ width: '180px' }}>Category</th>
                <th style={{ width: '140px' }}>Tracked Since</th>
                <th style={{ width: '190px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trackedProducts.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    #{item.product_id}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      <Link to={`/product/${item.product_id}`} style={{ color: 'inherit' }} title="View product history">
                        {item.name}
                      </Link>
                    </div>
                    {item.slug && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        /{item.slug}
                      </span>
                    )}
                  </td>
                  <td>
                    {item.brand ? (
                      <span style={{ fontWeight: 500 }}>{item.brand}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td>
                    {item.category ? (
                      <span className="meta-pill">{item.category}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>—</span>
                    )}
                  </td>
                  <td className="timestamp-cell">
                    {formatDateTime(item.created_at)}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <Link
                        to={`/product/${item.product_id}`}
                        className="btn btn-outline"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                      >
                        View Details →
                      </Link>
                      <button
                        type="button"
                        className="btn btn-danger-outline"
                        style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }}
                        onClick={() => handleUntrackSingle(item.product_id, item.name)}
                        disabled={untrackingId === item.product_id || isUntrackingAll}
                        title="Remove product from tracking"
                      >
                        {untrackingId === item.product_id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
