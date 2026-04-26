"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHAIN_PRICES, PRICE_LEVEL_LABEL } from "@/lib/printers";
import {
  GeoJSON,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import { divIcon, point } from "leaflet";
import type { LatLngExpression } from "leaflet";
import type {
  MapFocusRequest,
  MapLocation,
  MapNeedRegion,
  MapPrinter,
  MapViewportState,
} from "./OutreachMapDashboard";
import { latLngBounds } from "leaflet";
import type { MeetupSummary } from "@/lib/social-types";
import { SERVICE_TYPE_COLORS, type ServiceType } from "@/lib/service-resources";

const REGION_FALLBACK_COLOR = "#9CA3AF";

const mapCenter: LatLngExpression = [40.7395, -73.9363];
const INDIVIDUAL_MARKER_ZOOM = 15;
const popupPaddingTopLeft: [number, number] = [24, 96];
const popupPaddingBottomRight: [number, number] = [340, 32];
const nycBounds = latLngBounds(
  [40.4774, -74.2591],
  [40.9176, -73.7004],
);

function createMarkerIcon(covered: boolean, selected: boolean, recommended: boolean) {
  const size = 18;
  const fill = covered ? "#D44A12" : recommended ? "#8A8780" : "#D64B14";
  const ring = selected ? "#1f1a0b" : recommended ? "#eff6ff" : "#F8F6F0";
  const shadow = covered
    ? "rgba(22,163,74,0.22)"
    : recommended
      ? "rgba(96,165,250,0.30)"
      : "rgba(245,158,11,0.24)";

  return divIcon({
    className: "",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 999px;
        background: ${fill};
        border: 4px solid ${ring};
        box-shadow: 0 10px 18px ${shadow};
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createClusterIcon(count: number, kind: "recommended" | "uncovered") {
  const background =
    kind === "recommended" ? "rgba(96,165,250,0.94)" : "rgba(217,119,6,0.92)";
  const shadow =
    kind === "recommended"
      ? "rgba(96,165,250,0.24)"
      : "rgba(217,119,6,0.22)";
  const ring =
    kind === "recommended" ? "rgba(239,246,255,0.96)" : "rgba(255,246,214,0.95)";

  return divIcon({
    className: "",
    html: `
      <div style="
        min-width: 34px;
        height: 34px;
        padding: 0 10px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: ${background};
        border: 3px solid ${ring};
        box-shadow: 0 10px 20px ${shadow};
        color: #F8F6F0;
        font-size: 12px;
        font-weight: 800;
      ">${count}</div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

function createPrinterIcon() {
  const size = 24;

  return divIcon({
    className: "",
    html: `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 999px;
        background: #f8fafc;
        border: 2px solid #8A8780;
        box-shadow: 0 10px 20px rgba(51,65,85,0.18);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1A1917" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="6 9 6 2 18 2 18 9"></polyline>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
          <rect x="6" y="14" width="12" height="8"></rect>
        </svg>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createMeetupMarkerIcon(selected: boolean) {
  return divIcon({
    className: "",
    html: `<div class="meetup-marker-ring" style="${
      selected ? "transform: scale(1.08);" : ""
    }"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function ViewportReporter({
  onViewportChange,
  onMapClick,
}: {
  onViewportChange: (viewport: MapViewportState) => void;
  onMapClick: () => void;
}) {
  const map = useMap();

  const report = useCallback(() => {
    const bounds = map.getBounds();

    onViewportChange({
      zoom: map.getZoom(),
      bounds: {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
      },
      center: {
        lat: map.getCenter().lat,
        lng: map.getCenter().lng,
      },
    });
  }, [map, onViewportChange]);

  useMapEvents({
    click: () => {
      onMapClick();
    },
    moveend: () => {
      report();
    },
    zoomend: () => {
      report();
    },
  });

  useEffect(() => {
    report();
  }, [map, report]);

  return null;
}

function InitializeNycView() {
  const map = useMap();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;

    initializedRef.current = true;
    const baseZoom = map.getBoundsZoom(nycBounds, false, point(36, 36));
    const initialZoom = Math.min(baseZoom + 2, INDIVIDUAL_MARKER_ZOOM - 1);

    map.setView(nycBounds.getCenter(), initialZoom, {
      animate: true,
      duration: 0.8,
    });

    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [map]);

  return null;
}

function ApplyFocusRequest({
  focusRequest,
}: {
  focusRequest: MapFocusRequest | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!focusRequest) return;

    map.stop();
    map.setView([focusRequest.lat, focusRequest.lng], focusRequest.zoom ?? 15, {
      animate: true,
      duration: 0.8,
    });
  }, [focusRequest, map]);

  return null;
}

export default function OutreachMapCanvas({
  locations,
  printers,
  meetups,
  highlightedRegions,
  recommendedLocationIds,
  selectedLocation,
  selectedMeetup,
  focusRequest,
  onSelect,
  onSelectMeetup,
  onMapClick,
  onViewportChange,
  routeItemDedupeKeys,
  onTogglePrinterRoute,
}: {
  locations: MapLocation[];
  printers: MapPrinter[];
  meetups: MeetupSummary[];
  highlightedRegions: MapNeedRegion[];
  recommendedLocationIds: string[];
  selectedLocation: MapLocation | null;
  selectedMeetup: MeetupSummary | null;
  focusRequest: MapFocusRequest | null;
  onSelect: (id: string) => void;
  onSelectMeetup: (id: number) => void;
  onMapClick: () => void;
  onViewportChange: (viewport: MapViewportState) => void;
  routeItemDedupeKeys: Set<string>;
  onTogglePrinterRoute: (printer: MapPrinter) => void;
}) {
  return (
    <MapContainer
      center={mapCenter}
      zoom={10}
      zoomControl={false}
      markerZoomAnimation={false}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <ZoomControl position="topright" />

      <InitializeNycView />
      <ApplyFocusRequest focusRequest={focusRequest} />
      <ViewportReporter
        onViewportChange={onViewportChange}
        onMapClick={onMapClick}
      />

      {highlightedRegions.map((region) => {
        const gap = region.dominantGap;
        const color = gap
          ? SERVICE_TYPE_COLORS[gap.category as ServiceType] || REGION_FALLBACK_COLOR
          : REGION_FALLBACK_COLOR;
        const intensity = gap ? Math.min(0.42, 0.22 + gap.avgDistanceMiles * 0.06) : 0.14;
        return (
          <GeoJSON
            key={region.regionCode}
            data={region.geometry}
            style={{
              color,
              weight: 1.4,
              opacity: 0.85,
              fillColor: color,
              fillOpacity: intensity,
            }}
            eventHandlers={{
              click: () => onMapClick(),
            }}
          >
            <Tooltip sticky direction="top" opacity={0.96}>
              <div style={{ minWidth: 180, fontFamily: "DM Sans, system-ui, sans-serif" }}>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>
                  {region.regionName}
                </div>
                {region.boroughName ? (
                  <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 6 }}>
                    {region.boroughName}
                  </div>
                ) : null}
                {gap ? (
                  <>
                    <div
                      style={{
                        fontSize: 10.5,
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        fontWeight: 700,
                        color,
                      }}
                    >
                      Biggest unmet need
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>
                      {gap.label}
                    </div>
                    <div style={{ fontSize: 11.5, color: "#374151", marginTop: 2 }}>
                      Closest 4 avg {gap.avgDistanceMiles} mi away
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 11.5, color: "#6B7280" }}>
                    All categories well-served here.
                  </div>
                )}
              </div>
            </Tooltip>
          </GeoJSON>
        );
      })}

      <LocationMarkers
        locations={locations}
        selectedLocation={selectedLocation}
        recommendedLocationIds={recommendedLocationIds}
        onSelect={onSelect}
      />
      <PrinterMarkers
        printers={printers}
        routeItemDedupeKeys={routeItemDedupeKeys}
        onTogglePrinterRoute={onTogglePrinterRoute}
      />
      <MeetupMarkers
        meetups={meetups}
        selectedMeetup={selectedMeetup}
        onSelectMeetup={onSelectMeetup}
      />
    </MapContainer>
  );
}

function LocationMarkers({
  locations,
  selectedLocation,
  recommendedLocationIds,
  onSelect,
}: {
  locations: MapLocation[];
  selectedLocation: MapLocation | null;
  recommendedLocationIds: string[];
  onSelect: (id: string) => void;
}) {
  const map = useMap();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait until the map container is fully initialized
    const check = () => {
      try {
        map.getZoom();
        setReady(true);
      } catch {
        requestAnimationFrame(check);
      }
    };
    check();
  }, [map]);

  const recommendedIdSet = useMemo(
    () => new Set(recommendedLocationIds),
    [recommendedLocationIds],
  );

  if (!ready) return null;

  const zoom = map.getZoom();
  const clusters =
    zoom < INDIVIDUAL_MARKER_ZOOM
      ? clusterLocations(locations, zoom, recommendedIdSet)
      : [];

  if (zoom < INDIVIDUAL_MARKER_ZOOM) {
    return (
      <>
        {clusters.map((cluster) => {
          if (cluster.locations.length === 1) {
            const location = cluster.locations[0];
            const selected = location.id === selectedLocation?.id;
            const recommended = recommendedIdSet.has(location.id);

            return (
              <Fragment key={location.id}>
                <Marker
                  position={[location.lat, location.lng]}
                  icon={createMarkerIcon(location.covered, selected, recommended)}
                  eventHandlers={{
                    click: () => onSelect(location.id),
                  }}
                >
                  <Popup
                    autoPanPaddingTopLeft={popupPaddingTopLeft}
                    autoPanPaddingBottomRight={popupPaddingBottomRight}
                  >
                    <div style={{ minWidth: 190 }}>
                      <strong>{location.name}</strong>
                      <div style={{ marginTop: 4 }}>{location.address}</div>
                      <div style={{ marginTop: 6 }}>
                        {location.covered ? "Covered" : "Needs coverage"} · {location.category}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </Fragment>
            );
          }

          return (
            <Marker
              key={cluster.id}
              position={[cluster.lat, cluster.lng]}
              icon={createClusterIcon(cluster.locations.length, cluster.kind)}
              eventHandlers={{
                click: () => {
                  map.setView(
                    [cluster.lat, cluster.lng],
                    Math.min(map.getZoom() + 2, INDIVIDUAL_MARKER_ZOOM),
                    { animate: true },
                  );
                },
              }}
            >
              <Popup
                autoPanPaddingTopLeft={popupPaddingTopLeft}
                autoPanPaddingBottomRight={popupPaddingBottomRight}
              >
                <div style={{ minWidth: 170 }}>
                  <strong>{cluster.locations.length} spots here</strong>
                  <div style={{ marginTop: 6 }}>
                    Zoom in to reveal individual places.
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </>
    );
  }

  return (
    <>
      {locations.map((location) => {
        const selected = location.id === selectedLocation?.id;
        const recommended = recommendedIdSet.has(location.id);

        return (
          <Fragment key={location.id}>
            <Marker
              position={[location.lat, location.lng]}
              icon={createMarkerIcon(location.covered, selected, recommended)}
              eventHandlers={{
                click: () => onSelect(location.id),
              }}
            >
              <Popup
                autoPanPaddingTopLeft={popupPaddingTopLeft}
                autoPanPaddingBottomRight={popupPaddingBottomRight}
              >
                <div style={{ minWidth: 190 }}>
                  <strong>{location.name}</strong>
                  <div style={{ marginTop: 4 }}>{location.address}</div>
                  <div style={{ marginTop: 6 }}>
                    {location.covered ? "Covered" : "Needs coverage"} · {location.category}
                  </div>
                </div>
              </Popup>
            </Marker>
          </Fragment>
        );
      })}
    </>
  );
}

function PrinterMarkers({
  printers,
  routeItemDedupeKeys,
  onTogglePrinterRoute,
}: {
  printers: MapPrinter[];
  routeItemDedupeKeys: Set<string>;
  onTogglePrinterRoute: (printer: MapPrinter) => void;
}) {
  if (printers.length === 0) {
    return null;
  }

  return (
    <>
      {printers.map((printer) => {
        const chain = CHAIN_PRICES.find((candidate) => candidate.match.test(printer.name));
        const level = printer.priceLevel ? PRICE_LEVEL_LABEL[printer.priceLevel] : null;
        const inRoute = routeItemDedupeKeys.has(`printer:${printer.id}`);

        return (
          <Marker
            key={printer.id}
            position={[printer.lat, printer.lng]}
            icon={createPrinterIcon()}
            zIndexOffset={500}
          >
            <Popup
              autoPanPaddingTopLeft={popupPaddingTopLeft}
              autoPanPaddingBottomRight={popupPaddingBottomRight}
            >
              <div style={{ minWidth: 210 }}>
                <strong>{printer.name}</strong>
                <div style={{ marginTop: 4 }}>{printer.address}</div>
                <div style={{ marginTop: 6, color: "#8A8780", fontSize: 12 }}>
                  {printer.hours} · {printer.distance.toFixed(1)} mi
                </div>
                {chain ? (
                  <div style={{ marginTop: 8, fontSize: 12 }}>
                    {chain.bw} · {chain.color}
                  </div>
                ) : level ? (
                  <div style={{ marginTop: 8 }}>
                    <span
                      style={{
                        fontSize: 11.5,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 2,
                        background: level.bg,
                        color: level.color,
                        display: "inline-block",
                      }}
                    >
                      {level.label}
                    </span>
                  </div>
                ) : null}
                {printer.tags.length > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginTop: 8,
                    }}
                  >
                    {printer.tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "2px 8px",
                          borderRadius: 2,
                          background: "#f8fafc",
                          border: "1px solid rgba(148,163,184,0.35)",
                          color: "#8A8780",
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => onTogglePrinterRoute(printer)}
                    style={{
                      marginRight: 10,
                      border: "none",
                      background: "transparent",
                      color: "#0f172a",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {inRoute ? "Remove from route" : "Add to route"}
                  </button>
                  <a
                    href={`https://www.google.com/maps/place/?q=place_id:${printer.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#1d4ed8",
                      fontSize: 12.5,
                      fontWeight: 700,
                      textDecoration: "none",
                    }}
                  >
                    View on Maps
                  </a>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function clusterLocations(
  locations: MapLocation[],
  zoom: number,
  recommendedIdSet: Set<string>,
) {
  const cellSize = zoom < 11 ? 0.03 : zoom < 12 ? 0.018 : 0.01;
  const clusters = new Map<
    string,
    {
      id: string;
      lat: number;
      lng: number;
      kind: "recommended" | "uncovered";
      locations: MapLocation[];
    }
  >();

  for (const location of locations) {
    if (location.covered) {
      continue;
    }

    const kind = recommendedIdSet.has(location.id) ? "recommended" : "uncovered";
    const cellKey = `${kind}:${Math.floor(location.lat / cellSize)}:${Math.floor(location.lng / cellSize)}`;
    const existing = clusters.get(cellKey);

    if (existing) {
      existing.locations.push(location);
      existing.lat =
        existing.locations.reduce((sum, item) => sum + item.lat, 0) /
        existing.locations.length;
      existing.lng =
        existing.locations.reduce((sum, item) => sum + item.lng, 0) /
        existing.locations.length;
    } else {
      clusters.set(cellKey, {
        id: cellKey,
        lat: location.lat,
        lng: location.lng,
        kind,
        locations: [location],
      });
    }
  }

  return Array.from(clusters.values());
}

function MeetupMarkers({
  meetups,
  selectedMeetup,
  onSelectMeetup,
}: {
  meetups: MeetupSummary[];
  selectedMeetup: MeetupSummary | null;
  onSelectMeetup: (id: number) => void;
}) {
  return (
    <>
      {meetups.map((meetup) => (
        <Marker
          key={meetup.id}
          position={[meetup.lat, meetup.lng]}
          icon={createMeetupMarkerIcon(meetup.id === selectedMeetup?.id)}
          eventHandlers={{
            click: () => onSelectMeetup(meetup.id),
          }}
        >
          <Popup>
            <div style={{ minWidth: 190 }}>
              <strong>{meetup.title}</strong>
              <div style={{ marginTop: 4 }}>{meetup.locationLabel}</div>
              <div style={{ marginTop: 6 }}>
                {new Date(meetup.startTime).toLocaleString()}
              </div>
              <div style={{ marginTop: 6, color: "#D44A12" }}>
                {meetup.joinedCount} volunteer{meetup.joinedCount === 1 ? "" : "s"} joined
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}
