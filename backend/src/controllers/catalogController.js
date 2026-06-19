import supabase from '../config/supabaseClient.js';

const STORE_BASE = 'https://demo.inelabteamdev.com';

// 1. Pass-through catalog proxy
export async function getCatalog(req, res) {
  try {
    const page = req.query.page || 1;
    const pageSize = req.query.pageSize || 20;
    const response = await fetch(`${STORE_BASE}/api/catalog?page=${page}&pageSize=${pageSize}`);
    if (!response.ok) throw new Error(`Store responded ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to fetch catalog', detail: err.message });
  }
}

// 2. Search catalog by product name substring match from persistent catalog_products table
export async function searchCatalog(req, res) {
  try {
    const q = (req.query.q || '').trim();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(1, parseInt(req.query.pageSize, 10) || 20);

    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize - 1;

    let query = supabase
      .from('catalog_products')
      .select('*', { count: 'exact' });

    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    query = query
      .order('id', { ascending: true })
      .range(startIdx, endIdx);

    const [searchResult, freshnessResult] = await Promise.all([
      query,
      supabase
        .from('catalog_products')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1),
    ]);

    if (searchResult.error) throw searchResult.error;

    const items = searchResult.data || [];
    const total = searchResult.count || 0;
    const pages = total > 0 ? Math.ceil(total / pageSize) : 0;

    const lastSyncedAt =
      freshnessResult.data && freshnessResult.data.length > 0
        ? freshnessResult.data[0].updated_at
        : null;

    res.json({
      page,
      pageSize,
      pages,
      total,
      lastSyncedAt,
      items,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search catalog', detail: err.message });
  }
}
