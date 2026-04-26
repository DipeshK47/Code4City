const { query } = require("../db");
const { SERVICE_TYPE_LABELS } = require("./flyerService");

const TRUSTED_FREE_DATASETS = [
  "nyc-open-data:drop-in-centers",
  "nyc-open-data:health-systems",
  "nyc-open-data:flu-vaccinations",
  "nyc-open-data:dfta-providers",
  "nyc-open-data:dycd-program-sites",
  "osm:shelter",
  "osm:food",
];

const RADIUS_MILES = 5;
const TOP_N = 4;
const NYC_LAT_MILES = 69;
const CACHE_TTL_MS = 30 * 60 * 1000;

let cachedInsights = null;
let cachedAt = 0;

async function getRegionInsightsByCode({ force = false } = {}) {
  if (!force && cachedInsights && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedInsights;
  }

  const [regionsResult, resourcesResult] = await Promise.all([
    query(
      `SELECT region_code, region_name, centroid_lat, centroid_lng
       FROM need_regions`,
    ),
    query(
      `SELECT service_type, lat, lng
       FROM service_resources
       WHERE source_dataset = ANY($1::text[])
         AND address IS NOT NULL
         AND LENGTH(address) >= 10
         AND address ~ '\\d'`,
      [TRUSTED_FREE_DATASETS],
    ),
  ]);

  const resources = resourcesResult.rows.map((row) => ({
    serviceType: row.service_type,
    lat: Number(row.lat),
    lng: Number(row.lng),
  }));

  const radiusDeg = RADIUS_MILES / NYC_LAT_MILES;
  const insights = new Map();

  for (const region of regionsResult.rows) {
    const centroid = {
      lat: Number(region.centroid_lat),
      lng: Number(region.centroid_lng),
    };

    const byCategory = new Map();
    for (const resource of resources) {
      if (
        Math.abs(resource.lat - centroid.lat) > radiusDeg ||
        Math.abs(resource.lng - centroid.lng) > radiusDeg
      ) {
        continue;
      }
      const distance = haversineMiles(centroid, resource);
      if (distance > RADIUS_MILES) continue;
      if (!byCategory.has(resource.serviceType)) {
        byCategory.set(resource.serviceType, []);
      }
      byCategory.get(resource.serviceType).push(distance);
    }

    const candidates = [];
    for (const [category, distances] of byCategory.entries()) {
      if (distances.length < TOP_N) continue;
      distances.sort((a, b) => a - b);
      const avg = distances.slice(0, TOP_N).reduce((sum, d) => sum + d, 0) / TOP_N;
      candidates.push({
        category,
        label: SERVICE_TYPE_LABELS[category] || category,
        avgDistanceMiles: Number(avg.toFixed(2)),
        nearbyCount: distances.length,
      });
    }

    candidates.sort((a, b) => b.avgDistanceMiles - a.avgDistanceMiles);

    insights.set(region.region_code, {
      dominantGap: candidates[0] || null,
      categoryGaps: candidates,
    });
  }

  cachedInsights = insights;
  cachedAt = Date.now();
  return insights;
}

function invalidateInsightsCache() {
  cachedInsights = null;
  cachedAt = 0;
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

module.exports = {
  getRegionInsightsByCode,
  invalidateInsightsCache,
};
