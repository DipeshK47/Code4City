const { GoogleGenerativeAI } = require("@google/generative-ai");
const {
  inferTimeWindow,
  planDeterministic,
  validateAiOrder,
  computeRouteGeometry,
  haversineMeters,
  metersToMiles,
  WALK_MINUTES_PER_MILE,
  STOP_MINUTES,
  categoryTimeFit,
} = require("./routePlannerService");

const MODEL_NAME =
  process.env.AI_ROUTE_MODEL || "gemini-2.5-flash-lite";
const MAX_CANDIDATES = 30;
const AI_TIMEOUT_MS = Number(process.env.AI_ROUTE_TIMEOUT_MS) || 25000;

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

function summarizeStop(stop, origin, timeWindow) {
  const distance = Number.isFinite(stop.distanceMiles)
    ? stop.distanceMiles
    : metersToMiles(haversineMeters(origin, stop));
  return {
    id: stop.id,
    name: stop.name,
    category: stop.category || "",
    covered: Boolean(stop.covered),
    regionCode: stop.regionCode || null,
    regionNeedScore: Number.isFinite(stop.regionNeedScore)
      ? Number(stop.regionNeedScore.toFixed?.(2) ?? stop.regionNeedScore)
      : null,
    lastProofAt: stop.lastProofAt || null,
    distanceMiles: Number(distance.toFixed(2)),
    timeFit: Number(categoryTimeFit(stop.category, timeWindow).toFixed(2)),
  };
}

async function planWithAi({
  origin,
  candidateStops,
  constraints,
  timeOfDay,
  userId,
}) {
  const startedAt = Date.now();
  const timeWindow = inferTimeWindow(timeOfDay);
  const limited = candidateStops.slice(0, MAX_CANDIDATES);

  const client = getGeminiClient();
  if (!client) {
    const det = planDeterministic({
      origin,
      candidateStops: limited,
      timeWindow,
      constraints,
    });
    return {
      ...det,
      strategy: "deterministic",
      fallbackUsed: true,
      fallbackReason: "AI provider not configured.",
      latencyMs: Date.now() - startedAt,
      timeWindow,
      userId,
    };
  }

  try {
    const model = client.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.4,
      },
    });
    const summarized = limited.map((s) => summarizeStop(s, origin, timeWindow));

    const prompt = `You are a routing assistant for a community-outreach volunteer in NYC.

Goal: produce an ordered visit list maximizing outreach impact while obeying constraints.

Volunteer position: ${origin.lat.toFixed(4)}, ${origin.lng.toFixed(4)}
Time window: ${timeWindow}
Constraints:
- max stops: ${constraints?.maxStops ?? "no limit"}
- max minutes: ${constraints?.maxMinutes ?? "no limit"}
- avoid already-covered: ${constraints?.avoidCovered ? "yes" : "no"}
- preferred categories: ${(constraints?.preferredCategories || []).join(", ") || "none"}
- preferred regions: ${(constraints?.preferredRegionCodes || []).join(", ") || "none"}

Candidate stops (JSON):
${JSON.stringify(summarized)}

Rules:
- Optimize for outreach impact: high regionNeedScore + uncovered + good timeFit beat low-need or covered stops.
- Minimize zig-zag walking. Don't pick a far stop early if a closer high-fit stop exists.
- Never invent stops. Use ONLY the IDs provided.
- Respect maxStops and avoidCovered hard.
- Stale-but-covered stops can re-enter the route only if avoidCovered is "no" and the route still has budget.

Output STRICT JSON only:
{
  "orderedStopIds": ["<id>", ...],
  "reasonsByStopId": { "<id>": "short reason (≤120 chars)" },
  "summary": "1-2 sentence narrative of the route"
}`;

    const result = await Promise.race([
      model.generateContent(prompt),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`AI planner timed out after ${AI_TIMEOUT_MS}ms`)),
          AI_TIMEOUT_MS,
        ),
      ),
    ]);
    const text = result.response.text().trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(cleaned);

    const validated = validateAiOrder(parsed.orderedStopIds, limited, constraints);
    if (!validated) {
      throw new Error("AI returned invalid stop ordering");
    }

    const reasons = parsed.reasonsByStopId || {};
    let { enriched, totalMeters, totalMinutes } = computeRouteGeometry(origin, validated);

    if (constraints?.maxMinutes) {
      while (enriched.length > 1 && totalMinutes > constraints.maxMinutes) {
        enriched = enriched.slice(0, -1);
        const recomputed = computeRouteGeometry(origin, enriched);
        totalMeters = recomputed.totalMeters;
        totalMinutes = recomputed.totalMinutes;
      }
    }

    const orderedStops = enriched.map((stop) => ({
      id: stop.id,
      hotspotId: stop.hotspotId ?? null,
      name: stop.name,
      category: stop.category,
      lat: stop.lat,
      lng: stop.lng,
      covered: stop.covered,
      regionCode: stop.regionCode,
      regionName: stop.regionName,
      regionNeedScore: stop.regionNeedScore,
      sequence: stop.sequence,
      reason:
        typeof reasons[stop.id] === "string"
          ? reasons[stop.id].slice(0, 200)
          : "Selected by AI planner.",
    }));

    return {
      strategy: "ai_hybrid",
      orderedStops,
      explanations: [
        typeof parsed.summary === "string"
          ? parsed.summary.slice(0, 320)
          : "AI-ordered route.",
      ],
      estimatedDistanceMeters: Math.round(totalMeters),
      estimatedDurationMinutes: Math.round(totalMinutes),
      fallbackUsed: false,
      latencyMs: Date.now() - startedAt,
      timeWindow,
      userId,
    };
  } catch (error) {
    const det = planDeterministic({
      origin,
      candidateStops: limited,
      timeWindow,
      constraints,
    });
    return {
      ...det,
      strategy: "deterministic",
      fallbackUsed: true,
      fallbackReason: error instanceof Error ? error.message : "Unknown AI failure",
      latencyMs: Date.now() - startedAt,
      timeWindow,
      userId,
    };
  }
}

module.exports = {
  planWithAi,
  MAX_CANDIDATES,
};
