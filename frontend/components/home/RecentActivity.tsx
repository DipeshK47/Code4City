"use client";

import { useEffect, useState } from "react";
import { getRecentActivity, formatActivityTime, type RecentActivityItem } from "@/lib/activity-api";

const COLORS = ["#D44A12", "#22c55e", "#8b5cf6", "#f97316", "#06b6d4"];

function getInitials(name: string) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function RecentActivity() {
  const [items, setItems] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getRecentActivity()
      .then((res) => {
        if (!cancelled) setItems(res.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load activity");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "12px 0" }}>
        <p style={{ fontSize: 13, color: "#8A8780" }}>Loading recent activity...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "12px 0" }}>
        <p style={{ fontSize: 13, color: "#b91c1c" }}>{error}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: "12px 0" }}>
        <p style={{ fontSize: 13, color: "#8A8780" }}>No recent activity yet. Be the first to complete a route!</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {items.map((a, i) => (
        <div key={`${a.session_id}-${a.time}`} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 2,
              background: (COLORS[i % COLORS.length] ?? COLORS[0]) + "28",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: COLORS[i % COLORS.length] ?? COLORS[0],
              flexShrink: 0,
              letterSpacing: 0,
            }}
          >
            {getInitials(a.username)}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600, color: "#0B0B0A", lineHeight: 1.1 }}>{a.username}</p>
            <p style={{ fontSize: 12, color: "#1A1917", marginTop: 2, lineHeight: 1.35 }}>{a.action}</p>
            <p style={{ fontSize: 11, color: "#B8B3A7", marginTop: 2 }}>{formatActivityTime(a.time)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
