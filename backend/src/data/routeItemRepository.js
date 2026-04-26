const { pool } = require("../db");

function toIsoString(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRowToRouteItem(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    userId: row.user_id,
    itemType: row.item_type,
    dedupeKey: row.dedupe_key,
    hotspotId: row.hotspot_id != null ? String(row.hotspot_id) : null,
    sourceId: row.source_id,
    sourceKey: row.source_key,
    name: row.name,
    address: row.address,
    category: row.category,
    lat: Number(row.lat),
    lng: Number(row.lng),
    regionCode: row.region_code,
    metadata: row.metadata_json ?? {},
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

async function getAllRouteItems(userId) {
  const result = await pool.query(
    `
      SELECT *
      FROM saved_route_items
      WHERE user_id = $1
      ORDER BY created_at ASC, id ASC
    `,
    [userId],
  );

  return result.rows.map(mapRowToRouteItem);
}

async function upsertRouteItem(routeItem) {
  const result = await pool.query(
    `
      INSERT INTO saved_route_items (
        user_id,
        item_type,
        dedupe_key,
        hotspot_id,
        source_id,
        source_key,
        name,
        address,
        category,
        lat,
        lng,
        region_code,
        metadata_json
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb
      )
      ON CONFLICT (user_id, dedupe_key)
      DO UPDATE SET
        hotspot_id = EXCLUDED.hotspot_id,
        source_id = EXCLUDED.source_id,
        source_key = EXCLUDED.source_key,
        name = EXCLUDED.name,
        address = EXCLUDED.address,
        category = EXCLUDED.category,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        region_code = EXCLUDED.region_code,
        metadata_json = EXCLUDED.metadata_json,
        updated_at = NOW()
      RETURNING *
    `,
    [
      routeItem.userId,
      routeItem.itemType,
      routeItem.dedupeKey,
      routeItem.hotspotId,
      routeItem.sourceId,
      routeItem.sourceKey,
      routeItem.name,
      routeItem.address,
      routeItem.category,
      routeItem.lat,
      routeItem.lng,
      routeItem.regionCode,
      JSON.stringify(routeItem.metadata ?? {}),
    ],
  );

  return mapRowToRouteItem(result.rows[0]);
}

async function deleteRouteItem(id, userId) {
  const result = await pool.query(
    `
      DELETE FROM saved_route_items
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `,
    [id, userId],
  );

  return mapRowToRouteItem(result.rows[0]);
}

async function clearRouteItems(userId) {
  const result = await pool.query(
    `
      DELETE FROM saved_route_items
      WHERE user_id = $1
      RETURNING *
    `,
    [userId],
  );

  return result.rows.map(mapRowToRouteItem);
}

module.exports = {
  clearRouteItems,
  deleteRouteItem,
  getAllRouteItems,
  upsertRouteItem,
};
