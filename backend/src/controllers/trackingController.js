import supabase from '../config/supabaseClient.js';
import { scrapeAndRecordProduct } from '../scraper/scrapeAndRecordProduct.js';
import scrapeEventManager from '../scraper/scrapeEventManager.js';

// 3. Track a product — insert into Supabase
export async function trackProduct(req, res) {
  try {
    const { product_id, slug, name, brand, category } = req.body;
    if (!product_id || !slug || !name) {
      return res.status(400).json({ error: 'product_id, slug, and name are required' });
    }

    const { data, error } = await supabase
      .from('tracked_products')
      .insert([
        {
          product_id: Number(product_id),
          slug,
          name,
          brand: brand || null,
          category: category || null
        }
      ])
      .select();

    if (error) {
      // Unique constraint violation (Postgres error code 23505)
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Product already tracked' });
      }
      throw error;
    }

    res.status(201).json(data[0]);

    // Asynchronously trigger initial scrape in background if not already scraping
    const numId = Number(product_id);
    if (!scrapeEventManager.getActiveScrape(numId)) {
      scrapeAndRecordProduct(numId).catch((err) => {
        console.error(`Background initial scrape failed for product ${numId}:`, err.message);
      });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to track product', detail: err.message });
  }
}

// 4. List all tracked products
export async function listTracked(req, res) {
  try {
    const { data, error } = await supabase
      .from('tracked_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tracked products', detail: err.message });
  }
}

// 4b. Untrack a single product
export async function untrackProduct(req, res) {
  try {
    const { productId } = req.params;
    const numericId = Number(productId);
    if (!numericId) {
      return res.status(400).json({ error: 'Valid numeric productId is required' });
    }

    const { data, error } = await supabase
      .from('tracked_products')
      .delete()
      .eq('product_id', numericId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Tracked product not found' });
    }

    res.json({ message: 'Product untracked successfully', product_id: numericId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to untrack product', detail: err.message });
  }
}

// 4c. Untrack all products
export async function untrackAllProducts(req, res) {
  try {
    const { data, error } = await supabase
      .from('tracked_products')
      .delete()
      .neq('product_id', 0)
      .select();

    if (error) throw error;

    res.json({ message: 'All products untracked successfully', count: data ? data.length : 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed to untrack all products', detail: err.message });
  }
}


// 6. Price/stock history for one product
export async function getHistory(req, res) {
  try {
    const { productId } = req.params;
    const { data, error } = await supabase
      .from('price_history')
      .select('*')
      .eq('product_id', Number(productId))
      .order('scraped_at', { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history', detail: err.message });
  }
}

// 7. Scrape log for one product
export async function getLogs(req, res) {
  try {
    const { productId } = req.params;
    const { data, error } = await supabase
      .from('scrape_log')
      .select('*')
      .eq('product_id', Number(productId))
      .order('attempt_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch logs', detail: err.message });
  }
}

// 9. Aggregated dashboard summary for one product
export async function getSummary(req, res) {
  try {
    const productId = Number(req.params.productId);

    // Fetch price history and scrape log in parallel
    const [{ data: priceRows, error: priceError }, { data: logRows, error: logError }] =
      await Promise.all([
        supabase
          .from('price_history')
          .select('price, stock_status, scraped_at')
          .eq('product_id', productId)
          .order('scraped_at', { ascending: false }),
        supabase
          .from('scrape_log')
          .select('status, attempt_at')
          .eq('product_id', productId),
      ]);

    if (priceError) throw priceError;
    if (logError) throw logError;

    // --- Price stats (computed in JS) ---
    const prices = (priceRows || []).map((r) => Number(r.price)).filter((p) => Number.isFinite(p) && p > 0);
    const latest_price = priceRows && priceRows.length > 0 ? Number(priceRows[0].price) : null;
    const latest_stock_status = priceRows && priceRows.length > 0 ? priceRows[0].stock_status : null;
    const last_scraped_at = priceRows && priceRows.length > 0 ? priceRows[0].scraped_at : null;
    const lowest_price_seen = prices.length > 0 ? Math.min(...prices) : null;
    const highest_price_seen = prices.length > 0 ? Math.max(...prices) : null;

    // --- Attempt counts (computed in JS) ---
    const logs = logRows || [];
    const total_scrape_attempts = logs.length;
    const successful_scrapes = logs.filter((l) => l.status === 'success' || l.status === 'retried').length;
    const failed_scrapes = logs.filter((l) => l.status === 'failed').length;

    res.json({
      product_id: productId,
      latest_price,
      latest_stock_status,
      lowest_price_seen,
      highest_price_seen,
      total_scrape_attempts,
      successful_scrapes,
      failed_scrapes,
      last_scraped_at,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute summary', detail: err.message });
  }
}
