const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
let pool;

const communitySchemaPath = path.resolve(
  __dirname,
  "../../sql/community_meetups_chat.sql",
);
const hotspotCoverageSchemaPath = path.resolve(
  __dirname,
  "../../sql/hotspot_coverage_proofs.sql",
);
const outreachEventsSchemaPath = path.resolve(
  __dirname,
  "../../sql/outreach_events.sql",
);

function getConnectionString() {
  return process.env.DATABASE_URL;
}

function getPool() {
  if (pool) return pool;

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to use the Postgres backend.");
  }

  const isSupabase = connectionString.includes("supabase");
  // const ssl =
  //   process.env.NODE_ENV === "production"
  //     ? { rejectUnauthorized: true }
  //     : isSupabase
  //       ? { rejectUnauthorized: false }
  //       : false;

  const ssl = isSupabase
  ? { rejectUnauthorized: false }
  : process.env.NODE_ENV === "production"
  ? { rejectUnauthorized: true }
  : false;

  pool = new Pool({
    connectionString,
    ssl,
  });

  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function closePool() {
  if (!pool) return;
  const activePool = pool;
  pool = undefined;
  await activePool.end();
}

const poolFacade = {
  query: (...args) => getPool().query(...args),
  connect: (...args) => getPool().connect(...args),
};

