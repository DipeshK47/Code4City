export function getPrinterMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const radiusMiles = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return radiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getPrinterEmoji(name: string): string {
  const normalizedName = name.toLowerCase();

  if (normalizedName.includes("fedex") || normalizedName.includes("kinkos")) return "📮";
  if (normalizedName.includes("ups")) return "📦";
  if (normalizedName.includes("staples")) return "🖊️";
  if (normalizedName.includes("library")) return "📚";
  if (normalizedName.includes("office depot") || normalizedName.includes("officemax")) return "🗂️";

  return "🖨️";
}

export const CHAIN_PRICES: { match: RegExp; bw: string; color: string }[] = [
  { match: /staples/i, bw: "$0.09/page B&W", color: "$0.49/page Color" },
  { match: /fedex|kinkos/i, bw: "$0.12/page B&W", color: "$0.55/page Color" },
  { match: /ups\s*store/i, bw: "$0.14/page B&W", color: "$0.79/page Color" },
  { match: /office\s*depot|officemax/i, bw: "$0.09/page B&W", color: "$0.45/page Color" },
];

export const PRICE_LEVEL_LABEL: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  PRICE_LEVEL_FREE: { label: "Free", color: "#15803d", bg: "#dcfce7" },
  PRICE_LEVEL_INEXPENSIVE: { label: "$", color: "#15803d", bg: "#dcfce7" },
  PRICE_LEVEL_MODERATE: { label: "$$", color: "#92400e", bg: "rgba(245,200,66,0.18)" },
  PRICE_LEVEL_EXPENSIVE: { label: "$$$", color: "#9a3412", bg: "#ffedd5" },
  PRICE_LEVEL_VERY_EXPENSIVE: { label: "$$$$", color: "#7f1d1d", bg: "#fee2e2" },
};

export interface Printer {
  id: string;
  name: string;
  address: string;
  distance: number;
  hours: string;
  lat: number;
  lng: number;
  tags: string[];
  priceLevel?: string;
}

interface PlacesResult {
  id: string;
  displayName: { text: string };
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  currentOpeningHours?: { openNow: boolean };
  rating?: number;
  priceLevel?: string;
  businessStatus?: string;
}

export async function fetchPrinters(lat: number, lng: number): Promise<Printer[]> {
  const response = await fetch(`/api/printers?lat=${lat}&lng=${lng}`);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? "Failed to fetch printers");
  }

  return (data.results as PlacesResult[])
    .filter((place) => place.businessStatus !== "CLOSED_PERMANENTLY")
    .map((place) => {
      const printerLat = place.location.latitude;
      const printerLng = place.location.longitude;
      const openNow = place.currentOpeningHours?.openNow;
      const tags: string[] = [];

      if (openNow === true) tags.push("Open Now");
      if (place.rating) tags.push(`⭐ ${place.rating}`);

      return {
        id: place.id,
        name: place.displayName.text,
        address: place.formattedAddress,
        distance: getPrinterMiles(lat, lng, printerLat, printerLng),
        hours: openNow != null ? (openNow ? "Open Now" : "Closed Now") : "Hours not listed",
        lat: printerLat,
        lng: printerLng,
        tags,
        priceLevel: place.priceLevel,
      } satisfies Printer;
    })
    .sort((a, b) => a.distance - b.distance);
}
