-- Supabase PostgreSQL Schema for PriceTracker
-- Idempotent script: Safe to run multiple times in the Supabase SQL Editor.

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Table: tracked_products
-- Catalog items actively monitored by the scraper.
CREATE TABLE IF NOT EXISTS tracked_products (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  product_id integer UNIQUE NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  brand text,
  category text,
  created_at timestamptz DEFAULT now()
);

-- 3. Table: price_history
-- Verified price snapshots recorded upon successful scrape completions.
CREATE TABLE IF NOT EXISTS price_history (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  product_id integer NOT NULL REFERENCES tracked_products(product_id) ON DELETE CASCADE,
  price numeric NOT NULL,
  stock_status text,
  scraped_at timestamptz DEFAULT now()
);

-- Index for efficient time-series queries per product
CREATE INDEX IF NOT EXISTS idx_price_history_product_time 
  ON price_history(product_id, scraped_at DESC);

-- 4. Table: scrape_log
-- Audit logs of every individual scrape attempt, durations, and diagnostics.
CREATE TABLE IF NOT EXISTS scrape_log (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  product_id integer NOT NULL REFERENCES tracked_products(product_id) ON DELETE CASCADE,
  attempt_at timestamptz DEFAULT now(),
  status text NOT NULL CHECK (status IN ('success', 'retried', 'failed')),
  duration_ms integer,
  detail text
);

-- Index for fast retrieval of latest scrape attempts per product
CREATE INDEX IF NOT EXISTS idx_scrape_log_product_attempt 
  ON scrape_log(product_id, attempt_at DESC);

-- 5. Table: catalog_products
-- Persistent local mirror of upstream catalog items for resilient search across cold starts.
CREATE TABLE IF NOT EXISTS catalog_products (
  id integer PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  brand text,
  category text,
  sku text,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- B-Tree index on lower(name) for case-insensitive exact/prefix searches
CREATE INDEX IF NOT EXISTS idx_catalog_products_lower_name 
  ON catalog_products(lower(name));

-- Trigram GIN index for fast fuzzy and substring ILIKE searches
CREATE INDEX IF NOT EXISTS idx_catalog_products_name_trgm 
  ON catalog_products USING gin (name gin_trgm_ops);

-- 6. Updated_at Trigger for catalog_products
CREATE OR REPLACE FUNCTION set_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_catalog_products_updated_at ON catalog_products;
CREATE TRIGGER trg_catalog_products_updated_at
BEFORE UPDATE ON catalog_products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_column();

-- 7. Enable Row Level Security (RLS) on all tables
-- Backend connects using SUPABASE_SERVICE_KEY (service role), which automatically bypasses RLS.
ALTER TABLE tracked_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;
