"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHAIN_PRICES, PRICE_LEVEL_LABEL } from "@/lib/printers";
import {
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
  useMapsLibrary
} from "@vis.gl/react-google-maps";
import type {
  MapFocusRequest,
  MapLocation,
  MapNeedRegion,
  MapPrinter,
  MapViewportState,
} from "./OutreachMapDashboard";
import type { MeetupSummary } from "@/lib/social-types";

const mapCenter = { lat: 40.7395, lng: -73.9363 };
const INDIVIDUAL_MARKER_ZOOM = 15;

const nycBounds = {
  north: 40.9176,
  south: 40.4774,
  east: -73.7004,
  west: -74.2591
};

function MarkerIcon({ covered, selected, recommended }: { covered: boolean, selected: boolean, recommended: boolean }) {
  const size = 18;
  const fill = covered ? "#16a34a" : recommended ? "#60a5fa" : "#f59e0b";
  const ring = selected ? "#1f1a0b" : recommended ? "#eff6ff" : "#ffffff";
  const shadow = covered
    ? "rgba(22,163,74,0.22)"
    : recommended
      ? "rgba(96,165,250,0.30)"
      : "rgba(245,158,11,0.24)";

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 999,
      background: fill,
      border: `4px solid ${ring}`,
      boxShadow: `0 10px 18px ${shadow}`
    }} />
  );
}

function ClusterIcon({ count, kind }: { count: number, kind: "recommended" | "uncovered" }) {
  const background = kind === "recommended" ? "rgba(96,165,250,0.94)" : "rgba(217,119,6,0.92)";
  const shadow = kind === "recommended" ? "rgba(96,165,250,0.24)" : "rgba(217,119,6,0.22)";
  const ring = kind === "recommended" ? "rgba(239,246,255,0.96)" : "rgba(255,246,214,0.95)";

  return (
    <div style={{
      minWidth: 34,
      height: 34,
      padding: "0 10px",
      borderRadius: 999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background,
      border: `3px solid ${ring}`,
      boxShadow: `0 10px 20px ${shadow}`,
      color: "#fffdf8",
      fontSize: 12,
      fontWeight: 800
    }}>
      {count}
    </div>
  );
}

function PrinterIcon() {
  const size = 24;
  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 999,
      background: "#f8fafc",
      border: "2px solid #475569",
      boxShadow: "0 10px 20px rgba(51,65,85,0.18)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="6 9 6 2 18 2 18 9"></polyline>
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
        <rect x="6" y="14" width="12" height="8"></rect>
      </svg>
    </div>
  );
}

function MeetupMarkerIcon({ selected }: { selected: boolean }) {
  return (
    <div className="meetup-marker-ring" style={selected ? { transform: "scale(1.08)" } : {}} />
  );
}

function ApplyFocusRequest({ focusRequest }: { focusRequest: MapFocusRequest | null }) {
  const map = useMap();
  useEffect(() => {
    if (!focusRequest || !map) return;
    map.panTo({ lat: focusRequest.lat, lng: focusRequest.lng });
    map.setZoom(focusRequest.zoom ?? 15);
  }, [focusRequest, map]);
  return null;
}

