const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

export type TimeOfDay = "morning" | "midday" | "afternoon" | "evening" | "night";

export type PlannerConstraints = {
  maxStops?: number;
  maxMinutes?: number;
  avoidCovered?: boolean;
  includePrinterStop?: boolean;
  preferredCategories?: string[];
  preferredRegionCodes?: string[];
};

export type PlannerCandidateStop = {
  id: string;
  hotspotId?: number | null;
  name: string;
  category: string;
  lat: number;
  lng: number;
  covered: boolean;
  regionCode?: string | null;
  regionName?: string | null;
  regionNeedScore?: number | null;
  lastProofAt?: string | null;
  distanceMiles?: number;
};

export type PlannerOrderedStop = {
  id: string;
  hotspotId: number | null;
  name: string;
  category: string;
  lat: number;
  lng: number;
  covered: boolean;
  regionCode: string | null;
  regionName: string | null;
  regionNeedScore: number | null;
  sequence: number;
  reason: string;
};

export type PlannerResult = {
  strategy: "ai_hybrid" | "deterministic";
  orderedStops: PlannerOrderedStop[];
  explanations: string[];
  estimatedDistanceMeters: number;
  estimatedDurationMinutes: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  latencyMs?: number;
  timeWindow?: TimeOfDay;
};

export type PlannerRequest = {
  userLat: number;
  userLng: number;
  timeOfDay?: TimeOfDay | string;
  constraints?: PlannerConstraints;
  candidateStops: PlannerCandidateStop[];
};

export async function planRoute(request: PlannerRequest): Promise<PlannerResult> {
  const res = await fetch(`${API_BASE_URL}/api/route-planner/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const payload = await res.json();
  if (!res.ok || !payload.success) {
    throw new Error(payload.message || "Failed to plan route");
  }
  return payload.data as PlannerResult;
}
