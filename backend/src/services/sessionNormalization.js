const MAX_RENDER_ACCURACY_METERS = 120;
const MIN_POINT_SEPARATION_METERS = 3;
const MAX_IMPOSSIBLE_SPEED_METERS_PER_SECOND = 12;
const MAX_ZERO_TIME_JUMP_METERS = 80;

function normalizeRoutePoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }

  const normalized = points
    .map((point, index) => normalizeRoutePoint(point, index))
    .filter(Boolean)
    .sort((left, right) => {
      if (left.__timestampMs !== right.__timestampMs) {
        return left.__timestampMs - right.__timestampMs;
      }

      return left.__originalIndex - right.__originalIndex;
    });

  const filtered = [];

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

  return filtered.map(({ __timestampMs, __originalIndex, ...point }) => point);
}

function normalizeSessionStops(stops) {
  if (!Array.isArray(stops)) {
    return [];
  }

  return stops
    .map((stop, index) => normalizeSessionStop(stop, index))
    .filter(Boolean)
    .sort((left, right) => {
      if (left.__timestampMs !== right.__timestampMs) {
        return left.__timestampMs - right.__timestampMs;
      }

      return left.__originalIndex - right.__originalIndex;
    })
    .map(({ __timestampMs, __originalIndex, ...stop }) => stop);
}

function normalizeRoutePoint(point, index) {
  if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lng))) {
    return null;
  }

  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
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
    lat,
    lng,
    timestamp: new Date(timestampMs).toISOString(),
    ...(accuracy !== undefined ? { accuracy } : {}),
    __originalIndex: index,
    __timestampMs: timestampMs,
  };
}

function normalizeSessionStop(stop, index) {
  if (!stop || !Number.isFinite(Number(stop.lat)) || !Number.isFinite(Number(stop.lng))) {
    return null;
  }

  const lat = Number(stop.lat);
  const lng = Number(stop.lng);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return null;
  }

  const timestampMs = Date.parse(stop.timestamp);
  if (!Number.isFinite(timestampMs)) {
    return null;
  }

  return {
    id: String(stop.id),
    lat,
    lng,
    timestamp: new Date(timestampMs).toISOString(),
    type: stop.type,
    ...(typeof stop.label === "string" && stop.label.trim()
      ? { label: stop.label.trim() }
      : {}),
    __originalIndex: index,
    __timestampMs: timestampMs,
  };
}

function haversineDistanceMeters(a, b) {
  const latDelta = toRadians(b.lat - a.lat);
  const lngDelta = toRadians(b.lng - a.lng);
  const latA = toRadians(a.lat);
  const latB = toRadians(b.lat);

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(latA) * Math.cos(latB) * Math.sin(lngDelta / 2) ** 2;

  return 2 * 6371000 * Math.asin(Math.sqrt(haversine));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

module.exports = {
  normalizeRoutePoints,
  normalizeSessionStops,
};
