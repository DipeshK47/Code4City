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
  background: "var(--bg-card, #F8F6F0)",
  border: "1px solid rgba(11, 11, 10, 0.12)",
  borderRadius: 2,
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
  if (score >= 85) return "#D44A12";
  if (score >= 70) return "#B8712A";
  return "#8A8780";
}

function EventCard({ event }: { event: OutreachEvent }) {
  const completedStops = event.stops.filter((s) => s.completed).length;
  const totalStops = event.stops.length || 1;
  const stopPercent = Math.round((completedStops / totalStops) * 100);
  const capPercent = event.volunteerCapacity
    ? Math.min(100, Math.round((event.joinedCount / event.volunteerCapacity) * 100))
    : 0;
  const matchScore = event.recommendationScore ?? event.priorityScore;

  return (
    <Link
      href={`/events/${event.id}`}
      style={{ ...card, display: "block", padding: 20, textDecoration: "none" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9, fontWeight: 500, letterSpacing: "0.18em", textTransform: "uppercase",
          color: "#D44A12", border: "1px solid rgba(212, 74, 18, 0.28)", padding: "3px 7px",
        }}>
          {formatCategory(event.category)}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.12em", color: scoreColor(matchScore) }}>
          {matchScore} PRI
        </span>
      </div>

      <h3 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 8 }}>
        {event.title}
      </h3>
      <p style={{ fontSize: 13, color: "#8A8780", lineHeight: 1.5, marginBottom: 14 }}>
        {event.description}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <Metric label="When" value={formatDate(event.startTime)} />
        <Metric label="Where" value={event.locationLabel || event.zone?.name || "NYC"} />
        <Metric label="Reach" value={event.estimatedReach.toLocaleString()} />
        <Metric label="Priority" value={`${event.priorityScore}/100`} />
      </div>

      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        <ProgressBar label="Volunteers" value={`${event.joinedCount}/${event.volunteerCapacity}`} percent={capPercent} />
        <ProgressBar label="Stops done" value={`${completedStops}/${totalStops}`} percent={stopPercent} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: "1px solid rgba(11, 11, 10, 0.08)" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: event.remainingCapacity <= 0 ? "#D44A12" : "#8A8780" }}>
          {event.remainingCapacity <= 0 ? "AT CAPACITY" : `${event.remainingCapacity} SPOTS OPEN`}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#D44A12" }}>
          View →
        </span>
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8A8780", marginBottom: 3 }}>{label}</p>
      <p style={{ fontSize: 12, color: "#0B0B0A", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
    </div>
  );
}

function ProgressBar({ label, value, percent }: { label: string; value: string; percent: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A8780" }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#0B0B0A" }}>{value}</span>
      </div>
      <div style={{ height: 3, background: "rgba(11, 11, 10, 0.1)" }}>
        <div style={{ height: "100%", width: `${Math.min(percent, 100)}%`, background: "#D44A12" }} />
      </div>
    </div>
  );
}

