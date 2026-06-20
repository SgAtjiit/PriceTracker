import { scrapeProductWithRetry } from './scrapeWithRetry.js';
import scrapeEventManager from './scrapeEventManager.js';

/**
 * Scrapes a single product with retries and records logs & price history in the database,
 * while notifying the scrapeEventManager for real-time SSE stream listeners.
 * @param {number|string} productId
 * @returns {Promise<Object>}
 */
export async function scrapeAndRecordProduct(productId) {
  const numId = Number(productId);
  scrapeEventManager.startScrape(numId);
  try {
    const headless = process.env.SCRAPE_HEADLESS !== 'false';
    const result = await scrapeProductWithRetry(numId, headless);
    scrapeEventManager.finishScrape(numId, result);
    return result;
  } catch (err) {
    const errorResult = { success: false, error: err.message, attempts: [] };
    scrapeEventManager.finishScrape(numId, errorResult);
    throw err;
  }
}

export default scrapeAndRecordProduct;
