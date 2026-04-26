const { query } = require("../db");
const { planWithAi } = require("../services/aiRoutePlannerService");
const { planDeterministic, inferTimeWindow } = require("../services/routePlannerService");

function parseFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeRequest(body) {
  if (!body || typeof body !== "object") return null;
  const userLat = parseFiniteNumber(body.userLat);
  const userLng = parseFiniteNumber(body.userLng);
  if (userLat === null || userLng === null) return null;

  const constraints = body.constraints || {};
  const stops = Array.isArray(body.candidateStops) ? body.candidateStops : [];
  const cleanedStops = stops
    .map((stop) => {
      if (!stop || typeof stop !== "object") return null;
      const id = typeof stop.id === "string" && stop.id.length > 0 ? stop.id : null;
      const lat = parseFiniteNumber(stop.lat);
      const lng = parseFiniteNumber(stop.lng);
      if (!id || lat === null || lng === null) return null;
      return {
        id,
        hotspotId: stop.hotspotId ?? null,
        name: typeof stop.name === "string" ? stop.name : "",
        category: typeof stop.category === "string" ? stop.category : "",
        lat,
        lng,
        covered: Boolean(stop.covered),
        regionCode: stop.regionCode || null,
        regionName: stop.regionName || null,
        regionNeedScore:
          typeof stop.regionNeedScore === "number" ? stop.regionNeedScore : null,
        lastProofAt: stop.lastProofAt || null,
        distanceMiles:
          typeof stop.distanceMiles === "number" ? stop.distanceMiles : null,
      };
    })
    .filter(Boolean);

  return {
    origin: { lat: userLat, lng: userLng },
    timeOfDay:
      typeof body.timeOfDay === "string" ? body.timeOfDay.toLowerCase() : undefined,
    constraints: {
      maxStops:
        typeof constraints.maxStops === "number" && constraints.maxStops > 0
          ? Math.min(20, Math.floor(constraints.maxStops))
          : null,
      maxMinutes:
        typeof constraints.maxMinutes === "number" && constraints.maxMinutes > 0
          ? Math.min(360, Math.floor(constraints.maxMinutes))
          : null,
      avoidCovered: Boolean(constraints.avoidCovered),
      includePrinterStop: Boolean(constraints.includePrinterStop),
      preferredCategories: Array.isArray(constraints.preferredCategories)
        ? constraints.preferredCategories.filter((c) => typeof c === "string")
        : [],
      preferredRegionCodes: Array.isArray(constraints.preferredRegionCodes)
        ? constraints.preferredRegionCodes.filter((c) => typeof c === "string")
        : [],
    },
    candidateStops: cleanedStops,
  };
}

async function logPlan({ userId, strategy, request, response, fallbackUsed, latencyMs }) {
  try {
    await query(
      `INSERT INTO ai_route_plan_logs (
         user_id, strategy, request_json, response_json, fallback_used, latency_ms
       ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)`,
      [
        userId || null,
        strategy,
        JSON.stringify(request),
        JSON.stringify(response),
        fallbackUsed,
        latencyMs ?? null,
      ],
    );
  } catch {
    // observability is best-effort
  }
}

async function postPlan(req, res) {
  const startedAt = Date.now();
  const normalized = normalizeRequest(req.body);
  if (!normalized) {
    return res.status(400).json({
      success: false,
      message: "userLat, userLng, and candidateStops are required.",
    });
  }
  const userId = req.user?.id || null;

  if (normalized.candidateStops.length === 0) {
    const empty = {
      strategy: "deterministic",
      orderedStops: [],
      explanations: ["No candidate stops were sent."],
      estimatedDistanceMeters: 0,
      estimatedDurationMinutes: 0,
      fallbackUsed: false,
    };
    await logPlan({
      userId,
      strategy: "deterministic",
      request: normalized,
      response: empty,
      fallbackUsed: false,
      latencyMs: Date.now() - startedAt,
    });
    return res.json({ success: true, data: empty });
  }

  try {
    const result = await planWithAi({
      origin: normalized.origin,
      candidateStops: normalized.candidateStops,
      constraints: normalized.constraints,
      timeOfDay: normalized.timeOfDay,
      userId,
    });

    await logPlan({
      userId,
      strategy: result.strategy,
      request: normalized,
      response: result,
      fallbackUsed: result.fallbackUsed,
      latencyMs: result.latencyMs,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    const fallback = planDeterministic({
      origin: normalized.origin,
      candidateStops: normalized.candidateStops,
      timeWindow: inferTimeWindow(normalized.timeOfDay),
      constraints: normalized.constraints,
    });
    fallback.fallbackUsed = true;
    fallback.fallbackReason = error instanceof Error ? error.message : "Unknown error";
    await logPlan({
      userId,
      strategy: "deterministic",
      request: normalized,
      response: fallback,
      fallbackUsed: true,
      latencyMs: Date.now() - startedAt,
    });
    return res.json({ success: true, data: fallback });
  }
}

module.exports = { postPlan };
