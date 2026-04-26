const { pool } = require("../db");

function getDateFilter(period) {
  if (period === "week") return "NOW() - INTERVAL '7 days'";
  if (period === "month") return "DATE_TRUNC('month', NOW())";
  return null;
}

function isEnabled(value, fallback = true) {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

function getEnabledMetrics(query) {
  const enabled = {
    flyers: isEnabled(query.includeFlyers, true),
    scans: isEnabled(query.includeScans, true),
    hours: isEnabled(query.includeHours, true),
  };

  if (!enabled.flyers && !enabled.scans && !enabled.hours) {
    return { flyers: true, scans: true, hours: true };
  }

  return enabled;
}

function getOrderClause(enabledMetrics) {
  const clauses = [];

  if (enabledMetrics.flyers) clauses.push("flyers DESC");
  if (enabledMetrics.scans) clauses.push("scans DESC");
  if (enabledMetrics.hours) clauses.push("hours DESC");

  clauses.push("username ASC");
  return clauses.join(", ");
}

function getActivityWhereClause(enabledMetrics) {
  const clauses = [];

  if (enabledMetrics.flyers) clauses.push("flyers > 0");
  if (enabledMetrics.scans) clauses.push("scans > 0");
  if (enabledMetrics.hours) clauses.push("hours > 0");

  return clauses.length ? clauses.join(" OR ") : "TRUE";
}

async function getLeaderboard(req, res) {
  try {
    const period = req.query.period || "all";
    const dateFilter = getDateFilter(period);
    const enabledMetrics = getEnabledMetrics(req.query);
    const orderClause = getOrderClause(enabledMetrics);
    const activityWhereClause = getActivityWhereClause(enabledMetrics);

    let result;

    if (dateFilter) {
      try {
        result = await pool.query(
          `
          WITH stats AS (
            SELECT
              users.id,
              users.username,
              users.email,
              users.created_at,
              users.agreed_to_terms,
              profile_photos.image_url AS profile_photo_url,
              COALESCE(SUM(uda.flyers), 0)::BIGINT AS flyers,
              COALESCE(user_stats.scans, 0)::BIGINT AS scans,
              COALESCE(SUM(uda.hours), 0)::DOUBLE PRECISION AS hours
            FROM users
            LEFT JOIN profile_photos ON profile_photos.user_id = users.id
            LEFT JOIN user_stats ON user_stats.id = users.id
            LEFT JOIN user_daily_activity uda
              ON uda.user_id = users.id
              AND uda.date >= ${dateFilter}
            GROUP BY users.id, users.username, users.email, users.created_at,
                     users.agreed_to_terms, profile_photos.image_url, user_stats.scans
          ),
          ranked AS (
            SELECT *,
              DENSE_RANK() OVER (
                ORDER BY ${orderClause}
              ) AS rank_position
            FROM stats
          )
          SELECT *
          FROM ranked
          WHERE ${activityWhereClause}
          ORDER BY rank_position ASC, username ASC
          `
        );
      } catch (queryErr) {
        const msg = queryErr.message || "";
        if (msg.includes("user_daily_activity") && (msg.includes("does not exist") || msg.includes("relation"))) {
          return res.json({ success: true, count: 0, data: [], podium: [] });
        }
        throw queryErr;
      }
    } else {
      try {
        result = await pool.query(
          `
          WITH stats AS (
            SELECT
              users.id,
              users.username,
              users.email,
              users.created_at,
              users.agreed_to_terms,
              profile_photos.image_url AS profile_photo_url,
              COALESCE(user_stats.flyers, 0)::BIGINT AS flyers,
              COALESCE(user_stats.scans, 0)::BIGINT AS scans,
              COALESCE(user_stats.hours, 0)::DOUBLE PRECISION AS hours
            FROM users
            LEFT JOIN profile_photos ON profile_photos.user_id = users.id
            LEFT JOIN user_stats ON user_stats.id = users.id
          ),
          ranked AS (
            SELECT *,
              DENSE_RANK() OVER (
                ORDER BY ${orderClause}
              ) AS rank_position
            FROM stats
          )
          SELECT *
          FROM ranked
          ORDER BY rank_position ASC, username ASC
          `
        );
      } catch (queryErr) {
        const msg = queryErr.message || "";
        if (msg.includes("user_stats") && (msg.includes("does not exist") || msg.includes("relation"))) {
          result = await pool.query(`
            WITH base AS (
              SELECT
                users.id, users.username, users.email, users.created_at,
                users.agreed_to_terms,
                profile_photos.image_url AS profile_photo_url,
                0::BIGINT AS flyers, 0::BIGINT AS scans, 0::DOUBLE PRECISION AS hours
              FROM users
              LEFT JOIN profile_photos ON profile_photos.user_id = users.id
            ),
            numbered AS (
              SELECT *, ROW_NUMBER() OVER (ORDER BY username ASC)::INTEGER AS rank_position
              FROM base
            )
            SELECT * FROM numbered ORDER BY rank_position ASC
          `);
        } else {
          throw queryErr;
        }
      }
    }

    const data = result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      created_at: row.created_at,
      agreed_to_terms: row.agreed_to_terms,
      profile_photo_url: row.profile_photo_url,
      flyers: Number(row.flyers ?? 0),
      scans: Number(row.scans ?? 0),
      hours: Number(row.hours ?? 0),
      total_duration_seconds: Math.round(Number(row.hours ?? 0) * 3600),
      session_count: 0,
      total_distance_meters: 0,
      total_stops: 0,
      rank: row.rank_position,
    }));

    const podium = [...result.rows]
      .sort((a, b) => (a.rank_position ?? 999) - (b.rank_position ?? 999))
      .slice(0, 3)
      .map((row, index) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        created_at: row.created_at,
        agreed_to_terms: row.agreed_to_terms,
        profile_photo_url: row.profile_photo_url,
        flyers: Number(row.flyers ?? 0),
        scans: Number(row.scans ?? 0),
        hours: Number(row.hours ?? 0),
        total_duration_seconds: Math.round(Number(row.hours ?? 0) * 3600),
        rank: index + 1,
      }));

    const top10 = data.slice(0, 10);

    const totalUsersResult = await pool.query(`SELECT COUNT(*)::int AS total FROM users`);
    const totalVolunteers = totalUsersResult.rows[0]?.total ?? 0;

    const totalFlyers = data.reduce((sum, row) => sum + row.flyers, 0);
    const totalScans = data.reduce((sum, row) => sum + row.scans, 0);
    const totalHours = data.reduce((sum, row) => sum + row.hours, 0);

    return res.json({
      success: true,
      count: top10.length,
      data: top10,
      podium,
      enabledMetrics,
      totalVolunteers,
      totalFlyers,
      totalScans,
      totalHours: Math.round(totalHours * 10) / 10,
    });
  } catch (error) {
    console.error("Leaderboard error:", error);
    const message = error.message || "Failed to load leaderboard.";
    return res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === "development" ? message : "Failed to load leaderboard.",
    });
  }
}

module.exports = { getLeaderboard };