export default function OutreachMapCanvas({
  locations,
  printers,
  meetups,
  highlightedRegions,
  recommendedLocationIds,
  routeItemDedupeKeys,
  selectedLocation,
  selectedMeetup,
  focusRequest,
  onSelect,
  onTogglePrinterRoute,
  onSelectMeetup,
  onMapClick,
  onViewportChange,
}: {
  locations: MapLocation[];
  printers: MapPrinter[];
  meetups: MeetupSummary[];
  highlightedRegions: MapNeedRegion[];
  recommendedLocationIds: string[];
  routeItemDedupeKeys: Set<string>;
  selectedLocation: MapLocation | null;
  selectedMeetup: MeetupSummary | null;
  focusRequest: MapFocusRequest | null;
  onSelect: (id: string) => void;
  onTogglePrinterRoute: (printer: MapPrinter) => void;
  onSelectMeetup: (id: number) => void;
  onMapClick: () => void;
  onViewportChange: (viewport: MapViewportState) => void;
}) {
  const [zoom, setZoom] = useState(10);
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');

  const handleBoundsChanged = useCallback(() => {
    if (!map) return;
    const bounds = map.getBounds();
    const center = map.getCenter();
    const currentZoom = map.getZoom();
    if (bounds && center && currentZoom !== undefined) {
      setZoom(currentZoom);
      onViewportChange({
        zoom: currentZoom,
        bounds: {
          north: bounds.getNorthEast().lat(),
          south: bounds.getSouthWest().lat(),
          east: bounds.getNorthEast().lng(),
          west: bounds.getSouthWest().lng(),
        },
        center: {
          lat: center.lat(),
          lng: center.lng(),
        },
      });
    }
  }, [map, onViewportChange]);

  useEffect(() => {
    if (map && mapsLib) {
      map.fitBounds(nycBounds);
    }
  }, [map, mapsLib]);

  useEffect(() => {
    if (!map || !mapsLib || !highlightedRegions) return;
    // Clear existing data layer
    map.data.forEach((feature) => {
      map.data.remove(feature);
    });
    
    // Add new regions
    highlightedRegions.forEach(region => {
      map.data.addGeoJson({
        type: "Feature",
        geometry: region.geometry,
        properties: { id: region.id }
      });
    });

    map.data.setStyle({
      fillColor: "#f59e0b",
      fillOpacity: 0.12,
      strokeColor: "#c2410c",
      strokeWeight: 1.5,
      strokeOpacity: 0.7
    });

    const listener = map.data.addListener("click", () => {
      onMapClick();
    });

    return () => {
      listener.remove();
    };
  }, [map, mapsLib, highlightedRegions, onMapClick]);

  return (
    <div style={{ height: "100%", width: "100%" }}>
      <Map
        defaultCenter={mapCenter}
        defaultZoom={10}
        mapId="outreach-map"
        disableDefaultUI={true}
        zoomControl={true}
        gestureHandling="greedy"
        onIdle={handleBoundsChanged}
        onClick={onMapClick}
      >
        <ApplyFocusRequest focusRequest={focusRequest} />

        <LocationMarkers
          zoom={zoom}
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
      </Map>
    </div>
  );
}

