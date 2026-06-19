import supabase from '../config/supabaseClient.js';

/**
 * Persists an individual scraper attempt into `scrape_log` immediately.
 * 
 * @param {number|string} productId
 * @param {object} attemptData - { attempt, status, detail, duration_ms }
 */
export async function recordSingleAttempt(productId, attemptData) {
  try {
    const { error } = await supabase.from('scrape_log').insert([
      {
        product_id: Number(productId),
        status: attemptData.status,
        detail: attemptData.detail,
        duration_ms: attemptData.duration_ms,
        attempt_at: new Date().toISOString(),
      },
    ]);
    if (error) {
      console.error(`Failed to record single attempt for product ${productId}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Exception recording single attempt for product ${productId}:`, err.message);
    return false;
  }
}

/**
 * Persists a verified price & stock reading into `price_history`.
 * 
 * @param {number|string} productId
 * @param {number} price
 * @param {string} stock
 */
export async function recordPriceHistory(productId, price, stock) {
  const isValidPrice =
    typeof price === 'number' &&
    Number.isFinite(price) &&
    price > 0;

  if (!isValidPrice) return false;

  try {
    const { error } = await supabase.from('price_history').insert([
      {
        product_id: Number(productId),
        price,
        stock_status: stock || 'unknown',
        scraped_at: new Date().toISOString(),
      },
    ]);
    if (error) {
      console.error(`Failed to record price_history for product ${productId}:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`Exception recording price_history for product ${productId}:`, err.message);
    return false;
  }
}

/**
 * Persists scraper attempts to `scrape_log` and verified prices to `price_history` in batch.
 * 
 * @param {number|string} productId - ID of the product scraped
 * @param {object} result - Scraper result from scrapeProductWithRetry
 * @returns {Promise<boolean>} True if all attempted database writes succeeded without error, false otherwise
 */
export async function recordScrapeResult(productId, result) {
  let logSuccess = true;
  let historySuccess = true;

  // 1. Insert every attempt into scrape_log with explicit attempt_at timestamp
  if (result?.attempts && Array.isArray(result.attempts) && result.attempts.length > 0) {
    const logRows = result.attempts.map((att) => ({
      product_id: Number(productId),
      status: att.status,
      detail: att.detail,
      duration_ms: att.duration_ms,
      attempt_at: new Date().toISOString(),
    }));

    const { error: logError } = await supabase.from('scrape_log').insert(logRows);
    if (logError) {
      console.error(`Failed to insert scrape_log for product ${productId}:`, logError.message);
      logSuccess = false;
    }
  }

  // 2. Insert into price_history ONLY if scrape succeeded and price is a valid finite number > 0
  const isValidPrice =
    result?.success === true &&
    typeof result.price === 'number' &&
    Number.isFinite(result.price) &&
    result.price > 0;

  if (isValidPrice) {
    const { error: historyError } = await supabase.from('price_history').insert([
      {
        product_id: Number(productId),
        price: result.price,
        stock_status: result.stock || 'unknown',
        scraped_at: new Date().toISOString(),
      },
    ]);

    if (historyError) {
      console.error(`Failed to insert price_history for product ${productId}:`, historyError.message);
      historySuccess = false;
    }
  }

  return logSuccess && historySuccess;
}

export default recordScrapeResult;

