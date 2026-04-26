const { pool, query } = require("../db");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getStoredNeedRegions, findNeedRegionForPointInRegions } = require("./needRegionService");
const { getRegionInsightsByCode } = require("./regionInsightsService");

const COORDINATOR_THRESHOLD = 3;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

async function getMeetupContext(meetupId) {
  const meetupResult = await query(
    `SELECT id, title, description, location_label, lat, lng, start_time, end_time,
            status, max_attendees, created_by
     FROM meetups WHERE id = $1`,
    [meetupId],
  );
  if (meetupResult.rows.length === 0) return null;
  const meetup = meetupResult.rows[0];

  const membersResult = await query(
    `SELECT m.user_id, m.role, m.joined_at, u.username, u.full_name
     FROM meetup_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.meetup_id = $1
     ORDER BY m.joined_at ASC`,
    [meetupId],
  );

  const regions = await getStoredNeedRegions();
  const region = findNeedRegionForPointInRegions(
    Number(meetup.lat),
    Number(meetup.lng),
    regions,
  );

  let regionInsight = null;
  if (region) {
    try {
      const insights = await getRegionInsightsByCode();
      regionInsight = insights.get(region.regionCode) || null;
    } catch {
      regionInsight = null;
    }
  }

  return {
    meetup: {
      id: String(meetup.id),
      title: meetup.title,
      description: meetup.description,
      locationLabel: meetup.location_label,
      lat: Number(meetup.lat),
      lng: Number(meetup.lng),
      startTime: meetup.start_time,
      endTime: meetup.end_time,
    },
    members: membersResult.rows.map((row) => ({
      userId: String(row.user_id),
      username: row.username,
      fullName: row.full_name || row.username,
      role: row.role,
    })),
    region: region
      ? {
          regionCode: region.regionCode,
          regionName: region.regionName,
          boroughName: region.boroughName,
        }
      : null,
    dominantGap: regionInsight?.dominantGap || null,
    categoryGaps: regionInsight?.categoryGaps || [],
  };
}

async function generateAssignmentPlan(meetupId) {
  const ctx = await getMeetupContext(meetupId);
  if (!ctx) throw new Error("Meetup not found");
  if (ctx.members.length < COORDINATOR_THRESHOLD) {
    return null;
  }

  const aiPlan = await callGeminiForPlan(ctx);
  const plan = aiPlan || fallbackPlan(ctx);
  await attachAssignedStops(plan, ctx);
  return plan;
}

const STOPS_PER_MEMBER = 5;

