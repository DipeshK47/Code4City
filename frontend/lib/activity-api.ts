const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

export type RecentActivityItem = {
  username: string;
  session_id: number;
  action: string;
  time: string;
  duration_seconds?: number;
  distance_meters?: number;
};

export type RecentActivityResponse = {
  success: boolean;
  count: number;
  data: RecentActivityItem[];
};

export async function getRecentActivity(): Promise<RecentActivityResponse> {
  const res = await fetch(`${API_BASE.replace(/\/$/, "")}/api/activity/recent`);
  const payload = await res.json();
  if (!res.ok) throw new Error(payload.message || "Failed to load recent activity");
  return payload;
}

export function formatActivityTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
