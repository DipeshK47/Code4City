const { pool, query } = require("../db");
const {
  getStoredNeedRegions,
  findNeedRegionForPointInRegions,
} = require("./needRegionService");

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const LOOKBACK_WEEKS = 8;
const MIN_UNIQUE_USERS = 3;

async function generateSuggestions() {
  const sessionsResult = await query(
    `SELECT user_id, started_at, start_lat, start_lng,
            EXTRACT(DOW FROM started_at)::int AS dow
     FROM route_sessions
     WHERE started_at >= NOW() - INTERVAL '${LOOKBACK_WEEKS} weeks'
       AND status = 'completed'
       AND start_lat IS NOT NULL
       AND start_lng IS NOT NULL`,
  );

  const regions = await getStoredNeedRegions();

  const clusters = new Map();
  for (const row of sessionsResult.rows) {
    const lat = Number(row.start_lat);
    const lng = Number(row.start_lng);
    const region = findNeedRegionForPointInRegions(lat, lng, regions);
    if (!region) continue;
    const key = `${region.regionCode}|${row.dow}`;
    if (!clusters.has(key)) {
      clusters.set(key, {
        regionCode: region.regionCode,
        regionName: region.regionName,
        boroughName: region.boroughName,
        dayOfWeek: row.dow,
        userIds: new Set(),
        latSum: 0,
        lngSum: 0,
        count: 0,
      });
    }
    const cluster = clusters.get(key);
    cluster.userIds.add(String(row.user_id));
    cluster.latSum += lat;
    cluster.lngSum += lng;
    cluster.count += 1;
  }

  const qualifying = Array.from(clusters.values()).filter(
    (c) => c.userIds.size >= MIN_UNIQUE_USERS,
  );

  const created = [];
  const skipped = [];

  for (const cluster of qualifying) {
    const existing = await query(
      `SELECT id FROM suggested_events
       WHERE region_code = $1 AND day_of_week = $2 AND status = 'pending'
       LIMIT 1`,
      [cluster.regionCode, cluster.dayOfWeek],
    );
    if (existing.rows.length > 0) {
      skipped.push({ regionCode: cluster.regionCode, dayOfWeek: cluster.dayOfWeek });
      continue;
    }

    const centerLat = cluster.latSum / cluster.count;
    const centerLng = cluster.lngSum / cluster.count;
    const suggestedDate = nextDateForDow(cluster.dayOfWeek);
    const dayName = DAY_NAMES[cluster.dayOfWeek];
    const rationale = `${cluster.userIds.size} volunteers ran solo sessions in ${cluster.regionName} on ${dayName} during the last ${LOOKBACK_WEEKS} weeks. Coordinating could double their reach.`;

    const insertResult = await query(
      `INSERT INTO suggested_events (
         region_code, region_name, borough_name, day_of_week,
         suggested_date, center_lat, center_lng,
         unique_user_count, sample_user_ids, rationale, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, 'pending')
       RETURNING id, created_at`,
      [
        cluster.regionCode,
        cluster.regionName,
        cluster.boroughName || "",
        cluster.dayOfWeek,
        suggestedDate,
        centerLat,
        centerLng,
        cluster.userIds.size,
        JSON.stringify(Array.from(cluster.userIds).slice(0, 10)),
        rationale,
      ],
    );

    created.push({
      id: insertResult.rows[0].id,
      regionCode: cluster.regionCode,
      regionName: cluster.regionName,
      dayOfWeek: cluster.dayOfWeek,
      uniqueUserCount: cluster.userIds.size,
    });
  }

  return {
    sessionsAnalyzed: sessionsResult.rows.length,
    qualifyingClusters: qualifying.length,
    created: created.length,
    skipped: skipped.length,
    suggestions: created,
  };
}

async function listPendingSuggestions() {
  const result = await query(
    `SELECT id, region_code, region_name, borough_name, day_of_week,
            suggested_date, center_lat, center_lng, unique_user_count,
            sample_user_ids, rationale, status, meetup_id, created_at
     FROM suggested_events
     WHERE status = 'pending'
     ORDER BY unique_user_count DESC, created_at DESC`,
  );
  return result.rows.map(normalizeRow);
}

async function dismissSuggestion(id) {
  const result = await query(
    `UPDATE suggested_events
     SET status = 'dismissed', updated_at = NOW()
     WHERE id = $1 AND status = 'pending'
     RETURNING id`,
    [id],
  );
  return result.rows.length > 0;
}

