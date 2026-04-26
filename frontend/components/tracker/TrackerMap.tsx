"use client";

import { useEffect, useMemo, useRef, useState, Fragment } from "react";
import type { ReactNode } from "react";
import {
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary
} from "@vis.gl/react-google-maps";
import type { RoutePoint, SessionStop } from "@/types/tracker";
import type { SavedRouteItem } from "@/types/route-items";
import { haversineDistanceMeters } from "@/lib/distance";
import {
  getRouteEndPoint,
  getRouteStartPoint,
  normalizeRoutePoints,
  normalizeSessionStops,
} from "@/lib/tracker-route";

interface TrackerMapProps {
  routePoints: RoutePoint[];
  currentPoint: RoutePoint | null;
  stops: SessionStop[];
  plannedItems?: SavedRouteItem[];
  onSelectPlannedItem?: (item: SavedRouteItem) => void;
  onMapClick?: () => void;
  height?: number | string;
  overlay?: ReactNode;
  onSnapshotReady?: (capture: (() => Promise<string | null>) | null) => void;
}

const FALLBACK_CENTER = { lat: 40.7484, lng: -73.9857 };
const MAX_CONNECTED_GAP_SECONDS = 90;
const MIN_SEGMENT_BREAK_DISTANCE_METERS = 60;

// Polyline component
function RoutePolylines({ segments }: { segments: Array<Array<[number, number]>> }) {
  const map = useMap();
  const maps = useMapsLibrary("maps");
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map || !maps) return;

    // Clear existing
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];

    // Draw new
    segments.forEach(segment => {
      if (segment.length < 2) return;
      const path = segment.map(coord => ({ lat: coord[1], lng: coord[0] }));
      const polyline = new maps.Polyline({
        path,
        strokeColor: "#f4d03f",
        strokeWeight: 6,
        strokeOpacity: 0.92,
        map
      });
      polylinesRef.current.push(polyline);
    });

    return () => {
      polylinesRef.current.forEach(p => p.setMap(null));
    };
  }, [map, maps, segments]);

  return null;
}

