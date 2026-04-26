const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dataDir = path.join(__dirname, "../../data");
const dbPath = process.env.SQLITE_DB_PATH || path.join(dataDir, "hotspots.sqlite");

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS hotspot_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_key TEXT NOT NULL UNIQUE,
    osm_id TEXT NOT NULL,
    osm_type TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    address TEXT,
    neighborhood TEXT,
    region_code TEXT,
    region_name TEXT,
    region_need_score REAL,
    priority TEXT NOT NULL DEFAULT 'Medium',
    score REAL NOT NULL DEFAULT 0,
    covered INTEGER NOT NULL DEFAULT 0,
    last_checked TEXT NOT NULL DEFAULT 'Imported from OSM',
    assigned_to TEXT NOT NULL DEFAULT 'Open shift',
    notes TEXT NOT NULL DEFAULT '',
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    tags_json TEXT NOT NULL DEFAULT '{}',
    imported_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_hotspot_locations_lat_lng
    ON hotspot_locations (lat, lng);

  CREATE INDEX IF NOT EXISTS idx_hotspot_locations_category
    ON hotspot_locations (category);

  CREATE TABLE IF NOT EXISTS need_regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    region_code TEXT NOT NULL UNIQUE,
    region_name TEXT NOT NULL,
    borough_name TEXT,
    region_type TEXT,
    geometry_json TEXT NOT NULL,
    centroid_lat REAL NOT NULL,
    centroid_lng REAL NOT NULL,
    food_insecure_percentage REAL,
    food_need_score REAL NOT NULL,
    weighted_rank INTEGER,
    source_year TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_need_regions_score
    ON need_regions (food_need_score DESC);
`);

ensureColumn("hotspot_locations", "score", "ALTER TABLE hotspot_locations ADD COLUMN score REAL NOT NULL DEFAULT 0");
ensureColumn("hotspot_locations", "region_code", "ALTER TABLE hotspot_locations ADD COLUMN region_code TEXT");
ensureColumn("hotspot_locations", "region_name", "ALTER TABLE hotspot_locations ADD COLUMN region_name TEXT");
ensureColumn("hotspot_locations", "region_need_score", "ALTER TABLE hotspot_locations ADD COLUMN region_need_score REAL");
ensureColumn("need_regions", "food_insecure_percentage", "ALTER TABLE need_regions ADD COLUMN food_insecure_percentage REAL");
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_hotspot_locations_score
    ON hotspot_locations (score DESC);

  CREATE INDEX IF NOT EXISTS idx_hotspot_locations_region_code
    ON hotspot_locations (region_code);
`);

module.exports = db;

function ensureColumn(tableName, columnName, alterSql) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) return;
  db.exec(alterSql);
}
