export type OutreachZone = {
  id: string | number;
  zoneKey: string;
  name: string;
  borough: string | null;
  centerLat: number;
  centerLng: number;
  needScore: number;
  coverageScore: number;
  serviceGapScore: number;
  estimatedHouseholds: number;
  lastOutreachAt: string | null;
  upcomingEventCount?: number;
  recommendationScore?: number;
  reason?: string;
};

export type OutreachStop = {
  id: string | number;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  stopType: string;
  priorityWeight: number;
  completed: boolean;
  completedAt: string | null;
  legDistanceMeters?: number;
  sequence?: number;
};

export type OutreachEvent = {
  id: string | number;
  title: string;
  description: string;
  category: string;
  zoneId: string | number | null;
  locationLabel: string;
  startTime: string;
  endTime: string | null;
  volunteerCapacity: number;
  status: string;
  priorityScore: number;
  estimatedReach: number;
  joinedCount: number;
  remainingCapacity: number;
  viewerJoined: boolean;
  zone: OutreachZone | null;
  stops: OutreachStop[];
  assignments: Array<{
    id: string | number;
    volunteerId: string | number | null;
    volunteerName: string | null;
    status: string;
    assignedAt: string;
  }>;
  recommendationScore?: number;
  recommendationReason?: string;
};

export type OptimizedRoute = {
  eventId: string | number;
  estimatedDistanceMeters: number;
  estimatedDurationMinutes: number;
  orderedStops: OutreachStop[];
  routeGeometry: Array<{ lat: number; lng: number }>;
};

type ListResponse<T> = {
  success: boolean;
  count: number;
  data: T[];
};

type ItemResponse<T> = {
  success: boolean;
  data: T;
};

type EventApiFetchOptions = {
  method?: string;
  body?: unknown;
};

async function eventApiFetch<T>(
  path: string,
  { method = "GET", body }: EventApiFetchOptions = {},
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || "Request failed.");
  }

  return payload as T;
}

export async function getOutreachEvents() {
  const response = await eventApiFetch<ListResponse<OutreachEvent>>("/api/events");
  return response.data;
}

export async function getRecommendedEvents(params: {
  lat?: number;
  lng?: number;
  category?: string;
} = {}) {
  const searchParams = new URLSearchParams();

  if (typeof params.lat === "number") searchParams.set("lat", String(params.lat));
  if (typeof params.lng === "number") searchParams.set("lng", String(params.lng));
  if (params.category) searchParams.set("category", params.category);

  const query = searchParams.toString();
  const response = await eventApiFetch<ListResponse<OutreachEvent>>(
    `/api/events/recommended${query ? `?${query}` : ""}`,
  );
  return response.data;
}

export async function getRecommendedZones() {
  const response = await eventApiFetch<ListResponse<OutreachZone>>(
    "/api/events/zones/recommended",
  );
  return response.data;
}

export async function getOutreachEvent(id: string | number) {
  const response = await eventApiFetch<ItemResponse<OutreachEvent>>(`/api/events/${id}`);
  return response.data;
}

export async function joinOutreachEvent(
  id: string | number,
  volunteerName = "Demo Volunteer",
) {
  const response = await eventApiFetch<ItemResponse<OutreachEvent>>(
    `/api/events/${id}/join`,
    {
      method: "POST",
      body: { volunteerName },
    },
  );
  return response.data;
}

export async function completeOutreachStop(
  eventId: string | number,
  stopId: string | number,
) {
  const response = await eventApiFetch<ItemResponse<OutreachEvent>>(
    `/api/events/${eventId}/stops/${stopId}/complete`,
    {
      method: "POST",
    },
  );
  return response.data;
}

export async function getOptimizedOutreachRoute(
  eventId: string | number,
  params: { lat?: number; lng?: number } = {},
) {
  const searchParams = new URLSearchParams();

  if (typeof params.lat === "number") searchParams.set("lat", String(params.lat));
  if (typeof params.lng === "number") searchParams.set("lng", String(params.lng));

  const query = searchParams.toString();
  const response = await eventApiFetch<ItemResponse<OptimizedRoute>>(
    `/api/events/${eventId}/optimized-route${query ? `?${query}` : ""}`,
  );
  return response.data;
}
