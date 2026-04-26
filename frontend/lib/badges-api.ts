const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

export type BadgesData = {
  first_flyer: boolean;
  hundred_flyers: boolean;
  on_a_streak: boolean;
  top_5: boolean;
  top_1: boolean;
  flyers?: number;
  scans?: number;
  hours?: number;
  rank?: number | null;
  streak_days?: number;
};

export type BadgesResponse = {
  success: boolean;
  data: BadgesData;
};

export async function getBadges(token: string): Promise<BadgesResponse> {
  const res = await fetch(`${API_BASE.replace(/\/$/, "")}/api/badges`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.message || "Failed to load badges");
  return payload;
}
