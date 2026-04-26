import { NextRequest, NextResponse } from "next/server";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

type PlacesResult = {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  currentOpeningHours?: { openNow: boolean };
  rating?: number;
  priceLevel?: string;
  businessStatus?: string;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng are required" }, { status: 400 });
  }

  const latitude = Number.parseFloat(lat);
  const longitude = Number.parseFloat(lng);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json({ error: "lat and lng must be valid numbers" }, { status: 400 });
  }

  if (GOOGLE_MAPS_API_KEY) {
    const googleResponse = await fetchFromGoogle(latitude, longitude);
    if (googleResponse) {
      return NextResponse.json({ results: googleResponse });
    }
  }

  const fallbackResponse = await fetchFromOverpass(latitude, longitude);
  if (fallbackResponse) {
    return NextResponse.json({ results: fallbackResponse });
  }

  return NextResponse.json(
    { error: "Failed to fetch printers from both Google Places and Overpass." },
    { status: 500 },
  );
}

async function fetchFromGoogle(lat: number, lng: number): Promise<PlacesResult[] | null> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY!,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.currentOpeningHours.openNow",
          "places.rating",
          "places.priceLevel",
          "places.businessStatus",
        ].join(","),
      },
      body: JSON.stringify({
        textQuery: "print shop copy shop Staples FedEx Office UPS Store Office Depot",
        locationBias: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: 10000,
          },
        },
        maxResultCount: 20,
      }),
      cache: "no-store",
    });

    const data = await safeJson(res);
    if (!res.ok) {
      console.error("Google Places printer lookup failed:", data);
      return null;
    }

    return (data?.places ?? []) as PlacesResult[];
  } catch (error) {
    console.error("Google Places printer lookup crashed:", error);
    return null;
  }
}

async function fetchFromOverpass(lat: number, lng: number): Promise<PlacesResult[] | null> {
  const query = `
    [out:json][timeout:25];
    (
      node["shop"~"copyshop|printer|stationery"](around:10000,${lat},${lng});
      way["shop"~"copyshop|printer|stationery"](around:10000,${lat},${lng});
      node["office"="printing"](around:10000,${lat},${lng});
      way["office"="printing"](around:10000,${lat},${lng});
      node["brand"~"Staples|FedEx|UPS|Office Depot|OfficeMax",i](around:10000,${lat},${lng});
      way["brand"~"Staples|FedEx|UPS|Office Depot|OfficeMax",i](around:10000,${lat},${lng});
      node["name"~"Staples|FedEx|UPS|Office Depot|OfficeMax|print|copy",i](around:10000,${lat},${lng});
      way["name"~"Staples|FedEx|UPS|Office Depot|OfficeMax|print|copy",i](around:10000,${lat},${lng});
    );
    out center tags;
  `;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=UTF-8",
      },
      body: query,
      cache: "no-store",
    });

    const data = await safeJson(res);
    if (!res.ok) {
      console.error("Overpass printer lookup failed:", data);
      return null;
    }

    return (data?.elements ?? [])
      .map((element: {
        id: number;
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        tags?: Record<string, string>;
      }) => {
        const elementLat = element.lat ?? element.center?.lat;
        const elementLng = element.lon ?? element.center?.lon;

        if (typeof elementLat !== "number" || typeof elementLng !== "number") {
          return null;
        }

        const tags = element.tags ?? {};
        const addressParts = [
          tags["addr:housenumber"],
          tags["addr:street"],
          tags["addr:city"],
          tags["addr:state"],
        ].filter(Boolean);

        return {
          id: `osm-${element.id}`,
          displayName: {
            text: tags.name ?? tags.brand ?? "Nearby printer",
          },
          formattedAddress: addressParts.join(" ").trim() || "Address not listed",
          location: {
            latitude: elementLat,
            longitude: elementLng,
          },
          currentOpeningHours: undefined,
          rating: undefined,
          priceLevel: undefined,
          businessStatus: "OPERATIONAL",
        } satisfies PlacesResult;
      })
      .filter(Boolean) as PlacesResult[];
  } catch (error) {
    console.error("Overpass printer lookup crashed:", error);
    return null;
  }
}

async function safeJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
