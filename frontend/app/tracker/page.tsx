"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SectionCard from "@/components/common/SectionCard";
import StatCard from "@/components/common/StatCard";
import PageContainer from "@/components/layout/PageContainer";
import SessionSummary from "@/components/tracker/SessionSummary";
import SessionShareModal from "@/components/tracker/SessionShareModal";
import TrackerControls from "@/components/tracker/TrackerControls";
import TrackerMap from "@/components/tracker/TrackerMap";
import { useAuth } from "@/context/AuthContext";
import { calculateRouteDistanceMeters, formatDistance } from "@/lib/distance";
import {
  createRoutePoint,
  getGeolocationErrorMessage,
  isRecoverableGeolocationError,
  requestCurrentPosition,
  shouldAppendRoutePoint,
  startLocationWatch,
  stopLocationWatch,
} from "@/lib/geolocation";
import {
  completeSession,
  createSession,
  createSessionStop,
  formatDuration,
} from "@/lib/session";
import { normalizeVolunteerSession } from "@/lib/tracker-route";
import type {
  RoutePoint,
  SessionApiResponse,
  StopType,
  VolunteerSession,
} from "@/types/tracker";

const API_BASE_URL =
  (
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:5001"
  ).replace(/\/$/, "");

const TRACKER_SESSION_DRAFT_STORAGE_KEY = "lemontree.tracker.active-session";

