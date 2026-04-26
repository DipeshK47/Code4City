export type SavedRouteItemType = "hotspot" | "printer";

export interface SavedRouteItem {
  id: string;
  userId: number;
  itemType: SavedRouteItemType;
  dedupeKey: string;
  hotspotId: string | null;
  sourceId: string | null;
  sourceKey: string | null;
  name: string;
  address: string | null;
  category: string | null;
  lat: number;
  lng: number;
  regionCode: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SavedRouteItemsResponse {
  success: boolean;
  count: number;
  data: SavedRouteItem[];
  message?: string;
}