function LocationMarkers({
  zoom,
  locations,
  selectedLocation,
  recommendedLocationIds,
  onSelect,
}: {
  zoom: number;
  locations: MapLocation[];
  selectedLocation: MapLocation | null;
  recommendedLocationIds: string[];
  onSelect: (id: string) => void;
}) {
  const recommendedIdSet = useMemo(
    () => new Set(recommendedLocationIds),
    [recommendedLocationIds],
  );

  const clusters = zoom < INDIVIDUAL_MARKER_ZOOM ? clusterLocations(locations, zoom, recommendedIdSet) : [];
  const map = useMap();

  if (zoom < INDIVIDUAL_MARKER_ZOOM) {
    return (
      <>
        {clusters.map((cluster: { id: string; lat: number; lng: number; kind: "recommended" | "uncovered"; locations: MapLocation[]; }) => {
          if (cluster.locations.length === 1) {
            const location = cluster.locations[0];
            const selected = location.id === selectedLocation?.id;
            const recommended = recommendedIdSet.has(location.id);

            return (
              <Fragment key={location.id}>
                <AdvancedMarker
                  position={{ lat: location.lat, lng: location.lng }}
                  onClick={() => onSelect(location.id)}
                >
                  <MarkerIcon covered={location.covered} selected={selected} recommended={recommended} />
                </AdvancedMarker>
                {selected && (
                  <InfoWindow
                    position={{ lat: location.lat, lng: location.lng }}
                    onCloseClick={() => onSelect("")}
                    headerDisabled
                  >
                    <div style={{ minWidth: 190, color: 'black' }}>
                      <strong>{location.name}</strong>
                      <div style={{ marginTop: 4 }}>{location.address}</div>
                      <div style={{ marginTop: 6 }}>
                        {location.covered ? "Covered" : "Needs coverage"} · {location.category}
                      </div>
                    </div>
                  </InfoWindow>
                )}
              </Fragment>
            );
          }

          return (
            <AdvancedMarker
              key={cluster.id}
              position={{ lat: cluster.lat, lng: cluster.lng }}
              onClick={() => {
                if (map) {
                  map.panTo({ lat: cluster.lat, lng: cluster.lng });
                  map.setZoom(Math.min(map.getZoom()! + 2, INDIVIDUAL_MARKER_ZOOM));
                }
              }}
            >
              <ClusterIcon count={cluster.locations.length} kind={cluster.kind} />
            </AdvancedMarker>
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
            <AdvancedMarker
              position={{ lat: location.lat, lng: location.lng }}
              onClick={() => onSelect(location.id)}
            >
              <MarkerIcon covered={location.covered} selected={selected} recommended={recommended} />
            </AdvancedMarker>
            {selected && (
              <InfoWindow
                position={{ lat: location.lat, lng: location.lng }}
                onCloseClick={() => onSelect("")}
                headerDisabled
              >
                <div style={{ minWidth: 190, color: 'black' }}>
                  <strong>{location.name}</strong>
                  <div style={{ marginTop: 4 }}>{location.address}</div>
                  <div style={{ marginTop: 6 }}>
                    {location.covered ? "Covered" : "Needs coverage"} · {location.category}
                  </div>
                </div>
              </InfoWindow>
            )}
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (printers.length === 0) return null;

  return (
    <>
      {printers.map((printer) => {
        const chain = CHAIN_PRICES.find((candidate) => candidate.match.test(printer.name));
        const level = printer.priceLevel ? PRICE_LEVEL_LABEL[printer.priceLevel] : null;
        const inRoute = routeItemDedupeKeys.has(`printer:${printer.id}`);
        const selected = selectedId === printer.id;

        return (
          <Fragment key={printer.id}>
            <AdvancedMarker
              position={{ lat: printer.lat, lng: printer.lng }}
              zIndex={500}
              onClick={() => setSelectedId(printer.id)}
            >
              <PrinterIcon />
            </AdvancedMarker>
            {selected && (
              <InfoWindow
                position={{ lat: printer.lat, lng: printer.lng }}
                onCloseClick={() => setSelectedId(null)}
                headerDisabled
              >
                <div style={{ minWidth: 210, color: 'black' }}>
                  <strong>{printer.name}</strong>
                  <div style={{ marginTop: 4 }}>{printer.address}</div>
                  <div style={{ marginTop: 6, color: "#475569", fontSize: 12 }}>
                    {printer.hours} · {printer.distance.toFixed(1)} mi
                  </div>
                  {chain ? (
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      {chain.bw} · {chain.color}
                    </div>
                  ) : level ? (
                    <div style={{ marginTop: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: level.bg, color: level.color, display: "inline-block" }}>
                        {level.label}
                      </span>
                    </div>
                  ) : null}
                  {printer.tags.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      {printer.tags.map((tag) => (
                        <span key={tag} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#f8fafc", border: "1px solid rgba(148,163,184,0.35)", color: "#475569" }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      onClick={() => onTogglePrinterRoute(printer)}
                      style={{ marginRight: 10, border: "none", background: "transparent", color: "#0f172a", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}
                    >
                      {inRoute ? "Remove from route" : "Add to route"}
                    </button>
                    <a href={`https://www.google.com/maps/place/?q=place_id:${printer.id}`} target="_blank" rel="noopener noreferrer" style={{ color: "#1d4ed8", fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                      View on Maps
                    </a>
                  </div>
                </div>
              </InfoWindow>
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function clusterLocations(locations: MapLocation[], zoom: number, recommendedIdSet: Set<string>) {
  const cellSize = zoom < 11 ? 0.03 : zoom < 12 ? 0.018 : 0.01;
  const clusters = new globalThis.Map<string, { id: string; lat: number; lng: number; kind: "recommended" | "uncovered"; locations: MapLocation[]; }>();

  for (const location of locations) {
    if (location.covered) continue;
    const kind = recommendedIdSet.has(location.id) ? "recommended" : "uncovered";
    const cellKey = `${kind}:${Math.floor(location.lat / cellSize)}:${Math.floor(location.lng / cellSize)}`;
    const existing = clusters.get(cellKey);

    if (existing) {
      existing.locations.push(location);
      existing.lat = existing.locations.reduce((sum, item) => sum + item.lat, 0) / existing.locations.length;
      existing.lng = existing.locations.reduce((sum, item) => sum + item.lng, 0) / existing.locations.length;
    } else {
      clusters.set(cellKey, { id: cellKey, lat: location.lat, lng: location.lng, kind, locations: [location] });
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
        <Fragment key={meetup.id}>
          <AdvancedMarker
            position={{ lat: meetup.lat, lng: meetup.lng }}
            onClick={() => onSelectMeetup(meetup.id)}
          >
            <MeetupMarkerIcon selected={meetup.id === selectedMeetup?.id} />
          </AdvancedMarker>
          {meetup.id === selectedMeetup?.id && (
            <InfoWindow
              position={{ lat: meetup.lat, lng: meetup.lng }}
              onCloseClick={() => onSelectMeetup(-1)}
              headerDisabled
            >
              <div style={{ minWidth: 190, color: 'black' }}>
                <strong>{meetup.title}</strong>
                <div style={{ marginTop: 4 }}>{meetup.locationLabel}</div>
                <div style={{ marginTop: 6 }}>{new Date(meetup.startTime).toLocaleString()}</div>
                <div style={{ marginTop: 6, color: "#166534" }}>
                  {meetup.joinedCount} volunteer{meetup.joinedCount === 1 ? "" : "s"} joined
                </div>
              </div>
            </InfoWindow>
          )}
        </Fragment>
      ))}
    </>
  );
}