export default function TrackerMap({
  routePoints,
  currentPoint,
  stops,
  plannedItems = [],
  onSelectPlannedItem,
  onMapClick,
  height = 520,
  overlay = null,
  onSnapshotReady,
}: TrackerMapProps) {
  const normalizedRoutePoints = useMemo(() => normalizeRoutePoints(routePoints), [routePoints]);
  const normalizedStops = useMemo(() => normalizeSessionStops(stops), [stops]);
  const routeStartPoint = useMemo(() => getRouteStartPoint(normalizedRoutePoints), [normalizedRoutePoints]);
  const routeEndPoint = useMemo(() => getRouteEndPoint(normalizedRoutePoints), [normalizedRoutePoints]);
  
  const segments = useMemo(() => buildRouteSegments(normalizedRoutePoints), [normalizedRoutePoints]);

  const map = useMap();
  const mapsLib = useMapsLibrary("maps");

  useEffect(() => {
    if (onSnapshotReady) {
      onSnapshotReady(async () => null); // Fallback for snapshot
    }
  }, [onSnapshotReady]);

  useEffect(() => {
    if (!map || !mapsLib) return;
    
    // Fit bounds
    const coordinates: [number, number][] = [
      ...normalizedRoutePoints.map((p) => [p.lng, p.lat] as [number, number]),
      ...normalizedStops.map((s) => [s.lng, s.lat] as [number, number]),
      ...plannedItems.map((i) => [i.lng, i.lat] as [number, number]),
    ];

    if (coordinates.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      coordinates.forEach(coord => {
        bounds.extend({ lat: coord[1], lng: coord[0] });
      });
      map.fitBounds(bounds, 72);
    } else if (currentPoint) {
      map.panTo({ lat: currentPoint.lat, lng: currentPoint.lng });
      map.setZoom(15);
    }
  }, [map, mapsLib, normalizedRoutePoints, normalizedStops, plannedItems, currentPoint]);

  useEffect(() => {
    if (map && currentPoint && normalizedRoutePoints.length > 0) {
       map.panTo({ lat: currentPoint.lat, lng: currentPoint.lng });
    }
  }, [map, currentPoint, normalizedRoutePoints.length]);

  return (
    <div
      style={{
        position: "relative",
        height,
        borderRadius: 24,
        overflow: "hidden",
        background: "linear-gradient(160deg, #efe7cd 0%, #f8f3e3 100%)",
        border: "1px solid rgba(190,155,70,0.18)",
        boxShadow: "0 18px 38px rgba(190,155,70,0.14)",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <Map
          defaultCenter={FALLBACK_CENTER}
          defaultZoom={11}
          mapId="tracker-map"
          disableDefaultUI={true}
          gestureHandling="greedy"
          onClick={onMapClick}
        >
          <RoutePolylines segments={segments} />

          {currentPoint && (
            <AdvancedMarker position={{ lat: currentPoint.lat, lng: currentPoint.lng }} zIndex={100}>
              <div style={{
                width: 18, height: 18, borderRadius: 999, background: "#4d7c0f", border: "3px solid white", boxShadow: "0 0 0 8px rgba(91,145,32,0.18)"
              }} />
            </AdvancedMarker>
          )}

          {normalizedStops.map((stop, i) => (
            <AdvancedMarker key={i} position={{ lat: stop.lat, lng: stop.lng }}>
              <div style={{
                width: 14, height: 14, borderRadius: 999, background: "#5d8c2a", border: "2px solid #fefce8", boxShadow: "0 4px 12px rgba(93,140,42,0.35)"
              }} />
            </AdvancedMarker>
          ))}

          {routeStartPoint && (
            <AdvancedMarker position={{ lat: routeStartPoint.lat, lng: routeStartPoint.lng }}>
              <TerminalMarker fillColor="#f8df5e" textColor="#31401f" label="S" />
            </AdvancedMarker>
          )}

          {(currentPoint || routeEndPoint) && (!currentPoint || normalizedRoutePoints.length > 1) && (
            <AdvancedMarker 
              position={{ 
                lat: (currentPoint ?? routeEndPoint!).lat, 
                lng: (currentPoint ?? routeEndPoint!).lng 
              }}
            >
              <TerminalMarker fillColor="#6f8f2f" textColor="#fffdf2" label="E" />
            </AdvancedMarker>
          )}

          {plannedItems.map(item => (
            <AdvancedMarker 
              key={item.id} 
              position={{ lat: item.lat, lng: item.lng }}
              onClick={() => onSelectPlannedItem?.(item)}
            >
              <PlannedPin itemType={item.itemType} />
            </AdvancedMarker>
          ))}
        </Map>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(26,18,0,0.42) 0%, rgba(26,18,0,0.14) 18%, rgba(26,18,0,0) 36%, rgba(26,18,0,0) 64%, rgba(26,18,0,0.18) 84%, rgba(26,18,0,0.48) 100%)",
          pointerEvents: "none",
        }}
      />
      {overlay && (
        <div style={{ position: "absolute", inset: 0, padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between", pointerEvents: "none" }}>
          {overlay}
        </div>
      )}
    </div>
  );
}

function TerminalMarker({ fillColor, textColor, label }: { fillColor: string, textColor: string, label: string }) {
  return (
    <div style={{
      width: 28, height: 28, borderRadius: 999, background: fillColor, border: "3px solid #fffdf2",
      color: textColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, boxShadow: "0 6px 16px rgba(49,64,31,0.24)"
    }}>
      {label}
    </div>
  );
}

function PlannedPin({ itemType }: { itemType: SavedRouteItem["itemType"] }) {
  const isPrinter = itemType === "printer";
  return (
    <div style={{
      width: 36, height: 50, filter: isPrinter ? "drop-shadow(0 14px 22px rgba(51,65,85,0.22))" : "drop-shadow(0 14px 22px rgba(37,99,235,0.24))",
      cursor: "pointer", display: "flex", alignItems: "flex-end", justifyContent: "center"
    }}>
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="50" viewBox="0 0 36 50" fill="none">
        {isPrinter ? (
          <>
            <path d="M18 48C18 48 31 31.7 31 19C31 10.7 25.3 4 18 4C10.7 4 5 10.7 5 19C5 31.7 18 48 18 48Z" fill="#F8FAFC" stroke="#475569" strokeWidth="3"/>
            <circle cx="18" cy="19" r="8.5" fill="#F8FAFC" stroke="#475569" strokeWidth="2"/>
            <path d="M14 17V13.5H22V17" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 22H12.8C11.8 22 11 21.2 11 20.2V17.8C11 16.8 11.8 16 12.8 16H23.2C24.2 16 25 16.8 25 17.8V20.2C25 21.2 24.2 22 23.2 22H22" stroke="#334155" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <rect x="14" y="20.5" width="8" height="5.5" rx="0.8" stroke="#334155" strokeWidth="1.8"/>
          </>
        ) : (
          <>
            <path d="M18 48C18 48 31 31.7 31 19C31 10.7 25.3 4 18 4C10.7 4 5 10.7 5 19C5 31.7 18 48 18 48Z" fill="#FFFFFF" stroke="#2563EB" strokeWidth="3"/>
            <circle cx="18" cy="19" r="9" fill="#DBEAFE" stroke="#60A5FA" strokeWidth="2"/>
            <circle cx="18" cy="19" r="5.5" fill="#60A5FA"/>
          </>
        )}
      </svg>
    </div>
  );
}

function buildRouteSegments(routePoints: RoutePoint[]) {
  const segments: Array<Array<[number, number]>> = [];
  let currentSegment: Array<[number, number]> = [];
  let previousPoint: RoutePoint | null = null;

  for (const point of routePoints) {
    const coordinate: [number, number] = [point.lng, point.lat];

    if (!previousPoint) {
      currentSegment.push(coordinate);
      previousPoint = point;
      continue;
    }

    const elapsedSeconds = Math.max(
      0,
      (Date.parse(point.timestamp) - Date.parse(previousPoint.timestamp)) / 1000,
    );
    const distanceMeters = haversineDistanceMeters(previousPoint, point);
    const shouldBreakSegment = elapsedSeconds > MAX_CONNECTED_GAP_SECONDS && distanceMeters > MIN_SEGMENT_BREAK_DISTANCE_METERS;

    if (shouldBreakSegment) {
      if (currentSegment.length > 1) segments.push(currentSegment);
      currentSegment = [coordinate];
      previousPoint = point;
      continue;
    }

    currentSegment.push(coordinate);
    previousPoint = point;
  }

  if (currentSegment.length > 1) segments.push(currentSegment);

  return segments;
}