function ZoneRow({ zone }: { zone: OutreachZone }) {
  const score = zone.recommendationScore ?? zone.needScore;
  const coverage = Math.min(Number(zone.coverageScore ?? 0), 100);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "40px minmax(0, 1fr) auto", gap: 12, alignItems: "center", padding: "13px 0", borderBottom: "1px solid rgba(11, 11, 10, 0.08)" }}>
      <div style={{ width: 40, height: 40, border: "1px solid rgba(212, 74, 18, 0.28)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: "#D44A12" }}>
        {Math.round(score)}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 13, color: "#0B0B0A", fontWeight: 500, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{zone.name}</p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#8A8780", letterSpacing: "0.08em" }}>{zone.reason || "Recommended zone"}</p>
      </div>
      <div style={{ textAlign: "right" }}>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#D44A12", letterSpacing: "0.1em" }}>{zone.coverageScore}%</p>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#8A8780", marginTop: 1 }}>{zone.upcomingEventCount ?? 0} events</p>
      </div>
      <div style={{ gridColumn: "2 / 4", height: 2, background: "rgba(11, 11, 10, 0.08)" }}>
        <div style={{ height: "100%", width: `${coverage}%`, background: "#D44A12" }} />
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(248, 246, 240, 0.45)", marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, fontWeight: 400, color: "#F8F6F0", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</p>
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

    return () => { cancelled = true; };
  }, [category]);

  const totals = useMemo(() => ({
    activeEvents: events.filter((e) => e.status !== "completed").length,
    openSpots: events.reduce((s, e) => s + e.remainingCapacity, 0),
    estimatedReach: events.reduce((s, e) => s + e.estimatedReach, 0),
  }), [events]);

  const displayedEvents = (recommended.length ? recommended : events).filter(
    (e) => !category || e.category === category,
  );

  return (
    <main style={{ padding: "clamp(18px, 3vw, 34px)", width: "100%", background: "var(--bg-base, #F3F0E9)" }}>

      {/* Hero */}
      <section style={{
        borderRadius: 2,
        padding: "clamp(28px, 4vw, 48px)",
        background: "#1A1917",
        border: "1px solid rgba(212, 74, 18, 0.18)",
        marginBottom: 24,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: 28, right: 28, width: 54, height: 54, border: "1px solid #D44A12", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#D44A12", letterSpacing: "0.14em" }}>VT</div>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(248, 246, 240, 0.45)", marginBottom: 14 }}>
          Outreach Events
        </p>
        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(36px, 6vw, 72px)", fontWeight: 400, color: "#F8F6F0", letterSpacing: "-0.035em", lineHeight: 0.95, marginBottom: 14, maxWidth: 700 }}>
          Coordinate outreach where it matters most.
        </h1>
        <p style={{ fontSize: 14, color: "rgba(248, 246, 240, 0.55)", maxWidth: 560, lineHeight: 1.6, marginBottom: 28 }}>
          Events combine zone need, volunteer capacity, and route-ready stops to reduce duplicate outreach across NYC.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32 }}>
          <StatTile label="Active Events" value={String(totals.activeEvents)} />
          <StatTile label="Open Spots" value={String(totals.openSpots)} />
          <StatTile label="Est. Reach" value={totals.estimatedReach.toLocaleString()} />
        </div>
      </section>

      {error ? (
        <div style={{ ...card, padding: 14, marginBottom: 18, borderColor: "rgba(212, 74, 18, 0.28)", color: "#D44A12" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>Error — </span>
          {error}
        </div>
      ) : null}

      {/* Category filter */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 22, alignItems: "center" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A8780", marginRight: 6 }}>Filter</span>
        {CATEGORIES.map((opt) => {
          const active = category === opt.value;
          return (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => setCategory(opt.value)}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, fontWeight: 400, letterSpacing: "0.14em", textTransform: "uppercase",
                padding: "7px 14px", borderRadius: 0,
                border: active ? "1px solid #D44A12" : "1px solid rgba(11, 11, 10, 0.16)",
                background: active ? "#D44A12" : "transparent",
                color: active ? "#F8F6F0" : "#8A8780",
                cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Content grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 24, alignItems: "start" }}>

        {/* Events list */}
        <div>
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A8780", marginBottom: 4 }}>Recommended Events</p>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.025em", lineHeight: 1 }}>
              Prioritized for your zone
            </h2>
          </div>
          <div style={{ display: "grid", gap: 14 }}>
            {loading ? (
              <>
                <div className="anim-shimmer" style={{ height: 220, borderRadius: 2 }} />
                <div className="anim-shimmer" style={{ height: 220, borderRadius: 2 }} />
              </>
            ) : displayedEvents.length ? (
              displayedEvents.map((event) => <EventCard key={event.id} event={event} />)
            ) : (
              <div style={{ ...card, padding: 24 }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A8780" }}>
                  No events match this filter yet.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Zone sidebar */}
        <aside style={{ ...card, padding: 22 }}>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A8780", marginBottom: 4 }}>Zone Intelligence</p>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.02em", marginBottom: 4 }}>
            Where to prioritize
          </h2>
          <p style={{ fontSize: 12, color: "#8A8780", lineHeight: 1.5, marginBottom: 14 }}>
            Zones ranked by need, coverage gap, and upcoming event density.
          </p>
          {loading ? (
            <div className="anim-shimmer" style={{ height: 200, borderRadius: 2 }} />
          ) : zones.length ? (
            zones.map((zone) => <ZoneRow key={zone.id} zone={zone} />)
          ) : (
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.12em", color: "#8A8780", textTransform: "uppercase" }}>
              No zone data yet.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
