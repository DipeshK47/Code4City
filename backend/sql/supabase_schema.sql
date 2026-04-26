-- Code4City Supabase schema
-- Run this once in Supabase Dashboard > SQL Editor > New Query.
-- The app connects through the backend with DATABASE_URL, so no Supabase JS
-- client tables or public Row Level Security policies are required here.

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  agreed_to_terms BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  full_name TEXT DEFAULT ''
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT '';

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

CREATE TABLE IF NOT EXISTS profile_photos (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS meetups (
  id BIGSERIAL PRIMARY KEY,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  linked_post_id BIGINT,
  max_attendees INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_posts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  meetup_id BIGINT REFERENCES meetups(id) ON DELETE SET NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS post_likes (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_comments (
  id BIGSERIAL PRIMARY KEY,
  post_id BIGINT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_comment_id BIGINT REFERENCES post_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS meetup_members (
  id BIGSERIAL PRIMARY KEY,
  meetup_id BIGINT NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  role TEXT NOT NULL DEFAULT 'member'
);

CREATE TABLE IF NOT EXISTS meetup_messages (
  id BIGSERIAL PRIMARY KEY,
  meetup_id BIGINT NOT NULL REFERENCES meetups(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dm_threads (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dm_thread_members (
  id BIGSERIAL PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dm_messages (
  id BIGSERIAL PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
  sender_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS hotspot_coverage_proofs (
  id BIGSERIAL PRIMARY KEY,
  hotspot_id BIGINT NOT NULL REFERENCES hotspot_locations(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  notes TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE meetups
  ADD COLUMN IF NOT EXISTS linked_post_id BIGINT;

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS meetup_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meetups_linked_post_id_fkey'
  ) THEN
    ALTER TABLE meetups
      ADD CONSTRAINT meetups_linked_post_id_fkey
      FOREIGN KEY (linked_post_id) REFERENCES community_posts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_need_regions_score ON need_regions (food_need_score DESC);
CREATE INDEX IF NOT EXISTS idx_hotspot_locations_lat_lng ON hotspot_locations (lat, lng);
CREATE INDEX IF NOT EXISTS idx_hotspot_locations_category ON hotspot_locations (category);
CREATE INDEX IF NOT EXISTS idx_hotspot_locations_score ON hotspot_locations (score DESC);
CREATE INDEX IF NOT EXISTS idx_hotspot_locations_region_code ON hotspot_locations (region_code);

CREATE INDEX IF NOT EXISTS idx_route_sessions_user_id
  ON route_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_route_sessions_started_at
  ON route_sessions (started_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_profile_photos_user_id
  ON profile_photos (user_id);

CREATE INDEX IF NOT EXISTS idx_user_daily_activity_user_date
  ON user_daily_activity (user_id, date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_likes_unique
  ON post_likes (post_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meetup_members_unique
  ON meetup_members (meetup_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dm_thread_members_unique
  ON dm_thread_members (thread_id, user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meetups_linked_post_id
  ON meetups (linked_post_id)
  WHERE linked_post_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_community_posts_meetup_id
  ON community_posts (meetup_id)
  WHERE meetup_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_community_posts_created_at
  ON community_posts (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id
  ON post_comments (post_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_post_comments_parent_comment_id
  ON post_comments (parent_comment_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_meetups_start_time
  ON meetups (start_time ASC);

CREATE INDEX IF NOT EXISTS idx_meetups_status_start_time
  ON meetups (status, start_time ASC);

CREATE INDEX IF NOT EXISTS idx_meetups_lat_lng
  ON meetups (lat, lng);

CREATE INDEX IF NOT EXISTS idx_meetup_messages_meetup_id
  ON meetup_messages (meetup_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_dm_messages_thread_id
  ON dm_messages (thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_dm_messages_read_at
  ON dm_messages (thread_id, read_at);

CREATE INDEX IF NOT EXISTS idx_hotspot_coverage_proofs_hotspot_id
  ON hotspot_coverage_proofs (hotspot_id);

CREATE INDEX IF NOT EXISTS idx_hotspot_coverage_proofs_user_id
  ON hotspot_coverage_proofs (user_id);

CREATE INDEX IF NOT EXISTS idx_hotspot_coverage_proofs_submitted_at
  ON hotspot_coverage_proofs (submitted_at DESC);

DROP TRIGGER IF EXISTS trg_route_sessions_updated_at ON route_sessions;
CREATE TRIGGER trg_route_sessions_updated_at
BEFORE UPDATE ON route_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_saved_route_items_updated_at ON saved_route_items;
CREATE TRIGGER trg_saved_route_items_updated_at
BEFORE UPDATE ON saved_route_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_profile_photos_updated_at ON profile_photos;
CREATE TRIGGER trg_profile_photos_updated_at
BEFORE UPDATE ON profile_photos
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_community_posts_updated_at ON community_posts;
CREATE TRIGGER trg_community_posts_updated_at
BEFORE UPDATE ON community_posts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_post_comments_updated_at ON post_comments;
CREATE TRIGGER trg_post_comments_updated_at
BEFORE UPDATE ON post_comments
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_meetups_updated_at ON meetups;
CREATE TRIGGER trg_meetups_updated_at
BEFORE UPDATE ON meetups
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_meetup_messages_updated_at ON meetup_messages;
CREATE TRIGGER trg_meetup_messages_updated_at
BEFORE UPDATE ON meetup_messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_dm_threads_updated_at ON dm_threads;
CREATE TRIGGER trg_dm_threads_updated_at
BEFORE UPDATE ON dm_threads
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_dm_messages_updated_at ON dm_messages;
CREATE TRIGGER trg_dm_messages_updated_at
BEFORE UPDATE ON dm_messages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_hotspot_coverage_proofs_updated_at ON hotspot_coverage_proofs;
CREATE TRIGGER trg_hotspot_coverage_proofs_updated_at
BEFORE UPDATE ON hotspot_coverage_proofs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
