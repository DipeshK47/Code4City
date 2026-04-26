import type { SessionsApiResponse } from "@/types/tracker";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

export async function getSessions(token: string): Promise<SessionsApiResponse> {
  const response = await fetch(`${API_BASE}/api/sessions`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message || payload.error || "Failed to fetch sessions");
  }

  return payload;
}
