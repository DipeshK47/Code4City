"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SessionShareModal from "@/components/tracker/SessionShareModal";
import TrackerControls from "@/components/tracker/TrackerControls";
import TrackerMap from "@/components/tracker/TrackerMap";
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
import { clearRouteItems } from "@/lib/route-items";
import {
  completeSession,
  createSession,
  createSessionStop,
  formatDuration,
} from "@/lib/session";
import { normalizeVolunteerSession } from "@/lib/tracker-route";
import type { SavedRouteItem } from "@/types/route-items";
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

interface TrackerSessionExperienceProps {
  token: string | null;
  isGuest: boolean;
  plannedItems: SavedRouteItem[];
  height?: number | string;
  onExit: () => void;
  onPlannedItemsCleared: () => void;
}

export default function TrackerSessionExperience({
  token,
  isGuest,
  plannedItems,
  height = "100%",
  onExit,
  onPlannedItemsCleared,
}: TrackerSessionExperienceProps) {
  const watchIdRef = useRef<number | null>(null);
  const captureSnapshotRef = useRef<(() => Promise<string | null>) | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileControlsOpen, setIsMobileControlsOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<VolunteerSession | null>(null);
  const [lastCompletedSession, setLastCompletedSession] = useState<VolunteerSession | null>(null);
  const [currentPoint, setCurrentPoint] = useState<RoutePoint | null>(null);
  const [selectedPlannedItemId, setSelectedPlannedItemId] = useState<string | null>(null);
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
  const displayedSession = useMemo(
    () => {
      const nextSession = activeSession ?? lastCompletedSession;
      return nextSession ? normalizeVolunteerSession(nextSession) : null;
    },
    [activeSession, lastCompletedSession],
  );
  const orderedPlannedItems = useMemo(
    () =>
      [...plannedItems].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ),
    [plannedItems],
  );
  const selectedPlannedItem =
    orderedPlannedItems.find((item) => item.id === selectedPlannedItemId) ?? null;
  const handleSelectPlannedItem = useCallback((item: SavedRouteItem) => {
    setSelectedPlannedItemId(item.id);
  }, []);

  const handleOpenGoogleMapsRoute = useCallback(() => {
    if (orderedPlannedItems.length === 0 || typeof window === "undefined") {
      return;
    }

    const encodePoint = (lat: number, lng: number) => `${lat},${lng}`;
    const lastStop = orderedPlannedItems[orderedPlannedItems.length - 1];
    const waypointStops = orderedPlannedItems.slice(0, -1);
    const params = new URLSearchParams({
      api: "1",
      destination: encodePoint(lastStop.lat, lastStop.lng),
      travelmode: "walking",
    });

    if (currentPoint) {
      params.set("origin", encodePoint(currentPoint.lat, currentPoint.lng));
    }

    if (waypointStops.length > 0) {
      params.set(
        "waypoints",
        waypointStops.map((item) => encodePoint(item.lat, item.lng)).join("|"),
      );
    }

    window.open(
      `https://www.google.com/maps/dir/?${params.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );
  }, [currentPoint, orderedPlannedItems]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateViewport = (event?: MediaQueryListEvent) => {
      const matches = event?.matches ?? mediaQuery.matches;
      setIsMobile(matches);

      if (!matches) {
        setIsMobileControlsOpen(false);
      }
    };

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
    return () => {
      stopLocationWatch(watchIdRef.current);
    };
  }, []);

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
    if (!displayedSession) {
      return {
        points: 0,
        stops: 0,
        duration: "0s",
        distance: "0 m",
      };
    }

      const durationSeconds =
      normalizedActiveSession
        ? Math.max(
            0,
            Math.round((Date.now() - new Date(normalizedActiveSession.startTime).getTime()) / 1000),
          )
        : displayedSession.durationSeconds;

    const statsSession = normalizedActiveSession ?? displayedSession;

    return {
      points: statsSession.routePoints.length,
      stops: statsSession.stops.length,
      duration: formatDuration(durationSeconds),
      distance: formatDistance(statsSession.totalDistanceMeters),
    };
  }, [displayedSession, normalizedActiveSession]);

  const handleSnapshotReady = useCallback((capture: (() => Promise<string | null>) | null) => {
    captureSnapshotRef.current = capture;
  }, []);

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

      requestCurrentPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 12000 })
        .then((position) => {
          handlePosition(position);
        })
        .catch((error: GeolocationPositionError | Error) => {
          if (error && "code" in error) {
            setStatusMessage(
              error.code === error.TIMEOUT
                ? "Waiting for a stronger GPS fix..."
                : "Location permission granted. Waiting for live update...",
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
    setStatusMessage("Session stopped. Summary ready.");
    setIsShareOpen(true);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TRACKER_SESSION_DRAFT_STORAGE_KEY);
    }

    try {
      setSaveError(null);
      if (!isGuest && token) {
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
              `Request failed with status ${response.status}`,
          );
        }

        const payload = (await response.json()) as SessionApiResponse;
        setLastCompletedSession(payload.data);
        setSaveState("saved");
      } else {
        setSaveState("idle");
      }
    } catch (error) {
      setSaveState("error");
      setSaveError(
        error instanceof Error
          ? error.message
          : "The session was completed locally, but saving to the backend failed.",
      );
    }

    if (token) {
      try {
        await clearRouteItems(token);
        onPlannedItemsCleared();
      } catch (error) {
        setSaveError(
          error instanceof Error
            ? error.message
            : "Route items could not be cleared after the session.",
        );
      }
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

  const mobileFloatingBottom = "max(88px, calc(env(safe-area-inset-bottom) + 18px))";

  return (
    <div
      style={{
        position: "relative",
        height,
        minHeight: isMobile ? "100%" : 640,
        overflow: "hidden",
        overscrollBehavior: "none",
        background: "#dbe7dd",
      }}
    >
      <TrackerMap
        routePoints={displayedSession?.routePoints ?? []}
        currentPoint={currentPoint}
        stops={displayedSession?.stops ?? []}
        plannedItems={orderedPlannedItems}
        onSelectPlannedItem={handleSelectPlannedItem}
        height="100%"
        onSnapshotReady={handleSnapshotReady}
        overlay={
          isMobile ? null : (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div
                  style={{
                    maxWidth: "72%",
                    padding: "12px 14px",
                    borderRadius: 18,
                    background: "rgba(26,18,0,0.72)",
                    color: "#fff8e8",
                    backdropFilter: "blur(14px)",
                    pointerEvents: "auto",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "rgba(245,200,66,0.76)",
                    }}
                  >
                    Route Tracker
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 20,
                      fontWeight: 700,
                      lineHeight: 1.2,
                    }}
                  >
                    {statusMessage}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10, pointerEvents: "auto" }}>
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
                      Planned
                    </p>
                    <p style={{ margin: "3px 0 0", fontSize: 18, fontWeight: 700 }}>
                      {plannedItems.length}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onExit}
                    style={{
                      alignSelf: "flex-start",
                      borderRadius: 999,
                      padding: "10px 14px",
                      background: "rgba(26,18,0,0.72)",
                      color: "#fff8e8",
                      border: "1px solid rgba(245,200,66,0.16)",
                      backdropFilter: "blur(14px)",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    Back to Map
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end" }}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    pointerEvents: "auto",
                  }}
                >
                  <OverlayPill label="Points" value={String(liveStats.points)} />
                  <OverlayPill label="Stops" value={String(liveStats.stops)} />
                  <OverlayPill label="Time" value={liveStats.duration} />
                  <OverlayPill label="Distance" value={liveStats.distance} />
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
                    pointerEvents: "auto",
                  }}
                >
                  {isTracking ? "Route is updating" : "Planned markers only until you start"}
                </div>
              </div>
            </>
          )
        }
      />

      {isMobile ? (
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            right: 14,
            zIndex: 650,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              flex: 1,
              minWidth: 0,
              padding: "10px 12px",
              borderRadius: 18,
              background: "rgba(26,18,0,0.76)",
              color: "#fff8e8",
              backdropFilter: "blur(14px)",
              pointerEvents: "auto",
              boxShadow: "0 16px 32px rgba(17,14,6,0.18)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(245,200,66,0.76)",
                }}
              >
                Route Tracker
              </p>
              <span
                style={{
                  padding: "4px 8px",
                  borderRadius: 999,
                  background: "rgba(255,248,232,0.12)",
                  color: "#fff1c7",
                  fontSize: 10.5,
                  fontWeight: 700,
                }}
              >
                Planned {plannedItems.length}
              </span>
            </div>
            <p
              style={{
                margin: "5px 0 0",
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1.15,
              }}
            >
              {statusMessage}
            </p>
          </div>

          <button
            type="button"
            onClick={onExit}
            style={{
              pointerEvents: "auto",
              flexShrink: 0,
              minHeight: 48,
              borderRadius: 18,
              padding: "0 14px",
              background: "rgba(26,18,0,0.82)",
              color: "#fff8e8",
              border: "1px solid rgba(245,200,66,0.16)",
              backdropFilter: "blur(14px)",
              fontSize: 12,
              fontWeight: 800,
              boxShadow: "0 16px 32px rgba(17,14,6,0.18)",
            }}
          >
            Back
          </button>
        </div>
      ) : null}

      {selectedPlannedItem ? (
        <div
          style={{
            position: "absolute",
            left: 18,
            top: "50%",
            transform: "translateY(-50%)",
            width: 310,
            maxWidth: "calc(100vw - 36px)",
            zIndex: 700,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              borderRadius: 22,
              padding: "16px 16px 14px",
              background: "rgba(26,22,11,0.92)",
              border: "1px solid rgba(245,200,66,0.14)",
              color: "#fff7de",
              backdropFilter: "blur(18px)",
              boxShadow: "0 22px 40px rgba(17,14,6,0.24)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(245,200,66,0.56)", marginBottom: 6 }}>
                  Saved Route Stop
                </p>
                <h3 style={{ fontSize: 23, lineHeight: 1.08, letterSpacing: "-0.5px" }}>
                  {selectedPlannedItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlannedItemId(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff7de",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            {selectedPlannedItem.address ? (
              <p style={{ fontSize: 12.5, color: "rgba(255,247,222,0.72)", lineHeight: 1.5, marginBottom: 12 }}>
                {selectedPlannedItem.address}
              </p>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  background:
                    selectedPlannedItem.itemType === "printer"
                      ? "rgba(148,163,184,0.18)"
                      : "rgba(96,165,250,0.16)",
                  color:
                    selectedPlannedItem.itemType === "printer" ? "#e2e8f0" : "#bfdbfe",
                  fontSize: 11.5,
                  fontWeight: 700,
                }}
              >
                {selectedPlannedItem.itemType === "printer" ? "Printer" : "Hotspot"}
              </span>
              {selectedPlannedItem.category ? (
                <span
                  style={{
                    padding: "6px 10px",
                    borderRadius: 999,
                    background: "rgba(245,158,11,0.16)",
                    color: "#fcd34d",
                    fontSize: 11.5,
                    fontWeight: 700,
                  }}
                >
                  {selectedPlannedItem.category}
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams({
                  q: `${selectedPlannedItem.name} ${selectedPlannedItem.address ?? ""}`.trim(),
                });

                window.open(
                  `https://www.google.com/maps/search/?${params.toString()}`,
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
              style={{
                width: "100%",
                borderRadius: 15,
                padding: "12px 14px",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "#fff7de",
                fontSize: 12.5,
                fontWeight: 800,
                boxShadow: "0 10px 22px rgba(15,23,42,0.18)",
              }}
            >
              View on Maps
            </button>
          </div>
        </div>
      ) : null}

      <SessionShareModal
        key={`${lastCompletedSession?.id ?? "none"}-${isShareOpen ? "open" : "closed"}-tracker`}
        isOpen={isShareOpen}
        session={lastCompletedSession}
        onClose={() => setIsShareOpen(false)}
        isGuest={isGuest}
        contained
        saveState={saveState}
        saveError={saveError}
      />

      {isMobile ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: mobileFloatingBottom,
            transform: "translateX(-50%)",
            zIndex: 500,
            display: "grid",
            gap: 8,
            justifyItems: "center",
            pointerEvents: "none",
            width: "calc(100% - 24px)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 8,
              width: "min(100%, 292px)",
              pointerEvents: "auto",
            }}
          >
            <OverlayPill label="Points" value={String(liveStats.points)} compact />
            <OverlayPill label="Stops" value={String(liveStats.stops)} compact />
            <OverlayPill label="Time" value={liveStats.duration} compact />
            <OverlayPill label="Distance" value={liveStats.distance} compact />
          </div>

          {isMobileControlsOpen ? (
            <div
              style={{
                width: "min(360px, 100%)",
                maxHeight: "min(48dvh, 460px)",
                overflowY: "auto",
                pointerEvents: "auto",
                borderRadius: 24,
                padding: 14,
                background: "rgba(255,252,244,0.97)",
                border: "1px solid rgba(190,155,70,0.18)",
                backdropFilter: "blur(18px)",
                boxShadow: "0 18px 40px rgba(32,24,8,0.16)",
                display: "grid",
                gap: 12,
              }}
            >
              <TrackerControls
                isTracking={Boolean(isTracking)}
                onStart={handleStartSession}
                onStop={handleStopSession}
                onAddStop={handleAddStop}
                isBusy={saveState === "saving"}
                onOpenGoogleMapsRoute={handleOpenGoogleMapsRoute}
                canOpenGoogleMapsRoute={orderedPlannedItems.length > 0}
              />
              {errorMessage ? (
                <p style={{ fontSize: 12.5, color: "#b91c1c", lineHeight: 1.5 }}>
                  {errorMessage}
                </p>
              ) : null}
              {saveError ? (
                <p style={{ fontSize: 12.5, color: "#b91c1c", lineHeight: 1.5 }}>
                  {saveError}
                </p>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setIsMobileControlsOpen((current) => !current)}
            style={{
              pointerEvents: "auto",
              minWidth: 156,
              minHeight: 50,
              borderRadius: 999,
              padding: "11px 20px",
              background: "linear-gradient(135deg, rgba(26,18,0,0.92) 0%, rgba(58,39,0,0.96) 100%)",
              border: "1px solid rgba(245,200,66,0.24)",
              color: "#fff7de",
              boxShadow: "0 16px 34px rgba(26,16,0,0.22)",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            {isMobileControlsOpen ? "Close Route Tools" : "Open Route Tools"}
          </button>
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            right: 18,
            bottom: 18,
            width: 340,
            maxWidth: "calc(100vw - 36px)",
            zIndex: 500,
          }}
        >
          <div
            style={{
              borderRadius: 24,
              padding: 18,
              background: "rgba(255,252,244,0.96)",
              border: "1px solid rgba(190,155,70,0.18)",
              backdropFilter: "blur(18px)",
              boxShadow: "0 18px 40px rgba(32,24,8,0.12)",
              display: "grid",
              gap: 12,
            }}
          >
            <TrackerControls
              isTracking={Boolean(isTracking)}
              onStart={handleStartSession}
              onStop={handleStopSession}
              onAddStop={handleAddStop}
              isBusy={saveState === "saving"}
              onOpenGoogleMapsRoute={handleOpenGoogleMapsRoute}
              canOpenGoogleMapsRoute={orderedPlannedItems.length > 0}
            />
            {errorMessage ? (
              <p style={{ fontSize: 12.5, color: "#b91c1c", lineHeight: 1.5 }}>
                {errorMessage}
              </p>
            ) : null}
            {saveError ? (
              <p style={{ fontSize: 12.5, color: "#b91c1c", lineHeight: 1.5 }}>
                {saveError}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function OverlayPill({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        padding: compact ? "9px 10px" : "10px 12px",
        borderRadius: compact ? 16 : 18,
        background: compact ? "rgba(255,248,232,0.92)" : "rgba(255,248,232,0.16)",
        color: compact ? "#2f2410" : "#fff8e8",
        backdropFilter: compact ? "blur(16px)" : "blur(12px)",
        minWidth: compact ? 0 : 82,
        border: compact ? "1px solid rgba(245,200,66,0.22)" : "none",
        boxShadow: compact ? "0 12px 28px rgba(17,14,6,0.16)" : "none",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: compact ? 10 : 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: compact ? "#a36f00" : "rgba(245,200,66,0.72)",
        }}
      >
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: compact ? 14 : 16, fontWeight: 800 }}>{value}</p>
    </div>
  );
}
