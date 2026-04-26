"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getOutreachEvents,
  getRecommendedEvents,
  getRecommendedZones,
  OutreachEvent,
  OutreachZone,
} from "@/lib/urbanreach-events-api";

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid rgba(25, 38, 31, 0.10)",
  borderRadius: 12,
  boxShadow: "0 2px 14px rgba(0,0,0,0.05)",
};

const pill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 26,
  borderRadius: 999,
  padding: "0 10px",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const CATEGORIES = [
  { label: "All", value: "" },
  { label: "Food", value: "food" },
  { label: "Community Aid", value: "community_aid" },
  { label: "Public Health", value: "public_health" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCategory(value: string) {
  return value
    .split("_")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function scoreColor(score: number) {
  if (score >= 85) return "#dc2626";
  if (score >= 70) return "#d97706";
  return "#0f766e";
}

function softScoreBackground(score: number) {
  if (score >= 85) return "#fef2f2";
  if (score >= 70) return "#fffbeb";
  return "#ecfdf5";
}

function EventCard({ event, featured = false }: { event: OutreachEvent; featured?: boolean }) {
  const completedStops = event.stops.filter((stop) => stop.completed).length;
  const totalStops = event.stops.length || 1;
  const stopProgress = Math.round((completedStops / totalStops) * 100);
  const capacityProgress = event.volunteerCapacity
    ? Math.min(100, Math.round((event.joinedCount / event.volunteerCapacity) * 100))
    : 0;
  const matchScore = event.recommendationScore ?? event.priorityScore;

  return (
    <Link
      href={`/events/${event.id}`}
      style={{
        ...(featured ? {} : card),
        display: "block",
        padding: featured ? 0 : 18,
        borderColor: featured ? "rgba(15,118,110,0.24)" : "rgba(25,38,31,0.10)",
        transition: "transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 14 }}>
        <span style={{ ...pill, background: "#e0f2fe", color: "#075985" }}>
          {formatCategory(event.category)}
        </span>
        <span style={{ ...pill, background: softScoreBackground(matchScore), color: scoreColor(matchScore) }}>
          {matchScore} match
        </span>
      </div>

      <h2
        style={{
          fontSize: featured ? 24 : 18,
          lineHeight: 1.15,
          color: "#111827",
          letterSpacing: 0,
          marginBottom: 8,
        }}
      >
        {event.title}
      </h2>
      <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
        {event.description}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 16 }}>
        <Metric label="When" value={formatDate(event.startTime)} />
        <Metric label="Where" value={event.locationLabel || event.zone?.name || "NYC"} />
        <Metric label="Priority" value={`${event.priorityScore}/100`} />
        <Metric label="Est. Reach" value={event.estimatedReach.toLocaleString()} />
      </div>

      <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
        <ProgressMetric
          label="Volunteer capacity"
          value={`${event.joinedCount}/${event.volunteerCapacity}`}
          percent={capacityProgress}
          color={event.remainingCapacity <= 0 ? "#dc2626" : "#0f766e"}
        />
        <ProgressMetric
          label="Stop completion"
          value={`${completedStops}/${totalStops}`}
          percent={stopProgress}
          color="#2563eb"
        />
      </div>

      {event.recommendationReason ? (
        <p style={{ marginTop: 10, fontSize: 12, color: "#475569" }}>
          {event.recommendationReason}
        </p>
      ) : null}

      <div style={{ marginTop: 15, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <span style={{ color: event.remainingCapacity <= 0 ? "#b91c1c" : "#0f766e", fontSize: 12, fontWeight: 800 }}>
          {event.remainingCapacity <= 0 ? "At capacity" : `${event.remainingCapacity} spots open`}
        </span>
        <span style={{ color: "#0f172a", fontSize: 12, fontWeight: 900 }}>
          Open plan
        </span>
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ fontSize: 11, color: "#94a3b8", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 13, color: "#0f172a", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value}
      </p>
    </div>
  );
}

function ProgressMetric({
  label,
  value,
  percent,
  color,
}: {
  label: string;
  value: string;
  percent: number;
  color: string;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
        <span style={{ color: "#64748b", fontSize: 11, fontWeight: 700 }}>{label}</span>
        <span style={{ color: "#0f172a", fontSize: 11, fontWeight: 900 }}>{value}</span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(percent, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function ZoneRow({ zone }: { zone: OutreachZone }) {
  const score = zone.recommendationScore ?? zone.needScore;
  const coverage = Math.min(Number(zone.coverageScore ?? 0), 100);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "44px minmax(0, 1fr) auto",
        gap: 12,
        alignItems: "center",
        padding: "13px 0",
        borderBottom: "1px solid rgba(15,23,42,0.07)",
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: "#f1f5f9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: scoreColor(score),
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        {score}
      </div>
      <div style={{ minWidth: 0 }}>
        <h3 style={{ fontSize: 14, color: "#0f172a", marginBottom: 3, letterSpacing: 0 }}>
          {zone.name}
        </h3>
        <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.35 }}>
          {zone.reason || "Recommended for next event"}.
        </p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ fontSize: 12, color: "#0f172a", fontWeight: 700 }}>
          {zone.coverageScore}% covered
        </p>
        <p style={{ fontSize: 11, color: "#94a3b8" }}>
          {zone.upcomingEventCount ?? 0} scheduled
        </p>
      </div>
      <div style={{ gridColumn: "2 / 4", height: 7, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${coverage}%`, background: "#0f766e" }} />
      </div>
    </div>
  );
}

export default function EventsPageClient() {
  const [events, setEvents] = useState<OutreachEvent[]>([]);
  const [recommended, setRecommended] = useState<OutreachEvent[]>([]);
  const [zones, setZones] = useState<OutreachZone[]>([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getOutreachEvents(),
      getRecommendedEvents({ category: category || undefined }),
      getRecommendedZones(),
    ])
      .then(([eventData, recommendedData, zoneData]) => {
        if (cancelled) return;
        setEvents(eventData);
        setRecommended(recommendedData);
        setZones(zoneData);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load events.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  const topRecommendation = recommended[0] ?? events[0];
  const displayedEvents = (recommended.length ? recommended : events).filter(
    (event) => !category || event.category === category,
  );
  const totals = useMemo(() => {
    const activeEvents = events.filter((event) => event.status !== "completed").length;
    const openSpots = events.reduce((sum, event) => sum + event.remainingCapacity, 0);
    const estimatedReach = events.reduce((sum, event) => sum + event.estimatedReach, 0);

    return { activeEvents, openSpots, estimatedReach };
  }, [events]);

  return (
    <main style={{ padding: "clamp(18px, 3vw, 34px)", width: "100%" }}>
      <section
        className="anim-fade-up d1"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
          gap: 20,
          alignItems: "stretch",
          marginBottom: 22,
        }}
      >
        <div
          style={{
            borderRadius: 14,
            padding: "clamp(24px, 4vw, 38px)",
            background: "linear-gradient(135deg, #0f172a 0%, #164e63 58%, #0f766e 100%)",
            color: "#f8fafc",
            minHeight: 250,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(226,232,240,0.72)", marginBottom: 12 }}>
              UrbanReach operations console
            </p>
            <h1 style={{ fontSize: 36, lineHeight: 1.05, letterSpacing: 0, marginBottom: 12 }}>
              Coordinate outreach events where they matter most.
            </h1>
            <p style={{ maxWidth: 620, fontSize: 14, lineHeight: 1.6, color: "rgba(241,245,249,0.78)" }}>
              Recommendations combine zone need, coverage, open volunteer capacity, and route-ready stops so teams can reduce duplicate outreach.
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 }}>
            <Stat label="Active Events" value={String(totals.activeEvents)} />
            <Stat label="Open Spots" value={String(totals.openSpots)} />
            <Stat label="Est. Reach" value={totals.estimatedReach.toLocaleString()} />
          </div>
        </div>

        <div style={{ ...card, padding: 22 }}>
          <p style={{ fontSize: 12, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Best next event
          </p>
          {loading ? (
            <div className="anim-shimmer" style={{ height: 176, borderRadius: 12 }} />
          ) : topRecommendation ? (
            <EventCard event={topRecommendation} featured />
          ) : (
            <p style={{ color: "#64748b", fontSize: 14 }}>No events available yet.</p>
          )}
        </div>
      </section>

      {error ? (
        <div style={{ ...card, padding: 16, marginBottom: 18, color: "#b91c1c", background: "#fef2f2" }}>
          {error}
        </div>
      ) : null}

      <div
        style={{
          ...card,
          padding: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 20,
          alignItems: "center",
        }}
      >
        <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800, padding: "0 8px" }}>
          Filter by focus
        </span>
        {CATEGORIES.map((option) => {
          const active = category === option.value;
          return (
            <button
              key={option.value || "all"}
              type="button"
              onClick={() => setCategory(option.value)}
              style={{
                borderRadius: 8,
                padding: "9px 12px",
                background: active ? "#0f766e" : "#f8fafc",
                color: active ? "#ffffff" : "#334155",
                border: `1px solid ${active ? "#0f766e" : "rgba(15,23,42,0.08)"}`,
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 22, color: "#0f172a", letterSpacing: 0 }}>Recommended Events</h2>
              <p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                Ranked by event priority, zone need, capacity, and proximity defaults.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {loading ? (
              <>
                <div className="anim-shimmer" style={{ height: 260, borderRadius: 12 }} />
                <div className="anim-shimmer" style={{ height: 260, borderRadius: 12 }} />
              </>
            ) : displayedEvents.length ? displayedEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            )) : (
              <div style={{ ...card, padding: 22, color: "#64748b", fontSize: 14 }}>
                No events match this focus yet.
              </div>
            )}
          </div>
        </div>

        <aside style={{ ...card, padding: 20 }}>
          <h2 style={{ fontSize: 19, color: "#0f172a", letterSpacing: 0, marginBottom: 4 }}>
            Zone Recommendations
          </h2>
          <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.45, marginBottom: 10 }}>
            Organizer view for where to create or prioritize upcoming events.
          </p>
          {zones.map((zone) => (
            <ZoneRow key={zone.id} zone={zone} />
          ))}
        </aside>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 118 }}>
      <p style={{ color: "rgba(226,232,240,0.64)", fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#ffffff", fontSize: 24, fontWeight: 800 }}>{value}</p>
    </div>
  );
}
