import { scrapeProductWithRetry } from './scrapeWithRetry.js';
import { runWithConcurrency } from '../utils/concurrency.js';

const STORE_BASE = 'https://demo.inelabteamdev.com';
const CONCURRENCY = 2;

// Fetch ALL product ids across all pages (for stress-testing only — production scrapes tracked_products, not the full catalog)
async function fetchAllProductIds() {
    const firstPageRes = await fetch(`${STORE_BASE}/api/catalog?page=1&pageSize=20`);
    if (!firstPageRes.ok) throw new Error(`Catalog fetch failed: ${firstPageRes.status}`);
    const firstPage = await firstPageRes.json();

    const totalPages = firstPage.pages;
    let allIds = firstPage.items.map((item) => item.id);

    for (let page = 2; page <= totalPages; page++) {
        const res = await fetch(`${STORE_BASE}/api/catalog?page=${page}&pageSize=20`);
        if (!res.ok) {
            console.log(`Warning: catalog page ${page} failed (${res.status}), skipping`);
            continue;
        }
        const data = await res.json();
        allIds = allIds.concat(data.items.map((item) => item.id));
    }

    return allIds;
}


const ids = await fetchAllProductIds();
console.log(`Fetched ${ids.length} product IDs total`);

// Optional: slice to a manageable sample instead of running all 1000 in one go
const SAMPLE_SIZE = 30; // adjust as needed — running all 1000 will take a long time
const sampleIds = ids.slice(0, SAMPLE_SIZE);
console.log(`Testing a sample of ${sampleIds.length} products`);

const overallStart = Date.now();

const results = await runWithConcurrency(sampleIds, CONCURRENCY, async (id) => {
    const productStart = Date.now();
    console.log(`\n>>> Starting product ${id}`);
    const result = await scrapeProductWithRetry(id, true); // headless for a real stress test (faster, no rendering overhead)
    const productDuration = Date.now() - productStart;
    console.log(`<<< Finished product ${id} in ${(productDuration / 1000).toFixed(1)}s:`, result.success ? `✅ ₹${result.price}` : `❌ ${result.error}`);
    return { ...result, duration_ms: productDuration };
});

const overallDuration = Date.now() - overallStart;

console.log('\n=== SUMMARY ===');
const succeeded = results.filter((r) => r.success).length;
const avgDuration = results.reduce((sum, r) => sum + r.duration_ms, 0) / results.length;
console.log(`${succeeded}/${results.length} succeeded`);
console.log(`Total wall-clock time: ${(overallDuration / 1000).toFixed(1)}s`);
console.log(`Average time per product: ${(avgDuration / 1000).toFixed(1)}s`);
results.forEach((r) => {
    console.log(
        `Product ${r.productId}: ${r.success ? `✅ ₹${r.price}, ${r.stock}` : `❌ ${r.error}`} (${r.attempts.length} attempt(s), ${(r.duration_ms / 1000).toFixed(1)}s)`
    );
});

//Conclusion - About 24/30 products were fetched
//  successfully with concurrency 2 ,but increasing
//  the concurrency to 4 was leading to less success
//  rates as only 20/30 products prices were fetched
//  successfully with avg more time than the concurrency 2
//  solution. 