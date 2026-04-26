"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  fetchPrinters,
  type Printer,
} from "@/lib/printers";
import {
  addRouteItem,
  clearRouteItems,
  deleteRouteItem,
  getRouteItems,
} from "@/lib/route-items";
import { submitHotspotCoverageProof } from "@/lib/hotspot-proof-api";
import { useAuth } from "@/context/AuthContext";
import type { SavedRouteItem, SavedRouteItemsResponse } from "@/types/route-items";
import { useRouter } from "next/navigation";
import { getMeetups, joinMeetup } from "@/lib/meetup-api";
import { formatDateTimeRange } from "@/lib/social-format";
import type { MeetupSummary } from "@/lib/social-types";
import {
  planRoute,
  type PlannerCandidateStop,
  type PlannerConstraints,
  type PlannerResult,
} from "@/lib/route-planner-api";
import CoverageProofModal from "./CoverageProofModal";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

export type MapHub = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type MapLocation = {
  id: string;
  sourceKey: string;
  osmId: string;
  osmType: string;
  name: string;
  address: string;
  neighborhood: string;
  regionCode: string | null;
  regionName: string | null;
  regionNeedScore: number | null;
  category: string;
  priority: "High" | "Medium" | "Low";
  score: number;
  covered: boolean;
  lastChecked: string;
  assignedTo: string;
  notes: string;
  lat: number;
  lng: number;
  importedAt: string;
  lastProofAt: string | null;
  coverageCount: number;
};

export type RegionGap = {
  category: string;
  label: string;
  avgDistanceMiles: number;
  nearbyCount: number;
};

export type MapNeedRegion = {
  id: string;
  regionCode: string;
  regionName: string;
  boroughName: string;
  regionType: string;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  centroidLat: number;
  centroidLng: number;
  foodInsecurePercentage: number | null;
  foodNeedScore: number;
  weightedRank: number | null;
  sourceYear: string;
  dominantGap: RegionGap | null;
  categoryGaps: RegionGap[];
};

export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
};

export type MapViewportState = {
  zoom: number;
  bounds: MapBounds | null;
  center: {
    lat: number;
    lng: number;
  } | null;
};

export type MapFocusRequest = {
  key: number;
  lat: number;
  lng: number;
  zoom?: number;
  bounds?: [number, number, number, number];
};

type DistanceLocation = MapLocation & { distanceMiles: number };
type RankedLocation = DistanceLocation & {
  priorityScore: number;
  derivedPriority: "High" | "Medium" | "Low";
  suitabilityScore: number;
  needComponent: number;
  distanceComponent: number;
  coverageComponent: number;
  gapBonus: number;
};
type LayerVisibility = {
  recommended: boolean;
  uncovered: boolean;
  covered: boolean;
  regions: boolean;
  printers: boolean;
  meetups: boolean;
};
type PriorityOrigin = {
  lat: number;
  lng: number;
  label: string;
};

export type MapPrinter = Printer;

type LocationsResponse = {
  success: boolean;
  count: number;
  data: MapLocation[];
  message?: string;
};

type ImportResponse = {
  success: boolean;
  data?: {
    importedCount: number;
    sourceCount: number;
    importedAt: string;
    regions?: { region: string; importedCount: number; sourceCount: number }[];
    failures?: { region: string; message: string }[];
  };
  message?: string;
};

type UpdateLocationResponse = {
  success: boolean;
  data?: MapLocation;
  message?: string;
};

type NeedRegionsResponse = {
  success: boolean;
  count: number;
  data: MapNeedRegion[];
  message?: string;
};

type NeedRegionImportResponse = {
  success: boolean;
  data?: {
    importedCount: number;
    sourceCount: number;
    sourceYear: string;
    annotatedHotspotCount: number;
  };
  message?: string;
};

const OutreachMapCanvas = dynamic(() => import("./OutreachMapCanvas"), {
  ssr: false,
});

const hubs: MapHub[] = [
  { id: "hub-manhattan", name: "Manhattan Volunteer Base", lat: 40.7831, lng: -73.9712 },
  { id: "hub-bronx", name: "Bronx Outreach Hub", lat: 40.8448, lng: -73.8648 },
  { id: "hub-brooklyn", name: "Brooklyn Print Room", lat: 40.6782, lng: -73.9442 },
  { id: "hub-queens", name: "Queens Meetup", lat: 40.7282, lng: -73.7949 },
  { id: "hub-staten", name: "Staten Island Base", lat: 40.5795, lng: -74.1502 },
];

const priorityStyle = {
  High: { bg: "rgba(239,68,68,0.14)", color: "#b91c1c" },
  Medium: { bg: "rgba(245,158,11,0.16)", color: "#b45309" },
  Low: { bg: "rgba(34,197,94,0.14)", color: "#15803d" },
};

const HOTSPOT_REVEAL_ZOOM = 15;
const HOTSPOT_FETCH_LIMIT = 8000;

