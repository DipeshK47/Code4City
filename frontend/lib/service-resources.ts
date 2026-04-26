const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

export type ServiceType =
  | "food"
  | "shelter"
  | "healthcare"
  | "substance_use"
  | "mental_health"
  | "youth"
  | "senior";

export const SERVICE_TYPES: ServiceType[] = [
  "food",
  "shelter",
  "healthcare",
  "substance_use",
  "mental_health",
  "youth",
  "senior",
];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  food: "Food",
  shelter: "Shelter",
  healthcare: "Healthcare",
  substance_use: "Recovery",
  mental_health: "Mental Health",
  youth: "Youth",
  senior: "Senior",
};

export const SERVICE_TYPE_COLORS: Record<ServiceType, string> = {
  food: "#D44A12",
  shelter: "#3B82F6",
  healthcare: "#16A34A",
  substance_use: "#9333EA",
  mental_health: "#0EA5E9",
  youth: "#F59E0B",
  senior: "#6B7280",
};

export type ServiceResource = {
  id: string;
  sourceKey: string;
  sourceDataset: string;
  serviceType: ServiceType;
  name: string;
  description: string;
  address: string;
  borough: string;
  zip: string;
  lat: number;
  lng: number;
  phone: string;
  hours: string;
  website: string;
  eligibility: string;
  regionCode: string | null;
  regionName: string | null;
  regionNeedScore: number | null;
};

type ListResponse = {
  success: boolean;
  count: number;
  data: ServiceResource[];
  message?: string;
};

export async function fetchServiceResources(
  options: {
    types?: ServiceType[];
    near?: { lat: number; lng: number };
    radiusMiles?: number;
    limit?: number;
  } = {},
): Promise<ServiceResource[]> {
  const params = new URLSearchParams();
  if (options.types && options.types.length > 0) {
    params.set("type", options.types.join(","));
  }
  if (options.near) {
    params.set("near", `${options.near.lat},${options.near.lng}`);
  }
  if (options.radiusMiles) {
    params.set("radius", String(options.radiusMiles));
  }
  if (options.limit) {
    params.set("limit", String(options.limit));
  }

  const url = `${API_BASE_URL}/api/service-resources${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(url);
  const payload = (await response.json()) as ListResponse;

  if (!response.ok || !payload.success) {
    throw new Error(payload.message || "Failed to load service resources");
  }

  return payload.data || [];
}
