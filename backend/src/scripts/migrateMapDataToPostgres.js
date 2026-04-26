require("dotenv").config();

const sqliteDb = require("../db/database");
const { closePool, getPool, initDb } = require("../db");

main().catch((error) => {
  console.error("Map data migration failed:", error);
  process.exit(1);
});

async function main() {
  await initDb();

  const regionRows = sqliteDb
    .prepare("SELECT * FROM need_regions ORDER BY id ASC")
    .all();
  const hotspotRows = sqliteDb
    .prepare("SELECT * FROM hotspot_locations ORDER BY id ASC")
    .all();

  console.log(
    `Migrating ${regionRows.length} need regions and ${hotspotRows.length} hotspot rows to Postgres...`,
  );

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    await upsertNeedRegionBatches(client, regionRows, 100);
    await upsertHotspotBatches(client, hotspotRows, 250);

    if (hotspotRows.length > 0) {
      await client.query(
        `
          SELECT setval(
            pg_get_serial_sequence('hotspot_locations', 'id'),
            GREATEST((SELECT COALESCE(MAX(id), 1) FROM hotspot_locations), 1),
            true
          )
        `,
      );
    }

    if (regionRows.length > 0) {
      await client.query(
        `
          SELECT setval(
            pg_get_serial_sequence('need_regions', 'id'),
            GREATEST((SELECT COALESCE(MAX(id), 1) FROM need_regions), 1),
            true
          )
        `,
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await closePool();
  }

  console.log("Map data migration complete.");
}

async function upsertNeedRegionBatches(client, rows, chunkSize) {
  for (const chunk of chunkRows(rows, chunkSize)) {
    const values = [];
    const placeholders = chunk.map((row, index) => {
      const offset = index * 12;
      values.push(
        row.region_code,
        row.region_name,
        row.borough_name,
        row.region_type,
        normalizeJson(row.geometry_json),
        row.centroid_lat,
        row.centroid_lng,
        row.food_insecure_percentage,
        row.food_need_score,
        row.weighted_rank,
        row.source_year,
        normalizeTimestamp(row.updated_at),
      );

      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}::jsonb, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}::timestamptz)`;
    });

    await client.query(
      `
        INSERT INTO need_regions (
          region_code,
          region_name,
          borough_name,
          region_type,
          geometry_json,
          centroid_lat,
          centroid_lng,
          food_insecure_percentage,
          food_need_score,
          weighted_rank,
          source_year,
          updated_at
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT(region_code) DO UPDATE SET
          region_name = EXCLUDED.region_name,
          borough_name = EXCLUDED.borough_name,
          region_type = EXCLUDED.region_type,
          geometry_json = EXCLUDED.geometry_json,
          centroid_lat = EXCLUDED.centroid_lat,
          centroid_lng = EXCLUDED.centroid_lng,
          food_insecure_percentage = EXCLUDED.food_insecure_percentage,
          food_need_score = EXCLUDED.food_need_score,
          weighted_rank = EXCLUDED.weighted_rank,
          source_year = EXCLUDED.source_year,
          updated_at = EXCLUDED.updated_at
      `,
      values,
    );
  }
}

async function upsertHotspotBatches(client, rows, chunkSize) {
  for (const chunk of chunkRows(rows, chunkSize)) {
    const values = [];
    const placeholders = chunk.map((row, index) => {
      const offset = index * 22;
      values.push(
        row.id,
        row.source_key,
        row.osm_id,
        row.osm_type,
        row.name,
        row.category,
        row.address,
        row.neighborhood,
        row.region_code,
        row.region_name,
        row.region_need_score,
        row.priority,
        row.score,
        Boolean(row.covered),
        row.last_checked,
        row.assigned_to,
        row.notes,
        row.lat,
        row.lng,
        normalizeJson(row.tags_json),
        normalizeTimestamp(row.imported_at),
        normalizeTimestamp(row.updated_at),
      );

      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20}::jsonb, $${offset + 21}::timestamptz, $${offset + 22}::timestamptz)`;
    });

    await client.query(
      `
        INSERT INTO hotspot_locations (
          id,
          source_key,
          osm_id,
          osm_type,
          name,
          category,
          address,
          neighborhood,
          region_code,
          region_name,
          region_need_score,
          priority,
          score,
          covered,
          last_checked,
          assigned_to,
          notes,
          lat,
          lng,
          tags_json,
          imported_at,
          updated_at
        ) VALUES ${placeholders.join(", ")}
        ON CONFLICT(source_key) DO UPDATE SET
          osm_id = EXCLUDED.osm_id,
          osm_type = EXCLUDED.osm_type,
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          address = EXCLUDED.address,
          neighborhood = EXCLUDED.neighborhood,
          region_code = EXCLUDED.region_code,
          region_name = EXCLUDED.region_name,
          region_need_score = EXCLUDED.region_need_score,
          priority = EXCLUDED.priority,
          score = EXCLUDED.score,
          covered = EXCLUDED.covered,
          last_checked = EXCLUDED.last_checked,
          assigned_to = EXCLUDED.assigned_to,
          notes = EXCLUDED.notes,
          lat = EXCLUDED.lat,
          lng = EXCLUDED.lng,
          tags_json = EXCLUDED.tags_json,
          imported_at = EXCLUDED.imported_at,
          updated_at = EXCLUDED.updated_at
      `,
      values,
    );
  }
}

function chunkRows(rows, chunkSize) {
  const chunks = [];

  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }

  return chunks;
}

function normalizeJson(value) {
  if (!value) return "{}";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function normalizeTimestamp(value) {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return value;
}
