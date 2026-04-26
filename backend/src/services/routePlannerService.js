const TIME_WINDOWS = ["morning", "midday", "afternoon", "evening", "night"];

const CATEGORY_TIME_FIT = {
  Library: { afternoon: 1.0, midday: 0.85, morning: 0.6, evening: 0.45, night: 0.2 },
  Laundry: { morning: 0.95, evening: 0.95, midday: 0.6, afternoon: 0.7, night: 0.4 },
  "Coffee Shop": { morning: 1.0, midday: 0.8, afternoon: 0.55, evening: 0.45, night: 0.2 },
  Cafe: { morning: 1.0, midday: 0.8, afternoon: 0.55, evening: 0.45, night: 0.2 },
  Marketplace: { midday: 1.0, morning: 0.8, afternoon: 0.85, evening: 0.5, night: 0.2 },
  "Community Center": { afternoon: 0.9, evening: 0.9, midday: 0.7, morning: 0.6, night: 0.3 },
  Pharmacy: { afternoon: 0.85, midday: 0.85, morning: 0.75, evening: 0.7, night: 0.4 },
  "Place of Worship": { morning: 0.7, evening: 0.7, midday: 0.55, afternoon: 0.6, night: 0.4 },
  School: { afternoon: 1.0, midday: 0.65, morning: 0.85, evening: 0.4, night: 0.15 },
  College: { midday: 0.9, afternoon: 0.85, evening: 0.7, morning: 0.65, night: 0.45 },
  "Post Office": { midday: 0.85, morning: 0.85, afternoon: 0.7, evening: 0.45, night: 0.2 },
  Bookstore: { afternoon: 0.85, midday: 0.7, evening: 0.6, morning: 0.55, night: 0.3 },
  "Copy Shop": { midday: 0.85, afternoon: 0.85, morning: 0.75, evening: 0.55, night: 0.3 },
  Bakery: { morning: 0.95, midday: 0.8, afternoon: 0.6, evening: 0.4, night: 0.2 },
  "Convenience Store": { evening: 0.85, night: 0.7, afternoon: 0.75, midday: 0.7, morning: 0.65 },
  Supermarket: { evening: 0.95, afternoon: 0.85, midday: 0.85, morning: 0.7, night: 0.4 },
  Greengrocer: { morning: 0.85, midday: 0.85, afternoon: 0.8, evening: 0.6, night: 0.25 },
  "Variety Store": { afternoon: 0.8, evening: 0.85, midday: 0.75, morning: 0.6, night: 0.35 },
  "Department Store": { afternoon: 0.85, evening: 0.85, midday: 0.8, morning: 0.55, night: 0.3 },
  Restaurant: { evening: 0.95, midday: 0.85, afternoon: 0.6, morning: 0.4, night: 0.55 },
  "Fast Food": { evening: 0.85, midday: 0.85, afternoon: 0.7, morning: 0.6, night: 0.6 },
};

const DEFAULT_TIME_FIT = {
  morning: 0.6,
  midday: 0.65,
  afternoon: 0.7,
  evening: 0.65,
  night: 0.4,
};

const WALK_MINUTES_PER_MILE = 18;
const STOP_MINUTES = 5;

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function metersToMiles(m) {
  return m / 1609.344;
}

function inferTimeWindow(input) {
  if (typeof input === "string" && TIME_WINDOWS.includes(input.toLowerCase())) {
    return input.toLowerCase();
  }
  const hour = new Date().getHours();
  if (hour < 6) return "night";
  if (hour < 11) return "morning";
  if (hour < 14) return "midday";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function categoryTimeFit(category, timeWindow) {
  const profile = CATEGORY_TIME_FIT[category];
  if (profile && profile[timeWindow] !== undefined) return profile[timeWindow];
  return DEFAULT_TIME_FIT[timeWindow] ?? 0.6;
}

function staleCoverageBonus(lastProofAt) {
  if (!lastProofAt) return 0.6;
  const ageMs = Date.now() - new Date(lastProofAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays >= 60) return 1.0;
  if (ageDays >= 30) return 0.75;
  if (ageDays >= 14) return 0.5;
  if (ageDays >= 7) return 0.3;
  return 0.1;
}

function scoreStop(stop, origin, timeWindow, constraints) {
  const fromLat = origin.lat;
  const fromLng = origin.lng;
  const distMiles =
    typeof stop.distanceMiles === "number"
      ? stop.distanceMiles
      : metersToMiles(haversineMeters({ lat: fromLat, lng: fromLng }, stop));

  const distancePenalty = Math.min(3, distMiles) * 0.6;
  const need = Number.isFinite(stop.regionNeedScore) ? stop.regionNeedScore / 10 : 0.5;
  const uncoveredBonus = stop.covered ? -0.6 : 1.2;
  const timeFit = categoryTimeFit(stop.category, timeWindow);
  const staleBonus = stop.covered ? staleCoverageBonus(stop.lastProofAt) * 0.6 : 0;
  const preferredCategoryBonus =
    Array.isArray(constraints?.preferredCategories) &&
    constraints.preferredCategories.includes(stop.category)
      ? 0.4
      : 0;
  const preferredRegionBonus =
    Array.isArray(constraints?.preferredRegionCodes) &&
    stop.regionCode &&
    constraints.preferredRegionCodes.includes(stop.regionCode)
      ? 0.3
      : 0;

  return (
    need * 1.4 +
    uncoveredBonus +
    staleBonus +
    timeFit * 1.1 -
    distancePenalty +
    preferredCategoryBonus +
    preferredRegionBonus
  );
}

function applyHardFilters(stops, constraints) {
  return stops.filter((stop) => {
    if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)) return false;
    if (constraints?.avoidCovered && stop.covered) return false;
    return true;
  });
}

