const { getPool, query } = require("../db");
const {
  findNeedRegionForPointInRegions,
  getStoredNeedRegions,
} = require("./needRegionService");

const OVERPASS_ENDPOINTS = (
  process.env.OVERPASS_ENDPOINTS ||
  process.env.OVERPASS_ENDPOINT ||
  [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
  ].join(",")
)
  .split(",")
  .map((endpoint) => endpoint.trim())
  .filter(Boolean);

const OSM_TAG_FILTERS = [
  { key: "amenity", value: "cafe", category: "Coffee Shop" },
  { key: "amenity", value: "restaurant", category: "Restaurant" },
  { key: "amenity", value: "fast_food", category: "Fast Food" },
  { key: "amenity", value: "library", category: "Library" },
  { key: "amenity", value: "community_centre", category: "Community Center" },
  { key: "amenity", value: "marketplace", category: "Marketplace" },
  { key: "amenity", value: "place_of_worship", category: "Place of Worship" },
  { key: "amenity", value: "pharmacy", category: "Pharmacy" },
  { key: "amenity", value: "school", category: "School" },
  { key: "amenity", value: "college", category: "College" },
  { key: "amenity", value: "post_office", category: "Post Office" },
  { key: "shop", value: "books", category: "Bookstore" },
  { key: "shop", value: "copyshop", category: "Copy Shop" },
  { key: "shop", value: "laundry", category: "Laundry" },
  { key: "shop", value: "bakery", category: "Bakery" },
  { key: "shop", value: "convenience", category: "Convenience Store" },
  { key: "shop", value: "supermarket", category: "Supermarket" },
  { key: "shop", value: "greengrocer", category: "Greengrocer" },
  { key: "shop", value: "variety_store", category: "Variety Store" },
  { key: "shop", value: "department_store", category: "Department Store" },
];

const CATEGORY_SCORES = {
  Library: 9.5,
  Bookstore: 8.8,
  "Copy Shop": 8.6,
  Laundry: 8.3,
  "Community Center": 8.1,
  "Coffee Shop": 7.8,
  Marketplace: 7.2,
  Restaurant: 6.8,
  Pharmacy: 6.8,
  College: 6.8,
  Supermarket: 6.7,
  Greengrocer: 6.6,
  School: 6.5,
  "Post Office": 6.4,
  Bakery: 6.2,
  "Fast Food": 6.0,
  "Department Store": 5.9,
  "Convenience Store": 5.8,
  "Variety Store": 5.8,
  "Place of Worship": 5.4,
  "Custom Proof": 6.4,
};

const UPSERT_HOTSPOT_SQL = `
  INSERT INTO hotspot_locations (
    source_key,
    osm_id,
    osm_type,
    name,
    category,
    address,
    neighborhood,
    region_code,
    region_name,
    region_need_score,
    priority,
    score,
    covered,
    last_checked,
    assigned_to,
    notes,
    lat,
    lng,
    tags_json,
    imported_at,
    updated_at
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    $11, $12, FALSE, 'Imported from OSM', 'Open shift',
    $13, $14, $15, $16::jsonb, $17::timestamptz, $18::timestamptz
  )
  ON CONFLICT(source_key) DO UPDATE SET
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    address = EXCLUDED.address,
    neighborhood = EXCLUDED.neighborhood,
    region_code = EXCLUDED.region_code,
    region_name = EXCLUDED.region_name,
    region_need_score = EXCLUDED.region_need_score,
    priority = EXCLUDED.priority,
    score = EXCLUDED.score,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    tags_json = EXCLUDED.tags_json,
    imported_at = EXCLUDED.imported_at,
    updated_at = EXCLUDED.updated_at
`;

async function importHotspotsFromOsm({ lat, lng, radiusMiles }) {
  const radiusMeters = Math.round(radiusMiles * 1609.34);
  const queryText = buildOverpassQuery({ lat, lng, radiusMeters });
  const payload = await fetchOverpassPayload(queryText);
  const importedAt = new Date().toISOString();
  const regions = await getStoredNeedRegions();
  const candidates = (payload.elements || [])
    .map((element) => mapOsmElementToHotspot(element, importedAt, regions))
    .filter(Boolean);
  const hotspots = dedupeHotspots(candidates);
  let importedCount = 0;
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    for (const hotspot of hotspots) {
      await client.query(UPSERT_HOTSPOT_SQL, [
        hotspot.sourceKey,
        hotspot.osmId,
        hotspot.osmType,
        hotspot.name,
        hotspot.category,
        hotspot.address,
        hotspot.neighborhood,
        hotspot.regionCode,
        hotspot.regionName,
        hotspot.regionNeedScore,
        hotspot.priority,
        hotspot.score,
        hotspot.notes,
        hotspot.lat,
        hotspot.lng,
        hotspot.tagsJson,
        hotspot.importedAt,
        hotspot.updatedAt,
      ]);
      importedCount += 1;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return {
    importedCount,
    sourceCount: candidates.length,
    importedAt,
  };
}

async function getStoredHotspots({ lat, lng, radiusMiles, limit = 5000 }) {
  const result = await query(`
    SELECT *
    FROM hotspot_locations
    ORDER BY score DESC, imported_at DESC, name ASC
  `);

  const allRows = dedupeHotspots(
    result.rows
      .map(normalizeRow)
      .filter((row) => Boolean(row) && Boolean(CATEGORY_SCORES[row.category])),
    0.08,
  );

  if (Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radiusMiles)) {
    return allRows
      .map((row) => ({
        ...row,
        distanceMiles: getDistanceMiles(lat, lng, row.lat, row.lng),
      }))
      .filter((row) => row.distanceMiles <= radiusMiles)
      .sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        return a.distanceMiles - b.distanceMiles;
      })
      .slice(0, limit)
      .map(({ distanceMiles, ...row }) => row);
  }

  return allRows.slice(0, limit);
}

