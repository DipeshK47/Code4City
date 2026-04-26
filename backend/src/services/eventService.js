const { pool, query } = require("../db");
const { createError, normalizeLimit } = require("./serviceUtils");

const WALKING_METERS_PER_MINUTE = 80;

function parsePositiveInteger(value, fieldName) {
  const parsed = Number.parseInt(String(value), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createError(400, `${fieldName} must be a positive integer.`);
  }

  return parsed;
}

function parseOptionalPositiveInteger(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return parsePositiveInteger(value, fieldName);
}

function parseNumber(value, fieldName) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw createError(400, `${fieldName} must be a valid number.`);
  }

  return parsed;
}

function parseOptionalNumber(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  return parseNumber(value, fieldName);
}

function parseTimestamp(value, fieldName) {
  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    throw createError(400, `${fieldName} must be a valid date/time.`);
  }

  return parsed.toISOString();
}

function normalizeText(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function requireText(value, fieldName) {
  const normalized = normalizeText(value);

  if (!normalized) {
    throw createError(400, `${fieldName} is required.`);
  }

  return normalized;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function haversineDistanceMeters(start, end) {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(start.lat);
  const lat2 = toRadians(end.lat);
  const deltaLat = toRadians(end.lat - start.lat);
  const deltaLng = toRadians(end.lng - start.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getEventSelect(viewerParam = "$1") {
  return `
    SELECT
      events.id,
      events.title,
      events.description,
      events.category,
      events.zone_id,
      events.organizer_id,
      events.location_label,
      events.start_time,
      events.end_time,
      events.volunteer_capacity,
      events.status,
      events.priority_score,
      events.estimated_reach,
      events.created_at,
      events.updated_at,
      COALESCE(assignments.joined_count, 0) AS joined_count,
      GREATEST(events.volunteer_capacity - COALESCE(assignments.joined_count, 0), 0) AS remaining_capacity,
      CASE
        WHEN ${viewerParam}::bigint IS NULL THEN FALSE
        ELSE EXISTS (
          SELECT 1
          FROM outreach_event_assignments viewer_assignments
          WHERE viewer_assignments.event_id = events.id
            AND viewer_assignments.volunteer_id = ${viewerParam}::bigint
            AND viewer_assignments.status <> 'cancelled'
        )
      END AS viewer_joined,
      CASE
        WHEN zones.id IS NULL THEN NULL
        ELSE json_build_object(
          'id', zones.id,
          'zoneKey', zones.zone_key,
          'name', zones.name,
          'borough', zones.borough,
          'boundary', zones.boundary_json,
          'centerLat', zones.center_lat,
          'centerLng', zones.center_lng,
          'needScore', zones.need_score,
          'coverageScore', zones.coverage_score,
          'serviceGapScore', zones.service_gap_score,
          'estimatedHouseholds', zones.estimated_households,
          'lastOutreachAt', zones.last_outreach_at
        )
      END AS zone,
      COALESCE(stops.stops, '[]'::json) AS stops,
      COALESCE(member_list.assignments, '[]'::json) AS assignments
    FROM outreach_events events
    LEFT JOIN outreach_zones zones ON zones.id = events.zone_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS joined_count
      FROM outreach_event_assignments
      WHERE outreach_event_assignments.event_id = events.id
        AND outreach_event_assignments.status <> 'cancelled'
    ) AS assignments ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'id', outreach_event_stops.id,
          'name', outreach_event_stops.name,
          'address', outreach_event_stops.address,
          'lat', outreach_event_stops.lat,
          'lng', outreach_event_stops.lng,
          'stopType', outreach_event_stops.stop_type,
          'priorityWeight', outreach_event_stops.priority_weight,
          'completed', outreach_event_stops.completed,
          'completedAt', outreach_event_stops.completed_at
        )
        ORDER BY outreach_event_stops.priority_weight DESC, outreach_event_stops.id ASC
      ) AS stops
      FROM outreach_event_stops
      WHERE outreach_event_stops.event_id = events.id
    ) AS stops ON TRUE
    LEFT JOIN LATERAL (
      SELECT json_agg(
        json_build_object(
          'id', outreach_event_assignments.id,
          'volunteerId', outreach_event_assignments.volunteer_id,
          'volunteerName', outreach_event_assignments.volunteer_name,
          'status', outreach_event_assignments.status,
          'assignedAt', outreach_event_assignments.assigned_at
        )
        ORDER BY outreach_event_assignments.assigned_at ASC
      ) AS assignments
      FROM outreach_event_assignments
      WHERE outreach_event_assignments.event_id = events.id
        AND outreach_event_assignments.status <> 'cancelled'
    ) AS member_list ON TRUE
  `;
}

function normalizeEvent(row) {
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    zoneId: row.zone_id,
    organizerId: row.organizer_id,
    locationLabel: row.location_label,
    startTime: row.start_time,
    endTime: row.end_time,
    volunteerCapacity: row.volunteer_capacity,
    status: row.status,
    priorityScore: row.priority_score,
    estimatedReach: row.estimated_reach,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    joinedCount: row.joined_count,
    remainingCapacity: row.remaining_capacity,
    viewerJoined: row.viewer_joined,
    zone: row.zone,
    stops: row.stops ?? [],
    assignments: row.assignments ?? [],
  };
}

function normalizeZone(row) {
  if (!row) return null;

  return {
    id: row.id,
    zoneKey: row.zone_key,
    name: row.name,
    borough: row.borough,
    boundary: row.boundary_json,
    centerLat: row.center_lat,
    centerLng: row.center_lng,
    needScore: row.need_score,
    coverageScore: row.coverage_score,
    serviceGapScore: row.service_gap_score,
    estimatedHouseholds: row.estimated_households,
    lastOutreachAt: row.last_outreach_at,
    upcomingEventCount: row.upcoming_event_count ?? 0,
    recommendationScore: row.recommendation_score,
    reason: row.reason,
  };
}

function normalizeEventPayload(payload) {
  const title = requireText(payload.title, "title");
  const description = normalizeText(payload.description);
  const category = normalizeText(payload.category, "food") || "food";
  const zoneId = parseOptionalPositiveInteger(
    payload.zoneId ?? payload.zone_id,
    "zoneId",
  );
  const locationLabel = normalizeText(
    payload.locationLabel ?? payload.location_label,
  );
  const startTime = parseTimestamp(
    payload.startTime ?? payload.start_time,
    "startTime",
  );
  const rawEndTime = payload.endTime ?? payload.end_time;
  const endTime = rawEndTime ? parseTimestamp(rawEndTime, "endTime") : null;
  const volunteerCapacity =
    parseOptionalPositiveInteger(
      payload.volunteerCapacity ?? payload.volunteer_capacity,
      "volunteerCapacity",
    ) ?? 8;
  const priorityScore = clamp(
    parseOptionalNumber(payload.priorityScore ?? payload.priority_score, "priorityScore") ??
      50,
  );
  const estimatedReach =
    parseOptionalPositiveInteger(
      payload.estimatedReach ?? payload.estimated_reach,
      "estimatedReach",
    ) ?? 0;

  if (endTime && new Date(endTime) <= new Date(startTime)) {
    throw createError(400, "endTime must be after startTime.");
  }

  return {
    title,
    description,
    category,
    zoneId,
    locationLabel,
    startTime,
    endTime,
    volunteerCapacity,
    status: normalizeText(payload.status, "upcoming") || "upcoming",
    priorityScore,
    estimatedReach,
    stops: Array.isArray(payload.stops) ? payload.stops : [],
  };
}

function normalizeStopPayload(payload) {
  return {
    name: requireText(payload.name, "stop name"),
    address: normalizeText(payload.address),
    lat: parseNumber(payload.lat, "stop lat"),
    lng: parseNumber(payload.lng, "stop lng"),
    stopType: normalizeText(payload.stopType ?? payload.stop_type, "community") || "community",
    priorityWeight: clamp(
      parseOptionalNumber(
        payload.priorityWeight ?? payload.priority_weight,
        "stop priorityWeight",
      ) ?? 50,
    ),
  };
}

async function getEventByIdInternal(db, eventId, viewerUserId = null) {
  const result = await db.query(
    `
      ${getEventSelect("$1")}
      WHERE events.id = $2
      LIMIT 1
    `,
    [viewerUserId, eventId],
  );

  return normalizeEvent(result.rows[0]);
}

async function ensureEvent(eventId, viewerUserId = null) {
  const safeEventId = parsePositiveInteger(eventId, "event id");
  const event = await getEventByIdInternal({ query }, safeEventId, viewerUserId);

  if (!event) {
    throw createError(404, "Event not found.");
  }

  return event;
}

async function listEvents({
  viewerUserId = null,
  status,
  category,
  limit,
  includeCompleted = false,
} = {}) {
  const safeLimit = normalizeLimit(limit, 50, 150);
  const normalizedStatus = normalizeText(status);
  const normalizedCategory = normalizeText(category);
  const result = await query(
    `
      ${getEventSelect("$1")}
      WHERE ($2::text = '' OR events.status = $2)
        AND ($3::text = '' OR events.category = $3)
        AND ($4::boolean = TRUE OR events.status <> 'completed')
      ORDER BY events.priority_score DESC, events.start_time ASC
      LIMIT $5
    `,
    [
      viewerUserId,
      normalizedStatus,
      normalizedCategory,
      Boolean(includeCompleted),
      safeLimit,
    ],
  );

  return result.rows.map(normalizeEvent);
}

async function getEvent(eventId, viewerUserId = null) {
  return ensureEvent(eventId, viewerUserId);
}

async function createEvent(payload, organizerId = null) {
  const normalized = normalizeEventPayload(payload);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const eventResult = await client.query(
      `
        INSERT INTO outreach_events (
          title,
          description,
          category,
          zone_id,
          organizer_id,
          location_label,
          start_time,
          end_time,
          volunteer_capacity,
          status,
          priority_score,
          estimated_reach
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `,
      [
        normalized.title,
        normalized.description,
        normalized.category,
        normalized.zoneId,
        organizerId,
        normalized.locationLabel,
        normalized.startTime,
        normalized.endTime,
        normalized.volunteerCapacity,
        normalized.status,
        normalized.priorityScore,
        normalized.estimatedReach,
      ],
    );

    const eventId = eventResult.rows[0].id;

    for (const rawStop of normalized.stops) {
      const stop = normalizeStopPayload(rawStop);
      await client.query(
        `
          INSERT INTO outreach_event_stops (
            event_id,
            name,
            address,
            lat,
            lng,
            stop_type,
            priority_weight
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          eventId,
          stop.name,
          stop.address,
          stop.lat,
          stop.lng,
          stop.stopType,
          stop.priorityWeight,
        ],
      );
    }

    await client.query("COMMIT");
    return getEventByIdInternal(client, eventId, organizerId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateEvent(eventId, payload, viewerUserId = null) {
  const safeEventId = parsePositiveInteger(eventId, "event id");
  const allowedFields = {
    title: "title",
    description: "description",
    category: "category",
    zoneId: "zone_id",
    zone_id: "zone_id",
    locationLabel: "location_label",
    location_label: "location_label",
    startTime: "start_time",
    start_time: "start_time",
    endTime: "end_time",
    end_time: "end_time",
    volunteerCapacity: "volunteer_capacity",
    volunteer_capacity: "volunteer_capacity",
    status: "status",
    priorityScore: "priority_score",
    priority_score: "priority_score",
    estimatedReach: "estimated_reach",
    estimated_reach: "estimated_reach",
  };
  const assignments = [];
  const values = [];

  Object.entries(allowedFields).forEach(([payloadKey, column]) => {
    if (!Object.prototype.hasOwnProperty.call(payload, payloadKey)) return;

    let value = payload[payloadKey];
    if (column === "zone_id") value = parseOptionalPositiveInteger(value, "zoneId");
    if (column === "start_time" && value) value = parseTimestamp(value, "startTime");
    if (column === "end_time" && value) value = parseTimestamp(value, "endTime");
    if (column === "volunteer_capacity") {
      value = parsePositiveInteger(value, "volunteerCapacity");
    }
    if (column === "priority_score") value = clamp(parseNumber(value, "priorityScore"));
    if (column === "estimated_reach") {
      value = parseOptionalPositiveInteger(value, "estimatedReach") ?? 0;
    }
    if (["title", "description", "category", "location_label", "status"].includes(column)) {
      value = column === "title" ? requireText(value, "title") : normalizeText(value);
    }

    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  });

  if (!assignments.length) {
    return ensureEvent(safeEventId, viewerUserId);
  }

  values.push(safeEventId);

  await query(
    `
      UPDATE outreach_events
      SET ${assignments.join(", ")}
      WHERE id = $${values.length}
    `,
    values,
  );

  return ensureEvent(safeEventId, viewerUserId);
}

async function joinEvent(eventId, viewerUserId = null, payload = {}) {
  const event = await ensureEvent(eventId, viewerUserId);

  if (event.remainingCapacity <= 0) {
    throw createError(409, "This event is already at volunteer capacity.");
  }

  const volunteerName =
    normalizeText(payload.volunteerName ?? payload.volunteer_name) ||
    (viewerUserId ? null : "Demo Volunteer");

  if (viewerUserId) {
    await query(
      `
        INSERT INTO outreach_event_assignments (
          event_id,
          volunteer_id,
          volunteer_name,
          status
        )
        VALUES ($1, $2, $3, 'joined')
        ON CONFLICT (event_id, volunteer_id)
        DO UPDATE SET status = 'joined', assigned_at = NOW()
      `,
      [event.id, viewerUserId, volunteerName],
    );
  } else {
    await query(
      `
        INSERT INTO outreach_event_assignments (
          event_id,
          volunteer_name,
          status
        )
        VALUES ($1, $2, 'joined')
      `,
      [event.id, volunteerName],
    );
  }

  return ensureEvent(event.id, viewerUserId);
}

async function completeStop(eventId, stopId, viewerUserId = null) {
  const safeEventId = parsePositiveInteger(eventId, "event id");
  const safeStopId = parsePositiveInteger(stopId, "stop id");

  const result = await query(
    `
      UPDATE outreach_event_stops
      SET completed = TRUE,
          completed_at = COALESCE(completed_at, NOW())
      WHERE id = $1 AND event_id = $2
      RETURNING id
    `,
    [safeStopId, safeEventId],
  );

  if (!result.rows[0]) {
    throw createError(404, "Event stop not found.");
  }

  await query(
    `
      UPDATE outreach_zones zones
      SET coverage_score = LEAST(100, zones.coverage_score + 6),
          need_score = GREATEST(0, zones.need_score - 3),
          last_outreach_at = NOW()
      FROM outreach_events events
      WHERE events.id = $1
        AND events.zone_id = zones.id
    `,
    [safeEventId],
  );

  return ensureEvent(safeEventId, viewerUserId);
}

function scoreEventRecommendation(event, options = {}) {
  const zone = event.zone ?? {};
  const needScore = Number(zone.needScore ?? event.priorityScore ?? 50);
  const eventPriority = Number(event.priorityScore ?? 50);
  const capacityRatio =
    event.volunteerCapacity > 0
      ? clamp((event.remainingCapacity / event.volunteerCapacity) * 100)
      : 0;
  const categoryScore =
    options.category && options.category === event.category ? 100 : options.category ? 35 : 70;
  let distanceScore = 70;

  if (
    Number.isFinite(options.lat) &&
    Number.isFinite(options.lng) &&
    Number.isFinite(zone.centerLat) &&
    Number.isFinite(zone.centerLng)
  ) {
    const distanceMeters = haversineDistanceMeters(
      { lat: options.lat, lng: options.lng },
      { lat: zone.centerLat, lng: zone.centerLng },
    );
    distanceScore = clamp(100 - distanceMeters / 250);
  }

  return Math.round(
    needScore * 0.35 +
      eventPriority * 0.25 +
      distanceScore * 0.2 +
      capacityRatio * 0.1 +
      categoryScore * 0.1,
  );
}

async function listRecommendedEvents({
  viewerUserId = null,
  lat,
  lng,
  category,
  limit,
} = {}) {
  const events = await listEvents({
    viewerUserId,
    category,
    limit: normalizeLimit(limit, 10, 50),
  });
  const options = {
    lat: parseOptionalNumber(lat, "lat"),
    lng: parseOptionalNumber(lng, "lng"),
    category: normalizeText(category),
  };

  return events
    .map((event) => ({
      ...event,
      recommendationScore: scoreEventRecommendation(event, options),
      recommendationReason: buildEventReason(event, options),
    }))
    .sort((a, b) => b.recommendationScore - a.recommendationScore);
}

function buildEventReason(event, options) {
  const parts = [];

  if ((event.zone?.needScore ?? 0) >= 85) {
    parts.push("high zone need");
  }

  if ((event.zone?.coverageScore ?? 100) <= 30) {
    parts.push("low outreach coverage");
  }

  if (event.remainingCapacity > 0) {
    parts.push(`${event.remainingCapacity} volunteer spots open`);
  }

  if (options.category && options.category === event.category) {
    parts.push("matches preferred service category");
  }

  return parts.length ? parts.join(", ") : "balanced outreach impact";
}

async function listRecommendedZones({ limit } = {}) {
  const safeLimit = normalizeLimit(limit, 10, 50);
  const result = await query(
    `
      SELECT
        zones.*,
        COALESCE(event_counts.upcoming_event_count, 0) AS upcoming_event_count,
        ROUND(
          (
            zones.need_score * 0.4 +
            (100 - zones.coverage_score) * 0.3 +
            zones.service_gap_score * 0.15 +
            LEAST(
              100,
              GREATEST(
                0,
                EXTRACT(EPOCH FROM (NOW() - COALESCE(zones.last_outreach_at, NOW() - INTERVAL '90 days'))) / 86400
              )
            ) * 0.15 -
            COALESCE(event_counts.upcoming_event_count, 0) * 8
          )::numeric,
          0
        )::int AS recommendation_score,
        CASE
          WHEN COALESCE(event_counts.upcoming_event_count, 0) > 0 THEN 'Upcoming event already scheduled'
          WHEN zones.coverage_score < 30 THEN 'High need with low outreach coverage'
          WHEN zones.service_gap_score > 70 THEN 'Service access gap is high'
          ELSE 'Good candidate for next outreach event'
        END AS reason
      FROM outreach_zones zones
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS upcoming_event_count
        FROM outreach_events events
        WHERE events.zone_id = zones.id
          AND events.status = 'upcoming'
          AND events.start_time >= NOW()
      ) AS event_counts ON TRUE
      ORDER BY recommendation_score DESC, zones.need_score DESC
      LIMIT $1
    `,
    [safeLimit],
  );

  return result.rows.map(normalizeZone);
}

async function getOptimizedRoute(eventId, { lat, lng } = {}) {
  const event = await ensureEvent(eventId);
  const uncompletedStops = event.stops.filter((stop) => !stop.completed);

  if (!uncompletedStops.length) {
    return {
      eventId: event.id,
      estimatedDistanceMeters: 0,
      estimatedDurationMinutes: 0,
      orderedStops: [],
      routeGeometry: [],
    };
  }

  const fallbackStart = event.zone
    ? { lat: event.zone.centerLat, lng: event.zone.centerLng }
    : { lat: uncompletedStops[0].lat, lng: uncompletedStops[0].lng };
  let current = {
    lat: parseOptionalNumber(lat, "lat") ?? fallbackStart.lat,
    lng: parseOptionalNumber(lng, "lng") ?? fallbackStart.lng,
  };
  const remaining = [...uncompletedStops];
  const orderedStops = [];
  let totalDistanceMeters = 0;

  while (remaining.length) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestDistance = 0;

    remaining.forEach((stop, index) => {
      const distanceMeters = haversineDistanceMeters(current, stop);
      const priorityBoost = 1 + Number(stop.priorityWeight ?? 50) / 100;
      const routeScore = distanceMeters / priorityBoost;

      if (routeScore < bestScore) {
        bestScore = routeScore;
        bestIndex = index;
        bestDistance = distanceMeters;
      }
    });

    const [nextStop] = remaining.splice(bestIndex, 1);
    totalDistanceMeters += bestDistance;
    orderedStops.push({
      ...nextStop,
      legDistanceMeters: Math.round(bestDistance),
      sequence: orderedStops.length + 1,
    });
    current = { lat: nextStop.lat, lng: nextStop.lng };
  }

  return {
    eventId: event.id,
    estimatedDistanceMeters: Math.round(totalDistanceMeters),
    estimatedDurationMinutes: Math.ceil(totalDistanceMeters / WALKING_METERS_PER_MINUTE),
    orderedStops,
    routeGeometry: orderedStops.map((stop) => ({
      lat: stop.lat,
      lng: stop.lng,
    })),
  };
}

module.exports = {
  completeStop,
  createEvent,
  getEvent,
  getOptimizedRoute,
  joinEvent,
  listEvents,
  listRecommendedEvents,
  listRecommendedZones,
  updateEvent,
};