export default function TrackerPage() {
  const { token, isGuest } = useAuth();
  const watchIdRef = useRef<number | null>(null);
  const captureSnapshotRef = useRef<(() => Promise<string | null>) | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [activeSession, setActiveSession] = useState<VolunteerSession | null>(null);
  const [lastCompletedSession, setLastCompletedSession] = useState<VolunteerSession | null>(null);
  const [currentPoint, setCurrentPoint] = useState<RoutePoint | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready to start a volunteer route.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const isTracking = activeSession?.status === "tracking";
  const normalizedActiveSession = useMemo(
    () => (activeSession ? normalizeVolunteerSession(activeSession) : null),
    [activeSession],
  );
  const summarySession = useMemo(
    () => {
      const nextSession = activeSession ?? lastCompletedSession;
      return nextSession ? normalizeVolunteerSession(nextSession) : null;
    },
    [activeSession, lastCompletedSession],
  );
  const displayedRoutePoints = summarySession?.routePoints ?? [];
  const displayedStops = summarySession?.stops ?? [];
  const handleSnapshotReady = useCallback((capture: (() => Promise<string | null>) | null) => {
    captureSnapshotRef.current = capture;
  }, []);

  useEffect(() => {
    return () => {
      stopLocationWatch(watchIdRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const draft = window.localStorage.getItem(TRACKER_SESSION_DRAFT_STORAGE_KEY);
    if (!draft) {
      return;
    }

    try {
      const parsed = JSON.parse(draft) as VolunteerSession;
      if (parsed?.status === "tracking") {
        const normalized = normalizeVolunteerSession(parsed);
        setActiveSession(normalized);
        setCurrentPoint(normalized.routePoints[normalized.routePoints.length - 1] ?? null);
        setStatusMessage("Resumed active route session.");
      }
    } catch {
      window.localStorage.removeItem(TRACKER_SESSION_DRAFT_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (activeSession?.status === "tracking") {
      window.localStorage.setItem(
        TRACKER_SESSION_DRAFT_STORAGE_KEY,
        JSON.stringify(activeSession),
      );
      return;
    }

    window.localStorage.removeItem(TRACKER_SESSION_DRAFT_STORAGE_KEY);
  }, [activeSession]);

  useEffect(() => {
    if (typeof document === "undefined" || !isTracking) {
      return;
    }

    const ensureTrackingIsLive = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (watchIdRef.current === null) {
        try {
          watchIdRef.current = startLocationWatch(handlePosition, handlePositionError);
        } catch (error) {
          setErrorMessage(
            error instanceof Error ? error.message : "Could not resume geolocation tracking.",
          );
        }
      }

      void requestCurrentPosition({ enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 })
        .then((position) => {
          handlePosition(position);
        })
        .catch((error: GeolocationPositionError | Error) => {
          if (error && "code" in error && isRecoverableGeolocationError(error)) {
            setStatusMessage("Waiting for GPS signal to resume...");
            return;
          }

          setErrorMessage(
            error instanceof Error ? error.message : "Could not refresh your location.",
          );
        });
    };

    const handleVisibilityChange = () => {
      ensureTrackingIsLive();
    };

    window.addEventListener("focus", ensureTrackingIsLive);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    ensureTrackingIsLive();

    return () => {
      window.removeEventListener("focus", ensureTrackingIsLive);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isTracking]);

  const liveStats = useMemo(() => {
    if (!normalizedActiveSession) {
      return {
        points: 0,
        stops: 0,
        duration: "0s",
        distance: "0 m",
      };
    }

    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - new Date(normalizedActiveSession.startTime).getTime()) / 1000),
    );

    return {
      points: normalizedActiveSession.routePoints.length,
      stops: normalizedActiveSession.stops.length,
      duration: formatDuration(durationSeconds),
      distance: formatDistance(normalizedActiveSession.totalDistanceMeters),
    };
  }, [normalizedActiveSession]);

  function handlePosition(position: GeolocationPosition) {
    const nextPoint = createRoutePoint(position);
    setErrorMessage(null);
    setStatusMessage("Tracking live route.");
    setCurrentPoint(nextPoint);
    let acceptedPoint = false;
    let insertedFallbackPoint = false;

    setActiveSession((current) => {
      if (!current) {
        return current;
      }

      acceptedPoint = shouldAppendRoutePoint(current.routePoints, nextPoint);
      insertedFallbackPoint = !acceptedPoint && current.routePoints.length === 0;
      const nextRoutePoints =
        acceptedPoint || insertedFallbackPoint
          ? [...current.routePoints, nextPoint]
          : current.routePoints;

      return {
        ...current,
        routePoints: nextRoutePoints,
        totalDistanceMeters: calculateRouteDistanceMeters(nextRoutePoints),
      };
    });
  }

  function handlePositionError(error: GeolocationPositionError) {
    if (isRecoverableGeolocationError(error)) {
      setErrorMessage(getGeolocationErrorMessage(error));
      setStatusMessage("Waiting for GPS signal...");
      return;
    }

    stopLocationWatch(watchIdRef.current);
    watchIdRef.current = null;
    setActiveSession(null);
    setCurrentPoint(null);
    setErrorMessage(getGeolocationErrorMessage(error));
    setStatusMessage("Tracking did not start.");
  }

  async function handleStartSession() {
    if (isTracking) {
      return;
    }

    setErrorMessage(null);
    setSaveState("idle");
    setSaveError(null);
    setIsShareOpen(false);
    setStatusMessage("Requesting location permission...");
    setLastCompletedSession(null);
    setCurrentPoint(null);
    setActiveSession(createSession());

    try {
      watchIdRef.current = startLocationWatch(handlePosition, handlePositionError);
      setStatusMessage("Locating your position...");

      requestCurrentPosition()
        .then((position) => {
          handlePosition(position);
        })
        .catch((error: GeolocationPositionError | Error) => {
          if (error && "code" in error) {
            setStatusMessage(
              error.code === error.TIMEOUT
                ? "Waiting for a stronger GPS fix..."
                : "Location permission granted. Waiting for live update..."
            );
            return;
          }

          setStatusMessage("Location permission granted. Waiting for live update...");
        });
    } catch (error) {
      setActiveSession(null);
      setCurrentPoint(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Could not start geolocation tracking.",
      );
      setStatusMessage("Tracking did not start.");
    }
  }

  async function handleStopSession() {
    if (!activeSession || !isTracking) {
      setErrorMessage("No active session to stop.");
      return;
    }

    stopLocationWatch(watchIdRef.current);
    watchIdRef.current = null;

    const completed = completeSession(activeSession);
    const routeImageUrl = (await captureSnapshotRef.current?.()) ?? undefined;
    const completedSession = routeImageUrl ? { ...completed, routeImageUrl } : completed;
    setActiveSession(null);
    setCurrentPoint(null);
    setLastCompletedSession(completedSession);
    setIsShareOpen(true);
    setStatusMessage("Session stopped. Summary ready.");
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TRACKER_SESSION_DRAFT_STORAGE_KEY);
    }

    try {
      setSaveError(null);
      if (isGuest || !token) {
        setSaveState("idle");
        return;
      }

      setSaveState("saving");
      const response = await fetch(`${API_BASE_URL}/api/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(completedSession),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(
          errorPayload?.message ||
            errorPayload?.error ||
            `Request failed with status ${response.status}`
        );
      }

      const payload = (await response.json()) as SessionApiResponse;
      setLastCompletedSession(payload.data);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(
        error instanceof Error
          ? error.message
          : "The session was completed locally, but saving to the backend failed."
      );
    }
  }

  function handleAddStop(type: StopType, label?: string) {
    if (!activeSession || !isTracking || !currentPoint) {
      setErrorMessage("Start a session before adding a stop.");
      return;
    }

    const stop = createSessionStop(currentPoint, type, label);

    setActiveSession((current) =>
      current
        ? {
            ...current,
            stops: [...current.stops, stop],
          }
        : current,
    );
    setErrorMessage(null);
    setStatusMessage(`Added ${type.replaceAll("_", " ")} stop.`);
  }

  return (
    <PageContainer
      style={{
        padding: isMobile ? "12px 12px 28px" : "22px 24px 40px",
      }}
    >
      <div style={{ display: "grid", gap: 16, maxWidth: 980, margin: "0 auto" }}>
        <div
          style={{
            borderRadius: 28,
            background: "linear-gradient(180deg, #201300 0%, #2b1800 100%)",
            padding: isMobile ? 16 : 20,
            color: "#fff8e8",
            boxShadow: "0 18px 44px rgba(46,27,0,0.18)",
            border: "1px solid rgba(245,200,66,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(245,200,66,0.72)",
                }}
              >
                Route Tracker
              </p>
              <h2
                style={{
                  margin: "6px 0 0",
                  fontFamily: "'Fraunces', Georgia, serif",
                  fontSize: isMobile ? 28 : 34,
                  lineHeight: 1.05,
                  letterSpacing: "-0.04em",
                  color: "#f7e3ad",
                }}
              >
                Keep the map front and center while you walk.
              </h2>
            </div>
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                background: isTracking ? "rgba(245,200,66,0.16)" : "rgba(255,255,255,0.08)",
                color: isTracking ? "#f5c842" : "rgba(245,228,166,0.86)",
                fontSize: 13,
                fontWeight: 700,
                minWidth: 110,
                textAlign: "center",
              }}
            >
              {isTracking ? "Live Recording" : "Ready"}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            <StatCard label="Status" value={isTracking ? "Tracking" : "Idle"} icon="P" iconBg="#fdba74" />
            <StatCard label="Route Points" value={liveStats.points} icon="R" iconBg="#93c5fd" />
            <StatCard label="Distance" value={liveStats.distance} icon="D" iconBg="#86efac" />
            <StatCard label="Stops" value={liveStats.stops} icon="S" iconBg="#fca5a5" />
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <TrackerMap
            routePoints={displayedRoutePoints}
            currentPoint={currentPoint}
            stops={displayedStops}
            height={isMobile ? "68vh" : "72vh"}
            onSnapshotReady={handleSnapshotReady}
            overlay={
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div
                    style={{
                      maxWidth: "70%",
                      padding: "12px 14px",
                      borderRadius: 18,
                      background: "rgba(26,18,0,0.72)",
                      color: "#fff8e8",
                      backdropFilter: "blur(14px)",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(245,200,66,0.76)" }}>
                      Live Map
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: isMobile ? 18 : 20, fontWeight: 700, lineHeight: 1.2 }}>
                      {statusMessage}
                    </p>
                  </div>
                  <div
                    style={{
                      alignSelf: "flex-start",
                      padding: "10px 12px",
                      borderRadius: 18,
                      background: "rgba(255,248,232,0.14)",
                      color: "#fff1c7",
                      backdropFilter: "blur(12px)",
                      textAlign: "right",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(245,200,66,0.72)" }}>
                      Distance
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 700 }}>{liveStats.distance}</p>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end" }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <OverlayPill label="Points" value={String(liveStats.points)} />
                    <OverlayPill label="Stops" value={String(liveStats.stops)} />
                    <OverlayPill label="Time" value={liveStats.duration} />
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: 999,
                      background: "rgba(26,18,0,0.74)",
                      color: "#fff8e8",
                      fontSize: 12.5,
                      fontWeight: 700,
                      backdropFilter: "blur(12px)",
                    }}
                  >
                    {isTracking ? "Route is updating" : "Tap Start to begin"}
                  </div>
                </div>
              </>
            }
          />

          <SectionCard
            title="Controls"
            subtitle="Large mobile controls live under the map so the route stays visible first."
            style={{ borderRadius: 24, alignSelf: "start" }}
          >
            <TrackerControls
              isTracking={Boolean(isTracking)}
              onStart={handleStartSession}
              onStop={handleStopSession}
              onAddStop={handleAddStop}
              isBusy={saveState === "saving"}
            />
            {errorMessage ? (
              <p style={{ marginTop: 14, fontSize: 12.5, color: "#b91c1c", lineHeight: 1.5 }}>
                {errorMessage}
              </p>
            ) : null}
          </SectionCard>
        </div>

        <SessionSummary
          session={summarySession}
          saveState={saveState}
          saveError={saveError}
        />
        <SessionShareModal
          key={`${lastCompletedSession?.id ?? "none"}-${isShareOpen ? "open" : "closed"}`}
          isOpen={isShareOpen}
          session={lastCompletedSession}
          onClose={() => setIsShareOpen(false)}
          isGuest={isGuest}
          saveState={saveState}
          saveError={saveError}
        />

        <SectionCard title="Tracking Notes" subtitle="MVP guardrails and behavior">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
            <InfoTile
              title="Location filtering"
              body="Duplicate points, poor accuracy fixes, and negligible movement are ignored before updating the route."
            />
            <InfoTile
              title="Stop markers"
              body="Printer, cafe, bulletin board, community center, and custom stops are pinned using the latest valid position."
            />
            <InfoTile
              title="Persistence"
              body="Completed sessions are stored locally first, then posted to the backend session API for retrieval later."
            />
          </div>
        </SectionCard>
      </div>
    </PageContainer>
  );
}

function OverlayPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 18,
        background: "rgba(255,248,232,0.16)",
        color: "#fff8e8",
        backdropFilter: "blur(12px)",
        minWidth: 82,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(245,200,66,0.72)",
        }}
      >
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 16, fontWeight: 700 }}>{value}</p>
    </div>
  );
}

function InfoTile({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        borderRadius: 14,
        background: "#fffdf5",
        border: "1px solid rgba(190,155,70,0.14)",
      }}
    >
      <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1600", marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 12.5, color: "#8a7a50", lineHeight: 1.55 }}>{body}</p>
    </div>
  );
}
