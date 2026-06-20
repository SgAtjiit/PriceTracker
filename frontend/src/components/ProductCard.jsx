import { useState } from 'react';
import { Link } from 'react-router-dom';
import { trackProduct } from '../api/products';
import { useToast } from '../context/useToast';

export function ProductCard({ product, isAlreadyTracked = false, onTrackedSuccess }) {
  const [isTracked, setIsTracked] = useState(isAlreadyTracked);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleTrack = async () => {
    if (isTracked || loading) return;

    setLoading(true);
    try {
      await trackProduct({
        id: product.id,
        slug: product.slug,
        name: product.name,
        brand: product.brand,
        category: product.category,
      });

      setIsTracked(true);
      showToast('Product Tracked', `"${product.name}" has been added to tracked products.`, 'success');
      if (onTrackedSuccess) {
        onTrackedSuccess(product.id);
      }
    } catch (err) {
      if (err.response && err.response.status === 409) {
        // Handled as requested: "On 409 (already tracked), show 'Already tracked' state instead of an error."
        setIsTracked(true);
        showToast('Already Tracked', `"${product.name}" is already being tracked.`, 'info');
        if (onTrackedSuccess) {
          onTrackedSuccess(product.id);
        }
      } else {
        showToast('Tracking Failed', err.userMessage || 'Could not track product. Try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="product-card">
      <div>
        <div className="product-card-header">
          {product.brand && <div className="product-brand">{product.brand}</div>}
          <h3 className="product-title" title={product.name}>
            {product.name}
          </h3>
        </div>

        <div className="product-meta-tags">
          {product.category && <span className="meta-pill">{product.category}</span>}
          {product.sku && <span className="meta-pill">SKU: {product.sku}</span>}
        </div>

        {product.description && (
          <p className="product-description" title={product.description}>
            {product.description}
          </p>
        )}
      </div>

      <div className="product-card-footer">
        <span className="product-id-subtle">ID #{product.id}</span>

        {isTracked ? (
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <span className="btn btn-tracked" style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}>
              ✓ Tracked
            </span>
            <Link
              to={`/product/${product.id}`}
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
              title="View price history & logs"
            >
              Details →
            </Link>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleTrack}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }} />
                Tracking...
              </>
            ) : (
              '+ Track'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
