import express from 'express';
import { getCatalog, searchCatalog } from '../controllers/catalogController.js';
import { trackProduct, listTracked, untrackProduct, untrackAllProducts, getHistory, getLogs, getSummary } from '../controllers/trackingController.js';
import { runScrapeCron, runSingleScrape, streamScrapeProgress } from '../controllers/scrapeController.js';

const router = express.Router();

// 1. Pass-through catalog proxy
router.get('/catalog', getCatalog);

// 2. Search catalog by product name substring match
router.get('/search', searchCatalog);

// 3. Track a product — insert into Supabase
router.post('/track', trackProduct);

// 4. List all tracked products
router.get('/tracked', listTracked);

// 4b. Untrack all tracked products
router.delete('/tracked', untrackAllProducts);

// 4c. Untrack a single product
router.delete('/tracked/:productId', untrackProduct);
router.delete('/:productId', untrackProduct);

// 5. Trigger scraper for all tracked products (protected by CRON_SECRET)
router.post('/scrape/run', runScrapeCron);

// 6. Price/stock history for one product
router.get('/:productId/history', getHistory);

// 7. Scrape log for one product
router.get('/:productId/logs', getLogs);

// 8. On-demand single product scrape
router.post('/:productId/scrape', runSingleScrape);

// 8b. Server-Sent Events stream for real-time attempt progress
router.get('/:productId/scrape-stream', streamScrapeProgress);

// 9. Aggregated dashboard summary for one product
router.get('/:productId/summary', getSummary);

export default router;