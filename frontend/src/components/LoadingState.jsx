export function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="state-box">
      <div className="spinner" />
      <div className="state-box-title">{message}</div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }) {
  return (
    <div className="product-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton" style={{ width: '35%', height: '14px' }} />
          <div className="skeleton" style={{ width: '80%', height: '22px' }} />
          <div className="skeleton" style={{ width: '50%', height: '16px' }} />
          <div className="skeleton" style={{ width: '100%', height: '40px', marginTop: 'auto' }} />
        </div>
      ))}
    </div>
  );
}

