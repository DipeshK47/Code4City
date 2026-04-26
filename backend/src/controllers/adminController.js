const { query } = require("../db");

function toNumber(value, digits) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  if (typeof digits === "number") {
    return Number(numeric.toFixed(digits));
  }
  return numeric;
}

async function getAdminOverview(req, res) {
  try {
    const [
      summaryResult,
      topVolunteersResult,
      recentSessionsResult,
      dailyProgressResult,
      regionsResult,
      categoryResult,
    ] = await Promise.all([
      query(`
        WITH volunteer_totals AS (
          SELECT
            COUNT(*)::int AS total_volunteers,
            COUNT(*) FILTER (WHERE agreed_to_terms = TRUE)::int AS active_accounts
          FROM users
        ),
        recent_active AS (
          SELECT COUNT(DISTINCT user_id)::int AS active_last_30_days
          FROM (
            SELECT user_id
            FROM route_sessions
            WHERE started_at >= NOW() - INTERVAL '30 days'
            UNION
            SELECT user_id
            FROM user_daily_activity
            WHERE date >= CURRENT_DATE - INTERVAL '30 days'
          ) activity
        ),
        stat_totals AS (
          SELECT
            COALESCE(SUM(flyers), 0)::bigint AS total_flyers,
            COALESCE(SUM(hours), 0)::double precision AS total_hours,
            COALESCE(SUM(scans), 0)::bigint AS total_scans
          FROM user_stats
        ),
        session_totals AS (
          SELECT
            COUNT(*)::int AS total_sessions,
            COALESCE(SUM(distance_miles), 0)::double precision AS total_distance_miles,
            COALESCE(AVG(distance_miles), 0)::double precision AS avg_distance_miles,
            COALESCE(AVG(duration_seconds), 0)::double precision AS avg_duration_seconds
          FROM route_sessions
        ),
        route_item_totals AS (
          SELECT COUNT(*)::int AS pending_route_items FROM saved_route_items
        ),
        qr_totals AS (
          SELECT COUNT(*)::int AS qr_codes_issued FROM user_qrcodes
        ),
        hotspot_totals AS (
          SELECT
            COUNT(*)::int AS total_hotspots,
            COUNT(*) FILTER (WHERE covered = TRUE)::int AS covered_hotspots,
            COUNT(*) FILTER (WHERE covered = FALSE)::int AS uncovered_hotspots,
            COUNT(DISTINCT region_code)::int AS mapped_regions
          FROM hotspot_locations
        ),
        community_totals AS (
          SELECT
            (SELECT COUNT(*)::int FROM community_posts WHERE deleted_at IS NULL) AS community_posts,
            (SELECT COUNT(*)::int FROM post_comments WHERE deleted_at IS NULL) AS post_comments,
            (SELECT COUNT(*)::int FROM meetups) AS meetups,
            (SELECT COUNT(*)::int FROM meetups WHERE status = 'active') AS active_meetups,
            (SELECT COUNT(*)::int FROM meetup_members) AS meetup_members,
            (SELECT COUNT(*)::int FROM meetup_messages) AS meetup_messages
        )
        SELECT
          volunteer_totals.total_volunteers,
          volunteer_totals.active_accounts,
          recent_active.active_last_30_days,
          stat_totals.total_flyers,
          stat_totals.total_hours,
          stat_totals.total_scans,
          session_totals.total_sessions,
          session_totals.total_distance_miles,
          session_totals.avg_distance_miles,
          session_totals.avg_duration_seconds,
          route_item_totals.pending_route_items,
          qr_totals.qr_codes_issued,
          hotspot_totals.total_hotspots,
          hotspot_totals.covered_hotspots,
          hotspot_totals.uncovered_hotspots,
          hotspot_totals.mapped_regions,
          community_totals.community_posts,
          community_totals.post_comments,
          community_totals.meetups,
          community_totals.active_meetups,
          community_totals.meetup_members,
          community_totals.meetup_messages
        FROM volunteer_totals
        CROSS JOIN recent_active
        CROSS JOIN stat_totals
        CROSS JOIN session_totals
        CROSS JOIN route_item_totals
        CROSS JOIN qr_totals
        CROSS JOIN hotspot_totals
        CROSS JOIN community_totals
      `),
      query(`
        WITH session_rollup AS (
          SELECT
            user_id,
            COUNT(*)::int AS session_count,
            COALESCE(SUM(distance_miles), 0)::double precision AS distance_miles,
            COALESCE(SUM(jsonb_array_length(stops_json)), 0)::int AS stops_logged
          FROM route_sessions
          GROUP BY user_id
        )
        SELECT
          users.id,
          COALESCE(NULLIF(users.full_name, ''), users.username) AS display_name,
          users.username,
          users.email,
          COALESCE(user_stats.flyers, 0)::bigint AS flyers,
          COALESCE(user_stats.hours, 0)::double precision AS hours,
          COALESCE(user_stats.scans, 0)::bigint AS scans,
          COALESCE(session_rollup.session_count, 0)::int AS session_count,
          COALESCE(session_rollup.distance_miles, 0)::double precision AS distance_miles,
          COALESCE(session_rollup.stops_logged, 0)::int AS stops_logged
        FROM users
        LEFT JOIN user_stats ON user_stats.id = users.id
        LEFT JOIN session_rollup ON session_rollup.user_id = users.id
        ORDER BY
          COALESCE(user_stats.flyers, 0) DESC,
          COALESCE(user_stats.hours, 0) DESC,
          COALESCE(user_stats.scans, 0) DESC,
          users.username ASC
        LIMIT 8
      `),
      query(`
        SELECT
          route_sessions.id,
          COALESCE(NULLIF(users.full_name, ''), users.username) AS volunteer_name,
          users.username,
          route_sessions.started_at,
          route_sessions.ended_at,
          route_sessions.duration_seconds,
          route_sessions.distance_miles,
          COALESCE(jsonb_array_length(route_sessions.route_points_json), 0)::int AS route_point_count,
          COALESCE(jsonb_array_length(route_sessions.stops_json), 0)::int AS stop_count,
          route_sessions.status
        FROM route_sessions
        JOIN users ON users.id = route_sessions.user_id
        ORDER BY route_sessions.started_at DESC
        LIMIT 8
      `),
      query(`
        WITH days AS (
          SELECT generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day')::date AS day
        ),
        flyers AS (
          SELECT
            date AS day,
            COALESCE(SUM(flyers), 0)::bigint AS flyers,
            COALESCE(SUM(hours), 0)::double precision AS hours
          FROM user_daily_activity
          WHERE date >= CURRENT_DATE - INTERVAL '13 days'
          GROUP BY date
        ),
        sessions AS (
          SELECT
            started_at::date AS day,
            COUNT(*)::int AS sessions,
            COALESCE(SUM(distance_miles), 0)::double precision AS distance_miles
          FROM route_sessions
          WHERE started_at >= CURRENT_DATE - INTERVAL '13 days'
          GROUP BY started_at::date
        ),
        signups AS (
          SELECT
            created_at::date AS day,
            COUNT(*)::int AS signups
          FROM users
          WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
          GROUP BY created_at::date
        )
        SELECT
          days.day,
          COALESCE(flyers.flyers, 0)::bigint AS flyers,
          COALESCE(flyers.hours, 0)::double precision AS hours,
          COALESCE(sessions.sessions, 0)::int AS sessions,
          COALESCE(sessions.distance_miles, 0)::double precision AS distance_miles,
          COALESCE(signups.signups, 0)::int AS signups
        FROM days
        LEFT JOIN flyers ON flyers.day = days.day
        LEFT JOIN sessions ON sessions.day = days.day
        LEFT JOIN signups ON signups.day = days.day
        ORDER BY days.day ASC
      `),
      query(`
        WITH region_hotspots AS (
          SELECT
            region_code,
            COUNT(*)::int AS total_hotspots,
            COUNT(*) FILTER (WHERE covered = TRUE)::int AS covered_hotspots,
            COUNT(*) FILTER (WHERE covered = FALSE)::int AS uncovered_hotspots
          FROM hotspot_locations
          WHERE region_code IS NOT NULL
          GROUP BY region_code
        )
        SELECT
          need_regions.region_code,
          need_regions.region_name,
          need_regions.borough_name,
          need_regions.food_insecure_percentage,
          need_regions.food_need_score,
          COALESCE(region_hotspots.total_hotspots, 0)::int AS total_hotspots,
          COALESCE(region_hotspots.covered_hotspots, 0)::int AS covered_hotspots,
          COALESCE(region_hotspots.uncovered_hotspots, 0)::int AS uncovered_hotspots
        FROM need_regions
        LEFT JOIN region_hotspots ON region_hotspots.region_code = need_regions.region_code
        WHERE COALESCE(region_hotspots.total_hotspots, 0) > 0
        ORDER BY
          COALESCE(region_hotspots.uncovered_hotspots, 0) DESC,
          COALESCE(need_regions.food_insecure_percentage, 0) DESC,
          COALESCE(need_regions.food_need_score, 0) DESC
        LIMIT 6
      `),
      query(`
        SELECT
          category,
          COUNT(*)::int AS total_spots,
          COUNT(*) FILTER (WHERE covered = TRUE)::int AS covered_spots
        FROM hotspot_locations
        GROUP BY category
        ORDER BY total_spots DESC, category ASC
        LIMIT 8
      `),
    ]);

    const summary = summaryResult.rows[0] || {};
    const totalHotspots = toNumber(summary.total_hotspots);
    const coveredHotspots = toNumber(summary.covered_hotspots);
    const uncoveredHotspots = toNumber(summary.uncovered_hotspots);
    const totalSessions = toNumber(summary.total_sessions);
    const qrCodesIssued = toNumber(summary.qr_codes_issued);

    return res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        summary: {
          totalVolunteers: toNumber(summary.total_volunteers),
          activeAccounts: toNumber(summary.active_accounts),
          activeLast30Days: toNumber(summary.active_last_30_days),
          totalFlyers: toNumber(summary.total_flyers),
          totalHours: toNumber(summary.total_hours, 1),
          totalScans: toNumber(summary.total_scans),
          totalSessions,
          totalDistanceMiles: toNumber(summary.total_distance_miles, 1),
          averageSessionMiles: toNumber(summary.avg_distance_miles, 2),
          averageSessionMinutes: toNumber(summary.avg_duration_seconds / 60, 1),
          pendingRouteItems: toNumber(summary.pending_route_items),
          qrCodesIssued,
          avgScansPerCode: qrCodesIssued ? toNumber(summary.total_scans / qrCodesIssued, 1) : 0,
          totalHotspots,
          coveredHotspots,
          uncoveredHotspots,
          hotspotCoverageRate: totalHotspots ? toNumber((coveredHotspots / totalHotspots) * 100, 1) : 0,
          mappedRegions: toNumber(summary.mapped_regions),
          communityPosts: toNumber(summary.community_posts),
          postComments: toNumber(summary.post_comments),
          meetups: toNumber(summary.meetups),
          activeMeetups: toNumber(summary.active_meetups),
          meetupMembers: toNumber(summary.meetup_members),
          meetupMessages: toNumber(summary.meetup_messages),
        },
        topVolunteers: topVolunteersResult.rows.map((row) => ({
          id: row.id,
          displayName: row.display_name,
          username: row.username,
          email: row.email,
          flyers: toNumber(row.flyers),
          hours: toNumber(row.hours, 1),
          scans: toNumber(row.scans),
          sessions: toNumber(row.session_count),
          distanceMiles: toNumber(row.distance_miles, 1),
          stopsLogged: toNumber(row.stops_logged),
        })),
        recentSessions: recentSessionsResult.rows.map((row) => ({
          id: row.id,
          volunteerName: row.volunteer_name,
          username: row.username,
          startedAt: row.started_at,
          endedAt: row.ended_at,
          durationSeconds: toNumber(row.duration_seconds),
          distanceMiles: toNumber(row.distance_miles, 2),
          routePoints: toNumber(row.route_point_count),
          stops: toNumber(row.stop_count),
          status: row.status,
        })),
        dailyProgress: dailyProgressResult.rows.map((row) => ({
          day: row.day,
          flyers: toNumber(row.flyers),
          hours: toNumber(row.hours, 1),
          sessions: toNumber(row.sessions),
          distanceMiles: toNumber(row.distance_miles, 1),
          signups: toNumber(row.signups),
        })),
        needRegions: regionsResult.rows.map((row) => ({
          regionCode: row.region_code,
          regionName: row.region_name,
          boroughName: row.borough_name,
          foodInsecurePercentage: toNumber(row.food_insecure_percentage, 1),
          foodNeedScore: toNumber(row.food_need_score, 2),
          totalHotspots: toNumber(row.total_hotspots),
          coveredHotspots: toNumber(row.covered_hotspots),
          uncoveredHotspots: toNumber(row.uncovered_hotspots),
          coverageRate: row.total_hotspots
            ? toNumber((Number(row.covered_hotspots) / Number(row.total_hotspots)) * 100, 1)
            : 0,
        })),
        hotspotCategories: categoryResult.rows.map((row) => ({
          category: row.category,
          totalSpots: toNumber(row.total_spots),
          coveredSpots: toNumber(row.covered_spots),
          uncoveredSpots: toNumber(row.total_spots) - toNumber(row.covered_spots),
        })),
      },
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    return res.status(500).json({
      success: false,
      message:
        process.env.NODE_ENV === "development"
          ? error.message || "Failed to load admin overview."
          : "Failed to load admin overview.",
    });
  }
}

module.exports = { getAdminOverview };