async function updateHotspotStatus(id, updates) {
  const existingResult = await query(
    `
      SELECT *
      FROM hotspot_locations
      WHERE id = $1
    `,
    [id],
  );
  const existing = existingResult.rows[0];
  if (!existing) return null;

  const nextCovered =
    typeof updates.covered === "boolean" ? updates.covered : Boolean(existing.covered);
  const now = new Date().toISOString();

  await query(
    `
      UPDATE hotspot_locations
      SET
        covered = $1,
        last_checked = $2,
        assigned_to = $3,
        notes = $4,
        updated_at = $5::timestamptz
      WHERE id = $6
    `,
    [
      nextCovered,
      updates.lastChecked || "Just now",
      updates.assignedTo || (nextCovered ? "Volunteer confirmed" : "Open shift"),
      typeof updates.notes === "string" ? updates.notes : existing.notes,
      now,
      id,
    ],
  );

  const updatedResult = await query(
    `
      SELECT *
      FROM hotspot_locations
      WHERE id = $1
    `,
    [id],
  );

  return normalizeRow(updatedResult.rows[0]);
}

async function getHotspotById(id) {
  const result = await query(
    `
      SELECT *
      FROM hotspot_locations
      WHERE id = $1
    `,
    [id],
  );

  return normalizeRow(result.rows[0]);
}

function buildOverpassQuery({ lat, lng, radiusMeters }) {
  const filters = OSM_TAG_FILTERS.map(
    ({ key, value }) =>
      `  nwr(around:${radiusMeters},${lat},${lng})["${key}"="${value}"]["name"];`,
  ).join("\n");

  return `
[out:json][timeout:25];
(
${filters}
);
out center tags;
  `.trim();
}

