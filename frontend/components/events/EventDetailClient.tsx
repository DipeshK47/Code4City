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
  background: "#ffffff",
  border: "1px solid rgba(15,23,42,0.08)",
  borderRadius: 12,
  boxShadow: "0 2px 14px rgba(0,0,0,0.05)",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
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

type TravelMode = "walking" | "transit" | "biking";

export default function EventDetailClient({ eventId }: { eventId: string | number }) {
  const [event, setEvent] = useState<OutreachEvent | null>(null);
  const [route, setRoute] = useState<OptimizedRoute | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("walking");

  async function refresh() {
    const nextEvent = await getOutreachEvent(eventId);
    setEvent(nextEvent);
    const nextRoute = await getOptimizedOutreachRoute(eventId);
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
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load event.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [eventId]);

  const progress = useMemo(() => {
    const total = event?.stops.length ?? 0;
    const complete = event?.stops.filter((stop) => stop.completed).length ?? 0;
    return {
      complete,
      total,
      percent: total ? Math.round((complete / total) * 100) : 0,
    };
  }, [event]);

  const orderedStops = useMemo(() => {
    if (!event) return [];

    const routeById = new Map(
      (route?.orderedStops ?? []).map((stop) => [String(stop.id), stop]),
    );

    return event.stops
      .map((stop) => {
        const routeStop = routeById.get(String(stop.id));
        return {
          ...stop,
          sequence: routeStop?.sequence,
          legDistanceMeters: routeStop?.legDistanceMeters,
          isInOptimizedRoute: Boolean(routeStop),
        };
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (a.isInOptimizedRoute && b.isInOptimizedRoute) {
          return (a.sequence ?? 0) - (b.sequence ?? 0);
        }
        if (a.isInOptimizedRoute !== b.isInOptimizedRoute) {
          return a.isInOptimizedRoute ? -1 : 1;
        }
        return Number(a.id) - Number(b.id);
      });
  }, [event, route]);

  // Adjust time estimates dynamically based on selected travel mode
  // The backend gives us haversine-based distance in legDistanceMeters.
  // Walking: ~1.4 m/s (84 m/min)
  // Biking: ~4.5 m/s (270 m/min)
  // Transit: ~6.0 m/s (360 m/min) + base 3 min wait time
  const getAdjustedLegTime = useCallback((distanceMeters: number | undefined): number => {
    if (!distanceMeters) return 0;
    if (travelMode === "walking") return distanceMeters / 84;
    if (travelMode === "biking") return distanceMeters / 270;
    if (travelMode === "transit") return 3 + (distanceMeters / 360);
    return 0;
  }, [travelMode]);

  const adjustedTotalTimeMinutes = useMemo(() => {
    if (!route) return 0;
    let total = 0;
    route.orderedStops.forEach(s => total += getAdjustedLegTime(s.legDistanceMeters));
    return total;
  }, [route, travelMode]);

  async function handleJoin() {
    if (event && event.remainingCapacity <= 0) {
      setError("This event is already at volunteer capacity.");
      return;
    }

    setBusy("join");
    setError("");
    try {
      const nextEvent = await joinOutreachEvent(eventId);
      setEvent(nextEvent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join event.");
    } finally {
      setBusy("");
    }
  }

  async function handleCompleteStop(stopId: string | number) {
    setBusy(`stop-${stopId}`);
    setError("");
    try {
      await completeOutreachStop(eventId, stopId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete stop.");
    } finally {
      setBusy("");
    }
  }

  async function handleUseLocation() {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }

    setBusy("location");
    setError("");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
          const nextRoute = await getOptimizedOutreachRoute(eventId, {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setRoute(nextRoute);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to optimize from your location.");
        } finally {
          setBusy("");
        }
      },
      () => {
        setBusy("");
        setError("Location permission was not granted.");
      },
      { enableHighAccuracy: true, timeout: 9000 },
    );
  }

  // Simulate optimization when mode changes
  function handleModeChange(mode: TravelMode) {
    setTravelMode(mode);
    setBusy("mode");
    // Just fake a short loading state to show the skeleton animation when mode changes
    setTimeout(() => {
      setBusy("");
    }, 600);
  }

  if (loading) {
    return (
      <main style={{ padding: "clamp(18px, 3vw, 34px)", width: "100%" }}>
        <div className="anim-shimmer" style={{ height: 420, borderRadius: 14 }} />
      </main>
    );
  }

  if (!event) {
    return (
      <main style={{ padding: 32 }}>
        <Link href="/events" style={{ color: "#0f766e", fontWeight: 700 }}>Back to events</Link>
        <p style={{ marginTop: 16, color: "#b91c1c" }}>{error || "Event not found."}</p>
      </main>
    );
  }

  const isOptimizing = busy === "location" || busy === "mode";

  return (
    <main style={{ padding: "clamp(18px, 3vw, 34px)", width: "100%" }}>
      <Link href="/events" style={{ display: "inline-flex", marginBottom: 16, color: "#0f766e", fontSize: 13, fontWeight: 800 }}>
        Back to events
      </Link>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 360px), 1fr))",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              borderRadius: 14,
              padding: "clamp(24px, 4vw, 38px)",
              background: "linear-gradient(135deg, #111827 0%, #1e3a8a 54%, #0f766e 100%)",
              color: "#f8fafc",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ borderRadius: 999, padding: "7px 10px", background: "rgba(255,255,255,0.13)", fontSize: 12, fontWeight: 800 }}>
                {formatCategory(event.category)}
              </span>
              <span style={{ borderRadius: 999, padding: "7px 10px", background: "rgba(245,158,11,0.22)", color: "#fde68a", fontSize: 12, fontWeight: 800 }}>
                {event.priorityScore} priority
              </span>
              <span style={{ borderRadius: 999, padding: "7px 10px", background: "rgba(255,255,255,0.13)", fontSize: 12, fontWeight: 800 }}>
                {event.status}
              </span>
            </div>

            <h1 style={{ fontSize: 36, lineHeight: 1.05, letterSpacing: 0, marginBottom: 12 }}>
              {event.title}
            </h1>
            <p style={{ maxWidth: 700, lineHeight: 1.6, color: "rgba(241,245,249,0.78)", fontSize: 14 }}>
              {event.description}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginTop: 26 }}>
              <HeroMetric label="When" value={formatDate(event.startTime)} />
              <HeroMetric label="Zone" value={event.zone?.name || event.locationLabel} />
              <HeroMetric label="Volunteers" value={`${event.joinedCount}/${event.volunteerCapacity}`} />
              <HeroMetric label="Estimated Reach" value={event.estimatedReach.toLocaleString()} />
            </div>
          </div>

          {error ? (
            <div style={{ ...card, padding: 15, marginBottom: 16, background: "#fef2f2", color: "#b91c1c" }}>
              {error}
            </div>
          ) : null}

          <div style={{ ...card, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 20, color: "#0f172a", letterSpacing: 0 }}>Outreach Progress</h2>
                <p style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
                  Complete stops to update coverage and future priority scores.
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <strong style={{ color: "#0f766e", fontSize: 24 }}>{progress.percent}%</strong>
                <p style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
                  {progress.complete}/{progress.total} stops
                </p>
              </div>
            </div>
            <div style={{ height: 10, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress.percent}%`, background: "#0f766e", transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }} />
            </div>
          </div>

          <div style={{ ...card, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 20, color: "#0f172a", letterSpacing: 0, marginBottom: 4 }}>
                  Optimized Stop Order
                </h2>
                <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.45 }}>
                  Remaining stops are ordered by efficiency and priority.
                </p>
              </div>
              <span style={{ borderRadius: 999, padding: "6px 10px", background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap" }}>
                {route?.orderedStops.length ?? 0} remaining
              </span>
            </div>

            <div style={{ marginBottom: 20 }}>
              <MiniRouteMap stops={orderedStops} userLocation={userLocation} height={260} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 4 }}>
                <button
                  type="button"
                  onClick={() => handleModeChange("walking")}
                  style={{
                    padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                    background: travelMode === "walking" ? "#fff" : "transparent",
                    color: travelMode === "walking" ? "#0f172a" : "#64748b",
                    boxShadow: travelMode === "walking" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  🚶 Walking
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("transit")}
                  style={{
                    padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                    background: travelMode === "transit" ? "#fff" : "transparent",
                    color: travelMode === "transit" ? "#0f172a" : "#64748b",
                    boxShadow: travelMode === "transit" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  🚇 Transit
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("biking")}
                  style={{
                    padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                    background: travelMode === "biking" ? "#fff" : "transparent",
                    color: travelMode === "biking" ? "#0f172a" : "#64748b",
                    boxShadow: travelMode === "biking" ? "0 2px 4px rgba(0,0,0,0.05)" : "none",
                  }}
                >
                  🚲 Biking
                </button>
              </div>
            </div>

            <div style={{ position: "relative" }}>
              {isOptimizing ? (
                <div style={{ display: "grid", gap: 12, opacity: 0.7 }}>
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="anim-shimmer" style={{ height: 72, borderRadius: 10 }} />
                  ))}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {orderedStops.map((stop, index) => {
                    const isLast = index === orderedStops.length - 1;
                    const nextStopDistance = !isLast ? orderedStops[index + 1].legDistanceMeters : undefined;
                    const legTime = getAdjustedLegTime(nextStopDistance);
                    
                    return (
                      <div key={stop.id} style={{ position: "relative" }}>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "40px minmax(0, 1fr) auto",
                            gap: 12,
                            alignItems: "center",
                            padding: 14,
                            borderRadius: 10,
                            border: `1px solid ${stop.completed ? "rgba(22,101,52,0.18)" : "rgba(15,23,42,0.08)"}`,
                            background: stop.completed ? "#f0fdf4" : "#ffffff",
                            position: "relative",
                            zIndex: 2,
                            transition: "all 0.3s ease",
                          }}
                        >
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: 10,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: stop.completed ? "#bbf7d0" : "#e0f2fe",
                              color: stop.completed ? "#166534" : "#075985",
                              fontWeight: 900,
                            }}
                          >
                            {stop.completed ? "OK" : stop.sequence ?? index + 1}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 4 }}>
                              <h3 style={{ fontSize: 14, color: "#0f172a", letterSpacing: 0 }}>
                                {stop.name}
                              </h3>
                              <span style={{ borderRadius: 999, padding: "3px 7px", background: "#f1f5f9", color: "#475569", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                {stop.stopType.replace("_", " ")}
                              </span>
                            </div>
                            <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.4 }}>
                              {stop.address || stop.stopType}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCompleteStop(stop.id)}
                            disabled={stop.completed || busy === `stop-${stop.id}`}
                            style={{
                              borderRadius: 8,
                              padding: "9px 13px",
                              background: stop.completed ? "#dcfce7" : "#0f766e",
                              color: stop.completed ? "#166534" : "#ffffff",
                              fontSize: 12,
                              fontWeight: 800,
                              opacity: busy === `stop-${stop.id}` ? 0.72 : 1,
                              border: "none",
                              cursor: stop.completed ? "default" : "pointer",
                            }}
                          >
                            {stop.completed ? "Done" : busy === `stop-${stop.id}` ? "Saving" : "Complete"}
                          </button>
                        </div>
                        
                        {!isLast && !stop.completed && (
                          <div style={{ 
                            height: 36, 
                            display: "flex", 
                            alignItems: "center", 
                            paddingLeft: 33, 
                            position: "relative" 
                          }}>
                            <div style={{ 
                              position: "absolute", 
                              left: 33, top: 0, bottom: 0, 
                              width: 2, 
                              background: "repeating-linear-gradient(to bottom, #cbd5e1 0, #cbd5e1 4px, transparent 4px, transparent 8px)" 
                            }} />
                            <div style={{
                              marginLeft: 18,
                              background: "#f8fafc",
                              padding: "4px 8px",
                              borderRadius: 6,
                              border: "1px solid #e2e8f0",
                              fontSize: 11,
                              color: "#64748b",
                              fontWeight: 600,
                              display: "flex",
                              alignItems: "center",
                              gap: 6
                            }}>
                              <span style={{ fontSize: 12 }}>
                                {travelMode === "walking" ? "🚶" : travelMode === "transit" ? "🚇" : "🚲"}
                              </span>
                              {formatTime(legTime)}
                              <span style={{ opacity: 0.5 }}>·</span>
                              {formatMeters(nextStopDistance ?? 0)}
                            </div>
                          </div>
                        )}
                        {!isLast && stop.completed && (
                          <div style={{ height: 12 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside style={{ display: "grid", gap: 16 }}>
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 10 }}>
              <div>
                <h2 style={{ fontSize: 20, color: "#0f172a", letterSpacing: 0, marginBottom: 4 }}>
                  Join And Route
                </h2>
                <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5 }}>
                  Join the event, then optimize the stop order from the zone center or your current location.
                </p>
              </div>
              <div style={{ minWidth: 64, textAlign: "right" }}>
                <strong style={{ color: event.remainingCapacity <= 0 ? "#b91c1c" : "#0f766e", fontSize: 18 }}>
                  {event.remainingCapacity}
                </strong>
                <p style={{ color: "#64748b", fontSize: 11 }}>open</p>
              </div>
            </div>
            <p style={{ color: "#64748b", fontSize: 13, lineHeight: 1.5, marginBottom: 16 }}>
              {event.remainingCapacity <= 0
                ? "This event is fully staffed. You can still review the plan and route."
                : "Claim a volunteer spot and use the route controls below."}
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              <button
                type="button"
                onClick={handleJoin}
                disabled={busy === "join" || event.remainingCapacity <= 0}
                style={{
                  borderRadius: 10,
                  padding: "12px 14px",
                  background: event.remainingCapacity <= 0 ? "#e5e7eb" : "#0f766e",
                  border: "1px solid transparent",
                  color: event.remainingCapacity <= 0 ? "#64748b" : "#ffffff",
                  fontWeight: 900,
                  cursor: event.remainingCapacity <= 0 ? "default" : "pointer",
                }}
              >
                {event.remainingCapacity <= 0 ? "Event Full" : busy === "join" ? "Joining..." : "Join Event"}
              </button>
              <button
                type="button"
                onClick={handleUseLocation}
                disabled={isOptimizing}
                style={{
                  borderRadius: 10,
                  padding: "12px 14px",
                  background: "#e0f2fe",
                  border: "1px solid #bae6fd",
                  color: "#075985",
                  fontWeight: 900,
                  cursor: "pointer",
                  opacity: isOptimizing ? 0.7 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {busy === "location" ? (
                  <span className="anim-pulse">Optimizing...</span>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    Optimize From My Location
                  </>
                )}
              </button>
            </div>
          </div>

          <div style={{ ...card, padding: 20 }}>
            <h2 style={{ fontSize: 20, color: "#0f172a", letterSpacing: 0, marginBottom: 12 }}>
              Route Summary
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 8 }}>
              <SummaryTile label="Distance" value={route ? formatMeters(route.estimatedDistanceMeters) : "-"} />
              <SummaryTile label="Est. Time" value={route ? formatTime(adjustedTotalTimeMinutes) : "-"} />
            </div>
            <SummaryRow label="Stops Remaining" value={String(route?.orderedStops.length ?? 0)} />
            <SummaryRow label="Coverage" value={`${event.zone?.coverageScore ?? 0}%`} />
          </div>

          <div style={{ ...card, padding: 20 }}>
            <h2 style={{ fontSize: 20, color: "#0f172a", letterSpacing: 0, marginBottom: 12 }}>
              Zone Intelligence
            </h2>
            <div style={{ display: "grid", gap: 10, marginBottom: 12 }}>
              <ScoreBar label="Need Score" value={Number(event.zone?.needScore ?? 0)} />
              <ScoreBar label="Service Gap" value={Number(event.zone?.serviceGapScore ?? 0)} />
            </div>
            <SummaryRow label="Households" value={(event.zone?.estimatedHouseholds ?? 0).toLocaleString()} />
          </div>
        </aside>
      </section>
    </main>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ color: "rgba(226,232,240,0.62)", fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#ffffff", fontSize: 15, fontWeight: 900 }}>{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0", borderBottom: "1px solid rgba(15,23,42,0.07)" }}>
      <span style={{ color: "#64748b", fontSize: 13 }}>{label}</span>
      <strong style={{ color: "#0f172a", fontSize: 13 }}>{value}</strong>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ borderRadius: 10, background: "#f8fafc", border: "1px solid rgba(15,23,42,0.07)", padding: 12 }}>
      <p style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>{label}</p>
      <p style={{ color: "#0f172a", fontSize: 18, fontWeight: 900 }}>{value}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 5 }}>
        <span style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>{label}</span>
        <strong style={{ color: scoreColor(value), fontSize: 12 }}>{value}/100</strong>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(value, 100)}%`, background: scoreColor(value) }} />
      </div>
    </div>
  );
}
