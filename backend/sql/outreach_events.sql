CREATE TABLE IF NOT EXISTS outreach_zones (
  id BIGSERIAL PRIMARY KEY,
  zone_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  borough TEXT,
  boundary_json JSONB,
  center_lat DOUBLE PRECISION NOT NULL DEFAULT 40.7128,
  center_lng DOUBLE PRECISION NOT NULL DEFAULT -74.006,
  need_score DOUBLE PRECISION NOT NULL DEFAULT 50,
  coverage_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  service_gap_score DOUBLE PRECISION NOT NULL DEFAULT 50,
  estimated_households INT NOT NULL DEFAULT 0,
  last_outreach_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_events (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'food',
  zone_id BIGINT REFERENCES outreach_zones(id) ON DELETE SET NULL,
  organizer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  location_label TEXT NOT NULL DEFAULT '',
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  volunteer_capacity INT NOT NULL DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'open',
  priority_score INT NOT NULL DEFAULT 50,
  estimated_reach INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_event_stops (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES outreach_events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  stop_type TEXT NOT NULL DEFAULT 'distribution_point',
  priority_weight DOUBLE PRECISION NOT NULL DEFAULT 5,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_event_assignments (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES outreach_events(id) ON DELETE CASCADE,
  volunteer_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  volunteer_name TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outreach_events_zone_id ON outreach_events(zone_id);
CREATE INDEX IF NOT EXISTS idx_outreach_events_status ON outreach_events(status);
CREATE INDEX IF NOT EXISTS idx_outreach_events_start_time ON outreach_events(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_event_stops_event_id ON outreach_event_stops(event_id);
CREATE INDEX IF NOT EXISTS idx_outreach_event_assignments_event_id ON outreach_event_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_outreach_event_assignments_volunteer_id ON outreach_event_assignments(volunteer_id);
