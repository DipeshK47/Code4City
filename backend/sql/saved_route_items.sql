CREATE TABLE IF NOT EXISTS saved_route_items (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('hotspot', 'printer')),
  dedupe_key TEXT NOT NULL,
  hotspot_id BIGINT REFERENCES hotspot_locations(id) ON DELETE SET NULL,
  source_id TEXT,
  source_key TEXT,
  name TEXT NOT NULL,
  address TEXT,
  category TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  region_code TEXT REFERENCES need_regions(region_code) ON DELETE SET NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_saved_route_items_user_created
  ON saved_route_items (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_route_items_item_type
  ON saved_route_items (item_type);

CREATE INDEX IF NOT EXISTS idx_saved_route_items_hotspot_id
  ON saved_route_items (hotspot_id);

CREATE INDEX IF NOT EXISTS idx_saved_route_items_region_code
  ON saved_route_items (region_code);

CREATE INDEX IF NOT EXISTS idx_saved_route_items_lat_lng
  ON saved_route_items (lat, lng);

DROP TRIGGER IF EXISTS trg_saved_route_items_updated_at ON saved_route_items;
CREATE TRIGGER trg_saved_route_items_updated_at
BEFORE UPDATE ON saved_route_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
