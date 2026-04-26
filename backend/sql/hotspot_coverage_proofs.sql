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

CREATE INDEX IF NOT EXISTS idx_hotspot_coverage_proofs_hotspot_id
  ON hotspot_coverage_proofs (hotspot_id);

CREATE INDEX IF NOT EXISTS idx_hotspot_coverage_proofs_user_id
  ON hotspot_coverage_proofs (user_id);

CREATE INDEX IF NOT EXISTS idx_hotspot_coverage_proofs_submitted_at
  ON hotspot_coverage_proofs (submitted_at DESC);

DROP TRIGGER IF EXISTS trg_hotspot_coverage_proofs_updated_at ON hotspot_coverage_proofs;
CREATE TRIGGER trg_hotspot_coverage_proofs_updated_at
BEFORE UPDATE ON hotspot_coverage_proofs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();
