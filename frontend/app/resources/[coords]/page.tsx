import {
  SERVICE_TYPE_COLORS,
  SERVICE_TYPE_LABELS,
  type ServiceResource,
  type ServiceType,
} from "@/lib/service-resources";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5001";

const TYPE_ORDER: ServiceType[] = [
  "food",
  "shelter",
  "healthcare",
  "mental_health",
  "substance_use",
  "youth",
  "senior",
];

function parseCoords(coords: string): { lat: number; lng: number } | null {
  const decoded = decodeURIComponent(coords);
  const parts = decoded.split(",").map((part) => parseFloat(part.trim()));
  if (parts.length !== 2 || !parts.every(Number.isFinite)) return null;
  const [lat, lng] = parts;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function fetchResources(coords: { lat: number; lng: number }) {
  const params = new URLSearchParams({
    near: `${coords.lat},${coords.lng}`,
    radius: "3",
    limit: "300",
  });
  const url = `${API_BASE_URL}/api/service-resources?${params}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const payload = await res.json();
    if (!payload.success) return [];
    return (payload.data || []) as ServiceResource[];
  } catch {
    return [];
  }
}

export default async function ResourcesPage({
  params,
}: {
  params: Promise<{ coords: string }>;
}) {
  const { coords: coordsParam } = await params;
  const coords = parseCoords(coordsParam);

  if (!coords) {
    return (
      <main style={pageStyle}>
        <h1 style={titleStyle}>Invalid coordinates</h1>
        <p style={bodyTextStyle}>
          The QR link is malformed. Please ask the volunteer for an updated card.
        </p>
      </main>
    );
  }

  const resources = await fetchResources(coords);

  const byType = new Map<ServiceType, (ServiceResource & { distance: number })[]>();
  for (const resource of resources) {
    const type = resource.serviceType as ServiceType;
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push({
      ...resource,
      distance: distanceMiles(coords, { lat: resource.lat, lng: resource.lng }),
    });
  }
  for (const list of byType.values()) {
    list.sort((a, b) => a.distance - b.distance);
  }

  return (
    <main style={pageStyle}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={titleStyle}>Resources near you</h1>
        <p style={bodyTextStyle}>
          Free and low-cost services within 3 miles of {coords.lat.toFixed(4)},{" "}
          {coords.lng.toFixed(4)}.
        </p>
      </header>

      {resources.length === 0 && (
        <div style={emptyStateStyle}>
          <p>No resources are loaded for this area yet. Check back soon.</p>
        </div>
      )}

      {TYPE_ORDER.map((type) => {
        const list = byType.get(type);
        if (!list || list.length === 0) return null;
        const color = SERVICE_TYPE_COLORS[type];
        return (
          <section key={type} style={{ marginBottom: 28 }}>
            <h2 style={{ ...sectionTitleStyle, color }}>
              <span style={{ ...sectionDotStyle, background: color }} />
              {SERVICE_TYPE_LABELS[type]}
              <span style={countStyle}>{list.length}</span>
            </h2>
            <div style={{ display: "grid", gap: 10 }}>
              {list.slice(0, 8).map((resource) => (
                <ResourceCard key={resource.id} resource={resource} color={color} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

function ResourceCard({
  resource,
  color,
}: {
  resource: ServiceResource & { distance: number };
  color: string;
}) {
  return (
    <article style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: 0 }}>
          {resource.name}
        </h3>
        <span style={{ fontSize: 12, color: "#8A8780", whiteSpace: "nowrap" }}>
          {resource.distance.toFixed(1)} mi
        </span>
      </div>
      {resource.description && (
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b5a22" }}>
          {resource.description}
        </p>
      )}
      {resource.address && (
        <p style={{ margin: "6px 0 0", fontSize: 13 }}>{resource.address}</p>
      )}
      {(resource.phone || resource.hours) && (
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b5a22" }}>
          {resource.phone}
          {resource.phone && resource.hours ? " · " : ""}
          {resource.hours}
        </p>
      )}
      {resource.website && (
        <p style={{ margin: "8px 0 0" }}>
          <a
            href={
              resource.website.startsWith("http")
                ? resource.website
                : `https://${resource.website}`
            }
            target="_blank"
            rel="noreferrer"
            style={{ color, fontSize: 13, fontWeight: 700 }}
          >
            Visit website
          </a>
        </p>
      )}
    </article>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "32px 20px 64px",
  fontFamily: "DM Sans, system-ui, sans-serif",
  color: "#1A1917",
  background: "#F8F6F0",
  minHeight: "100vh",
};

const titleStyle: React.CSSProperties = {
  fontFamily: "Fraunces, serif",
  fontSize: 32,
  fontWeight: 600,
  margin: 0,
};

const bodyTextStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 14,
  color: "#6b5a22",
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "Fraunces, serif",
  fontSize: 22,
  fontWeight: 600,
  margin: "0 0 12px",
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const sectionDotStyle: React.CSSProperties = {
  display: "inline-block",
  width: 10,
  height: 10,
  borderRadius: "50%",
};

const countStyle: React.CSSProperties = {
  marginLeft: 6,
  fontSize: 12,
  color: "#8A8780",
  fontWeight: 500,
};

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF",
  borderRadius: 4,
  padding: "14px 16px",
  border: "1px solid rgba(11,11,10,0.08)",
};

const emptyStateStyle: React.CSSProperties = {
  padding: 24,
  background: "#FFFFFF",
  borderRadius: 4,
  textAlign: "center",
  color: "#8A8780",
};