function haversineMiles(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingToDirection(originLat, originLng, lat, lng) {
  const dLng = (lng - originLng) * Math.cos((originLat * Math.PI) / 180);
  const dLat = lat - originLat;
  const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
  const compass = (angle + 360) % 360;
  if (compass < 22.5 || compass >= 337.5) return "N";
  if (compass < 67.5) return "NE";
  if (compass < 112.5) return "E";
  if (compass < 157.5) return "SE";
  if (compass < 202.5) return "S";
  if (compass < 247.5) return "SW";
  if (compass < 292.5) return "W";
  return "NW";
}

async function fetchNearbyHotspotsForMeetup(meetupLat, meetupLng, radiusMiles) {
  const latPad = radiusMiles / 69;
  const lngPad = radiusMiles / (69 * Math.cos((meetupLat * Math.PI) / 180));
  const result = await query(
    `SELECT id, name, category, address, lat, lng,
            region_code, region_name, region_need_score,
            score, covered, last_proof_at
     FROM hotspot_locations
     WHERE lat BETWEEN $1 AND $2
       AND lng BETWEEN $3 AND $4
     ORDER BY score DESC
     LIMIT 400`,
    [meetupLat - latPad, meetupLat + latPad, meetupLng - lngPad, meetupLng + lngPad],
  );
  return result.rows.map((row) => {
    const lat = Number(row.lat);
    const lng = Number(row.lng);
    return {
      id: String(row.id),
      name: row.name,
      category: row.category,
      address: row.address,
      lat,
      lng,
      regionCode: row.region_code || null,
      regionName: row.region_name || null,
      regionNeedScore:
        row.region_need_score === null ? null : Number(row.region_need_score),
      score: Number(row.score || 0),
      covered: Boolean(row.covered),
      lastProofAt:
        row.last_proof_at instanceof Date
          ? row.last_proof_at.toISOString()
          : row.last_proof_at,
      direction: bearingToDirection(meetupLat, meetupLng, lat, lng),
      distanceMiles: haversineMiles(meetupLat, meetupLng, lat, lng),
    };
  });
}

async function attachAssignedStops(plan, ctx) {
  if (!plan || !Array.isArray(plan.assignments) || plan.assignments.length === 0) return;

  let nearby = await fetchNearbyHotspotsForMeetup(
    ctx.meetup.lat,
    ctx.meetup.lng,
    1.6,
  );
  if (nearby.length < plan.assignments.length * STOPS_PER_MEMBER) {
    nearby = await fetchNearbyHotspotsForMeetup(ctx.meetup.lat, ctx.meetup.lng, 2.6);
  }

  const usedIds = new Set();

  for (const assignment of plan.assignments) {
    const dir = (assignment.direction || "").toUpperCase();
    const inDirection = nearby
      .filter((s) => s.direction === dir && !usedIds.has(s.id))
      .sort((a, b) => {
        if (a.covered !== b.covered) return a.covered ? 1 : -1;
        if (b.score !== a.score) return b.score - a.score;
        return a.distanceMiles - b.distanceMiles;
      });

    let picks = inDirection.slice(0, STOPS_PER_MEMBER);

    if (picks.length < STOPS_PER_MEMBER) {
      const adjacency = {
        N: ["NW", "NE"],
        NE: ["N", "E"],
        E: ["NE", "SE"],
        SE: ["E", "S"],
        S: ["SE", "SW"],
        SW: ["S", "W"],
        W: ["SW", "NW"],
        NW: ["W", "N"],
      };
      const adjacent = (adjacency[dir] || []).flatMap((d) =>
        nearby
          .filter((s) => s.direction === d && !usedIds.has(s.id))
          .filter((s) => !picks.some((p) => p.id === s.id)),
      );
      adjacent.sort((a, b) => a.distanceMiles - b.distanceMiles);
      picks = picks.concat(adjacent.slice(0, STOPS_PER_MEMBER - picks.length));
    }

    if (picks.length < STOPS_PER_MEMBER) {
      const anyDirection = nearby
        .filter((s) => !usedIds.has(s.id) && !picks.some((p) => p.id === s.id))
        .sort((a, b) => a.distanceMiles - b.distanceMiles);
      picks = picks.concat(anyDirection.slice(0, STOPS_PER_MEMBER - picks.length));
    }

    for (const s of picks) usedIds.add(s.id);

    assignment.assignedStops = picks.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      regionCode: s.regionCode,
      regionName: s.regionName,
      regionNeedScore: s.regionNeedScore,
      covered: s.covered,
      lastProofAt: s.lastProofAt,
      direction: s.direction,
      distanceMiles: Number(s.distanceMiles.toFixed(2)),
    }));
  }
}

