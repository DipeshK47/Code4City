const { pool } = require("../db");

async function upsertUserStatsForSession(userId, flyersDelta, hoursDelta, date) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `
      INSERT INTO user_stats (id, flyers, hours, "updatedAt")
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (id) DO UPDATE SET
        flyers = user_stats.flyers + EXCLUDED.flyers,
        hours = user_stats.hours + EXCLUDED.hours,
        "updatedAt" = NOW()
      `,
      [userId, flyersDelta, hoursDelta]
    );

    await client.query(
      `
      INSERT INTO user_daily_activity (user_id, date, flyers, hours)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, date) DO UPDATE SET
        flyers = user_daily_activity.flyers + EXCLUDED.flyers,
        hours = user_daily_activity.hours + EXCLUDED.hours
      `,
      [userId, date, flyersDelta, hoursDelta]
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { upsertUserStatsForSession };