async function initDb() {
  const client = await getPool().connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        agreed_to_terms BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        full_name TEXT DEFAULT ''
      );

      ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT '';

      CREATE TABLE IF NOT EXISTS need_regions (
        id BIGSERIAL PRIMARY KEY,
        region_code TEXT NOT NULL UNIQUE,
        region_name TEXT NOT NULL,
        borough_name TEXT,
        region_type TEXT,
        geometry_json JSONB NOT NULL,
        centroid_lat DOUBLE PRECISION NOT NULL,
        centroid_lng DOUBLE PRECISION NOT NULL,
        food_insecure_percentage DOUBLE PRECISION,
        food_need_score DOUBLE PRECISION NOT NULL,
        weighted_rank INTEGER,
        source_year TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE need_regions ADD COLUMN IF NOT EXISTS health_access_score DOUBLE PRECISION;
      ALTER TABLE need_regions ADD COLUMN IF NOT EXISTS housing_instability_score DOUBLE PRECISION;
      ALTER TABLE need_regions ADD COLUMN IF NOT EXISTS substance_use_score DOUBLE PRECISION;
      ALTER TABLE need_regions ADD COLUMN IF NOT EXISTS composite_need_score DOUBLE PRECISION;
      ALTER TABLE need_regions ALTER COLUMN food_need_score DROP NOT NULL;

      CREATE TABLE IF NOT EXISTS hotspot_locations (
        id BIGSERIAL PRIMARY KEY,
        source_key TEXT NOT NULL UNIQUE,
        osm_id TEXT NOT NULL,
        osm_type TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        address TEXT,
        neighborhood TEXT,
        region_code TEXT REFERENCES need_regions(region_code) ON DELETE SET NULL,
        region_name TEXT,
        region_need_score DOUBLE PRECISION,
        priority TEXT NOT NULL DEFAULT 'Medium',
        score DOUBLE PRECISION NOT NULL DEFAULT 0,
        covered BOOLEAN NOT NULL DEFAULT FALSE,
        last_checked TEXT NOT NULL DEFAULT 'Imported from OSM',
        assigned_to TEXT NOT NULL DEFAULT 'Open shift',
        notes TEXT NOT NULL DEFAULT '',
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        tags_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

      CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TABLE IF NOT EXISTS route_sessions (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        started_at TIMESTAMPTZ NOT NULL,
        ended_at TIMESTAMPTZ NOT NULL,
        duration_seconds INT NOT NULL,
        distance_miles FLOAT8 NOT NULL DEFAULT 0,
        distance_meters FLOAT8 NOT NULL DEFAULT 0,
        route_points_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        stops_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        route_image_url TEXT,
        start_lat FLOAT8,
        start_lng FLOAT8,
        end_lat FLOAT8,
        end_lng FLOAT8,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_route_sessions_user_id
        ON route_sessions (user_id);

      CREATE INDEX IF NOT EXISTS idx_route_sessions_started_at
        ON route_sessions (started_at DESC);

      DROP TRIGGER IF EXISTS trg_route_sessions_updated_at ON route_sessions;
      CREATE TRIGGER trg_route_sessions_updated_at
      BEFORE UPDATE ON route_sessions
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at_timestamp();

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

      CREATE TABLE IF NOT EXISTS profile_photos (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id
        ON profile_photos (user_id);

      DROP TRIGGER IF EXISTS trg_profile_photos_updated_at ON profile_photos;
      CREATE TRIGGER trg_profile_photos_updated_at
      BEFORE UPDATE ON profile_photos
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at_timestamp();

      CREATE TABLE IF NOT EXISTS user_stats (
        id INT PRIMARY KEY REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        flyers BIGINT NOT NULL DEFAULT 0,
        hours DOUBLE PRECISION NOT NULL DEFAULT 0,
        scans BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE user_stats
      ADD COLUMN IF NOT EXISTS scans BIGINT NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS user_qrcodes (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        slug TEXT NOT NULL UNIQUE,
        target_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS user_daily_activity (
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        flyers INT NOT NULL DEFAULT 0,
        hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, date)
      );

      CREATE INDEX IF NOT EXISTS idx_user_daily_activity_user_date
      ON user_daily_activity (user_id, date DESC);

      CREATE INDEX IF NOT EXISTS idx_hotspot_locations_lat_lng ON hotspot_locations (lat, lng);
      CREATE INDEX IF NOT EXISTS idx_hotspot_locations_category ON hotspot_locations (category);
      CREATE INDEX IF NOT EXISTS idx_hotspot_locations_score ON hotspot_locations (score DESC);
      CREATE INDEX IF NOT EXISTS idx_hotspot_locations_region_code ON hotspot_locations (region_code);
      CREATE INDEX IF NOT EXISTS idx_need_regions_score ON need_regions (food_need_score DESC);

      CREATE TABLE IF NOT EXISTS service_resources (
        id BIGSERIAL PRIMARY KEY,
        source_key TEXT NOT NULL UNIQUE,
        source_dataset TEXT NOT NULL,
        service_type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        address TEXT,
        borough TEXT,
        zip TEXT,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        phone TEXT,
        hours TEXT,
        website TEXT,
        eligibility TEXT,
        region_code TEXT REFERENCES need_regions(region_code) ON DELETE SET NULL,
        region_name TEXT,
        region_need_score DOUBLE PRECISION,
        tags_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_service_resources_type ON service_resources (service_type);
      CREATE INDEX IF NOT EXISTS idx_service_resources_lat_lng ON service_resources (lat, lng);
      CREATE INDEX IF NOT EXISTS idx_service_resources_region_code ON service_resources (region_code);

      DROP TRIGGER IF EXISTS trg_service_resources_updated_at ON service_resources;
      CREATE TRIGGER trg_service_resources_updated_at
      BEFORE UPDATE ON service_resources
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at_timestamp();

      CREATE TABLE IF NOT EXISTS generated_flyers (
        id TEXT PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        drop_name TEXT NOT NULL,
        drop_lat DOUBLE PRECISION NOT NULL,
        drop_lng DOUBLE PRECISION NOT NULL,
        region_code TEXT,
        region_name TEXT,
        dominant_category TEXT NOT NULL,
        headline TEXT NOT NULL,
        blurb TEXT NOT NULL,
        resources_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        qr_slug TEXT,
        qr_target_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_generated_flyers_user_id ON generated_flyers (user_id);
      CREATE INDEX IF NOT EXISTS idx_generated_flyers_created_at ON generated_flyers (created_at DESC);

      ALTER TABLE generated_flyers ADD COLUMN IF NOT EXISTS secondary_language TEXT;
      ALTER TABLE generated_flyers ADD COLUMN IF NOT EXISTS secondary_language_name TEXT;
      ALTER TABLE generated_flyers ADD COLUMN IF NOT EXISTS headline_translated TEXT;
      ALTER TABLE generated_flyers ADD COLUMN IF NOT EXISTS blurb_translated TEXT;
      ALTER TABLE generated_flyers ADD COLUMN IF NOT EXISTS translated_labels JSONB;

      CREATE TABLE IF NOT EXISTS suggested_events (
        id BIGSERIAL PRIMARY KEY,
        region_code TEXT,
        region_name TEXT,
        borough_name TEXT,
        day_of_week INTEGER NOT NULL,
        suggested_date DATE,
        center_lat DOUBLE PRECISION,
        center_lng DOUBLE PRECISION,
        unique_user_count INTEGER NOT NULL DEFAULT 0,
        sample_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        rationale TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        meetup_id BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_suggested_events_status ON suggested_events (status);
      CREATE INDEX IF NOT EXISTS idx_suggested_events_region ON suggested_events (region_code, day_of_week);
    `);

    if (fs.existsSync(communitySchemaPath)) {
      await client.query(fs.readFileSync(communitySchemaPath, "utf8"));
      await client.query(`
        ALTER TABLE meetup_messages ADD COLUMN IF NOT EXISTS is_coordinator BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE meetup_messages ADD COLUMN IF NOT EXISTS assignments_json JSONB;
        ALTER TABLE meetup_messages ALTER COLUMN user_id DROP NOT NULL;
      `);
    }

    if (fs.existsSync(hotspotCoverageSchemaPath)) {
      await client.query(fs.readFileSync(hotspotCoverageSchemaPath, "utf8"));
    }

    if (fs.existsSync(outreachEventsSchemaPath)) {
      await client.query(fs.readFileSync(outreachEventsSchemaPath, "utf8"));
    }
  } finally {
    client.release();
  }
}

module.exports = {
  closePool,
  getPool,
  initDb,
  pool: poolFacade,
  query,
};
