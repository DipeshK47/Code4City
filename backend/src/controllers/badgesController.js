const { pool } = require("../db");

async function getBadges(req, res) {
  try {
    const userId = req.user.id;

    let flyers = 0;
    let hours = 0;
    let scans = 0;
    const statsRow = await pool.query(
      "SELECT flyers, hours, scans FROM user_stats WHERE id = $1",
      [userId]
    );
    if (statsRow.rows[0]) {
      flyers = Number(statsRow.rows[0].flyers || 0);
      hours = Number(statsRow.rows[0].hours ?? 0);
      scans = Number(statsRow.rows[0].scans ?? 0);
    } else {
      const fallback = await pool.query(
        "SELECT COALESCE(SUM(jsonb_array_length(stops_json)), 0) AS total FROM route_sessions WHERE user_id = $1",
        [userId]
      );
      flyers = Number(fallback.rows[0]?.total || 0);
    }

    const rankResult = await pool.query(
      `
      WITH stats AS (
        SELECT
          users.id,
          COALESCE(user_stats.flyers, 0)::BIGINT AS flyers,
          COALESCE(user_stats.hours, 0)::DOUBLE PRECISION AS hours
        FROM users
        LEFT JOIN user_stats ON user_stats.id = users.id
      ),
      ranked AS (
        SELECT
          id,
          DENSE_RANK() OVER (
            ORDER BY (flyers * 1.5 + hours) DESC, hours DESC, id ASC
          ) AS rank
        FROM stats
      )
      SELECT rank FROM ranked WHERE id = $1
      `,
      [userId]
    );
    const rank = rankResult.rows[0] ? Number(rankResult.rows[0].rank) : null;

    const streakResult = await pool.query(
      `
      SELECT date FROM user_daily_activity
      WHERE user_id = $1
      ORDER BY date DESC
      LIMIT 30
      `,
      [userId]
    );
    const dates = streakResult.rows.map((r) => r.date).filter(Boolean);
    let streakDays = 0;
    if (dates.length > 0) {
      const sorted = [...dates].sort((a, b) => new Date(b) - new Date(a));
      const today = new Date().toISOString().slice(0, 10);
      let check = today;
      for (const d of sorted) {
        const dStr = typeof d === "string" ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10);
        if (dStr === check) {
          streakDays += 1;
          const next = new Date(check);
          next.setDate(next.getDate() - 1);
          check = next.toISOString().slice(0, 10);
        } else if (new Date(dStr) < new Date(check)) {
          break;
        }
      }
    }
    const onAStreak = streakDays >= 2;

    const firstFlyer = flyers >= 1;
    const hundredFlyers = flyers >= 100;
    const top5 = rank !== null && rank <= 5;
    const top1 = rank === 1;

    return res.json({
      success: true,
      data: {
        first_flyer: firstFlyer,
        hundred_flyers: hundredFlyers,
        on_a_streak: onAStreak,
        top_5: top5,
        top_1: top1,
        flyers,
        scans,
        hours,
        rank,
        streak_days: streakDays,
      },
    });
  } catch (error) {
    console.error("Badges error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load badges.",
    });
  }
}

module.exports = { getBadges };
