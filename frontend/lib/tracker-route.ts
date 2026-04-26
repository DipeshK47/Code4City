import { calculateRouteDistanceMeters, haversineDistanceMeters } from "@/lib/distance";
import type { RoutePoint, SessionStop, VolunteerSession } from "@/types/tracker";

const MAX_RENDER_ACCURACY_METERS = 120;
const MIN_POINT_SEPARATION_METERS = 3;
const MAX_IMPOSSIBLE_SPEED_METERS_PER_SECOND = 12;
const MAX_ZERO_TIME_JUMP_METERS = 80;

type IndexedRoutePoint = RoutePoint & {
  __originalIndex: number;
  __timestampMs: number;
};

type IndexedSessionStop = SessionStop & {
  __originalIndex: number;
  __timestampMs: number;
};

export function normalizeRoutePoints(points: RoutePoint[]) {
  const normalized = points
    .map((point, index) => normalizeRoutePoint(point, index))
    .filter((point): point is IndexedRoutePoint => point !== null)
    .sort((left, right) => {
      if (left.__timestampMs !== right.__timestampMs) {
        return left.__timestampMs - right.__timestampMs;
      }

      return left.__originalIndex - right.__originalIndex;
    });

  const filtered: IndexedRoutePoint[] = [];

  for (const point of normalized) {
    const previousPoint = filtered[filtered.length - 1];

    if (!previousPoint) {
      filtered.push(point);
      continue;
    }

    const distanceMeters = haversineDistanceMeters(previousPoint, point);
    const elapsedSeconds = Math.max(
      0,
      (point.__timestampMs - previousPoint.__timestampMs) / 1000,
    );

    if (
      previousPoint.lat === point.lat &&
      previousPoint.lng === point.lng &&
      previousPoint.timestamp === point.timestamp
    ) {
      continue;
    }

    if (distanceMeters < MIN_POINT_SEPARATION_METERS) {
      continue;
    }

    if (elapsedSeconds === 0 && distanceMeters > MAX_ZERO_TIME_JUMP_METERS) {
      continue;
    }

    if (
      elapsedSeconds > 0 &&
      distanceMeters / elapsedSeconds > MAX_IMPOSSIBLE_SPEED_METERS_PER_SECOND &&
      distanceMeters > MAX_ZERO_TIME_JUMP_METERS
    ) {
      continue;
    }

    filtered.push(point);
  }

  return filtered.map(stripRoutePointMetadata);
}

export function normalizeSessionStops(stops: SessionStop[]) {
  return stops
    .map((stop, index) => normalizeSessionStop(stop, index))
    .filter((stop): stop is IndexedSessionStop => stop !== null)
    .sort((left, right) => {
      if (left.__timestampMs !== right.__timestampMs) {
        return left.__timestampMs - right.__timestampMs;
      }

      return left.__originalIndex - right.__originalIndex;
    })
    .map(stripSessionStopMetadata);
}

export function normalizeVolunteerSession(session: VolunteerSession): VolunteerSession {
  const routePoints = normalizeRoutePoints(session.routePoints ?? []);
  const stops = normalizeSessionStops(session.stops ?? []);

  return {
    ...session,
    routePoints,
    stops,
    totalDistanceMeters: calculateRouteDistanceMeters(routePoints),
  };
}

export function getRouteStartPoint(routePoints: RoutePoint[]) {
  return routePoints[0] ?? null;
}

export function getRouteEndPoint(routePoints: RoutePoint[]) {
  return routePoints[routePoints.length - 1] ?? null;
}

function normalizeRoutePoint(point: RoutePoint, index: number): IndexedRoutePoint | null {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return null;
  }

  if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) {
    return null;
  }

  const timestampMs = Date.parse(point.timestamp);
  if (!Number.isFinite(timestampMs)) {
    return null;
  }

  const accuracy =
    typeof point.accuracy === "number" && Number.isFinite(point.accuracy)
      ? point.accuracy
      : undefined;

  if (accuracy !== undefined && accuracy > MAX_RENDER_ACCURACY_METERS) {
    return null;
  }

  return {
    lat: point.lat,
    lng: point.lng,
    timestamp: new Date(timestampMs).toISOString(),
    ...(accuracy !== undefined ? { accuracy } : {}),
    __originalIndex: index,
    __timestampMs: timestampMs,
  };
}

function normalizeSessionStop(stop: SessionStop, index: number): IndexedSessionStop | null {
  if (!stop || !Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)) {
    return null;
  }

  if (Math.abs(stop.lat) > 90 || Math.abs(stop.lng) > 180) {
    return null;
  }

  const timestampMs = Date.parse(stop.timestamp);
  if (!Number.isFinite(timestampMs)) {
    return null;
  }

  return {
    ...stop,
    timestamp: new Date(timestampMs).toISOString(),
    __originalIndex: index,
    __timestampMs: timestampMs,
  };
}

function stripRoutePointMetadata(point: IndexedRoutePoint): RoutePoint {
  const { __originalIndex, __timestampMs, ...routePoint } = point;
  return routePoint;
}

function stripSessionStopMetadata(stop: IndexedSessionStop): SessionStop {
  const { __originalIndex, __timestampMs, ...sessionStop } = stop;
  return sessionStop;
}
