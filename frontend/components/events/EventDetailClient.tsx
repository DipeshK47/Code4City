"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  completeOutreachStop,
  getOptimizedOutreachRoute,
  getOutreachEvent,
  joinOutreachEvent,
  OptimizedRoute,
  OutreachEvent,
} from "@/lib/urbanreach-events-api";
import MiniRouteMap from "./MiniRouteMap";

const card: React.CSSProperties = {
  background: "var(--bg-card, #F8F6F0)",
  border: "1px solid rgba(11, 11, 10, 0.12)",
  borderRadius: 2,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function formatMeters(value: number) {
  if (value >= 1609) return `${(value / 1609.344).toFixed(1)} mi`;
  return `${Math.round(value)} m`;
}

function formatTime(minutes: number) {
  if (minutes < 60) return `${Math.ceil(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.ceil(minutes % 60);
  return `${h}h ${m}m`;
}

function formatCategory(value: string) {
  return value.split("_").map((p) => p[0]?.toUpperCase() + p.slice(1)).join(" ");
}

type TravelMode = "walking" | "transit" | "biking";

export default function EventDetailClient({ eventId }: { eventId: string | number }) {
  const [event, setEvent] = useState<OutreachEvent | null>(null);
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("walking");

  async function refresh() {
    const [nextEvent, nextRoute] = await Promise.all([
      getOutreachEvent(eventId),
      getOptimizedOutreachRoute(eventId),
    ]);
    setEvent(nextEvent);
    setRoute(nextRoute);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([getOutreachEvent(eventId), getOptimizedOutreachRoute(eventId)])
      .then(([eventData, routeData]) => {
        if (cancelled) return;
        setEvent(eventData);
        setRoute(routeData);
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load event."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [eventId]);

  const progress = useMemo(() => {
    const total = event?.stops.length ?? 0;
    const complete = event?.stops.filter((s) => s.completed).length ?? 0;
    return { complete, total, percent: total ? Math.round((complete / total) * 100) : 0 };
  }, [event]);

  const orderedStops = useMemo(() => {
    if (!event) return [];
    const routeById = new Map((route?.orderedStops ?? []).map((s) => [String(s.id), s]));
    return event.stops
      .map((stop) => {
        const rs = routeById.get(String(stop.id));
        return { ...stop, sequence: rs?.sequence, legDistanceMeters: rs?.legDistanceMeters, isInOptimizedRoute: Boolean(rs) };
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.isInOptimizedRoute && b.isInOptimizedRoute) return (a.sequence ?? 0) - (b.sequence ?? 0);
        if (a.isInOptimizedRoute !== b.isInOptimizedRoute) return a.isInOptimizedRoute ? -1 : 1;
        return Number(a.id) - Number(b.id);
      });
  }, [event, route]);

  const getAdjustedLegTime = useCallback((distanceMeters: number | undefined): number => {
    if (!distanceMeters) return 0;
    if (travelMode === "walking") return distanceMeters / 84;
    if (travelMode === "biking") return distanceMeters / 270;
    return 3 + distanceMeters / 360;
  }, [travelMode]);

  const adjustedTotalMinutes = useMemo(() => {
    if (!route) return 0;
    return route.orderedStops.reduce((t, s) => t + getAdjustedLegTime(s.legDistanceMeters), 0);
  }, [route, travelMode]);

  async function handleJoin() {
    if (event && event.remainingCapacity <= 0) { setError("This event is already at capacity."); return; }
    setBusy("join"); setError("");
    try { const next = await joinOutreachEvent(eventId); setEvent(next); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to join event."); }
    finally { setBusy(""); }
  }

  async function handleCompleteStop(stopId: string | number) {
    setBusy(`stop-${stopId}`); setError("");
    try { await completeOutreachStop(eventId, stopId); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to complete stop."); }
    finally { setBusy(""); }
  }

  async function handleUseLocation() {
    if (!navigator.geolocation) { setError("Location not available in this browser."); return; }
    setBusy("location"); setError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          const next = await getOptimizedOutreachRoute(eventId, loc);
          setRoute(next);
        } catch (err) { setError(err instanceof Error ? err.message : "Failed to optimize from location."); }
        finally { setBusy(""); }
      },
      () => { setBusy(""); setError("Location permission denied."); },
      { enableHighAccuracy: true, timeout: 9000 },
    );
  }

  function handleModeChange(mode: TravelMode) {
    setTravelMode(mode);
    setBusy("mode");
    setTimeout(() => setBusy(""), 400);
  }

  if (loading) {
    return (
      <main style={{ padding: "clamp(18px, 3vw, 34px)", width: "100%", background: "var(--bg-base, #F3F0E9)" }}>
        <div className="anim-shimmer" style={{ height: 380, borderRadius: 2, marginBottom: 20 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="anim-shimmer" style={{ height: 260, borderRadius: 2 }} />
          <div className="anim-shimmer" style={{ height: 260, borderRadius: 2 }} />
        </div>
      </main>
    );
  }

  if (!event) {
    return (
      <main style={{ padding: 32, background: "var(--bg-base, #F3F0E9)" }}>
        <Link href="/events" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#D44A12", textDecoration: "none" }}>
          ← Back to Events
        </Link>
        <p style={{ marginTop: 16, color: "#D44A12", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{error || "Event not found."}</p>
      </main>
    );
  }

  const isOptimizing = busy === "location" || busy === "mode";

  return (
    <main style={{ padding: "clamp(18px, 3vw, 34px)", width: "100%", background: "var(--bg-base, #F3F0E9)" }}>
      <Link href="/events" style={{ display: "inline-block", marginBottom: 18, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#D44A12", textDecoration: "none" }}>
        ← Back to Events
      </Link>

      {/* Hero */}
      <section style={{ background: "#1A1917", border: "1px solid rgba(212, 74, 18, 0.18)", borderRadius: 2, padding: "clamp(28px, 4vw, 48px)", marginBottom: 20, position: "relative" }}>
        <div style={{ position: "absolute", top: 24, right: 24, width: 48, height: 48, border: "1px solid #D44A12", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#D44A12", letterSpacing: "0.14em" }}>VT</div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <Tag>{formatCategory(event.category)}</Tag>
          <Tag accent>{event.priorityScore} priority</Tag>
          <Tag>{event.status}</Tag>
        </div>

        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "clamp(32px, 5vw, 64px)", fontWeight: 400, color: "#F8F6F0", letterSpacing: "-0.035em", lineHeight: 0.95, marginBottom: 12 }}>
          {event.title}
        </h1>
        <p style={{ maxWidth: 680, lineHeight: 1.6, color: "rgba(248, 246, 240, 0.58)", fontSize: 14, marginBottom: 28 }}>
          {event.description}
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
          <HeroMetric label="When" value={formatDate(event.startTime)} />
          <HeroMetric label="Zone" value={event.zone?.name || event.locationLabel} />
          <HeroMetric label="Volunteers" value={`${event.joinedCount}/${event.volunteerCapacity}`} />
          <HeroMetric label="Est. Reach" value={event.estimatedReach.toLocaleString()} />
        </div>
      </section>

      {error ? (
        <div style={{ ...card, padding: 14, marginBottom: 16, borderColor: "rgba(212, 74, 18, 0.28)", color: "#D44A12" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>Error — </span>{error}
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))", gap: 20, alignItems: "start" }}>

        {/* Left column */}
        <div style={{ display: "grid", gap: 16 }}>

          {/* Progress */}
          <div style={{ ...card, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 14 }}>
              <div>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A8780", marginBottom: 4 }}>Outreach Progress</p>
                <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.02em" }}>Stop completion</h2>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, fontWeight: 400, color: "#D44A12", letterSpacing: "-0.02em", lineHeight: 1 }}>{progress.percent}%</p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#8A8780", marginTop: 4, letterSpacing: "0.1em" }}>{progress.complete}/{progress.total} stops</p>
              </div>
            </div>
            <div style={{ height: 3, background: "rgba(11, 11, 10, 0.1)" }}>
              <div style={{ height: "100%", width: `${progress.percent}%`, background: "#D44A12", transition: "width 0.4s ease" }} />
            </div>
          </div>

          {/* Optimized route */}
          <div style={{ ...card, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
              <div>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A8780", marginBottom: 4 }}>Route Plan</p>
                <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.02em" }}>Optimized stop order</h2>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", border: "1px solid rgba(212, 74, 18, 0.28)", color: "#D44A12", padding: "4px 8px" }}>
                {route?.orderedStops.length ?? 0} remaining
              </span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <MiniRouteMap stops={orderedStops} userLocation={userLocation} height={240} />
            </div>

            {/* Travel mode toggle */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <div style={{ display: "flex", gap: 2, border: "1px solid rgba(11, 11, 10, 0.16)", padding: 3 }}>
                {(["walking", "transit", "biking"] as TravelMode[]).map((mode) => {
                  const labels: Record<TravelMode, string> = { walking: "Walk", transit: "Transit", biking: "Bike" };
                  return (
                    <button key={mode} type="button" onClick={() => handleModeChange(mode)} style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fontWeight: 400,
                      letterSpacing: "0.14em", textTransform: "uppercase",
                      padding: "6px 10px", border: "none", cursor: "pointer",
                      background: travelMode === mode ? "#D44A12" : "transparent",
                      color: travelMode === mode ? "#F8F6F0" : "#8A8780",
                    }}>
                      {labels[mode]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stop list */}
            <div style={{ position: "relative" }}>
              {isOptimizing ? (
                <div style={{ display: "grid", gap: 10 }}>
                  {[1, 2, 3].map((i) => <div key={i} className="anim-shimmer" style={{ height: 68, borderRadius: 2 }} />)}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {orderedStops.map((stop, index) => {
                    const isLast = index === orderedStops.length - 1;
                    const nextDist = !isLast ? orderedStops[index + 1].legDistanceMeters : undefined;
                    const legTime = getAdjustedLegTime(nextDist);

                    return (
                      <div key={stop.id}>
                        <div style={{
                          display: "grid", gridTemplateColumns: "36px minmax(0, 1fr) auto",
                          gap: 12, alignItems: "center", padding: 14,
                          border: `1px solid ${stop.completed ? "rgba(212, 74, 18, 0.22)" : "rgba(11, 11, 10, 0.10)"}`,
                          background: stop.completed ? "rgba(212, 74, 18, 0.04)" : "var(--bg-card, #F8F6F0)",
                          borderRadius: 2,
                        }}>
                          <div style={{
                            width: 36, height: 36, border: `1px solid ${stop.completed ? "rgba(212, 74, 18, 0.4)" : "rgba(11, 11, 10, 0.16)"}`,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                            color: stop.completed ? "#D44A12" : "#8A8780", fontWeight: 500,
                          }}>
                            {stop.completed ? "✓" : stop.sequence ?? index + 1}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginBottom: 3 }}>
                              <p style={{ fontSize: 13, color: "#0B0B0A", fontWeight: 500 }}>{stop.name}</p>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A8780", border: "1px solid rgba(11, 11, 10, 0.12)", padding: "2px 5px" }}>
                                {stop.stopType.replace("_", " ")}
                              </span>
                            </div>
                            <p style={{ fontSize: 11, color: "#8A8780" }}>{stop.address || stop.stopType}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCompleteStop(stop.id)}
                            disabled={stop.completed || busy === `stop-${stop.id}`}
                            style={{
                              fontFamily: "'JetBrains Mono', monospace", fontSize: 9,
                              letterSpacing: "0.14em", textTransform: "uppercase",
                              padding: "8px 12px", borderRadius: 0, border: "1px solid",
                              borderColor: stop.completed ? "rgba(212, 74, 18, 0.28)" : "#D44A12",
                              background: stop.completed ? "transparent" : "#D44A12",
                              color: stop.completed ? "#D44A12" : "#F8F6F0",
                              cursor: stop.completed ? "default" : "pointer",
                              opacity: busy === `stop-${stop.id}` ? 0.6 : 1,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {stop.completed ? "Done" : busy === `stop-${stop.id}` ? "Saving" : "Complete"}
                          </button>
                        </div>

                        {!isLast && !stop.completed && (
                          <div style={{ paddingLeft: 50, paddingTop: 6, paddingBottom: 6 }}>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#8A8780", letterSpacing: "0.1em" }}>
                              {travelMode === "walking" ? "Walk" : travelMode === "transit" ? "Transit" : "Bike"} · {formatTime(legTime)} · {formatMeters(nextDist ?? 0)}
                            </span>
                          </div>
                        )}
                        {!isLast && stop.completed && <div style={{ height: 8 }} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <aside style={{ display: "grid", gap: 16 }}>

          {/* Join */}
          <div style={{ ...card, padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
              <div>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A8780", marginBottom: 4 }}>Volunteer</p>
                <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.02em" }}>Join & Route</h2>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, fontWeight: 400, color: event.remainingCapacity <= 0 ? "#D44A12" : "#0B0B0A", lineHeight: 1 }}>{event.remainingCapacity}</p>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#8A8780", marginTop: 4, letterSpacing: "0.1em" }}>spots open</p>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#8A8780", lineHeight: 1.55, marginBottom: 16 }}>
              {event.remainingCapacity <= 0
                ? "This event is fully staffed. You can still review the plan."
                : "Claim a spot and use the route controls to optimize your path."}
            </p>
            <div style={{ display: "grid", gap: 8 }}>
              <button
                type="button" onClick={handleJoin}
                disabled={busy === "join" || event.remainingCapacity <= 0}
                style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                  padding: "12px 14px", borderRadius: 0,
                  border: "1px solid",
                  borderColor: event.remainingCapacity <= 0 ? "rgba(11, 11, 10, 0.16)" : "#D44A12",
                  background: event.remainingCapacity <= 0 ? "transparent" : "#D44A12",
                  color: event.remainingCapacity <= 0 ? "#8A8780" : "#F8F6F0",
                  cursor: event.remainingCapacity <= 0 ? "default" : "pointer",
                }}
              >
                {event.remainingCapacity <= 0 ? "Event Full" : busy === "join" ? "Joining..." : "Join Event"}
              </button>
              <button
                type="button" onClick={handleUseLocation} disabled={isOptimizing}
                style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                  padding: "12px 14px", borderRadius: 0,
                  border: "1px solid rgba(11, 11, 10, 0.16)", background: "transparent",
                  color: "#8A8780", cursor: "pointer", opacity: isOptimizing ? 0.6 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                {busy === "location" ? "Optimizing..." : "Optimize from My Location"}
              </button>
            </div>
          </div>

          {/* Route summary */}
          <div style={{ ...card, padding: 22 }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A8780", marginBottom: 4 }}>Route Summary</p>
            <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.02em", marginBottom: 14 }}>Mission overview</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
              <SummaryTile label="Distance" value={route ? formatMeters(route.estimatedDistanceMeters) : "—"} />
              <SummaryTile label="Est. Time" value={route ? formatTime(adjustedTotalMinutes) : "—"} />
            </div>
            <SummaryRow label="Stops Remaining" value={String(route?.orderedStops.length ?? 0)} />
            <SummaryRow label="Zone Coverage" value={`${event.zone?.coverageScore ?? 0}%`} />
          </div>

          {/* Zone intelligence */}
          {event.zone && (
            <div style={{ ...card, padding: 22 }}>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#8A8780", marginBottom: 4 }}>Zone Intelligence</p>
              <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.02em", marginBottom: 14 }}>{event.zone.name}</h2>
              <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
                <ScoreBar label="Need Score" value={Number(event.zone.needScore)} />
                <ScoreBar label="Service Gap" value={Number(event.zone.serviceGapScore)} />
              </div>
              <SummaryRow label="Households" value={(event.zone.estimatedHouseholds ?? 0).toLocaleString()} />
              {event.zone.borough && <SummaryRow label="Borough" value={event.zone.borough} />}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
      padding: "5px 10px", border: accent ? "1px solid rgba(212, 74, 18, 0.5)" : "1px solid rgba(248, 246, 240, 0.2)",
      color: accent ? "#D44A12" : "rgba(248, 246, 240, 0.65)",
      background: accent ? "rgba(212, 74, 18, 0.1)" : "transparent",
    }}>
      {children}
    </span>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(248, 246, 240, 0.4)", marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 500, color: "#F8F6F0" }}>{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(11, 11, 10, 0.08)" }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: "0.1em", color: "#8A8780" }}>{label}</span>
      <span style={{ fontSize: 13, color: "#0B0B0A", fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: "1px solid rgba(11, 11, 10, 0.10)", padding: 12, background: "var(--bg-base, #F3F0E9)" }}>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#8A8780", marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, fontWeight: 400, color: "#0B0B0A", letterSpacing: "-0.02em", lineHeight: 1 }}>{value}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8A8780" }}>{label}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: value >= 70 ? "#D44A12" : "#8A8780" }}>{value}/100</span>
      </div>
      <div style={{ height: 3, background: "rgba(11, 11, 10, 0.1)" }}>
        <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, background: "#D44A12" }} />
      </div>
    </div>
  );
}
