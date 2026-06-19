import supabase from '../config/supabaseClient.js';

const STORE_BASE = 'https://demo.inelabteamdev.com';
const RETRY_DELAY_MS = 1500;
const BATCH_SIZE = 100;
const CONCURRENCY = 1;

/**
 * Fetches a single page of the store catalog with 1 retry on failure.
 */
export async function fetchCatalogPage(page, pageSize = 60) {
  const url = `${STORE_BASE}/api/catalog?page=${page}&pageSize=${pageSize}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Store responded ${res.status}`);
      }
      const data = await res.json();
      return { success: true, page, items: data.items || [], data };
    } catch (err) {
      if (attempt === 1) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        console.error(`Catalog page ${page} fetch failed on attempt ${attempt}:`, err.message);
        return { success: false, page, items: [], error: err.message };
      }
    }
  }
}

/**
 * Helper to process an array of tasks with limited concurrency.
 */
async function runWithConcurrency(items, limit, worker) {
  let index = 0;
  async function next() {
    while (index < items.length) {
      const current = index++;
      await worker(items[current]);
    }
  }
  await Promise.all(Array.from({ length: limit }, next));
}

/**
 * Syncs the entire upstream store catalog into the `catalog_products` Supabase table.
 * Idempotently upserts products on the `id` column.
 * Does NOT set `updated_at` in payload (managed by DB default on insert & trigger on update).
 * 
 * @returns {Promise<{ total: number, complete: boolean, failedPages: number[] }>}
 */
export async function syncCatalog() {
  console.log('Starting full catalog sync from upstream store...');
  const firstPage = await fetchCatalogPage(1, 60);

  if (!firstPage.success) {
    console.error('Catalog sync aborted: page 1 failed after retry:', firstPage.error);
    return { total: 0, complete: false, failedPages: [1] };
  }

  const firstData = firstPage.data;
  const totalPages = firstData.pages || Math.ceil((firstData.total || 1000) / 60);

  const allItems = [...(firstPage.items || [])];
  const failedPages = [];

  if (totalPages > 1) {
    const pageNumbers = [];
    for (let p = 2; p <= totalPages; p++) {
      pageNumbers.push(p);
    }

    await runWithConcurrency(pageNumbers, CONCURRENCY, async (p) => {
      const res = await fetchCatalogPage(p, 60);
      if (!res.success) {
        failedPages.push(p);
      } else {
        allItems.push(...res.items);
      }
      // Brief pause between requests to prevent upstream 429 burst rate-limits
      await new Promise((r) => setTimeout(r, 200));
    });
  }

  failedPages.sort((a, b) => a - b);

  // Deduplicate by ID to prevent Postgres 'ON CONFLICT DO UPDATE cannot affect row a second time'
  const uniqueItemsMap = new Map();
  for (const item of allItems) {
    if (item && item.id != null) {
      uniqueItemsMap.set(Number(item.id), item);
    }
  }
  const uniqueItems = Array.from(uniqueItemsMap.values());

  if (uniqueItems.length > 0) {
    // Map items to catalog_products columns; omit updated_at so DB trigger handles it
    const payload = uniqueItems.map((item) => ({
      id: Number(item.id),
      slug: String(item.slug),
      name: String(item.name),
      brand: item.brand || null,
      category: item.category || null,
      sku: item.sku || null,
      description: item.description || null,
    }));

    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const chunk = payload.slice(i, i + BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from('catalog_products')
        .upsert(chunk, { onConflict: 'id' });

      if (upsertError) {
        console.error(`Failed to upsert catalog batch at index ${i}:`, upsertError.message);
        throw upsertError;
      }
    }
  }

  const complete = failedPages.length === 0;
  console.log(
    `Catalog sync complete: ${uniqueItems.length} unique products upserted. Complete: ${complete}. Failed pages: ${
      failedPages.length > 0 ? failedPages.join(', ') : 'none'
    }`
  );

  return {
    total: uniqueItems.length,
    complete,
    failedPages,
  };
}

export default syncCatalog;
