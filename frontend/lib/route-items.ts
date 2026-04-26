import type { SavedRouteItem, SavedRouteItemsResponse, SavedRouteItemType } from "@/types/route-items";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

type RouteItemPayload = {
  itemType: SavedRouteItemType;
  hotspotId?: string | number | null;
  sourceId?: string | null;
  sourceKey?: string | null;
  name: string;
  address?: string | null;
  category?: string | null;
  lat: number;
  lng: number;
  regionCode?: string | null;
  metadata?: Record<string, unknown>;
};

function authHeaders(token: string) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function getRouteItems(token: string): Promise<SavedRouteItemsResponse> {
  const response = await fetch(`${API_BASE}/api/route-items`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = (await response.json()) as SavedRouteItemsResponse;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Failed to fetch route items");
  }

  return payload;
}

export async function addRouteItem(
  token: string,
  routeItem: RouteItemPayload,
): Promise<SavedRouteItem> {
  const response = await fetch(`${API_BASE}/api/route-items`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(routeItem),
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Failed to save route item");
  }

  return payload.data as SavedRouteItem;
}

export async function deleteRouteItem(token: string, id: string): Promise<SavedRouteItem> {
  const response = await fetch(`${API_BASE}/api/route-items/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Failed to delete route item");
  }

  return payload.data as SavedRouteItem;
}

export async function clearRouteItems(token: string): Promise<SavedRouteItem[]> {
  const response = await fetch(`${API_BASE}/api/route-items`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Failed to clear route items");
  }

  return payload.data as SavedRouteItem[];
}
