export function Pagination({ page, pages, total, pageSize, onPageChange }) {
  if (!pages || pages <= 1) {
    if (total !== undefined) {
      return (
        <div className="pagination">
          <div>
            Showing <strong>{total}</strong> {total === 1 ? 'item' : 'items'}
          </div>
        </div>
      );
    }
    return null;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Generate visible page numbers
  const pageNumbers = [];
  const maxButtons = 5;
  let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
  let endPage = Math.min(pages, startPage + maxButtons - 1);

  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="pagination">
      <div className="pagination-info">
        Showing <strong>{start}</strong> - <strong>{end}</strong> of <strong>{total}</strong> products
      </div>

      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous Page"
        >
          ← Prev
        </button>

        {startPage > 1 && (
          <>
            <button
              type="button"
              className={`pagination-btn ${page === 1 ? 'active' : ''}`}
              onClick={() => onPageChange(1)}
            >
              1
            </button>
            {startPage > 2 && <span style={{ padding: '0 0.25rem', color: 'var(--text-muted)' }}>...</span>}
          </>
        )}

        {pageNumbers.map((num) => (
          <button
            key={num}
            type="button"
            className={`pagination-btn ${page === num ? 'active' : ''}`}
            onClick={() => onPageChange(num)}
            aria-current={page === num ? 'page' : undefined}
          >
            {num}
          </button>
        ))}

        {endPage < pages && (
          <>
            {endPage < pages - 1 && <span style={{ padding: '0 0.25rem', color: 'var(--text-muted)' }}>...</span>}
            <button
              type="button"
              className={`pagination-btn ${page === pages ? 'active' : ''}`}
              onClick={() => onPageChange(pages)}
            >
              {pages}
            </button>
          </>
        )}

        <button
          type="button"
          className="pagination-btn"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next Page"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
