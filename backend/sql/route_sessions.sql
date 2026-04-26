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
