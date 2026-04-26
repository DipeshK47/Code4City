const { pool } = require("../db");

async function getRecentActivity(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        users.username,
        route_sessions.id AS session_id,
        route_sessions.started_at,
        route_sessions.ended_at,
        route_sessions.duration_seconds,
        route_sessions.distance_meters,
        route_sessions.stops_json,
        route_sessions.created_at
      FROM route_sessions
      JOIN users ON users.id = route_sessions.user_id
      ORDER BY route_sessions.created_at DESC
      LIMIT 5
      `
    );

    const data = result.rows.map((row) => {
      const stopCount = Array.isArray(row.stops_json) ? row.stops_json.length : 0;
      return {
        username: row.username,
        session_id: row.session_id,
        action: stopCount > 0 ? `Distributed ${stopCount} flyer${stopCount === 1 ? "" : "s"}` : "Completed a route session",
        time: row.created_at,
        duration_seconds: row.duration_seconds,
        distance_meters: row.distance_meters,
      };
    });

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    console.error("Recent activity error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load recent activity.",
    });
  }
}

module.exports = { getRecentActivity };
