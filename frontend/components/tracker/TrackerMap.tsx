"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import mapboxgl, { GeoJSONSource } from "mapbox-gl";
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

const FALLBACK_CENTER: [number, number] = [-73.9857, 40.7484];
const MAX_CONNECTED_GAP_SECONDS = 90;
const MIN_SEGMENT_BREAK_DISTANCE_METERS = 60;

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
  const tokenMissing = !process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const currentMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const startMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const endMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const stopMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const plannedMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const normalizedRoutePoints = useMemo(() => normalizeRoutePoints(routePoints), [routePoints]);
  const normalizedStops = useMemo(() => normalizeSessionStops(stops), [stops]);
  const routeStartPoint = useMemo(
    () => getRouteStartPoint(normalizedRoutePoints),
    [normalizedRoutePoints],
  );
  const routeEndPoint = useMemo(
    () => getRouteEndPoint(normalizedRoutePoints),
    [normalizedRoutePoints],
  );
  const latestRoutePointsRef = useRef<RoutePoint[]>(normalizedRoutePoints);
  const latestStopsRef = useRef<SessionStop[]>(normalizedStops);
  const latestCurrentPointRef = useRef<RoutePoint | null>(currentPoint);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useEffect(() => {
    latestRoutePointsRef.current = normalizedRoutePoints;
    latestStopsRef.current = normalizedStops;
    latestCurrentPointRef.current = currentPoint;
  }, [currentPoint, normalizedRoutePoints, normalizedStops]);

  useEffect(() => {
    if (!mapContainerRef.current) {
      return;
    }

    if (tokenMissing) {
      return;
    }

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: FALLBACK_CENTER,
      zoom: 11,
    });

    mapRef.current = map;

    map.on("load", () => {
      setIsMapLoaded(true);
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: {
            type: "MultiLineString",
            coordinates: [],
          },
          properties: {},
        },
      });

      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#f4d03f",
          "line-width": 6,
          "line-opacity": 0.92,
        },
      });

      onSnapshotReady?.(async () => {
        try {
          return await captureRouteSnapshot({
            width: map.getCanvas().width,
            height: map.getCanvas().height,
            routePoints: latestRoutePointsRef.current,
            stops: latestStopsRef.current,
            currentPoint: latestCurrentPointRef.current,
          });
        } catch {
          return null;
        }
      });
    });

    map.on("error", () => {
      setMapError("The map failed to load. Check your Mapbox token and network access.");
    });

    const handleBackgroundClick = (event: mapboxgl.MapMouseEvent) => {
      const target = event.originalEvent.target as HTMLElement | null;
      if (target?.closest(".lemontree-planned-marker")) {
        return;
      }

      onMapClick?.();
    };

    if (onMapClick) {
      map.on("click", handleBackgroundClick);
    }

    return () => {
      setIsMapLoaded(false);
      onSnapshotReady?.(null);
      if (onMapClick) {
        map.off("click", handleBackgroundClick);
      }
      stopMarkersRef.current.forEach((marker) => marker.remove());
      stopMarkersRef.current = [];
      plannedMarkersRef.current.forEach((marker) => marker.remove());
      plannedMarkersRef.current = [];
      currentMarkerRef.current?.remove();
      startMarkerRef.current?.remove();
      endMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [onMapClick, onSnapshotReady, tokenMissing]);

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const handleResize = () => mapRef.current?.resize();
    const timeoutId = window.setTimeout(handleResize, 120);
    window.addEventListener("resize", handleResize);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, [height]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isMapLoaded) {
      return;
    }

    const source = map.getSource("route") as GeoJSONSource | undefined;

    source?.setData({
      type: "Feature",
      geometry: {
        type: "MultiLineString",
        coordinates: buildRouteSegments(normalizedRoutePoints),
      },
      properties: {},
    });
  }, [isMapLoaded, normalizedRoutePoints]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isMapLoaded) {
      return;
    }

    if (!currentPoint) {
      currentMarkerRef.current?.remove();
      currentMarkerRef.current = null;
      return;
    }

    if (!currentMarkerRef.current) {
      const markerElement = document.createElement("div");
      markerElement.style.width = "18px";
      markerElement.style.height = "18px";
      markerElement.style.borderRadius = "999px";
      markerElement.style.background = "#4d7c0f";
      markerElement.style.border = "3px solid white";
      markerElement.style.boxShadow = "0 0 0 8px rgba(91,145,32,0.18)";

      currentMarkerRef.current = new mapboxgl.Marker(markerElement)
        .setLngLat([currentPoint.lng, currentPoint.lat])
        .addTo(map);
    } else {
      currentMarkerRef.current.setLngLat([currentPoint.lng, currentPoint.lat]);
    }

    map.easeTo({
      center: [currentPoint.lng, currentPoint.lat],
      zoom: Math.max(map.getZoom(), 15.5),
      duration: 500,
      essential: true,
    });
  }, [currentPoint, isMapLoaded]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isMapLoaded) {
      return;
    }

    stopMarkersRef.current.forEach((marker) => marker.remove());
    stopMarkersRef.current = normalizedStops.map((stop) => {
      const element = document.createElement("div");
      element.style.width = "14px";
      element.style.height = "14px";
      element.style.borderRadius = "999px";
      element.style.background = "#5d8c2a";
      element.style.border = "2px solid #fefce8";
      element.style.boxShadow = "0 4px 12px rgba(93,140,42,0.35)";

      const popupContent = document.createElement("div");
      popupContent.style.fontSize = "12px";
      popupContent.style.lineHeight = "1.4";

      const title = document.createElement("strong");
      title.textContent = stop.type.replaceAll("_", " ");
      popupContent.appendChild(title);

      if (stop.label) {
        const label = document.createElement("div");
        label.textContent = stop.label;
        popupContent.appendChild(label);
      }

      return new mapboxgl.Marker(element)
        .setLngLat([stop.lng, stop.lat])
        .setPopup(new mapboxgl.Popup({ offset: 18 }).setDOMContent(popupContent))
        .addTo(map);
    });
  }, [isMapLoaded, normalizedStops]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isMapLoaded) {
      return;
    }

    startMarkerRef.current?.remove();
    startMarkerRef.current = null;
    if (routeStartPoint) {
      startMarkerRef.current = new mapboxgl.Marker({
        element: createTerminalMarkerElement("#f8df5e", "#31401f", "S"),
        anchor: "center",
      })
        .setLngLat([routeStartPoint.lng, routeStartPoint.lat])
        .addTo(map);
    }

    endMarkerRef.current?.remove();
    endMarkerRef.current = null;
    const endPoint = currentPoint ?? routeEndPoint;
    if (endPoint && (!currentPoint || normalizedRoutePoints.length > 1)) {
      endMarkerRef.current = new mapboxgl.Marker({
        element: createTerminalMarkerElement("#6f8f2f", "#fffdf2", "E"),
        anchor: "center",
      })
        .setLngLat([endPoint.lng, endPoint.lat])
        .addTo(map);
    }
  }, [currentPoint, isMapLoaded, normalizedRoutePoints.length, routeEndPoint, routeStartPoint]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isMapLoaded || currentPoint) {
      return;
    }

    const bounds = buildBoundsFromPoints({
      routePoints: normalizedRoutePoints,
      stops: normalizedStops,
      plannedItems,
    });

    if (!bounds) {
      return;
    }

    map.fitBounds(bounds, {
      padding: 72,
      maxZoom: 15.5,
      duration: 700,
      essential: true,
    });
  }, [currentPoint, isMapLoaded, normalizedRoutePoints, normalizedStops, plannedItems]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isMapLoaded) {
      return;
    }

    plannedMarkersRef.current.forEach((marker) => marker.remove());
    plannedMarkersRef.current = plannedItems.map((item) => {
      const element = document.createElement("div");
      element.className = "lemontree-planned-marker";
      element.style.width = "36px";
      element.style.height = "50px";
      element.style.backgroundRepeat = "no-repeat";
      element.style.backgroundSize = "contain";
      element.style.backgroundPosition = "center bottom";
      element.style.filter =
        item.itemType === "printer"
          ? "drop-shadow(0 14px 22px rgba(51,65,85,0.22))"
          : "drop-shadow(0 14px 22px rgba(37,99,235,0.24))";
      element.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(
        getPlannedPinSvg(item.itemType),
      )}")`;

      element.style.cursor = "pointer";
      const handleSelect = (event: MouseEvent | TouchEvent) => {
        event.preventDefault();
        event.stopPropagation();
        onSelectPlannedItem?.(item);
      };

      element.addEventListener("mousedown", handleSelect);
      element.addEventListener("touchstart", handleSelect);
      element.addEventListener("click", handleSelect);

      return new mapboxgl.Marker({
        element,
        anchor: "bottom",
        offset: [0, -2],
      })
        .setLngLat([item.lng, item.lat])
        .addTo(map);
    });

    if (!currentPoint && plannedItems.length > 0 && normalizedRoutePoints.length === 0) {
      const bounds = new mapboxgl.LngLatBounds();
      plannedItems.forEach((item) => bounds.extend([item.lng, item.lat]));
      map.fitBounds(bounds, {
        padding: 80,
        maxZoom: 15,
        duration: 800,
      });
    }
  }, [currentPoint, isMapLoaded, normalizedRoutePoints.length, onSelectPlannedItem, plannedItems]);

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
      <div ref={mapContainerRef} style={{ position: "absolute", inset: 0 }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(26,18,0,0.42) 0%, rgba(26,18,0,0.14) 18%, rgba(26,18,0,0) 36%, rgba(26,18,0,0) 64%, rgba(26,18,0,0.18) 84%, rgba(26,18,0,0.48) 100%)",
          pointerEvents: "none",
        }}
      />
      {overlay ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            pointerEvents: "none",
          }}
        >
          {overlay}
        </div>
      ) : null}
      {tokenMissing || mapError ? (
        <div
          style={{
            position: "absolute",
            inset: 16,
            borderRadius: 16,
            background: "rgba(26,18,0,0.78)",
            color: "#f8f1d8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: 24,
            lineHeight: 1.5,
          }}
        >
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Map unavailable</p>
            <p style={{ fontSize: 13 }}>
              {tokenMissing
                ? "Mapbox token missing. Add NEXT_PUBLIC_MAPBOX_TOKEN to render the live map."
                : mapError}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getPlannedPinSvg(itemType: SavedRouteItem["itemType"]) {
  if (itemType === "printer") {
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="50" viewBox="0 0 36 50" fill="none">
        <path d="M18 48C18 48 31 31.7 31 19C31 10.7 25.3 4 18 4C10.7 4 5 10.7 5 19C5 31.7 18 48 18 48Z" fill="#F8FAFC" stroke="#475569" stroke-width="3"/>
        <circle cx="18" cy="19" r="8.5" fill="#F8FAFC" stroke="#475569" stroke-width="2"/>
        <path d="M14 17V13.5H22V17" stroke="#334155" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M14 22H12.8C11.8 22 11 21.2 11 20.2V17.8C11 16.8 11.8 16 12.8 16H23.2C24.2 16 25 16.8 25 17.8V20.2C25 21.2 24.2 22 23.2 22H22" stroke="#334155" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="14" y="20.5" width="8" height="5.5" rx="0.8" stroke="#334155" stroke-width="1.8"/>
      </svg>
    `;
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="50" viewBox="0 0 36 50" fill="none">
      <path d="M18 48C18 48 31 31.7 31 19C31 10.7 25.3 4 18 4C10.7 4 5 10.7 5 19C5 31.7 18 48 18 48Z" fill="#FFFFFF" stroke="#2563EB" stroke-width="3"/>
      <circle cx="18" cy="19" r="9" fill="#DBEAFE" stroke="#60A5FA" stroke-width="2"/>
      <circle cx="18" cy="19" r="5.5" fill="#60A5FA"/>
    </svg>
  `;
}

async function captureRouteSnapshot({
  width,
  height,
  routePoints,
  stops,
  currentPoint,
}: {
  width: number;
  height: number;
  routePoints: RoutePoint[];
  stops: SessionStop[];
  currentPoint: RoutePoint | null;
}) {
  if (
    typeof document === "undefined" ||
    !process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    !width ||
    !height
  ) {
    return null;
  }

  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-20000px";
  container.style.top = "0";
  container.style.width = `${width}px`;
  container.style.height = `${height}px`;
  container.style.pointerEvents = "none";
  container.style.opacity = "0";
  document.body.appendChild(container);

  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const snapshotMap = new mapboxgl.Map({
    container,
    style: "mapbox://styles/mapbox/outdoors-v12",
    center: FALLBACK_CENTER,
    zoom: 11,
    interactive: false,
    preserveDrawingBuffer: true,
    attributionControl: false,
    fadeDuration: 0,
  });

  const snapshotCanvas = document.createElement("canvas");
  snapshotCanvas.width = width;
  snapshotCanvas.height = height;
  const context = snapshotCanvas.getContext("2d");
  if (!context) {
    snapshotMap.remove();
    container.remove();
    return null;
  }

  try {
    await waitForMapLoad(snapshotMap);

    const pointsForBounds = [
      ...routePoints.map((point) => [point.lng, point.lat] as [number, number]),
      ...stops.map((stop) => [stop.lng, stop.lat] as [number, number]),
    ];

    if (pointsForBounds.length > 0) {
      const bounds = pointsForBounds.slice(1).reduce(
        (accumulator, coordinate) => accumulator.extend(coordinate),
        new mapboxgl.LngLatBounds(pointsForBounds[0], pointsForBounds[0]),
      );

      snapshotMap.fitBounds(bounds, {
        padding: 56,
        maxZoom: 15.5,
        duration: 0,
        essential: true,
      });
    } else if (currentPoint) {
      snapshotMap.jumpTo({
        center: [currentPoint.lng, currentPoint.lat],
        zoom: 15,
      });
    }

    await waitForMapIdle(snapshotMap);

    context.drawImage(snapshotMap.getCanvas(), 0, 0, snapshotCanvas.width, snapshotCanvas.height);
    drawRouteLine(context, snapshotMap, routePoints);
    drawStopMarkers(context, snapshotMap, stops);
    drawTerminalMarker(context, snapshotMap, routePoints[0], "#f8df5e", "#31401f", "S");
    drawTerminalMarker(
      context,
      snapshotMap,
      currentPoint ?? routePoints[routePoints.length - 1],
      "#6f8f2f",
      "#fffdf2",
      "E",
    );

    return snapshotCanvas.toDataURL("image/png");
  } finally {
    snapshotMap.remove();
    container.remove();
  }
}

function drawRouteLine(
  context: CanvasRenderingContext2D,
  map: mapboxgl.Map,
  routePoints: RoutePoint[]
) {
  const segments = buildRouteSegments(routePoints);
  if (segments.length === 0) {
    return;
  }

  context.save();
  context.strokeStyle = "#f4d03f";
  context.lineWidth = 7;
  context.lineJoin = "round";
  context.lineCap = "round";
  context.shadowColor = "rgba(49,64,31,0.26)";
  context.shadowBlur = 12;
  segments.forEach((segment) => {
    context.beginPath();
    segment.forEach((coordinate, index) => {
      const projected = map.project(coordinate);
      if (index === 0) {
        context.moveTo(projected.x, projected.y);
      } else {
        context.lineTo(projected.x, projected.y);
      }
    });
    context.stroke();
  });
  context.restore();
}

function drawStopMarkers(
  context: CanvasRenderingContext2D,
  map: mapboxgl.Map,
  stops: SessionStop[]
) {
  stops.forEach((stop) => {
    const projected = map.project([stop.lng, stop.lat]);

    context.save();
    context.beginPath();
    context.arc(projected.x, projected.y, 9, 0, Math.PI * 2);
    context.fillStyle = "#5d8c2a";
    context.fill();
    context.lineWidth = 3;
    context.strokeStyle = "#fff8d6";
    context.stroke();
    context.restore();
  });
}

function drawTerminalMarker(
  context: CanvasRenderingContext2D,
  map: mapboxgl.Map,
  point: RoutePoint | undefined,
  fillColor: string,
  textColor: string,
  label: string
) {
  if (!point) {
    return;
  }

  const projected = map.project([point.lng, point.lat]);

  context.save();
  context.beginPath();
  context.arc(projected.x, projected.y, 13, 0, Math.PI * 2);
  context.fillStyle = fillColor;
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = "#fffdf2";
  context.stroke();
  context.fillStyle = textColor;
  context.font = "700 11px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, projected.x, projected.y + 0.5);
  context.restore();
}

function waitForMapIdle(map: mapboxgl.Map) {
  return new Promise<void>((resolve) => {
    if (map.loaded()) {
      requestAnimationFrame(() => resolve());
      return;
    }

    map.once("idle", () => resolve());
  });
}

function waitForMapLoad(map: mapboxgl.Map) {
  return new Promise<void>((resolve) => {
    if (map.loaded()) {
      resolve();
      return;
    }

    map.once("load", () => resolve());
  });
}

function createTerminalMarkerElement(fillColor: string, textColor: string, label: string) {
  const element = document.createElement("div");
  element.style.width = "28px";
  element.style.height = "28px";
  element.style.borderRadius = "999px";
  element.style.background = fillColor;
  element.style.border = "3px solid #fffdf2";
  element.style.color = textColor;
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.fontSize = "11px";
  element.style.fontWeight = "800";
  element.style.boxShadow = "0 6px 16px rgba(49,64,31,0.24)";
  element.textContent = label;
  return element;
}

function buildBoundsFromPoints({
  routePoints,
  stops,
  plannedItems,
}: {
  routePoints: RoutePoint[];
  stops: SessionStop[];
  plannedItems: SavedRouteItem[];
}) {
  const coordinates: [number, number][] = [
    ...routePoints.map((point) => [point.lng, point.lat] as [number, number]),
    ...stops.map((stop) => [stop.lng, stop.lat] as [number, number]),
    ...plannedItems.map((item) => [item.lng, item.lat] as [number, number]),
  ];

  if (coordinates.length === 0) {
    return null;
  }

  return coordinates.slice(1).reduce(
    (bounds, coordinate) => bounds.extend(coordinate),
    new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]),
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
    const shouldBreakSegment =
      elapsedSeconds > MAX_CONNECTED_GAP_SECONDS &&
      distanceMeters > MIN_SEGMENT_BREAK_DISTANCE_METERS;

    if (shouldBreakSegment) {
      if (currentSegment.length > 1) {
        segments.push(currentSegment);
      }
      currentSegment = [coordinate];
      previousPoint = point;
      continue;
    }

    currentSegment.push(coordinate);
    previousPoint = point;
  }

  if (currentSegment.length > 1) {
    segments.push(currentSegment);
  }

  return segments;
}
