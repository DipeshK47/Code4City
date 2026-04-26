const { pool } = require("../db");
const {
  normalizeRoutePoints,
  normalizeSessionStops,
} = require("../services/sessionNormalization");

function toIsoString(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRowToSession(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    userId: row.user_id,
    startTime: toIsoString(row.started_at),
    endTime: toIsoString(row.ended_at),
    status: row.status,
    routePoints: normalizeRoutePoints(row.route_points_json ?? []),
    stops: normalizeSessionStops(row.stops_json ?? []),
    durationSeconds: row.duration_seconds,
    totalDistanceMeters: Number(row.distance_meters ?? 0),
    totalDistanceMiles: Number(row.distance_miles ?? 0),
    routeImageUrl: row.route_image_url,
    startLat: row.start_lat,
    startLng: row.start_lng,
    endLat: row.end_lat,
    endLng: row.end_lng,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

async function getAllSessions(userId) {
  const result = await pool.query(
    `
      SELECT *
      FROM route_sessions
      WHERE user_id = $1
      ORDER BY started_at DESC, id DESC
    `,
    [userId]
  );

  return result.rows.map(mapRowToSession);
}

async function getSessionById(id, userId) {
  const result = await pool.query(
    `
      SELECT *
      FROM route_sessions
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [id, userId]
  );

  return mapRowToSession(result.rows[0]);
}

async function createSession(session) {
  const result = await pool.query(
    `
      INSERT INTO route_sessions (
        user_id,
        started_at,
        ended_at,
        duration_seconds,
        distance_miles,
        distance_meters,
        route_points_json,
        stops_json,
        route_image_url,
        start_lat,
        start_lng,
        end_lat,
        end_lng,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11, $12, $13, $14
      )
      RETURNING *
    `,
    [
      session.userId,
      session.startedAt,
      session.endedAt,
      session.durationSeconds,
      session.distanceMiles,
      session.distanceMeters,
      JSON.stringify(session.routePoints),
      JSON.stringify(session.stops),
      session.routeImageUrl,
      session.startLat,
      session.startLng,
      session.endLat,
      session.endLng,
      session.status,
    ]
  );

  return mapRowToSession(result.rows[0]);
}

async function deleteSession(id, userId) {
  const result = await pool.query(
    `
      DELETE FROM route_sessions
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `,
    [id, userId]
  );

  return mapRowToSession(result.rows[0]);
}

module.exports = {
  getAllSessions,
  getSessionById,
  createSession,
  deleteSession,
};