async function fetchOverpassPayload(queryText) {
  const failures = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: queryText,
        signal: controller.signal,
      });

      if (!response.ok) {
        const details = await response.text();
        throw new Error(`Overpass request failed: ${response.status} ${details}`);
      }

      return await response.json();
    } catch (error) {
      failures.push(`${endpoint}: ${error.message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`All Overpass endpoints failed. ${failures.join(" | ")}`);
}

function normalizeRow(row) {
  if (!row) return null;

  return {
    id: String(row.id),
    sourceKey: row.source_key,
    osmId: row.osm_id,
    osmType: row.osm_type,
    name: row.name,
    category: row.category,
    address: row.address || "Address not available in OSM",
    neighborhood: row.neighborhood || "Area not tagged",
    regionCode: row.region_code || null,
    regionName: row.region_name || null,
    regionNeedScore: row.region_need_score === null ? null : Number(row.region_need_score),
    priority: row.priority,
    score: Number(row.score || 0),
    covered: Boolean(row.covered),
    lastChecked: row.last_checked,
    assignedTo: row.assigned_to,
    notes: row.notes,
    lat: Number(row.lat),
    lng: Number(row.lng),
    importedAt:
      row.imported_at instanceof Date ? row.imported_at.toISOString() : row.imported_at,
  };
}

function mapOsmElementToHotspot(element, importedAt, needRegions) {
  const tags = element.tags || {};
  const coordinates = getCoordinates(element);
  const category = mapCategory(tags);
  const name = getName(tags);

  if (!coordinates || !category || !name) return null;
  const neighborhood =
    tags["addr:suburb"] ||
    tags["addr:neighbourhood"] ||
    tags["addr:city"] ||
    tags["is_in:neighbourhood"] ||
    tags["is_in:city"] ||
    "";
  const address = buildAddress(tags);
  const needRegion = findNeedRegionForPointInRegions(
    coordinates.lat,
    coordinates.lng,
    needRegions,
  );
  const score = calculateHotspotScore({
    category,
    tags,
    address,
    neighborhood,
    regionNeedScore: needRegion?.foodNeedScore ?? null,
  });

  return {
    sourceKey: `${element.type}:${element.id}`,
    osmId: String(element.id),
    osmType: element.type,
    name,
    category,
    address,
    neighborhood,
    regionCode: needRegion?.regionCode || null,
    regionName: needRegion?.regionName || null,
    regionNeedScore: needRegion?.foodNeedScore ?? null,
    priority: inferPriority(score),
    score,
    notes: inferNotes(tags, category, score),
    lat: coordinates.lat,
    lng: coordinates.lng,
    tagsJson: JSON.stringify(tags),
    importedAt,
    updatedAt: importedAt,
  };
}

function mapCategory(tags) {
  return (
    OSM_TAG_FILTERS.find(({ key, value }) => tags[key] === value)?.category ||
    null
  );
}

function getName(tags) {
  if (typeof tags.name !== "string") return null;
  const name = tags.name.trim();
  return name.length > 0 ? name : null;
}

function calculateHotspotScore({ category, tags, address, neighborhood, regionNeedScore }) {
  let score = CATEGORY_SCORES[category] || 5;

  if (address) score += 1.2;
  if (tags.opening_hours) score += 0.8;
  if (tags.website || tags["contact:website"] || tags.url) score += 0.6;
  if (tags.phone || tags["contact:phone"]) score += 0.2;
  if (tags["contact:instagram"] || tags["contact:facebook"]) score += 0.15;
  if (tags.internet_access) score += 0.25;
  if (neighborhood) score += 0.2;
  if (Number.isFinite(regionNeedScore)) score += Math.min(regionNeedScore * 0.18, 1.5);

  return Number(score.toFixed(2));
}

function inferPriority(score) {
  if (score >= 8.7) return "High";
  if (score >= 6.3) return "Medium";
  return "Low";
}

function inferNotes(tags, category, score) {
  const metadata = [];
  if (tags.opening_hours) metadata.push("hours listed");
  if (tags.website || tags["contact:website"] || tags.url) metadata.push("web presence");
  if (tags.phone || tags["contact:phone"]) metadata.push("phone listed");

  const metadataSummary =
    metadata.length > 0 ? ` Metadata: ${metadata.join(", ")}.` : "";

  return `Imported from OSM ${category.toLowerCase()} data. Score ${score.toFixed(1)} favors named places with stronger metadata and higher outreach value.${metadataSummary}`;
}

function dedupeHotspots(hotspots, thresholdMiles = 0.06) {
  const sorted = [...hotspots].sort((a, b) => {
    if ((a.score || 0) !== (b.score || 0)) return (b.score || 0) - (a.score || 0);
    const aAddress = a.address ? 1 : 0;
    const bAddress = b.address ? 1 : 0;
    if (aAddress !== bAddress) return bAddress - aAddress;
    return a.name.localeCompare(b.name);
  });

  const kept = [];

  for (const candidate of sorted) {
    const nearbyBetterSpot = kept.find((existing) =>
      isDuplicateHotspot(existing, candidate, thresholdMiles),
    );

    if (!nearbyBetterSpot) {
      kept.push(candidate);
    }
  }

  return kept;
}

function isDuplicateHotspot(existing, candidate, thresholdMiles) {
  const distanceMiles = getDistanceMiles(
    existing.lat,
    existing.lng,
    candidate.lat,
    candidate.lng,
  );
  const normalizedExistingName = normalizeName(existing.name);
  const normalizedCandidateName = normalizeName(candidate.name);
  const sameName = normalizedExistingName === normalizedCandidateName;
  const sameCategory = existing.category === candidate.category;
  const duplicateThreshold = sameName ? Math.max(thresholdMiles, 0.12) : thresholdMiles;

  return distanceMiles <= duplicateThreshold && (sameName || sameCategory);
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function buildAddress(tags) {
  if (tags["addr:full"]) return tags["addr:full"].trim();

  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:city"],
    tags["addr:state"],
    tags["addr:postcode"],
  ]
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter(Boolean);

  return parts.join(" ").trim();
}

function getCoordinates(element) {
  if (typeof element.lat === "number" && typeof element.lon === "number") {
    return { lat: element.lat, lng: element.lon };
  }

  if (
    element.center &&
    typeof element.center.lat === "number" &&
    typeof element.center.lon === "number"
  ) {
    return { lat: element.center.lat, lng: element.center.lon };
  }

  return null;
}

function getDistanceMiles(fromLat, fromLng, toLat, toLng) {
  const toRadians = (value) => (value * Math.PI) / 180;
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

module.exports = {
  getHotspotById,
  importHotspotsFromOsm,
  getStoredHotspots,
  normalizeRow,
  updateHotspotStatus,
};