export default function OutreachMapDashboard() {
  const router = useRouter();
  const { token, isGuest } = useAuth();
  const [isMobile, setIsMobile] = useState(false);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [printers, setPrinters] = useState<MapPrinter[]>([]);
  const [needRegions, setNeedRegions] = useState<MapNeedRegion[]>([]);
  const [routeItems, setRouteItems] = useState<SavedRouteItem[]>([]);
  const [meetups, setMeetups] = useState<MeetupSummary[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedMeetupId, setSelectedMeetupId] = useState<number | null>(null);
  const [layers, setLayers] = useState<LayerVisibility>({
    recommended: true,
    uncovered: true,
    covered: false,
    regions: true,
    printers: true,
    meetups: true,
  });
  const [isGeneratingFlyer, setIsGeneratingFlyer] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerResult, setPlannerResult] = useState<PlannerResult | null>(null);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const PLANNER_CONSTRAINTS: PlannerConstraints = {};
  const [viewport, setViewport] = useState<MapViewportState>({
    zoom: 12,
    bounds: null,
    center: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isTrackerMode, setIsTrackerMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingPrinters, setIsLoadingPrinters] = useState(false);
  const [isLoadingRouteItems, setIsLoadingRouteItems] = useState(false);
  const [isCoverageProofModalOpen, setIsCoverageProofModalOpen] = useState(false);
  const [isSubmittingCoverageProof, setIsSubmittingCoverageProof] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [printerErrorMessage, setPrinterErrorMessage] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [hasAutoSeeded, setHasAutoSeeded] = useState(false);
  const [hasAutoSeededRegions, setHasAutoSeededRegions] = useState(false);
  const [hasResolvedPrinterLocation, setHasResolvedPrinterLocation] = useState(false);
  const [focusRequest, setFocusRequest] = useState<MapFocusRequest | null>(null);
  const lastPrinterQueryRef = useRef<{ lat: number; lng: number } | null>(null);
  const [priorityOrigin, setPriorityOrigin] = useState<PriorityOrigin>({
    lat: hubs[0].lat,
    lng: hubs[0].lng,
    label: hubs[0].name,
  });

  const handleViewportChange = useCallback((nextViewport: MapViewportState) => {
    setViewport((currentViewport) => {
      if (
        currentViewport.zoom === nextViewport.zoom &&
        areBoundsEqual(currentViewport.bounds, nextViewport.bounds) &&
        areCentersEqual(currentViewport.center, nextViewport.center)
      ) {
        return currentViewport;
      }

      return nextViewport;
    });
  }, []);

  const locationsWithDistance: DistanceLocation[] = useMemo(
    () =>
      locations.map((location) => ({
        ...location,
        distanceMiles: getDistanceMiles(
          priorityOrigin.lat,
          priorityOrigin.lng,
          location.lat,
          location.lng,
        ),
      })),
    [locations, priorityOrigin.lat, priorityOrigin.lng],
  );

  const regionLocationCounts = useMemo(
    () => getRegionLocationCounts(locationsWithDistance),
    [locationsWithDistance],
  );
  const highlightedRegions = useMemo(
    () =>
      getHighlightedRegions(
        needRegions,
        regionLocationCounts,
        viewport.zoom,
        0.2,
        10,
      ),
    [needRegions, regionLocationCounts, viewport.zoom],
  );
  const highlightedRegionCodes = useMemo(
    () => new Set(highlightedRegions.map((region) => region.regionCode)),
    [highlightedRegions],
  );
  const rankedLocations = useMemo(
    () =>
      rankLocations(
        locationsWithDistance,
        highlightedRegionCodes,
        regionLocationCounts,
      ),
    [highlightedRegionCodes, locationsWithDistance, regionLocationCounts],
  );
  const recommendedTargetCount = useMemo(
    () => Math.max(1, Math.round(locationsWithDistance.length * 0.2)),
    [locationsWithDistance.length],
  );
  const recommendedLocations = useMemo(
    () =>
      rankedLocations
        .filter((location) => isRecommendedLocation(location, highlightedRegionCodes))
        .slice(0, recommendedTargetCount),
    [highlightedRegionCodes, rankedLocations, recommendedTargetCount],
  );
  const layeredLocations = useMemo(
    () => getLayeredLocations(rankedLocations, recommendedLocations, layers),
    [layers, rankedLocations, recommendedLocations],
  );
  const recommendedLocationIds = useMemo(
    () => recommendedLocations.map((location) => location.id),
    [recommendedLocations],
  );
  const layeredRankedLocations = useMemo(
    () => rankLocations(layeredLocations, highlightedRegionCodes, regionLocationCounts),
    [highlightedRegionCodes, layeredLocations, regionLocationCounts],
  );
  const visibleLocations = useMemo(
    () => getVisibleLocations(layeredRankedLocations, viewport, highlightedRegionCodes),
    [highlightedRegionCodes, layeredRankedLocations, viewport],
  );
  const visibleMeetups = useMemo(
    () => (layers.meetups ? getVisibleMeetups(meetups, viewport) : []),
    [layers.meetups, meetups, viewport],
  );

  const selectedLocation = useMemo(
    () => rankedLocations.find((location) => location.id === selectedLocationId) || null,
    [rankedLocations, selectedLocationId],
  );
  const routeItemByDedupeKey = useMemo(
    () => new Map(routeItems.map((item) => [item.dedupeKey, item])),
    [routeItems],
  );
  const routeItemDedupeKeys = useMemo(
    () => new Set(routeItems.map((item) => item.dedupeKey)),
    [routeItems],
  );
  const selectedLocationRouteItem = selectedLocation
    ? routeItemByDedupeKey.get(getHotspotRouteDedupeKey(selectedLocation))
    : null;
  const selectedMeetup = useMemo(
    () => meetups.find((meetup) => Number(meetup.id) === Number(selectedMeetupId)) || null,
    [meetups, selectedMeetupId],
  );

  const runInitialLoad = useEffectEvent(() => {
    void loadStoredHotspots(true);
    void loadNeedRegions(true);
    void loadMeetups();
  });

  const runLocationSearch = useEffectEvent((query: string) => {
    void searchForLocation(query);
  });
  const runRouteItemsWipe = useEffectEvent(() => {
    if (!token || isGuest) {
      setRouteItems([]);
      return;
    }
    setIsLoadingRouteItems(true);
    void clearRouteItems(token)
      .then(() => setRouteItems([]))
      .catch((error) => {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to clear saved route.",
        );
      })
      .finally(() => setIsLoadingRouteItems(false));
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 768px)");
    const updateViewport = (event?: MediaQueryListEvent) => {
      setIsMobile(event?.matches ?? mediaQuery.matches);
    };

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);

    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    runInitialLoad();
  }, []);

  useEffect(() => {
    runRouteItemsWipe();
  }, [isGuest, token]);

  useEffect(() => {
    if (!selectedLocationId) {
      setIsCoverageProofModalOpen(false);
    }
  }, [selectedLocationId]);

  useEffect(() => {
    let cancelled = false;

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setHasResolvedPrinterLocation(true);
      return () => {
        cancelled = true;
      };
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;

        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setFocusRequest({
          key: Date.now(),
          lat,
          lng,
          zoom: HOTSPOT_REVEAL_ZOOM,
        });
        setPriorityOrigin({
          lat,
          lng,
          label: "Your location",
        });
        setHasResolvedPrinterLocation(true);
      },
      () => {
        if (cancelled) return;
        setHasResolvedPrinterLocation(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleSearch(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === "string") {
        runLocationSearch(detail);
      }
    }

    window.addEventListener("voluntiers:map-search", handleSearch as EventListener);

    return () => {
      window.removeEventListener("voluntiers:map-search", handleSearch as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!layers.printers || !hasResolvedPrinterLocation || !viewport.center) {
      return;
    }

    const nextCenter = viewport.center;
    const timer = window.setTimeout(() => {
      const lastQuery = lastPrinterQueryRef.current;

      if (
        lastQuery &&
        getDistanceMiles(lastQuery.lat, lastQuery.lng, nextCenter.lat, nextCenter.lng) < 0.15
      ) {
        return;
      }

      lastPrinterQueryRef.current = nextCenter;
      void loadPrintersForArea(nextCenter.lat, nextCenter.lng);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [hasResolvedPrinterLocation, layers.printers, viewport.center]);

  async function loadStoredHotspots(autoSeedIfEmpty = false) {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams({
        limit: String(HOTSPOT_FETCH_LIMIT),
      });

      const response = await fetch(`${API_BASE_URL}/api/locations?${params.toString()}`);
      const payload = (await response.json()) as LocationsResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Failed to load stored hotspots");
      }

      const nextLocations = payload.data || [];
      setLocations(nextLocations);

      if (nextLocations.length === 0 && autoSeedIfEmpty && !hasAutoSeeded) {
        setHasAutoSeeded(true);
        void syncNycHotspots(true);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load OSM hotspots",
      );
      setLocations([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMeetups() {
    try {
      const response = await getMeetups(token, false);
      setMeetups(response.data ?? []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load meetups",
      );
    }
  }

  async function loadNeedRegions(autoSeedIfEmpty = false) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/need-regions`);
      const payload = (await response.json()) as NeedRegionsResponse;

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Failed to load need regions");
      }

      const nextRegions = payload.data || [];
      setNeedRegions(nextRegions);

      if (nextRegions.length === 0 && autoSeedIfEmpty && !hasAutoSeededRegions) {
        setHasAutoSeededRegions(true);
        void syncNeedRegions(true);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load need regions",
      );
    }
  }

  async function loadPrintersForArea(lat: number, lng: number) {
    setIsLoadingPrinters(true);
    setPrinterErrorMessage(null);

    try {
      const nextPrinters = await fetchPrinters(lat, lng);
      setPrinters(nextPrinters);
    } catch (error) {
      setPrinters([]);
      setPrinterErrorMessage(
        error instanceof Error ? error.message : "Failed to load nearby printers",
      );
    } finally {
      setIsLoadingPrinters(false);
    }
  }

  async function syncNeedRegions(silent = false) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/need-regions/import/nyc-open-data`, {
        method: "POST",
      });
      const payload = (await response.json()) as NeedRegionImportResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || "Failed to import NYC need regions");
      }

      await loadNeedRegions();

      if (!silent) {
        setSyncMessage(
          `Imported ${payload.data.importedCount} NYC need regions from ${payload.data.sourceYear} data.`,
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to import NYC need regions",
      );
    }
  }

  async function searchForLocation(query: string) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return;

    setIsSearching(true);
    setErrorMessage(null);
    setSyncMessage(null);

    try {
      const params = new URLSearchParams({
        q: normalizedQuery.includes("New York")
          ? normalizedQuery
          : `${normalizedQuery}, New York City`,
        format: "jsonv2",
        limit: "1",
        addressdetails: "1",
      });

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      );
      const payload = (await response.json()) as Array<{
        lat: string;
        lon: string;
        boundingbox?: [string, string, string, string];
      }>;

      if (!response.ok || payload.length === 0) {
        throw new Error("Location not found. Try a neighborhood or street address.");
      }

      const firstMatch = payload[0];
      const resultLat = Number(firstMatch.lat);
      const resultLng = Number(firstMatch.lon);

      setFocusRequest({
        key: Date.now(),
        lat: resultLat,
        lng: resultLng,
        zoom: getSearchZoom(normalizedQuery),
      });
      setPriorityOrigin({
        lat: resultLat,
        lng: resultLng,
        label: normalizedQuery,
      });
      setShowTools(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to search for location",
      );
    } finally {
      setIsSearching(false);
    }
  }

  async function syncNycHotspots(silent = false) {
    setErrorMessage(null);

    try {
      await syncNeedRegions(true);
      const response = await fetch(`${API_BASE_URL}/api/locations/import/osm/nyc`, {
        method: "POST",
      });

      const payload = (await response.json()) as ImportResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || "Failed to import NYC hotspots from OSM");
      }

      await loadStoredHotspots();
      await loadNeedRegions();

      if (!silent) {
        const failedRegions = payload.data.failures?.length ?? 0;
        setSyncMessage(
          failedRegions > 0
            ? `Imported region overlays and ${payload.data.importedCount} hotspot records. ${failedRegions} hotspot region${failedRegions === 1 ? "" : "s"} still failed and can be retried.`
            : `Imported NYC need regions and ${payload.data.importedCount} hotspot records across all 5 boroughs.`,
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to import NYC hotspots from OSM",
      );
    }
  }

  async function toggleCovered(id: string, covered: boolean) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/locations/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          covered: !covered,
          lastChecked: "Just now",
          assignedTo: !covered ? "Volunteer confirmed" : "Open shift",
        }),
      });

      const payload = (await response.json()) as UpdateLocationResponse;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.message || "Failed to update hotspot");
      }

      setLocations((current) =>
        current.map((location) =>
          location.id === payload.data?.id ? payload.data : location,
        ),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update hotspot",
      );
    }
  }

  function updateHotspotInState(updatedHotspot: MapLocation) {
    setLocations((current) =>
      current.map((location) =>
        location.id === updatedHotspot.id ? updatedHotspot : location,
      ),
    );
  }

  function openCoverageProofFlow() {
    if (!selectedLocation) {
      return;
    }

    if (!token || isGuest) {
      setErrorMessage("Sign in with a full account to submit hotspot coverage proof.");
      return;
    }

    setErrorMessage(null);
    setIsCoverageProofModalOpen(true);
  }

  async function handleCoverageProofSubmit(photo: File, notes: string) {
    if (!selectedLocation || !token || isGuest) {
      throw new Error("Sign in with a full account to submit hotspot coverage proof.");
    }

    setIsSubmittingCoverageProof(true);

    try {
      const result = await submitHotspotCoverageProof(
        token,
        selectedLocation.id,
        photo,
        notes,
      );

      updateHotspotInState(result.hotspot);
      setSyncMessage(`${result.hotspot.name} was marked covered with photo proof.`);
      setErrorMessage(null);
      setIsCoverageProofModalOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to submit hotspot coverage proof.";
      setErrorMessage(message);
      throw error;
    } finally {
      setIsSubmittingCoverageProof(false);
    }
  }

  async function handleAddHotspotToRoute(location: RankedLocation) {
    if (!token || isGuest) {
      setErrorMessage("Sign in to save route items.");
      return;
    }

    try {
      const savedItem = await addRouteItem(token, {
        itemType: "hotspot",
        hotspotId: location.id,
        sourceId: location.osmId,
        sourceKey: location.sourceKey,
        name: location.name,
        address: location.address,
        category: location.category,
        lat: location.lat,
        lng: location.lng,
        regionCode: location.regionCode,
        metadata: {
          priority: location.derivedPriority,
          covered: location.covered,
        },
      });

      setRouteItems((current) => upsertRouteItemInList(current, savedItem));
      setSyncMessage(`${location.name} added to route.`);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save route item",
      );
    }
  }

  async function handleRemoveSelectedRouteItem() {
    if (!token || !selectedLocationRouteItem) {
      return;
    }

    try {
      await deleteRouteItem(token, selectedLocationRouteItem.id);
      setRouteItems((current) =>
        current.filter((item) => item.id !== selectedLocationRouteItem.id),
      );
      setSyncMessage(`${selectedLocation?.name ?? "Hotspot"} removed from route.`);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to remove route item",
      );
    }
  }

  async function loadRouteItems() {
    if (!token || isGuest) {
      setRouteItems([]);
      return;
    }

    setIsLoadingRouteItems(true);

    try {
      const payload = (await getRouteItems(token)) as SavedRouteItemsResponse;
      setRouteItems(payload.data || []);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load saved route items",
      );
    } finally {
      setIsLoadingRouteItems(false);
    }
  }

  async function handleTogglePrinterRoute(printer: MapPrinter) {
    if (!token || isGuest) {
      setErrorMessage("Sign in to save route items.");
      return;
    }

    const existing = routeItemByDedupeKey.get(getPrinterRouteDedupeKey(printer));

    try {
      if (existing) {
        await deleteRouteItem(token, existing.id);
        setRouteItems((current) => current.filter((item) => item.id !== existing.id));
        setSyncMessage(`${printer.name} removed from route.`);
        return;
      }

      const savedItem = await addRouteItem(token, {
        itemType: "printer",
        sourceId: printer.id,
        name: printer.name,
        address: printer.address,
        category: "Printer",
        lat: printer.lat,
        lng: printer.lng,
        metadata: {
          distance: printer.distance,
          hours: printer.hours,
          tags: printer.tags,
          priceLevel: printer.priceLevel ?? null,
        },
      });

      setRouteItems((current) => upsertRouteItemInList(current, savedItem));
      setSyncMessage(`${printer.name} added to route.`);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update route item",
      );
    }
  }

  async function handleMeetupJoin(meetupId: number) {
    if (!token || isGuest) {
      return;
    }

    try {
      const response = await joinMeetup(token, meetupId);
      setMeetups((current) =>
        current.map((meetup) =>
          meetup.id === response.data.id ? response.data : meetup,
        ),
      );
      setSelectedMeetupId(response.data.id);
      router.push(`/community/meetups/${response.data.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to join meetup",
      );
    }
  }

  function openGoogleMapsLocation(location: RankedLocation) {
    const params = new URLSearchParams({
      q: `${location.name} ${location.address}`.trim(),
    });

    window.open(`https://www.google.com/maps/search/?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  function buildPlannerCandidates(): PlannerCandidateStop[] {
    const hotspotById = new Map(rankedLocations.map((loc) => [String(loc.id), loc]));

    const fromRouteItems = routeItems
      .filter((item) => item.itemType === "hotspot" && item.hotspotId)
      .map((item) => {
        const ranked = hotspotById.get(String(item.hotspotId));
        if (!ranked) {
          return {
            id: `hotspot:${item.hotspotId}`,
            hotspotId: Number(item.hotspotId),
            name: item.name,
            category: item.category || "",
            lat: item.lat,
            lng: item.lng,
            covered: false,
            regionCode: item.regionCode ?? null,
            regionName: null,
            regionNeedScore: null,
            lastProofAt: null,
          } as PlannerCandidateStop;
        }
        return {
          id: `hotspot:${ranked.id}`,
          hotspotId: Number(ranked.id),
          name: ranked.name,
          category: ranked.category,
          lat: ranked.lat,
          lng: ranked.lng,
          covered: ranked.covered,
          regionCode: ranked.regionCode,
          regionName: ranked.regionName,
          regionNeedScore: ranked.regionNeedScore,
          lastProofAt: ranked.lastProofAt,
        } as PlannerCandidateStop;
      });

    if (fromRouteItems.length >= 1) return fromRouteItems;

    return visibleLocations.slice(0, 10).map((loc) => ({
      id: `hotspot:${loc.id}`,
      hotspotId: Number(loc.id),
      name: loc.name,
      category: loc.category,
      lat: loc.lat,
      lng: loc.lng,
      covered: loc.covered,
      regionCode: loc.regionCode,
      regionName: loc.regionName,
      regionNeedScore: loc.regionNeedScore,
      lastProofAt: loc.lastProofAt,
    }));
  }

  async function handlePlanRoute() {
    setPlannerLoading(true);
    setPlannerError(null);
    setPlannerResult(null);
    try {
      const origin = priorityOrigin || viewport.center;
      if (!origin) {
        throw new Error("No location available — pan the map or grant location access.");
      }
      const candidates = buildPlannerCandidates();
      if (candidates.length === 0) {
        throw new Error("Add some hotspots to your route first or zoom into an area.");
      }
      const result = await planRoute({
        userLat: origin.lat,
        userLng: origin.lng,
        constraints: { ...PLANNER_CONSTRAINTS, maxStops: candidates.length },
        candidateStops: candidates,
      });
      setPlannerResult(result);
    } catch (error) {
      setPlannerError(error instanceof Error ? error.message : "Failed to plan route.");
    } finally {
      setPlannerLoading(false);
    }
  }

  function handleOpenPlannedRouteInGoogleMaps() {
    if (!plannerResult || plannerResult.orderedStops.length === 0) return;
    const origin = priorityOrigin || viewport.center;
    const stops = plannerResult.orderedStops;
    const destination = stops[stops.length - 1];
    const waypoints = stops.slice(0, -1);
    const params = new URLSearchParams({
      api: "1",
      travelmode: "walking",
      destination: `${destination.lat},${destination.lng}`,
    });
    if (origin) {
      params.set("origin", `${origin.lat},${origin.lng}`);
    }
    if (waypoints.length > 0) {
      params.set(
        "waypoints",
        waypoints.map((w) => `${w.lat},${w.lng}`).join("|"),
      );
    }
    window.open(
      `https://www.google.com/maps/dir/?${params.toString()}`,
      "_blank",
      "noopener,noreferrer",
    );

    setPlannerResult(null);
    setPlannerOpen(false);

    if (token && !isGuest && routeItems.length > 0) {
      void clearRouteItems(token)
        .then(() => {
          setRouteItems([]);
          setSyncMessage("Route handed off to Google Maps. Saved stops cleared.");
        })
        .catch((error) => {
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to clear saved route.",
          );
        });
    } else {
      setRouteItems([]);
    }
  }

  function handleTogglePlanner() {
    if (plannerOpen) {
      setPlannerOpen(false);
      return;
    }
    setPlannerOpen(true);
    void handlePlanRoute();
  }

  async function generateFlyerForLocation(location: MapLocation) {
    setIsGeneratingFlyer(true);
    setSyncMessage("Building flyer for this spot…");
    try {
      const response = await fetch(`/api/flyers/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dropName: location.name,
          lat: location.lat,
          lng: location.lng,
          authToken: token,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || "Failed to generate flyer");
      }
      setSyncMessage(null);
      window.open(`/flyers/${payload.data.id}`, "_blank", "noopener,noreferrer");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to generate flyer",
      );
    } finally {
      setIsGeneratingFlyer(false);
    }
  }

  const mobileFloatingBottom = "max(88px, calc(env(safe-area-inset-bottom) + 18px))";
  const mobileDetailPanelBottom = `calc(${mobileFloatingBottom} + 64px)`;

  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        minHeight: isMobile ? "100%" : 640,
        overflow: "hidden",
        overscrollBehavior: "none",
        background: "#dbe7dd",
      }}
    >
      <OutreachMapCanvas
        locations={visibleLocations}
        meetups={visibleMeetups}
        printers={layers.printers ? printers : []}
        highlightedRegions={layers.regions ? needRegions : []}
        recommendedLocationIds={recommendedLocationIds}
        selectedLocation={selectedLocation}
        selectedMeetup={selectedMeetup}
        focusRequest={focusRequest}
        onSelect={(locationId) => {
          setSelectedLocationId(locationId);
          setSelectedMeetupId(null);
        }}
        onSelectMeetup={(meetupId) => {
          setSelectedMeetupId(meetupId);
          setSelectedLocationId(null);
        }}
        onMapClick={() => {
          setSelectedLocationId(null);
          setSelectedMeetupId(null);
        }}
        onViewportChange={handleViewportChange}
        routeItemDedupeKeys={routeItemDedupeKeys}
        onTogglePrinterRoute={handleTogglePrinterRoute}
      />

      <div
        style={{
          position: "absolute",
          top: 18,
          left: 18,
          zIndex: 500,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", gap: 10, pointerEvents: "auto" }}>
          <button
            onClick={() => setShowTools((current) => !current)}
            style={toolButtonStyle}
          >
            {showTools ? "Close Tools" : "Map Tools"}
          </button>
        </div>

        {showTools && (
          <div
            style={{
              width: 320,
              maxWidth: "calc(100vw - 36px)",
              borderRadius: 22,
              padding: "16px 16px 14px",
              background: "rgba(255,252,244,0.95)",
              border: "1px solid rgba(11, 11, 10,0.18)",
              backdropFilter: "blur(18px)",
              boxShadow: "none",
              pointerEvents: "auto",
            }}
          >
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11.5, color: "#8A8780", fontWeight: 700, marginBottom: 8 }}>
                Map layers
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  ["recommended", "Recommended"],
                  ["uncovered", "Uncovered"],
                  ["covered", "Covered"],
                  ["printers", "Printers"],
                  ["regions", "Need-gap overlay"],
                  ["meetups", "Meetups"],
                ].map(([key, label]) => {
                  const layerKey = key as keyof LayerVisibility;
                  const active = layers[layerKey];

                  return (
                    <button
                      key={key}
                      onClick={() =>
                        setLayers((current) => ({
                          ...current,
                          [layerKey]: !current[layerKey],
                        }))
                      }
                      style={{
                        padding: "7px 11px",
                        borderRadius: 2,
                        border: `1px solid ${active ? "#D44A12" : "rgba(11, 11, 10,0.18)"}`,
                        background: active ? "#F8F6F0" : "#F8F6F0",
                        color: active ? "#8a5a00" : "#8A8780",
                        fontSize: 11.5,
                        fontWeight: 700,
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 11.5, color: "#8A8780", marginTop: 6 }}>
                Each neighborhood is color-coded by its biggest unmet need (food, shelter, healthcare, etc.). Hover a region for the gap detail.
              </p>
            </div>


            <p style={{ marginTop: 10, fontSize: 11.5, color: "#8A8780", lineHeight: 1.45 }}>
              Use the search bar in the page header to jump to any address,
              neighborhood, or landmark in NYC.
            </p>

            {syncMessage && (
              <p style={{ marginTop: 10, fontSize: 11.5, color: "#6b5a22", background: "#F8F6F0", border: "1px solid rgba(212, 74, 18,0.25)", borderRadius: 2, padding: "10px 12px" }}>
                {syncMessage}
              </p>
            )}

            {errorMessage && (
              <p style={{ marginTop: 10, fontSize: 11.5, color: "#b91c1c", background: "rgba(254,226,226,0.72)", border: "1px solid rgba(239,68,68,0.18)", borderRadius: 2, padding: "10px 12px" }}>
                {errorMessage}
              </p>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          position: "absolute",
          top: 18,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 500,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        {[
          {
            key: "legend",
            content: (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "nowrap",
                  whiteSpace: "nowrap",
                }}
              >
                <LegendItem
                  label="Recommended spot"
                  icon={
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 2,
                        background: "#8A8780",
                        border: "3px solid #eff6ff",
                        boxShadow: "none",
                        display: "inline-block",
                      }}
                    />
                  }
                />
                <LegendItem
                  label="Uncovered spot"
                  icon={
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 2,
                        background: "#D64B14",
                        border: "3px solid #F8F6F0",
                        boxShadow: "none",
                        display: "inline-block",
                      }}
                    />
                  }
                />
                <LegendItem
                  label="Covered spot"
                  icon={
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 2,
                        background: "#D44A12",
                        border: "3px solid #F8F6F0",
                        boxShadow: "none",
                        display: "inline-block",
                      }}
                    />
                  }
                />
                <LegendItem
                  label="Printer"
                  icon={
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 2,
                        background: "#f8fafc",
                        border: "2px solid #8A8780",
                        color: "#1A1917",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#1A1917"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 6 2 18 2 18 9" />
                        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                        <rect x="6" y="14" width="12" height="8" />
                      </svg>
                    </span>
                  }
                />
                <LegendItem
                  label="Higher-need region"
                  icon={
                    <span
                      style={{
                        width: 18,
                        height: 12,
                        borderRadius: 4,
                        background: "rgba(245,158,11,0.12)",
                        border: "2px solid #c2410c",
                        display: "inline-block",
                      }}
                    />
                  }
                />
                <LegendItem
                  label="Meetup"
                  icon={
                    <span
                      className="meetup-marker-ring"
                      style={{
                        width: 18,
                        height: 18,
                        display: "inline-block",
                      }}
                    />
                  }
                />
              </div>
            ),
          },
          {
            key: "status",
            content:
              isSearching
                ? "Finding that area..."
                : viewport.zoom < HOTSPOT_REVEAL_ZOOM
                ? "Zoom in or search to reveal individual hotspots"
                : layeredLocations.length > visibleLocations.length
                ? "Zoom in to reveal more places"
                : layers.printers
                ? "Map shows current hotspots and nearby printers"
                : "Map shows current hotspot set",
          },
        ].map((item) => (
          <div
            key={item.key}
            style={{
              pointerEvents: "auto",
              borderRadius: 2,
              padding: "10px 14px",
              background: "rgba(255,252,244,0.92)",
              boxShadow: "none",
              color: "#6f5e37",
              fontSize: 11.5,
              fontWeight: 700,
              overflowX: item.key === "legend" ? "auto" : "visible",
            }}
          >
            {item.content}
          </div>
        ))}
      </div>

      {selectedMeetup ? (
        <div
          style={{
            position: "absolute",
            right: isMobile ? 12 : 18,
            left: isMobile ? 12 : "auto",
            top: isMobile ? "auto" : "50%",
            bottom: isMobile ? mobileDetailPanelBottom : "auto",
            transform: isMobile ? "none" : "translateY(-50%)",
            width: isMobile ? "auto" : 326,
            maxWidth: isMobile ? "none" : "calc(100vw - 36px)",
            zIndex: 500,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              borderRadius: 22,
              padding: "16px 16px 14px",
              background: "rgba(17,45,29,0.94)",
              border: "1px solid rgba(74,222,128,0.18)",
              color: "#effff3",
              backdropFilter: "blur(18px)",
              boxShadow: "none",
              maxHeight: isMobile ? "min(52dvh, 460px)" : "none",
              overflowY: isMobile ? "auto" : "visible",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(134,239,172,0.78)", marginBottom: 6 }}>
                  Meetup Marker
                </p>
                <h3 style={{ fontSize: 23, lineHeight: 1.08, letterSpacing: 0 }}>
                  {selectedMeetup.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMeetupId(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.08)",
                  color: "#effff3",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                X
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: "rgba(239,255,243,0.72)", lineHeight: 1.5, marginBottom: 12 }}>
              {selectedMeetup.description}
            </p>

            <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
              <p style={{ fontSize: 12, color: "rgba(134,239,172,0.95)" }}>
                {formatDateTimeRange(selectedMeetup.startTime, selectedMeetup.endTime)}
              </p>
              <p style={{ fontSize: 12, color: "rgba(239,255,243,0.78)" }}>
                {selectedMeetup.locationLabel}
              </p>
              <p style={{ fontSize: 12, color: "rgba(239,255,243,0.78)" }}>
                {selectedMeetup.joinedCount} joined
                {selectedMeetup.maxAttendees
                  ? ` of ${selectedMeetup.maxAttendees} spots`
                  : ""}
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                type="button"
                onClick={() => router.push(`/community/meetups/${selectedMeetup.id}`)}
                style={{
                  width: "100%",
                  borderRadius: 15,
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "#effff3",
                  fontSize: 12.5,
                  fontWeight: 800,
                }}
              >
                View details
              </button>
              <button
                type="button"
                disabled={!token || Boolean(isGuest)}
                onClick={() => void handleMeetupJoin(selectedMeetup.id)}
                style={{
                  width: "100%",
                  borderRadius: 15,
                  padding: "12px 14px",
                  background: "#D44A12",
                  color: "#04210e",
                  fontSize: 12.5,
                  fontWeight: 800,
                  opacity: !token || isGuest ? 0.55 : 1,
                }}
              >
                {selectedMeetup.viewerJoined ? "Open meetup chat" : "Join meetup chat"}
              </button>
            </div>

            {!token || isGuest ? (
              <p style={{ marginTop: 10, fontSize: 11.5, color: "rgba(239,255,243,0.68)" }}>
                Sign in with a full account to join meetup chat.
              </p>
            ) : null}
          </div>
        </div>
      ) : selectedLocation ? (
        <div
          style={{
            position: "absolute",
            right: isMobile ? 12 : 18,
            left: isMobile ? 12 : "auto",
            top: isMobile ? "auto" : "50%",
            bottom: isMobile ? mobileDetailPanelBottom : "auto",
            transform: isMobile ? "none" : "translateY(-50%)",
            width: isMobile ? "auto" : 310,
            maxWidth: isMobile ? "none" : "calc(100vw - 36px)",
            zIndex: 500,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              borderRadius: 22,
              padding: "16px 16px 14px",
              background: "rgba(26,22,11,0.92)",
              border: "1px solid rgba(212, 74, 18,0.14)",
              color: "#F8F6F0",
              backdropFilter: "blur(18px)",
              boxShadow: "none",
              maxHeight: isMobile ? "min(56dvh, 520px)" : "none",
              overflowY: isMobile ? "auto" : "visible",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(212, 74, 18,0.56)", marginBottom: 6 }}>
                  Selected Hotspot
                </p>
                <h3 style={{ fontSize: 23, lineHeight: 1.08, letterSpacing: 0 }}>
                  {selectedLocation.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedLocationId(null)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 2,
                  background: "rgba(255,255,255,0.08)",
                  color: "#F8F6F0",
                  fontSize: 16,
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>

            <p style={{ fontSize: 12.5, color: "rgba(255,247,222,0.72)", lineHeight: 1.5, marginBottom: 12 }}>
              {selectedLocation.address}
            </p>

            {selectedLocation.regionName ? (
              <p style={{ fontSize: 12, color: "rgba(212, 74, 18,0.82)", marginBottom: 10 }}>
                {selectedLocation.regionName}
              </p>
            ) : null}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <span style={{ padding: "6px 10px", borderRadius: 2, background: selectedLocation.covered ? "rgba(34,197,94,0.16)" : "rgba(245,158,11,0.16)", color: selectedLocation.covered ? "#86efac" : "#fcd34d", fontSize: 11.5, fontWeight: 700 }}>
                {selectedLocation.covered ? "Covered" : "Needs coverage"}
              </span>
              <span style={{ padding: "6px 10px", borderRadius: 2, background: priorityStyle[selectedLocation.derivedPriority].bg, color: "#F8F6F0", fontSize: 11.5, fontWeight: 700 }}>
                {selectedLocation.derivedPriority} priority
              </span>
            </div>

            <p style={{ fontSize: 12, color: "rgba(255,247,222,0.76)", lineHeight: 1.55, marginBottom: 12 }}>
              {selectedLocation.notes}
            </p>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
              <button
                onClick={() => openGoogleMapsLocation(selectedLocation)}
                style={{
                  width: "100%",
                  borderRadius: 15,
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "#F8F6F0",
                  fontSize: 12.5,
                  fontWeight: 800,
                  boxShadow: "none",
                }}
              >
                Get directions
              </button>
              <button
                onClick={() =>
                  selectedLocationRouteItem
                    ? void handleRemoveSelectedRouteItem()
                    : void handleAddHotspotToRoute(selectedLocation)
                }
                style={{
                  width: "100%",
                  borderRadius: 15,
                  padding: "12px 14px",
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "#F8F6F0",
                  fontSize: 12.5,
                  fontWeight: 800,
                  boxShadow: "none",
                }}
              >
                {selectedLocationRouteItem ? "Remove from route" : "Add to route"}
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 }}>
              <button
                onClick={() =>
                  selectedLocation.covered
                    ? void toggleCovered(selectedLocation.id, selectedLocation.covered)
                    : openCoverageProofFlow()
                }
                style={{
                  width: "100%",
                  borderRadius: 15,
                  padding: "12px 14px",
                  background: selectedLocation.covered
                    ? "#D44A12"
                    : "#D44A12",
                  color: selectedLocation.covered ? "#effff3" : "#0B0B0A",
                  fontSize: 12.5,
                  fontWeight: 800,
                  boxShadow: selectedLocation.covered
                    ? "0 10px 22px rgba(34,197,94,0.22)"
                    : "0 10px 22px rgba(212, 74, 18,0.22)",
                }}
              >
                {selectedLocation.covered ? "Mark as uncovered" : "Mark hotspot as covered"}
              </button>

              {!selectedLocation.covered && (!token || isGuest) ? (
                <p style={{ margin: 0, fontSize: 11.5, color: "rgba(255,247,222,0.68)", lineHeight: 1.5 }}>
                  Sign in with a full account to upload a proof photo and verify coverage.
                </p>
              ) : null}

              <button
                onClick={() => void generateFlyerForLocation(selectedLocation)}
                disabled={isGeneratingFlyer}
                style={{
                  width: "100%",
                  borderRadius: 15,
                  padding: "12px 14px",
                  background: isGeneratingFlyer ? "rgba(255,255,255,0.08)" : "#0B0B0A",
                  border: "1px solid rgba(255,255,255,0.18)",
                  color: "#F8F6F0",
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: isGeneratingFlyer ? "wait" : "pointer",
                  opacity: isGeneratingFlyer ? 0.7 : 1,
                }}
              >
                {isGeneratingFlyer ? "Building flyer…" : "Generate flyer for this spot"}
              </button>
              <p style={{ margin: "4px 2px 0", fontSize: 11, color: "rgba(255,247,222,0.55)", lineHeight: 1.4 }}>
                AI picks the most-needed cause for this area and the 4 closest matching resources.
              </p>
            </div>

          </div>
        </div>
      ) : null}

      <CoverageProofModal
        hotspot={selectedLocation}
        isOpen={isCoverageProofModalOpen}
        isSubmitting={isSubmittingCoverageProof}
        onClose={() => setIsCoverageProofModalOpen(false)}
        onSubmit={handleCoverageProofSubmit}
      />

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: isMobile ? mobileFloatingBottom : 18,
          transform: "translateX(-50%)",
          zIndex: 500,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          onClick={handleTogglePlanner}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 2,
            padding: isMobile ? "12px 18px" : "13px 18px",
            background: plannerOpen ? "#FFFFFF" : "#D44A12",
            color: plannerOpen ? "#D44A12" : "#FFFFFF",
            border: `1px solid ${plannerOpen ? "#D44A12" : "rgba(212, 74, 18,0.24)"}`,
            fontSize: isMobile ? 12 : 12.5,
            fontWeight: 800,
            lineHeight: 1.1,
            cursor: "pointer",
            minHeight: isMobile ? 50 : "auto",
          }}
        >
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.18em",
              padding: "2px 5px",
              background: plannerOpen ? "#D44A12" : "#FFFFFF",
              color: plannerOpen ? "#FFFFFF" : "#D44A12",
              borderRadius: 2,
              fontWeight: 800,
            }}
          >
            AI
          </span>
          {plannerOpen ? "Close planner" : "Plan my route"}
        </button>
      </div>

      {plannerOpen ? (
        <div
          style={{
            position: "absolute",
            left: 18,
            bottom: isMobile ? `calc(${mobileFloatingBottom} + 76px)` : 88,
            zIndex: 600,
            width: isMobile ? "calc(100vw - 36px)" : 360,
            maxHeight: "calc(100vh - 180px)",
            overflowY: "auto",
            background: "rgba(255,252,244,0.98)",
            borderRadius: 4,
            border: "1.5px solid #D44A12",
            padding: 16,
            boxShadow: "0 18px 48px rgba(11,11,10,0.18)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontFamily: "Fraunces, Georgia, serif", fontSize: 18, color: "#1A1917" }}>
              <span style={{ fontSize: 10, color: "#D44A12", letterSpacing: "0.18em", fontWeight: 800, marginRight: 8 }}>AI</span>
              Plan my route
            </h3>
            <button
              type="button"
              onClick={() => setPlannerOpen(false)}
              style={{ background: "transparent", border: "none", color: "#8A8780", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          {plannerLoading && !plannerResult && (
            <p style={{ margin: 0, fontSize: 12, color: "#3A3833", lineHeight: 1.45 }}>
              Planning the best ordering…
            </p>
          )}

          {plannerError && (
            <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#b91c1c", lineHeight: 1.45 }}>
              {plannerError}
            </p>
          )}

          {plannerResult && (
            <div style={{ display: "grid", gap: 8 }}>
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 4,
                  background:
                    plannerResult.strategy === "ai_hybrid" && !plannerResult.fallbackUsed
                      ? "rgba(212, 74, 18, 0.08)"
                      : "#F8F6F0",
                  border: `1px solid ${
                    plannerResult.strategy === "ai_hybrid" && !plannerResult.fallbackUsed
                      ? "rgba(212, 74, 18, 0.4)"
                      : "rgba(11,11,10,0.18)"
                  }`,
                }}
              >
                <div style={{ fontSize: 10.5, fontWeight: 800, color: "#D44A12", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                  {plannerResult.strategy === "ai_hybrid" && !plannerResult.fallbackUsed
                    ? "AI plan"
                    : "Rule-based plan"}
                  {plannerResult.fallbackUsed ? " · fallback" : ""}
                </div>
                <div style={{ fontSize: 12, color: "#1A1917", marginTop: 4, lineHeight: 1.45 }}>
                  {plannerResult.explanations.join(" ")}
                </div>
                <div style={{ fontSize: 11, color: "#8A8780", marginTop: 4 }}>
                  {plannerResult.orderedStops.length} stops · ~
                  {plannerResult.estimatedDurationMinutes} min · ~
                  {(plannerResult.estimatedDistanceMeters / 1609.344).toFixed(2)} mi
                </div>
                {plannerResult.fallbackReason && (
                  <div style={{ fontSize: 10.5, color: "#b91c1c", marginTop: 4 }}>
                    Fallback: {plannerResult.fallbackReason}
                  </div>
                )}
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                {plannerResult.orderedStops.map((stop) => (
                  <div
                    key={stop.id}
                    style={{
                      display: "flex",
                      gap: 10,
                      padding: "8px 10px",
                      borderRadius: 4,
                      background: "#FFFFFF",
                      border: "1px solid rgba(11,11,10,0.12)",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        background: "#D44A12",
                        color: "#FFFFFF",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 11,
                        flexShrink: 0,
                      }}
                    >
                      {stop.sequence}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1A1917" }}>
                        {stop.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#8A8780", marginTop: 2 }}>
                        {stop.category}
                        {stop.regionName ? ` · ${stop.regionName}` : ""}
                        {stop.covered ? " · covered" : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "#3A3833", marginTop: 4, lineHeight: 1.4 }}>
                        {stop.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                disabled={plannerResult.orderedStops.length === 0}
                onClick={handleOpenPlannedRouteInGoogleMaps}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 2,
                  background: "#1A73E8",
                  color: "#FFFFFF",
                  border: "1px solid rgba(26,115,232,0.4)",
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: plannerResult.orderedStops.length === 0 ? "not-allowed" : "pointer",
                  opacity: plannerResult.orderedStops.length === 0 ? 0.55 : 1,
                  marginTop: 4,
                }}
              >
                Open route in Google Maps
              </button>
            </div>
          )}
        </div>
      ) : null}

      {(isLoading || errorMessage || isLoadingPrinters || printerErrorMessage || isLoadingRouteItems) && (
        <div
          style={{
            position: "absolute",
            left: 18,
            bottom: isMobile ? mobileFloatingBottom : 18,
            zIndex: 500,
            pointerEvents: "none",
          }}
        >
          {isLoading && (
            <div style={statusChipStyle}>Loading stored hotspots...</div>
          )}
          {!isLoading && isLoadingRouteItems && (
            <div style={{ ...statusChipStyle, marginTop: 8 }}>Loading saved route...</div>
          )}
          {!isLoading && isLoadingPrinters && (
            <div style={{ ...statusChipStyle, marginTop: 8 }}>Loading nearby printers...</div>
          )}
          {!isLoading && errorMessage && (
            <div style={{ ...statusChipStyle, color: "#b91c1c", background: "rgba(255,245,245,0.94)" }}>
              {errorMessage}
            </div>
          )}
          {!isLoading && printerErrorMessage && (
            <div
              style={{
                ...statusChipStyle,
                marginTop: 8,
                color: "#b91c1c",
                background: "rgba(255,245,245,0.94)",
              }}
            >
              {printerErrorMessage}
            </div>
          )}
        </div>
      )}

    </div>
  );
}

const toolButtonStyle: React.CSSProperties = {
  borderRadius: 2,
  padding: "10px 14px",
  background: "rgba(255,252,244,0.95)",
  border: "1px solid rgba(11, 11, 10,0.18)",
  boxShadow: "none",
  color: "#1A1917",
  fontSize: 12,
  fontWeight: 800,
  backdropFilter: "blur(18px)",
};

const statusChipStyle: React.CSSProperties = {
  borderRadius: 2,
  padding: "10px 14px",
  background: "rgba(255,252,244,0.94)",
  boxShadow: "none",
  color: "#6f5e37",
  fontSize: 11.5,
  fontWeight: 700,
};

function getHotspotRouteDedupeKey(location: Pick<MapLocation, "id">) {
  return `hotspot:${location.id}`;
}

function getPrinterRouteDedupeKey(printer: Pick<MapPrinter, "id">) {
  return `printer:${printer.id}`;
}

function upsertRouteItemInList(current: SavedRouteItem[], next: SavedRouteItem) {
  const existingIndex = current.findIndex((item) => item.id === next.id);

  if (existingIndex === -1) {
    return [...current, next];
  }

  return current.map((item) => (item.id === next.id ? next : item));
}

function getVisibleLocations(
  locations: RankedLocation[],
  viewport: MapViewportState,
  highlightedRegionCodes: Set<string>,
) {
  const bounds = viewport.bounds;
  const inBounds = bounds
    ? locations.filter((location) => isLocationInBounds(location, bounds))
    : locations;

  const sorted = [...inBounds].sort((a, b) => {
    if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore;
    return a.distanceMiles - b.distanceMiles;
  });
  const highNeedLocations = sorted.filter((location) =>
    isHighlightedRegionLocation(location, highlightedRegionCodes),
  );

  if (viewport.zoom < 11) {
    return mergeVisibleLocations(highNeedLocations, sorted.slice(0, 220));
  }

  if (viewport.zoom < 13) {
    return mergeVisibleLocations(highNeedLocations, sorted.slice(0, 420));
  }

  if (viewport.zoom < HOTSPOT_REVEAL_ZOOM) {
    return mergeVisibleLocations(highNeedLocations, sorted.slice(0, 700));
  }

  if (viewport.zoom < 16) {
    return mergeVisibleLocations(highNeedLocations, sorted.slice(0, 320));
  }

  return sorted;
}

function areBoundsEqual(current: MapBounds | null, next: MapBounds | null) {
  if (current === next) return true;
  if (!current || !next) return current === next;

  return (
    current.north === next.north &&
    current.south === next.south &&
    current.east === next.east &&
    current.west === next.west
  );
}

function areCentersEqual(
  current: MapViewportState["center"],
  next: MapViewportState["center"],
) {
  if (current === next) return true;
  if (!current || !next) return current === next;

  return current.lat === next.lat && current.lng === next.lng;
}

function getVisibleMeetups(meetups: MeetupSummary[], viewport: MapViewportState) {
  if (!viewport.bounds) {
    return meetups;
  }

  return meetups.filter((meetup) =>
    meetup.lat <= viewport.bounds!.north &&
    meetup.lat >= viewport.bounds!.south &&
    meetup.lng <= viewport.bounds!.east &&
    meetup.lng >= viewport.bounds!.west,
  );
}

function getHighlightedRegions(
  regions: MapNeedRegion[],
  regionLocationCounts: Map<string, number>,
  zoom: number,
  foodInsecurityCutoff: number,
  minimumRegionSpots: number,
) {
  if (regions.length === 0) return [];

  const sorted = [...regions].sort(
    (a, b) =>
      (b.foodInsecurePercentage ?? -1) - (a.foodInsecurePercentage ?? -1) ||
      b.foodNeedScore - a.foodNeedScore,
  );
  const denseRegions = sorted.filter(
    (region) => (regionLocationCounts.get(region.regionCode) ?? 0) >= minimumRegionSpots,
  );
  const preferredRegions = denseRegions.filter(
    (region) => (region.foodInsecurePercentage ?? 0) >= foodInsecurityCutoff,
  );
  const fallbackRegions = denseRegions.filter(
    (region) => (region.foodInsecurePercentage ?? 0) < foodInsecurityCutoff,
  );
  const targetCount = zoom < 11 ? 8 : zoom < 12 ? 12 : 18;

  return [...preferredRegions, ...fallbackRegions].slice(0, targetCount);
}

function getLayeredLocations(
  locations: RankedLocation[],
  recommendedLocations: RankedLocation[],
  layers: LayerVisibility,
) {
  const merged = new Map<string, RankedLocation>();

  if (layers.recommended) {
    for (const location of recommendedLocations) {
      merged.set(location.id, location);
    }
  }

  if (layers.uncovered) {
    for (const location of locations) {
      if (!location.covered) {
        merged.set(location.id, location);
      }
    }
  }

  if (layers.covered) {
    for (const location of locations) {
      if (location.covered) {
        merged.set(location.id, location);
      }
    }
  }

  return Array.from(merged.values());
}

function mergeVisibleLocations(
  priorityLocations: RankedLocation[],
  sampledLocations: RankedLocation[],
) {
  const merged = new Map<string, RankedLocation>();

  for (const location of priorityLocations) {
    merged.set(location.id, location);
  }

  for (const location of sampledLocations) {
    if (!merged.has(location.id)) {
      merged.set(location.id, location);
    }
  }

  return Array.from(merged.values());
}

function isHighlightedRegionLocation(
  location: DistanceLocation | RankedLocation,
  highlightedRegionCodes: Set<string>,
) {
  return Boolean(location.regionCode && highlightedRegionCodes.has(location.regionCode));
}

function isRecommendedLocation(
  location: RankedLocation,
  highlightedRegionCodes: Set<string>,
) {
  return (
    !location.covered &&
    location.derivedPriority === "High" &&
    location.priorityScore >= 11.5 &&
    (
      isHighlightedRegionLocation(location, highlightedRegionCodes) ||
      location.suitabilityScore >= 3 ||
      location.distanceMiles <= 1.5
    )
  );
}

function getRegionLocationCounts(locations: DistanceLocation[]) {
  const counts = new Map<string, number>();

  for (const location of locations) {
    if (!location.regionCode) continue;
    counts.set(location.regionCode, (counts.get(location.regionCode) ?? 0) + 1);
  }

  return counts;
}

function rankLocations(
  locations: DistanceLocation[],
  highlightedRegionCodes: Set<string>,
  regionLocationCounts: Map<string, number>,
) {
  return locations
    .map((location) => {
      const needComponent = getNeedComponent(location, highlightedRegionCodes);
      const coverageComponent = location.covered ? -2.5 : 3.8;
      const suitabilityScore = getSuitabilityScore(location.category);
      const distanceComponent = getDistanceComponent(location.distanceMiles);
      const gapBonus = getOutreachGapBonus(location, highlightedRegionCodes, regionLocationCounts);
      const priorityScore = Number(
        (
          needComponent +
          coverageComponent +
          suitabilityScore +
          distanceComponent +
          gapBonus
        ).toFixed(2),
      );

      return {
        ...location,
        needComponent,
        coverageComponent,
        suitabilityScore,
        distanceComponent,
        gapBonus,
        priorityScore,
        derivedPriority: getDerivedPriority(priorityScore),
      } satisfies RankedLocation;
    })
    .sort((a, b) => {
      if (a.priorityScore !== b.priorityScore) return b.priorityScore - a.priorityScore;
      return a.distanceMiles - b.distanceMiles;
    });
}

function getNeedComponent(
  location: DistanceLocation,
  highlightedRegionCodes: Set<string>,
) {
  const regionNeedScore = location.regionNeedScore ?? 0;

  if (isHighlightedRegionLocation(location, highlightedRegionCodes)) {
    return clamp(regionNeedScore * 0.8, 2.4, 7.8);
  }

  if (regionNeedScore > 0) {
    return clamp(regionNeedScore * 0.35, 0.8, 3.1);
  }

  return 1.1;
}

function getSuitabilityScore(category: string) {
  const suitabilityByCategory: Record<string, number> = {
    Library: 3.8,
    Bookstore: 3.5,
    "Copy Shop": 3.4,
    Laundry: 3.2,
    "Community Center": 3.1,
    "Coffee Shop": 2.9,
    Marketplace: 2.6,
    Pharmacy: 2.5,
    Restaurant: 2.2,
    Supermarket: 2.2,
    Bakery: 2.0,
    Greengrocer: 2.0,
    School: 1.9,
    College: 1.9,
    "Convenience Store": 1.8,
    "Fast Food": 1.6,
    "Post Office": 1.5,
    "Variety Store": 1.4,
    "Department Store": 1.4,
    "Place of Worship": 1.2,
  };

  return suitabilityByCategory[category] ?? 1.4;
}

function getDistanceComponent(distanceMiles: number) {
  if (distanceMiles <= 0.3) return 3.6;
  if (distanceMiles <= 0.75) return 3.0;
  if (distanceMiles <= 1.5) return 2.4;
  if (distanceMiles <= 3) return 1.5;
  if (distanceMiles <= 5) return 0.8;
  return 0.2;
}

function getOutreachGapBonus(
  location: DistanceLocation,
  highlightedRegionCodes: Set<string>,
  regionLocationCounts: Map<string, number>,
) {
  if (!isHighlightedRegionLocation(location, highlightedRegionCodes) || !location.regionCode) {
    return 0;
  }

  const spotCount = regionLocationCounts.get(location.regionCode) ?? 0;

  if (spotCount <= 4) return 3;
  if (spotCount <= 8) return 2.1;
  if (spotCount <= 14) return 1.1;
  return 0.25;
}

function getDerivedPriority(score: number): "High" | "Medium" | "Low" {
  if (score >= 11.5) return "High";
  if (score >= 7) return "Medium";
  return "Low";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isLocationInBounds(location: DistanceLocation, bounds: MapBounds) {
  return (
    location.lat <= bounds.north &&
    location.lat >= bounds.south &&
    location.lng <= bounds.east &&
    location.lng >= bounds.west
  );
}

function getDistanceMiles(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
}

function getSearchZoom(query: string) {
  const normalized = query.trim().toLowerCase();

  if (/\d/.test(normalized)) return 16;
  if (normalized.includes("street") || normalized.includes("ave") || normalized.includes("avenue")) {
    return 16;
  }

  return 15;
}

function LegendItem({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      {icon}
      <span>{label}</span>
    </span>
  );
}