function planDeterministic({ origin, candidateStops, timeWindow, constraints }) {
  const filtered = applyHardFilters(candidateStops, constraints);
  if (filtered.length === 0) {
    return {
      strategy: "deterministic",
      orderedStops: [],
      explanations: ["No candidate stops met the constraints."],
      estimatedDistanceMeters: 0,
      estimatedDurationMinutes: 0,
      fallbackUsed: false,
    };
  }

  const remaining = [...filtered];
  const ordered = [];
  let cursor = origin;
  let totalMeters = 0;
  const maxStops = Math.min(
    constraints?.maxStops || filtered.length,
    filtered.length,
  );

  while (remaining.length > 0 && ordered.length < maxStops) {
    let best = null;
    let bestScore = -Infinity;
    let bestDistanceMeters = 0;

    for (const candidate of remaining) {
      const distMeters = haversineMeters(cursor, candidate);
      const distMiles = metersToMiles(distMeters);
      const score =
        scoreStop({ ...candidate, distanceMiles: distMiles }, cursor, timeWindow, constraints) -
        Math.min(2, distMiles) * 0.4;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
        bestDistanceMeters = distMeters;
      }
    }
    if (!best) break;

    const reason = buildDeterministicReason(best, timeWindow, ordered.length);
    ordered.push({
      ...best,
      sequence: ordered.length + 1,
      reason,
      legMeters: bestDistanceMeters,
    });
    totalMeters += bestDistanceMeters;
    cursor = best;
    const idx = remaining.indexOf(best);
    remaining.splice(idx, 1);

    const projectedMinutes =
      metersToMiles(totalMeters) * WALK_MINUTES_PER_MILE +
      ordered.length * STOP_MINUTES;
    if (constraints?.maxMinutes && projectedMinutes > constraints.maxMinutes) {
      break;
    }
  }

  const totalMinutes =
    metersToMiles(totalMeters) * WALK_MINUTES_PER_MILE + ordered.length * STOP_MINUTES;

  return {
    strategy: "deterministic",
    orderedStops: ordered.map(({ legMeters, ...rest }) => rest),
    explanations: buildDeterministicExplanations(ordered, timeWindow, constraints),
    estimatedDistanceMeters: Math.round(totalMeters),
    estimatedDurationMinutes: Math.round(totalMinutes),
    fallbackUsed: false,
  };
}

function buildDeterministicReason(stop, timeWindow, sequence) {
  const parts = [];
  if (sequence === 0) parts.push("Closest high-impact start.");
  if (!stop.covered) parts.push("Uncovered.");
  if (Number.isFinite(stop.regionNeedScore) && stop.regionNeedScore >= 7) {
    parts.push(`High-need zone (${Number(stop.regionNeedScore).toFixed(1)}).`);
  }
  const fit = categoryTimeFit(stop.category, timeWindow);
  if (fit >= 0.85) {
    parts.push(`${stop.category} draws traffic in the ${timeWindow}.`);
  } else if (fit <= 0.45) {
    parts.push(`${stop.category} is quieter in the ${timeWindow}; queued for relay.`);
  }
  if (stop.covered && stop.lastProofAt) {
    const days = Math.round(
      (Date.now() - new Date(stop.lastProofAt).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days >= 14) parts.push(`Coverage is ${days}d stale — refresh worth it.`);
  }
  return parts.join(" ").slice(0, 200) || "Strong overall fit.";
}

function buildDeterministicExplanations(ordered, timeWindow, constraints) {
  const lines = [];
  if (ordered.length === 0) return lines;
  const firstCats = ordered.slice(0, 3).map((s) => s.category).filter(Boolean);
  if (firstCats.length > 0) {
    lines.push(
      `Started with ${firstCats.join(", ")} in the ${timeWindow} for best foot traffic.`,
    );
  }
  if (constraints?.avoidCovered) {
    lines.push("Filtered out already-covered stops per your constraint.");
  }
  const uncoveredCount = ordered.filter((s) => !s.covered).length;
  if (uncoveredCount > 0) {
    lines.push(`${uncoveredCount} of ${ordered.length} stops still need first-pass coverage.`);
  }
  return lines;
}

function validateAiOrder(orderedIds, candidateStops, constraints) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return null;
  const max = Math.min(constraints?.maxStops || orderedIds.length, candidateStops.length);
  const byId = new Map(candidateStops.map((s) => [s.id, s]));
  const seen = new Set();
  const ordered = [];
  for (const id of orderedIds) {
    if (typeof id !== "string") return null;
    if (seen.has(id)) return null;
    if (!byId.has(id)) return null;
    seen.add(id);
    ordered.push(byId.get(id));
    if (ordered.length >= max) break;
  }
  if (constraints?.avoidCovered && ordered.some((s) => s.covered)) return null;
  return ordered;
}

function computeRouteGeometry(origin, ordered) {
  let cursor = origin;
  let totalMeters = 0;
  const enriched = ordered.map((stop, idx) => {
    const meters = haversineMeters(cursor, stop);
    totalMeters += meters;
    cursor = stop;
    return {
      ...stop,
      sequence: idx + 1,
      legMeters: meters,
    };
  });
  const totalMinutes =
    metersToMiles(totalMeters) * WALK_MINUTES_PER_MILE + enriched.length * STOP_MINUTES;
  return {
    enriched,
    totalMeters,
    totalMinutes,
  };
}

module.exports = {
  TIME_WINDOWS,
  inferTimeWindow,
  scoreStop,
  applyHardFilters,
  planDeterministic,
  validateAiOrder,
  computeRouteGeometry,
  haversineMeters,
  metersToMiles,
  WALK_MINUTES_PER_MILE,
  STOP_MINUTES,
  categoryTimeFit,
};
