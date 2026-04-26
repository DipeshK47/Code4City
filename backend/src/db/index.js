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

      CREATE TABLE IF NOT EXISTS outreach_zones (
        id BIGSERIAL PRIMARY KEY,
        zone_key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        borough TEXT,
        boundary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
        center_lat DOUBLE PRECISION NOT NULL,
        center_lng DOUBLE PRECISION NOT NULL,
        need_score DOUBLE PRECISION NOT NULL DEFAULT 50,
        coverage_score DOUBLE PRECISION NOT NULL DEFAULT 0,
        service_gap_score DOUBLE PRECISION NOT NULL DEFAULT 50,
        estimated_households INTEGER NOT NULL DEFAULT 0,
        last_outreach_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_outreach_zones_need_score
        ON outreach_zones (need_score DESC);

      CREATE INDEX IF NOT EXISTS idx_outreach_zones_coverage_score
        ON outreach_zones (coverage_score ASC);

      DROP TRIGGER IF EXISTS trg_outreach_zones_updated_at ON outreach_zones;
      CREATE TRIGGER trg_outreach_zones_updated_at
      BEFORE UPDATE ON outreach_zones
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at_timestamp();

      CREATE TABLE IF NOT EXISTS outreach_events (
        id BIGSERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        category TEXT NOT NULL DEFAULT 'food',
        zone_id BIGINT REFERENCES outreach_zones(id) ON DELETE SET NULL,
        organizer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        location_label TEXT NOT NULL DEFAULT '',
        start_time TIMESTAMPTZ NOT NULL,
        end_time TIMESTAMPTZ,
        volunteer_capacity INTEGER NOT NULL DEFAULT 8,
        status TEXT NOT NULL DEFAULT 'upcoming',
        priority_score DOUBLE PRECISION NOT NULL DEFAULT 50,
        estimated_reach INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_outreach_events_start_time
        ON outreach_events (start_time ASC);

      CREATE INDEX IF NOT EXISTS idx_outreach_events_zone_id
        ON outreach_events (zone_id);

      CREATE INDEX IF NOT EXISTS idx_outreach_events_priority_score
        ON outreach_events (priority_score DESC);

      DROP TRIGGER IF EXISTS trg_outreach_events_updated_at ON outreach_events;
      CREATE TRIGGER trg_outreach_events_updated_at
      BEFORE UPDATE ON outreach_events
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at_timestamp();

      CREATE TABLE IF NOT EXISTS outreach_event_stops (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL REFERENCES outreach_events(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        address TEXT,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        stop_type TEXT NOT NULL DEFAULT 'community',
        priority_weight DOUBLE PRECISION NOT NULL DEFAULT 50,
        completed BOOLEAN NOT NULL DEFAULT FALSE,
        completed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_outreach_event_stops_event_id
        ON outreach_event_stops (event_id);

      CREATE INDEX IF NOT EXISTS idx_outreach_event_stops_completed
        ON outreach_event_stops (completed);

      DROP TRIGGER IF EXISTS trg_outreach_event_stops_updated_at ON outreach_event_stops;
      CREATE TRIGGER trg_outreach_event_stops_updated_at
      BEFORE UPDATE ON outreach_event_stops
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at_timestamp();

      CREATE TABLE IF NOT EXISTS outreach_event_assignments (
        id BIGSERIAL PRIMARY KEY,
        event_id BIGINT NOT NULL REFERENCES outreach_events(id) ON DELETE CASCADE,
        volunteer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
        volunteer_name TEXT,
        status TEXT NOT NULL DEFAULT 'joined',
        assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (event_id, volunteer_id)
      );

      CREATE INDEX IF NOT EXISTS idx_outreach_event_assignments_event_id
        ON outreach_event_assignments (event_id);

      CREATE INDEX IF NOT EXISTS idx_outreach_event_assignments_volunteer_id
        ON outreach_event_assignments (volunteer_id);

      CREATE INDEX IF NOT EXISTS idx_hotspot_locations_lat_lng ON hotspot_locations (lat, lng);
      CREATE INDEX IF NOT EXISTS idx_hotspot_locations_category ON hotspot_locations (category);
      CREATE INDEX IF NOT EXISTS idx_hotspot_locations_score ON hotspot_locations (score DESC);
      CREATE INDEX IF NOT EXISTS idx_hotspot_locations_region_code ON hotspot_locations (region_code);
      CREATE INDEX IF NOT EXISTS idx_need_regions_score ON need_regions (food_need_score DESC);
    `);

    await client.query(`
      INSERT INTO outreach_zones (
        zone_key,
        name,
        borough,
        boundary_json,
        center_lat,
        center_lng,
        need_score,
        coverage_score,
        service_gap_score,
        estimated_households,
        last_outreach_at
      )
      VALUES
        (
          'brooklyn-sunset-park',
          'Sunset Park Outreach Zone',
          'Brooklyn',
          '{"type":"Feature","properties":{"name":"Sunset Park Outreach Zone"}}'::jsonb,
          40.6454,
          -74.0121,
          88,
          22,
          76,
          14800,
          NOW() - INTERVAL '45 days'
        ),
        (
          'bronx-mott-haven',
          'Mott Haven Service Access Zone',
          'Bronx',
          '{"type":"Feature","properties":{"name":"Mott Haven Service Access Zone"}}'::jsonb,
          40.8091,
          -73.9229,
          92,
          18,
          82,
          13200,
          NOW() - INTERVAL '60 days'
        ),
        (
          'queens-jackson-heights',
          'Jackson Heights Community Aid Zone',
          'Queens',
          '{"type":"Feature","properties":{"name":"Jackson Heights Community Aid Zone"}}'::jsonb,
          40.7557,
          -73.8831,
          74,
          44,
          61,
          16500,
          NOW() - INTERVAL '20 days'
        )
      ON CONFLICT (zone_key) DO NOTHING;

      INSERT INTO outreach_events (
        title,
        description,
        category,
        zone_id,
        location_label,
        start_time,
        end_time,
        volunteer_capacity,
        status,
        priority_score,
        estimated_reach
      )
      SELECT
        seed.title,
        seed.description,
        seed.category,
        zones.id,
        seed.location_label,
        seed.start_time,
        seed.end_time,
        seed.volunteer_capacity,
        seed.status,
        seed.priority_score,
        seed.estimated_reach
      FROM (
        VALUES
          (
            'Sunset Park Food Access Outreach',
            'Distribute food pantry awareness flyers around transit, library, and community service corridors.',
            'food',
            'brooklyn-sunset-park',
            'Sunset Park, Brooklyn',
            NOW() + INTERVAL '2 days',
            NOW() + INTERVAL '2 days 3 hours',
            10,
            'upcoming',
            91,
            420
          ),
          (
            'Mott Haven Benefits Navigation Event',
            'Help residents discover nearby aid, food, and public health resources.',
            'community_aid',
            'bronx-mott-haven',
            'Mott Haven, Bronx',
            NOW() + INTERVAL '4 days',
            NOW() + INTERVAL '4 days 3 hours',
            12,
            'upcoming',
            94,
            510
          ),
          (
            'Jackson Heights Public Health Flyer Walk',
            'Canvass high-foot-traffic stops with multilingual health and service access materials.',
            'public_health',
            'queens-jackson-heights',
            'Jackson Heights, Queens',
            NOW() + INTERVAL '6 days',
            NOW() + INTERVAL '6 days 2 hours',
            8,
            'upcoming',
            76,
            360
          )
      ) AS seed (
        title,
        description,
        category,
        zone_key,
        location_label,
        start_time,
        end_time,
        volunteer_capacity,
        status,
        priority_score,
        estimated_reach
      )
      JOIN outreach_zones zones ON zones.zone_key = seed.zone_key
      WHERE NOT EXISTS (
        SELECT 1
        FROM outreach_events existing
        WHERE existing.title = seed.title
      );

      INSERT INTO outreach_event_stops (
        event_id,
        name,
        address,
        lat,
        lng,
        stop_type,
        priority_weight
      )
      SELECT
        events.id,
        seed.name,
        seed.address,
        seed.lat,
        seed.lng,
        seed.stop_type,
        seed.priority_weight
      FROM (
        VALUES
          ('Sunset Park Food Access Outreach', '59th Street Subway Exit', '59 St Station, Brooklyn, NY', 40.6417, -74.0177, 'transit', 95),
          ('Sunset Park Food Access Outreach', 'Sunset Park Library', '5108 4th Ave, Brooklyn, NY', 40.6456, -74.0118, 'library', 88),
          ('Sunset Park Food Access Outreach', 'Community Resource Corner', '5th Ave & 45th St, Brooklyn, NY', 40.6494, -74.0068, 'community', 72),
          ('Mott Haven Benefits Navigation Event', '3 Av-149 St Subway Plaza', '3 Av-149 St, Bronx, NY', 40.8161, -73.9178, 'transit', 96),
          ('Mott Haven Benefits Navigation Event', 'Mott Haven Library', '321 E 140th St, Bronx, NY', 40.8102, -73.9252, 'library', 84),
          ('Mott Haven Benefits Navigation Event', 'Health Resource Corridor', 'E 143rd St & Willis Ave, Bronx, NY', 40.8114, -73.9209, 'public_health', 80),
          ('Jackson Heights Public Health Flyer Walk', '74 St-Broadway Transit Hub', '74 St-Broadway, Queens, NY', 40.7468, -73.8917, 'transit', 94),
          ('Jackson Heights Public Health Flyer Walk', 'Jackson Heights Library', '35-51 81st St, Queens, NY', 40.7505, -73.8851, 'library', 78),
          ('Jackson Heights Public Health Flyer Walk', 'Diversity Plaza', '37th Rd & 73rd St, Queens, NY', 40.7476, -73.8922, 'community', 86)
      ) AS seed (
        event_title,
        name,
        address,
        lat,
        lng,
        stop_type,
        priority_weight
      )
      JOIN outreach_events events ON events.title = seed.event_title
      WHERE NOT EXISTS (
        SELECT 1
        FROM outreach_event_stops existing
        WHERE existing.event_id = events.id
          AND existing.name = seed.name
      );
    `);

    if (fs.existsSync(communitySchemaPath)) {
      await client.query(fs.readFileSync(communitySchemaPath, "utf8"));
    }

    if (fs.existsSync(hotspotCoverageSchemaPath)) {
      await client.query(fs.readFileSync(hotspotCoverageSchemaPath, "utf8"));
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
