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
  return plan;
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

Also write a friendly group-chat opener (2-3 sentences) introducing yourself as the coordinator and announcing the plan.

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
    opener: `Hi everyone — I'm Citrus, your meetup coordinator. Here's a starting plan based on who's joined: ${ctx.members.length} volunteers split into ${ctx.members.length} mini-zones around the meeting point. Adjust freely once you're on the ground.`,
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
