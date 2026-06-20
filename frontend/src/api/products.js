import apiClient from './client.js';

/**
 * Health check endpoint (not under /api/products)
 */
export async function checkHealth() {
  const response = await apiClient.get('/health');
  return response.data;
}

/**
 * Fetch paginated catalog
 * @param {number} page
 * @param {number} pageSize
 */
export async function getCatalog(page = 1, pageSize = 20) {
  const response = await apiClient.get('/api/products/catalog', {
    params: { page, pageSize },
  });
  return response.data;
}

/**
 * Search products by query substring
 * @param {string} query
 * @param {number} page
 * @param {number} pageSize
 */
export async function searchProducts(query = '', page = 1, pageSize = 20) {
  const response = await apiClient.get('/api/products/search', {
    params: { q: query, page, pageSize },
  });
  return response.data;
}

/**
 * Track a product
 * @param {Object} product - { product_id, slug, name, brand, category }
 */
export async function trackProduct(product) {
  const response = await apiClient.post('/api/products/track', {
    product_id: product.id || product.product_id,
    slug: product.slug,
    name: product.name,
    brand: product.brand || null,
    category: product.category || null,
  });
  return response.data;
}

/**
 * Fetch all tracked products
 */
export async function getTrackedProducts() {
  const response = await apiClient.get('/api/products/tracked');
  return response.data;
}

/**
 * Fetch price and stock history for a product
 * @param {string|number} productId
 */
export async function getProductHistory(productId) {
  const response = await apiClient.get(`/api/products/${productId}/history`);
  return response.data;
}

/**
 * Fetch scrape logs for a product
 * @param {string|number} productId
 */
export async function getProductLogs(productId) {
  const response = await apiClient.get(`/api/products/${productId}/logs`);
  return response.data;
}

/**
 * Trigger an on-demand scrape for a single product
 * @param {string|number} productId
 */
export async function triggerProductScrape(productId) {
  const response = await apiClient.post(`/api/products/${productId}/scrape`, null, {
    timeout: 240000,
  });
  return response.data;
}

/**
 * Fetch aggregated summary statistics for a product
 * @param {string|number} productId
 */
export async function getProductSummary(productId) {
  const response = await apiClient.get(`/api/products/${productId}/summary`);
  return response.data;
}

/**
 * Untrack a single product
 * @param {string|number} productId
 */
export async function untrackProduct(productId) {
  const response = await apiClient.delete(`/api/products/tracked/${productId}`);
  return response.data;
}

/**
 * Untrack all tracked products
 */
export async function untrackAllProducts() {
  const response = await apiClient.delete('/api/products/tracked');
  return response.data;
}

/**
 * Returns the SSE stream URL for live scrape updates
 * @param {string|number} productId
 */
export function getScrapeStreamUrl(productId) {
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');
  return `${base}/api/products/${productId}/scrape-stream`;
}




