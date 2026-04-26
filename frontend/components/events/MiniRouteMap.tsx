"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";

export type RoutePoint = {
  id: string | number;
  lat: number;
  lng: number;
  sequence?: number;
  completed?: boolean;
};

interface MiniRouteMapProps {
  stops: RoutePoint[];
  userLocation?: { lat: number; lng: number } | null;
  height?: number | string;
}

const FALLBACK_CENTER = { lat: 40.7484, lng: -73.9857 };

function PolylineOverlay({ path }: { path: google.maps.LatLngLiteral[] }) {
  const map = useMap();
  const maps = useMapsLibrary("maps");
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  useEffect(() => {
    if (!map || !maps) return;

    if (!polylineRef.current) {
      polylineRef.current = new maps.Polyline({
        strokeColor: "#0f766e",
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map,
      });
    }

    polylineRef.current.setPath(path);

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, maps, path]);

  return null;
}

export default function MiniRouteMap({ stops, userLocation, height = 300 }: MiniRouteMapProps) {
  const map = useMap();
  const mapsLib = useMapsLibrary("maps");

  const path = useMemo(() => {
    const points: google.maps.LatLngLiteral[] = [];
    if (userLocation) {
      points.push(userLocation);
    }
    stops.forEach((stop) => points.push({ lat: stop.lat, lng: stop.lng }));
    return points;
  }, [stops, userLocation]);

  useEffect(() => {
    if (!map || !mapsLib || path.length === 0) return;

    const bounds = new window.google.maps.LatLngBounds();
    path.forEach((p) => bounds.extend(p));
    
    // Check if bounds have width/height (more than 1 point, or same point)
    if (path.length > 1) {
      map.fitBounds(bounds, { top: 30, right: 30, bottom: 30, left: 30 });
    } else {
      map.panTo(path[0]);
      map.setZoom(14);
    }
  }, [map, mapsLib, path]);

  return (
    <div
      style={{
        height,
        width: "100%",
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(15,23,42,0.08)",
        boxShadow: "0 4px 14px rgba(0,0,0,0.03)",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", inset: 0 }}>
        <Map
          defaultCenter={FALLBACK_CENTER}
          defaultZoom={11}
          mapId="mini-route-map"
          disableDefaultUI={true}
          gestureHandling="cooperative"
        >
          <PolylineOverlay path={path} />

          {userLocation && (
            <AdvancedMarker position={userLocation} zIndex={50}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "#3b82f6",
                  border: "3px solid white",
                  boxShadow: "0 0 0 6px rgba(59,130,246,0.2)",
                }}
              />
            </AdvancedMarker>
          )}

          {stops.map((stop, index) => (
            <AdvancedMarker key={stop.id} position={{ lat: stop.lat, lng: stop.lng }} zIndex={stop.completed ? 10 : 20}>
              <div
                style={{
                  width: stop.completed ? 20 : 26,
                  height: stop.completed ? 20 : 26,
                  borderRadius: "50%",
                  background: stop.completed ? "#dcfce7" : "#0f766e",
                  border: `2px solid ${stop.completed ? "#166534" : "white"}`,
                  color: stop.completed ? "#166534" : "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: stop.completed ? 10 : 12,
                  fontWeight: 800,
                  boxShadow: stop.completed ? "none" : "0 4px 10px rgba(15,118,110,0.3)",
                }}
              >
                {stop.completed ? "✓" : stop.sequence ?? index + 1}
              </div>
            </AdvancedMarker>
          ))}
        </Map>
      </div>
    </div>
  );
}
