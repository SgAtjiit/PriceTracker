import { useState, useEffect, useCallback, useRef } from 'react';
import { searchProducts, getTrackedProducts } from '../api/products';
import { ProductCard } from '../components/ProductCard';
import { Pagination } from '../components/Pagination';
import { ProductGridSkeleton } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';

const PAGE_SIZE = 12;

export function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);

  const [productsData, setProductsData] = useState({
    items: [],
    total: 0,
    page: 1,
    pages: 1,
  });

  const [trackedProductIds, setTrackedProductIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDebouncing, setIsDebouncing] = useState(false);

  const debounceTimerRef = useRef(null);

  // Debounced input handler (400ms delay)
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsDebouncing(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(value.trim());
      setPage(1);
      setIsDebouncing(false);
    }, 400);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setDebouncedQuery('');
    setPage(1);
    setIsDebouncing(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  // Populate tracked product IDs set
  const loadTrackedSet = useCallback(async () => {
    try {
      const trackedList = await getTrackedProducts();
      if (Array.isArray(trackedList)) {
        const idSet = new Set(trackedList.map((item) => Number(item.product_id)));
        setTrackedProductIds(idSet);
      }
    } catch {
      // Non-blocking: If tracked list fails, search still works
    }
  }, []);

  useEffect(() => {
    loadTrackedSet();
  }, [loadTrackedSet]);

  // Fetch catalog search results (backend /search with empty query returns full paginated mirror)
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await searchProducts(debouncedQuery || '', page, PAGE_SIZE);

      setProductsData({
        items: data.items || [],
        total: data.total || 0,
        page: data.page || page,
        pages: data.pages || 1,
      });
    } catch (err) {
      setError(err.userMessage || 'Failed to retrieve products from the catalog.');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, page]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleTrackedSuccess = (id) => {
    setTrackedProductIds((prev) => new Set(prev).add(Number(id)));
  };

  return (
    <div className="search-page">
      <div className="page-header">
        <h1 className="page-title">Search & Track Products</h1>
        <p className="page-subtitle">
          Search the catalog to monitor product prices and inventory status.
        </p>
      </div>

      <div className="search-bar-container">
        <div className="search-input-wrapper">
          <span className="search-icon-left" aria-hidden="true">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>

          <input
            type="text"
            className="search-input"
            placeholder="Search products by name (e.g., iPhone, Keyboard, Monitor)..."
            value={searchTerm}
            onChange={handleSearchChange}
            aria-label="Search products"
          />

          {searchTerm && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={handleClearSearch}
              aria-label="Clear search input"
              title="Clear search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        <div className="search-meta-bar">
          <div>
            {debouncedQuery ? (
              <span>
                Search results for &ldquo;<strong>{debouncedQuery}</strong>&rdquo;
              </span>
            ) : (
              <span>Browsing all catalog products</span>
            )}
          </div>

          {isDebouncing && (
            <div className="search-debounce-indicator">
              <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
              Searching...
            </div>
          )}
        </div>
      </div>

      {/* State Handlers: Loading, Error, Empty, Success */}
      {loading ? (
        <ProductGridSkeleton count={PAGE_SIZE} />
      ) : error ? (
        <ErrorState
          title="Catalog Search Error"
          message={error}
          onRetry={fetchProducts}
        />
      ) : productsData.items.length === 0 ? (
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <div className="state-box-title">
            {debouncedQuery ? 'No products found' : 'Catalog is syncing, try again in a minute'}
          </div>
          <p className="state-box-text">
            {debouncedQuery
              ? `No products matched "${debouncedQuery}". Try a different keyword or partial product name.`
              : 'The catalog mirror is currently synchronizing with the store. Please try again in a moment.'}
          </p>
          {debouncedQuery ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClearSearch}
            >
              Clear Search Query
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={fetchProducts}
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="product-grid">
            {productsData.items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isAlreadyTracked={trackedProductIds.has(Number(product.id))}
                onTrackedSuccess={handleTrackedSuccess}
              />
            ))}
          </div>

          <Pagination
            page={productsData.page}
            pages={productsData.pages}
            total={productsData.total}
            pageSize={PAGE_SIZE}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </>
      )}
    </div>
  );
}
