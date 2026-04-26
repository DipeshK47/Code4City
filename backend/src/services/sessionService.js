const repository = require("../data/sessionRepository");
const statsRepository = require("../data/statsRepository");
const {
  normalizeRoutePoints,
  normalizeSessionStops,
} = require("./sessionNormalization");

const METERS_TO_MILES = 0.000621371;

function listSessions(userId) {
  return repository.getAllSessions(userId);
}

function findSessionById(id, userId) {
  return repository.getSessionById(id, userId);
}

function validateSessionPayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Session payload is required.";
  }

  if (!Array.isArray(payload.routePoints) || !Array.isArray(payload.stops)) {
    return "Session routePoints and stops must be arrays.";
  }

  if (!payload.startedAt || !payload.endedAt) {
    return "started_at and ended_at are required.";
  }

  return null;
}

function parseTimestamp(value, fieldName) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${fieldName} must be a valid timestamp.`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function toFiniteNumber(value, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function calculateDistanceMeters(routePoints) {
  if (!Array.isArray(routePoints) || routePoints.length < 2) {
    return 0;
  }

  let totalMeters = 0;

  for (let index = 1; index < routePoints.length; index += 1) {
    const previousPoint = routePoints[index - 1];
    const currentPoint = routePoints[index];

    const lat1 = previousPoint.lat * (Math.PI / 180);
    const lat2 = currentPoint.lat * (Math.PI / 180);
    const deltaLat = (currentPoint.lat - previousPoint.lat) * (Math.PI / 180);
    const deltaLng = (currentPoint.lng - previousPoint.lng) * (Math.PI / 180);

    const haversine =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    totalMeters += 6371000 * (2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
  }

  return totalMeters;
}

function normalizeSessionPayload(payload, userId) {
  const requestedUserId = payload.user_id ?? payload.userId;
  if (requestedUserId !== undefined && Number(requestedUserId) !== Number(userId)) {
    const error = new Error("user_id must match the authenticated user.");
    error.statusCode = 403;
    throw error;
  }

  const resolvedUserId = Number(userId ?? requestedUserId);
  if (!Number.isInteger(resolvedUserId) || resolvedUserId <= 0) {
    const error = new Error("user_id is required.");
    error.statusCode = 400;
    throw error;
  }

  const routePoints = Array.isArray(payload.route_points_json)
    ? payload.route_points_json
    : Array.isArray(payload.routePoints)
      ? payload.routePoints
      : [];

  const stops = Array.isArray(payload.stops_json)
    ? payload.stops_json
    : Array.isArray(payload.stops)
      ? payload.stops
      : [];
  const normalizedRoutePoints = normalizeRoutePoints(routePoints);
  const normalizedStops = normalizeSessionStops(stops);

  const startedAtValue = payload.started_at ?? payload.startedAt ?? payload.startTime;
  const endedAtValue = payload.ended_at ?? payload.endedAt ?? payload.endTime;
  const startedAt = parseTimestamp(startedAtValue, "started_at");
  const endedAt = parseTimestamp(endedAtValue, "ended_at");

  if (endedAt < startedAt) {
    const error = new Error("ended_at must be greater than or equal to started_at.");
    error.statusCode = 400;
    throw error;
  }

  const calculatedDurationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000)
  );
  const distanceMeters =
    toFiniteNumber(payload.distance_meters ?? payload.distanceMeters ?? payload.totalDistanceMeters, -1);
  const resolvedDistanceMeters =
    distanceMeters >= 0 ? distanceMeters : calculateDistanceMeters(normalizedRoutePoints);
  const distanceMiles = toFiniteNumber(
    payload.distance_miles ?? payload.distanceMiles,
    resolvedDistanceMeters * METERS_TO_MILES
  );
  const firstPoint = normalizedRoutePoints[0] ?? null;
  const lastPoint = normalizedRoutePoints[normalizedRoutePoints.length - 1] ?? null;

  return {
    userId: resolvedUserId,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationSeconds: Math.max(
      0,
      Math.round(
        toFiniteNumber(payload.duration_seconds ?? payload.durationSeconds, calculatedDurationSeconds)
      )
    ),
    distanceMeters: resolvedDistanceMeters,
    distanceMiles,
    routePoints: normalizedRoutePoints,
    stops: normalizedStops,
    routeImageUrl: payload.route_image_url ?? payload.routeImageUrl ?? null,
    startLat: payload.start_lat ?? payload.startLat ?? firstPoint?.lat ?? null,
    startLng: payload.start_lng ?? payload.startLng ?? firstPoint?.lng ?? null,
    endLat: payload.end_lat ?? payload.endLat ?? lastPoint?.lat ?? null,
    endLng: payload.end_lng ?? payload.endLng ?? lastPoint?.lng ?? null,
    status: payload.status ?? "completed",
  };
}

async function saveSession(payload, userId) {
  const normalizedPayload = normalizeSessionPayload(payload, userId);
  const validationError = validateSessionPayload(normalizedPayload);

  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 400;
    throw error;
  }

  const session = await repository.createSession(normalizedPayload);

  const flyersDelta = Array.isArray(normalizedPayload.stops) ? normalizedPayload.stops.length : 0;
  const hoursDelta = (normalizedPayload.durationSeconds || 0) / 3600;
  const sessionDate = normalizedPayload.startedAt ? normalizedPayload.startedAt.slice(0, 10) : null;
  if (sessionDate && (flyersDelta > 0 || hoursDelta > 0)) {
    try {
      await statsRepository.upsertUserStatsForSession(userId, flyersDelta, hoursDelta, sessionDate);
    } catch (err) {
      console.error("Failed to update user_stats for session:", err);
    }
  }

  return session;
}

async function removeSession(id, userId) {
  return repository.deleteSession(id, userId);
}

module.exports = {
  listSessions,
  findSessionById,
  saveSession,
  removeSession,
};
