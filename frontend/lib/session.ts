import { calculateRouteDistanceMeters } from "@/lib/distance";
import { normalizeRoutePoints, normalizeSessionStops } from "@/lib/tracker-route";
import type { RoutePoint, SessionStop, StopType, VolunteerSession } from "@/types/tracker";

export function createSession(): VolunteerSession {
  return {
    id: crypto.randomUUID(),
    startTime: new Date().toISOString(),
    endTime: null,
    status: "tracking",
    routePoints: [],
    stops: [],
    totalDistanceMeters: 0,
    durationSeconds: 0,
  };
}

export function createSessionStop(point: RoutePoint, type: StopType, label?: string): SessionStop {
  return {
    id: crypto.randomUUID(),
    lat: point.lat,
    lng: point.lng,
    timestamp: new Date().toISOString(),
    type,
    label: label?.trim() || undefined,
  };
}

export function completeSession(session: VolunteerSession): VolunteerSession {
  const endTime = new Date().toISOString();
  const routePoints = normalizeRoutePoints(session.routePoints);
  const stops = normalizeSessionStops(session.stops);

  return {
    ...session,
    endTime,
    status: "completed",
    routePoints,
    stops,
    durationSeconds: Math.max(
      0,
      Math.round((new Date(endTime).getTime() - new Date(session.startTime).getTime()) / 1000),
    ),
    totalDistanceMeters: calculateRouteDistanceMeters(routePoints),
  };
}

export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }

  return `${remainingSeconds}s`;
}

export function formatStopType(type: StopType) {
  return type.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