async function approveSuggestionAsMeetup(id, userId) {
  const result = await query(
    `SELECT id, region_code, region_name, borough_name, day_of_week,
            suggested_date, center_lat, center_lng, unique_user_count, rationale
     FROM suggested_events WHERE id = $1 AND status = 'pending'`,
    [id],
  );
  if (result.rows.length === 0) return null;
  const suggestion = result.rows[0];

  const startDate = new Date(suggestion.suggested_date);
  startDate.setUTCHours(15, 0, 0, 0);
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  const dayName = DAY_NAMES[suggestion.day_of_week];
  const title = `${dayName} group outreach in ${suggestion.region_name}`;
  const description = `Auto-suggested by Volun-Tiers based on volunteer activity. ${suggestion.rationale}`;
  const locationLabel = `${suggestion.region_name}${suggestion.borough_name ? ", " + suggestion.borough_name : ""}`;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const meetupResult = await client.query(
      `INSERT INTO meetups (
         created_by, title, description, location_label, lat, lng,
         start_time, end_time, status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
       RETURNING id`,
      [
        userId,
        title,
        description,
        locationLabel,
        Number(suggestion.center_lat),
        Number(suggestion.center_lng),
        startDate.toISOString(),
        endDate.toISOString(),
      ],
    );
    const meetupId = meetupResult.rows[0].id;

    await client.query(
      `INSERT INTO meetup_members (meetup_id, user_id, role)
       VALUES ($1, $2, 'host')
       ON CONFLICT (meetup_id, user_id) DO NOTHING`,
      [meetupId, userId],
    );

    await client.query(
      `UPDATE suggested_events
       SET status = 'approved', meetup_id = $1, updated_at = NOW()
       WHERE id = $2`,
      [meetupId, id],
    );

    await client.query("COMMIT");
    return { suggestionId: id, meetupId: String(meetupId) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function normalizeRow(row) {
  return {
    id: String(row.id),
    regionCode: row.region_code,
    regionName: row.region_name,
    boroughName: row.borough_name || "",
    dayOfWeek: row.day_of_week,
    dayName: DAY_NAMES[row.day_of_week],
    suggestedDate: row.suggested_date,
    centerLat: row.center_lat === null ? null : Number(row.center_lat),
    centerLng: row.center_lng === null ? null : Number(row.center_lng),
    uniqueUserCount: row.unique_user_count,
    sampleUserIds:
      typeof row.sample_user_ids === "string"
        ? JSON.parse(row.sample_user_ids)
        : row.sample_user_ids,
    rationale: row.rationale,
    status: row.status,
    meetupId: row.meetup_id ? String(row.meetup_id) : null,
    createdAt: row.created_at,
  };
}

function nextDateForDow(targetDow) {
  const today = new Date();
  const todayDow = today.getUTCDay();
  let daysAhead = (targetDow - todayDow + 7) % 7;
  if (daysAhead === 0) daysAhead = 7;
  const target = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}

async function seedDemoSessions() {
  const userResult = await query(
    `SELECT id FROM users ORDER BY id ASC LIMIT 5`,
  );
  const userIds = userResult.rows.map((r) => Number(r.id));
  if (userIds.length < 3) {
    throw new Error("Need at least 3 users in the database to seed demo sessions");
  }

  const seedSpots = [
    {
      regionName: "Crown Heights (South)",
      lat: 40.6627,
      lng: -73.9396,
      targetDow: 0,
    },
    {
      regionName: "Sunset Park (West)",
      lat: 40.6505,
      lng: -74.0064,
      targetDow: 6,
    },
    {
      regionName: "Washington Heights (South)",
      lat: 40.8417,
      lng: -73.9393,
      targetDow: 0,
    },
  ];

  let inserted = 0;
  const today = new Date();
  for (const spot of seedSpots) {
    for (let weekOffset = 1; weekOffset <= 4; weekOffset += 1) {
      for (let i = 0; i < Math.min(userIds.length, 4); i += 1) {
        const userId = userIds[i];
        const sessionDate = new Date(today);
        sessionDate.setUTCDate(today.getUTCDate() - weekOffset * 7);
        const currentDow = sessionDate.getUTCDay();
        const dowDelta = (spot.targetDow - currentDow + 7) % 7;
        sessionDate.setUTCDate(sessionDate.getUTCDate() - dowDelta);
        sessionDate.setUTCHours(15 + i * 2, 0, 0, 0);
        const startTime = sessionDate.toISOString();
        const endTime = new Date(sessionDate.getTime() + 90 * 60 * 1000).toISOString();

        await query(
          `INSERT INTO route_sessions (
             user_id, started_at, ended_at, duration_seconds, distance_miles,
             distance_meters, route_points_json, stops_json,
             start_lat, start_lng, end_lat, end_lng, status
           )
           VALUES ($1, $2, $3, $4, $5, $6, '[]'::jsonb, '[]'::jsonb,
                   $7, $8, $9, $10, 'completed')`,
          [
            userId,
            startTime,
            endTime,
            90 * 60,
            1.4,
            2253,
            spot.lat + (Math.random() - 0.5) * 0.005,
            spot.lng + (Math.random() - 0.5) * 0.005,
            spot.lat + (Math.random() - 0.5) * 0.005,
            spot.lng + (Math.random() - 0.5) * 0.005,
          ],
        );
        inserted += 1;
      }
    }
  }

  return { inserted, seedSpots };
}

module.exports = {
  generateSuggestions,
  listPendingSuggestions,
  approveSuggestionAsMeetup,
  dismissSuggestion,
  seedDemoSessions,
};
