ALTER TABLE hotspot_locations
  ADD COLUMN IF NOT EXISTS last_proof_at TIMESTAMPTZ;

ALTER TABLE hotspot_locations
  ADD COLUMN IF NOT EXISTS coverage_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE hotspot_locations
  ADD COLUMN IF NOT EXISTS foot_traffic_profile JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS ai_route_plan_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  strategy TEXT NOT NULL,
  request_json JSONB NOT NULL,
  response_json JSONB,
  fallback_used BOOLEAN NOT NULL DEFAULT FALSE,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_route_plan_logs_user_id ON ai_route_plan_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_ai_route_plan_logs_created_at ON ai_route_plan_logs (created_at DESC);
