const crypto = require("crypto");
const { query } = require("../db");
const {
  getStoredNeedRegions,
  findNeedRegionForPointInRegions,
} = require("./needRegionService");

const SERVICE_TYPE_LABELS = {
  food: "Food",
  shelter: "Shelter",
  healthcare: "Healthcare",
  substance_use: "Recovery",
  mental_health: "Mental Health",
  youth: "Youth services",
  senior: "Senior services",
};

const CONTEXT_RADIUS_MILES = 5;
const CANDIDATE_COUNT = 4;
const NYC_LAT_MILES = 69;

const TRUSTED_FREE_DATASETS = new Set([
  "nyc-open-data:drop-in-centers",
  "nyc-open-data:health-systems",
  "nyc-open-data:flu-vaccinations",
  "nyc-open-data:dfta-providers",
  "nyc-open-data:dycd-program-sites",
  "osm:shelter",
  "osm:food",
]);

async function getFlyerContext({ lat, lng }) {
  const regions = await getStoredNeedRegions();
  const region = findNeedRegionForPointInRegions(lat, lng, regions);

  const resources = await fetchNearbyResources({ lat, lng, radiusMiles: CONTEXT_RADIUS_MILES });
  const grouped = groupAndRankResources(resources, { lat, lng });

  const candidates = Array.from(grouped.entries())
    .filter(([, list]) => list.length >= CANDIDATE_COUNT)
    .map(([category, list]) => {
      const top = list.slice(0, CANDIDATE_COUNT);
      const avgDistance = top.reduce((sum, r) => sum + r.distance, 0) / top.length;
      return {
        category,
        label: SERVICE_TYPE_LABELS[category] || category,
        averageDistanceMiles: Number(avgDistance.toFixed(2)),
        resources: top,
      };
    });

  candidates.sort((a, b) => b.averageDistanceMiles - a.averageDistanceMiles);

  let dominant = candidates[0] || null;
  if (!dominant) {
    const fallbackCategory = pickFallbackCategory(grouped);
    if (fallbackCategory) {
      const list = grouped.get(fallbackCategory) || [];
      dominant = {
        category: fallbackCategory,
        label: SERVICE_TYPE_LABELS[fallbackCategory] || fallbackCategory,
        averageDistanceMiles:
          list.length > 0
            ? Number(
                (
                  list.slice(0, CANDIDATE_COUNT).reduce((sum, r) => sum + r.distance, 0) /
                  Math.min(list.length, CANDIDATE_COUNT)
                ).toFixed(2),
              )
            : 0,
        resources: list.slice(0, CANDIDATE_COUNT),
      };
    }
  }

  return {
    region: region
      ? {
          regionCode: region.regionCode,
          regionName: region.regionName,
          boroughName: region.boroughName,
          compositeNeedScore: region.compositeNeedScore,
          foodNeedScore: region.foodNeedScore,
          foodInsecurePercentage: region.foodInsecurePercentage,
        }
      : null,
    dominant,
    candidates,
  };
}

async function saveFlyer({
  userId,
  dropName,
  lat,
  lng,
  regionCode,
  regionName,
  dominantCategory,
  headline,
  blurb,
  resources,
  qrSlug,
  qrTargetUrl,
}) {
  const id = crypto.randomBytes(8).toString("hex");

  await query(
    `INSERT INTO generated_flyers (
       id, user_id, drop_name, drop_lat, drop_lng, region_code, region_name,
       dominant_category, headline, blurb, resources_json, qr_slug, qr_target_url
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13
     )`,
    [
      id,
      userId || null,
      dropName,
      lat,
      lng,
      regionCode || null,
      regionName || null,
      dominantCategory,
      headline,
      blurb,
      JSON.stringify(resources || []),
      qrSlug || null,
      qrTargetUrl || null,
    ],
  );

  return getFlyerById(id);
}

async function getFlyerById(id) {
  const result = await query(
    `SELECT * FROM generated_flyers WHERE id = $1`,
    [id],
  );
  if (result.rows.length === 0) return null;
  return normalizeFlyerRow(result.rows[0]);
}

async function fetchNearbyResources({ lat, lng, radiusMiles }) {
  const radiusDeg = radiusMiles / NYC_LAT_MILES;
  const trustedSources = Array.from(TRUSTED_FREE_DATASETS);
  const result = await query(
    `SELECT id, source_key, source_dataset, service_type, name, description, address,
            borough, zip, lat, lng, phone, hours, website, eligibility,
            region_code, region_need_score
     FROM service_resources
     WHERE lat BETWEEN ($1::float8 - $3::float8) AND ($1::float8 + $3::float8)
       AND lng BETWEEN ($2::float8 - $3::float8) AND ($2::float8 + $3::float8)
       AND source_dataset = ANY($4::text[])
       AND address IS NOT NULL
       AND LENGTH(address) >= 10
       AND address ~ '\\d'`,
    [lat, lng, radiusDeg, trustedSources],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    serviceType: row.service_type,
    name: row.name,
    description: row.description || "",
    address: row.address || "",
    borough: row.borough || "",
    zip: row.zip || "",
    lat: Number(row.lat),
    lng: Number(row.lng),
    phone: row.phone || "",
    hours: row.hours || "",
    website: row.website || "",
    eligibility: row.eligibility || "",
  }));
}

function groupAndRankResources(resources, origin) {
  const grouped = new Map();
  for (const resource of resources) {
    const distance = haversineMiles(origin, { lat: resource.lat, lng: resource.lng });
    const enriched = { ...resource, distance: Number(distance.toFixed(2)) };
    if (!grouped.has(resource.serviceType)) grouped.set(resource.serviceType, []);
    grouped.get(resource.serviceType).push(enriched);
  }
  for (const list of grouped.values()) {
    list.sort((a, b) => a.distance - b.distance);
  }
  return grouped;
}

function pickFallbackCategory(grouped) {
  let best = null;
  let bestSize = 0;
  for (const [category, list] of grouped.entries()) {
    if (list.length > bestSize) {
      best = category;
      bestSize = list.length;
    }
  }
  return best;
}

function haversineMiles(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
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

function normalizeFlyerRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    dropName: row.drop_name,
    dropLat: Number(row.drop_lat),
    dropLng: Number(row.drop_lng),
    regionCode: row.region_code,
    regionName: row.region_name,
    dominantCategory: row.dominant_category,
    dominantCategoryLabel:
      SERVICE_TYPE_LABELS[row.dominant_category] || row.dominant_category,
    headline: row.headline,
    blurb: row.blurb,
    resources:
      typeof row.resources_json === "string"
        ? JSON.parse(row.resources_json)
        : row.resources_json,
    qrSlug: row.qr_slug,
    qrTargetUrl: row.qr_target_url,
    createdAt: row.created_at,
  };
}

module.exports = {
  SERVICE_TYPE_LABELS,
  getFlyerContext,
  saveFlyer,
  getFlyerById,
};
