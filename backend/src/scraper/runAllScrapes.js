import { scrapeProductWithRetry } from './scrapeWithRetry.js';
import { recordScrapeResult } from './recordScrapeResult.js';
import { syncCatalog } from './syncCatalog.js';
import { runWithConcurrency } from '../utils/concurrency.js';
import supabase from '../config/supabaseClient.js';

const CONCURRENCY = 2;
let isBatchRunning = false;

export async function runAllScrapes() {
  if (isBatchRunning) {
    console.log('Batch scrape run already in progress — skipping this run.');
    return { skipped: true };
  }

  isBatchRunning = true;
  try {
    console.log('Running catalog sync before scrape run...');
    try {
      await syncCatalog();
    } catch (err) {
      console.error('Catalog sync failed during scrape run:', err.message);
    }

    const { data: trackedProducts, error } = await supabase
      .from('tracked_products')
      .select('product_id');

    if (error) {
      console.error('Failed to fetch tracked products:', error.message);
      throw error;
    }

    if (!trackedProducts || trackedProducts.length === 0) {
      console.log('No tracked products to scrape.');
      return { total: 0, succeeded: 0, failed: 0 };
    }

    const productIds = trackedProducts.map((p) => p.product_id);
    console.log(`Starting scrape run for ${productIds.length} tracked products`);

    const headless = process.env.SCRAPE_HEADLESS !== 'false';

    const results = await runWithConcurrency(productIds, CONCURRENCY, async (productId) => {
      const result = await scrapeProductWithRetry(productId, headless);
      await recordScrapeResult(productId, result);
      return result;
    });

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.length - succeeded;

    console.log(`Scrape run complete: ${succeeded}/${results.length} succeeded`);

    return { total: results.length, succeeded, failed };
  } finally {
    isBatchRunning = false;
  }
}