async function callGeminiForPlan(ctx) {
  const client = getGeminiClient();
  if (!client) return null;

  try {
    const model = client.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
    });

    const memberList = ctx.members
      .map((m, i) => `${i + 1}. ${m.fullName} (@${m.username}) — id ${m.userId}`)
      .join("\n");

    const gapText = ctx.dominantGap
      ? `Biggest unmet need in this neighborhood: ${ctx.dominantGap.label} (avg ${ctx.dominantGap.avgDistanceMiles} mi to closest 4 resources).`
      : "Neighborhood gap data not available.";

    const regionLabel = ctx.region
      ? `${ctx.region.regionName}${ctx.region.boroughName ? ", " + ctx.region.boroughName : ""}`
      : "the meetup area";

    const meetTime = new Date(ctx.meetup.startTime).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });

    const prompt = `You are the meetup coordinator for a Volun-Tiers community outreach event.

Meetup: "${ctx.meetup.title}"
Description: ${ctx.meetup.description}
Meeting point: ${ctx.meetup.locationLabel} (${ctx.meetup.lat.toFixed(4)}, ${ctx.meetup.lng.toFixed(4)})
Start: ${meetTime}
Neighborhood: ${regionLabel}
${gapText}

Volunteers who joined (${ctx.members.length}):
${memberList}

Build a coverage plan that splits the area around the meetup point into ${ctx.members.length} mini-zones, one per volunteer. For each volunteer, assign:
- a compass direction relative to the meetup point (N, NE, E, SE, S, SW, W, NW)
- a focus category they should drop flyers about (pick from: food, shelter, healthcare, mental_health, substance_use, youth, senior — bias toward the area's biggest unmet need)
- a brief role title (≤4 words, e.g., "North leg captain")
- a one-sentence task description (≤25 words)

Also write a friendly group-chat opener (2-3 sentences) introducing yourself as Neighbour-Hood, the AI coordinator, and announcing the plan.

Output STRICT JSON only, no prose, no fences:
{
  "opener": "...",
  "assignments": [
    {
      "userId": "<exact id from list>",
      "username": "<exact username>",
      "direction": "NE",
      "focusCategory": "shelter",
      "roleTitle": "...",
      "task": "..."
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned);

    if (
      typeof parsed.opener === "string" &&
      Array.isArray(parsed.assignments) &&
      parsed.assignments.length > 0
    ) {
      const validCategories = new Set([
        "food",
        "shelter",
        "healthcare",
        "mental_health",
        "substance_use",
        "youth",
        "senior",
      ]);
      const assignments = parsed.assignments
        .filter((a) => a && typeof a.userId === "string")
        .map((a) => ({
          userId: a.userId,
          username: typeof a.username === "string" ? a.username : "",
          direction: typeof a.direction === "string" ? a.direction.slice(0, 4).toUpperCase() : "—",
          focusCategory: validCategories.has(a.focusCategory) ? a.focusCategory : "food",
          roleTitle:
            typeof a.roleTitle === "string"
              ? a.roleTitle.slice(0, 60)
              : "Outreach lead",
          task:
            typeof a.task === "string"
              ? a.task.slice(0, 200)
              : "Cover your assigned mini-zone.",
        }));

      if (assignments.length === ctx.members.length) {
        return {
          opener: parsed.opener.slice(0, 600),
          assignments,
          generatedBy: "gemini",
        };
      }
    }
  } catch {
    // fall through to fallback
  }
  return null;
}

function fallbackPlan(ctx) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const focus =
    ctx.dominantGap && ctx.dominantGap.category
      ? ctx.dominantGap.category
      : "food";
  const assignments = ctx.members.map((member, idx) => ({
    userId: member.userId,
    username: member.username,
    direction: directions[idx % directions.length],
    focusCategory: focus,
    roleTitle: idx === 0 ? "Lead coordinator" : "Outreach lead",
    task: `Cover the ${directions[idx % directions.length]} side of the meetup point. Drop flyers focused on ${focus}.`,
  }));

  return {
    opener: `Hi everyone — I'm Neighbour-Hood, your meetup coordinator. Here's a starting plan based on who's joined: ${ctx.members.length} volunteers split into ${ctx.members.length} mini-zones around the meeting point. Adjust freely once you're on the ground.`,
    assignments,
    generatedBy: "fallback",
  };
}

async function postCoordinatorPlan(meetupId, plan) {
  const messageText = formatPlanAsMessage(plan);
  const result = await query(
    `INSERT INTO meetup_messages (meetup_id, user_id, message_text, is_coordinator, assignments_json)
     VALUES ($1, NULL, $2, TRUE, $3::jsonb)
     RETURNING id, created_at`,
    [meetupId, messageText, JSON.stringify(plan.assignments || [])],
  );
  await query(`UPDATE meetups SET updated_at = NOW() WHERE id = $1`, [meetupId]);
  return {
    id: String(result.rows[0].id),
    createdAt: result.rows[0].created_at,
  };
}

function formatPlanAsMessage(plan) {
  const lines = [plan.opener || "Here's the plan:"];
  lines.push("");
  for (const assignment of plan.assignments || []) {
    lines.push(
      `• @${assignment.username} (${assignment.direction}) — ${assignment.roleTitle}: ${assignment.task}`,
    );
  }
  return lines.join("\n");
}

async function maybeAutoCoordinate(meetupId) {
  const countResult = await query(
    `SELECT COUNT(*)::int AS c FROM meetup_members WHERE meetup_id = $1`,
    [meetupId],
  );
  const count = countResult.rows[0]?.c || 0;
  if (count < COORDINATOR_THRESHOLD) return null;

  const lastCoord = await query(
    `SELECT id, created_at, assignments_json
     FROM meetup_messages
     WHERE meetup_id = $1 AND is_coordinator = TRUE
     ORDER BY created_at DESC
     LIMIT 1`,
    [meetupId],
  );
  const previous = lastCoord.rows[0];
  const previousAssignmentsCount = previous?.assignments_json
    ? (typeof previous.assignments_json === "string"
        ? JSON.parse(previous.assignments_json)
        : previous.assignments_json
      ).length
    : 0;

  if (previous && previousAssignmentsCount === count) {
    return null;
  }

  const plan = await generateAssignmentPlan(meetupId);
  if (!plan) return null;
  return postCoordinatorPlan(meetupId, plan);
}

module.exports = {
  COORDINATOR_THRESHOLD,
  getMeetupContext,
  generateAssignmentPlan,
  postCoordinatorPlan,
  maybeAutoCoordinate,
};
