const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

export type EventSuggestion = {
  id: string;
  regionCode: string;
  regionName: string;
  boroughName: string;
  dayOfWeek: number;
  dayName: string;
  suggestedDate: string;
  centerLat: number | null;
  centerLng: number | null;
  uniqueUserCount: number;
  rationale: string;
  status: string;
  meetupId: string | null;
  createdAt: string;
};

type ListResponse = { success: boolean; count: number; data: EventSuggestion[]; message?: string };

export async function fetchSuggestions(): Promise<EventSuggestion[]> {
  const res = await fetch(`${API_BASE_URL}/api/event-suggestions`);
  const payload = (await res.json()) as ListResponse;
  if (!res.ok || !payload.success) throw new Error(payload.message || "Failed to load suggestions");
  return payload.data || [];
}

export async function regenerateSuggestions() {
  const res = await fetch(`${API_BASE_URL}/api/event-suggestions/generate`, { method: "POST" });
  const payload = await res.json();
  if (!res.ok || !payload.success) throw new Error(payload.message || "Failed to generate");
  return payload.data;
}

export async function approveSuggestion(token: string, id: string) {
  const res = await fetch(`${API_BASE_URL}/api/event-suggestions/${id}/approve`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await res.json();
  if (!res.ok || !payload.success) throw new Error(payload.message || "Failed to approve");
  return payload.data as { suggestionId: string; meetupId: string };
}

export async function dismissSuggestion(id: string) {
  const res = await fetch(`${API_BASE_URL}/api/event-suggestions/${id}/dismiss`, {
    method: "POST",
  });
  const payload = await res.json();
  if (!res.ok || !payload.success) throw new Error(payload.message || "Failed to dismiss");
  return true;
}
