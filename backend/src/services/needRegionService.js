const { getPool, query } = require("../db");

const FOOD_NEED_DATASET_URL =
  "https://data.cityofnewyork.us/resource/4kc9-zrs2.json?%24limit=1000&%24order=year%20DESC%2C%20weighted_score%20DESC";
const NTA_BOUNDARY_DATASET_URL =
  "https://data.cityofnewyork.us/resource/9nt8-h7nd.json?%24limit=1000";

const UPSERT_REGION_SQL = `
  INSERT INTO need_regions (
    region_code,
    region_name,
    borough_name,
    region_type,
    geometry_json,
    centroid_lat,
    centroid_lng,
    food_insecure_percentage,
    food_need_score,
    weighted_rank,
    source_year,
    updated_at
  ) VALUES (
    $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12::timestamptz
  )
  ON CONFLICT(region_code) DO UPDATE SET
    region_name = EXCLUDED.region_name,
    borough_name = EXCLUDED.borough_name,
    region_type = EXCLUDED.region_type,
    geometry_json = EXCLUDED.geometry_json,
    centroid_lat = EXCLUDED.centroid_lat,
    centroid_lng = EXCLUDED.centroid_lng,
    food_insecure_percentage = EXCLUDED.food_insecure_percentage,
    food_need_score = EXCLUDED.food_need_score,
    weighted_rank = EXCLUDED.weighted_rank,
    source_year = EXCLUDED.source_year,
    updated_at = EXCLUDED.updated_at
`;

async function getStoredNeedRegions() {
  const result = await query(`
    SELECT *
    FROM need_regions
    ORDER BY food_insecure_percentage DESC NULLS LAST, food_need_score DESC, region_name ASC
  `);

  return result.rows.map(normalizeRegionRow);
}

async function importNeedRegionsFromNycOpenData() {
  const [scoreRows, boundaryRows] = await Promise.all([
    fetchJson(FOOD_NEED_DATASET_URL),
    fetchJson(NTA_BOUNDARY_DATASET_URL),
  ]);

  const latestYear = scoreRows.reduce((latest, row) => {
    const year = Number(row.year);
    return Number.isFinite(year) && year > latest ? year : latest;
  }, 0);

  const latestScores = scoreRows.filter((row) => Number(row.year) === latestYear);
  const scoreByRegion = new Map(
    latestScores.map((row) => [
      row.nta,
      {
        regionCode: row.nta,
        regionName: row.nta_name,
        foodInsecurePercentage: Number(row.food_insecure_percentage),
        foodNeedScore: Number(row.weighted_score),
        weightedRank: Number(row.rank),
        sourceYear: row.year,
      },
    ]),
  );

  const joinedRegions = boundaryRows
    .map((row) => {
      const scoreRow = scoreByRegion.get(row.nta2020);
      if (!scoreRow || !row.the_geom) return null;

      const centroid = calculateGeometryCentroid(row.the_geom);
      if (!centroid) return null;

      return {
        regionCode: scoreRow.regionCode,
        regionName: scoreRow.regionName || row.ntaname,
        boroughName: row.boroname || "",
        regionType: row.cdtaname || row.ntatype || "",
        geometryJson: JSON.stringify(row.the_geom),
        centroidLat: centroid.lat,
        centroidLng: centroid.lng,
        foodInsecurePercentage: scoreRow.foodInsecurePercentage,
        foodNeedScore: scoreRow.foodNeedScore,
        weightedRank: scoreRow.weightedRank,
        sourceYear: scoreRow.sourceYear,
        updatedAt: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    for (const region of joinedRegions) {
      await client.query(UPSERT_REGION_SQL, [
        region.regionCode,
        region.regionName,
        region.boroughName,
        region.regionType,
        region.geometryJson,
        region.centroidLat,
        region.centroidLng,
        region.foodInsecurePercentage,
        region.foodNeedScore,
        region.weightedRank,
        region.sourceYear,
        region.updatedAt,
      ]);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const annotationSummary = await annotateStoredHotspotsWithNeedRegions();

  return {
    importedCount: joinedRegions.length,
    sourceCount: latestScores.length,
    sourceYear: String(latestYear),
    annotatedHotspotCount: annotationSummary.annotatedCount,
  };
}

async function annotateStoredHotspotsWithNeedRegions() {
  const regions = await getStoredNeedRegions();
  const hotspotResult = await query(`
    SELECT id, lat, lng
    FROM hotspot_locations
  `);
  let annotatedCount = 0;
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    for (const row of hotspotResult.rows) {
      const assignment = findNeedRegionForPointInRegions(row.lat, row.lng, regions);

      await client.query(
        `
          UPDATE hotspot_locations
          SET
            region_code = $1,
            region_name = $2,
            region_need_score = $3
          WHERE id = $4
        `,
        [
          assignment?.regionCode || null,
          assignment?.regionName || null,
          assignment?.foodNeedScore ?? null,
          row.id,
        ],
      );

      if (assignment) annotatedCount += 1;
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return { annotatedCount };
}

async function findNeedRegionForPoint(lat, lng, cachedRegions) {
  const regions = cachedRegions || (await getStoredNeedRegions());
  return findNeedRegionForPointInRegions(lat, lng, regions);
}

function findNeedRegionForPointInRegions(lat, lng, regions) {
  for (const region of regions) {
    if (pointInGeometry({ lat, lng }, region.geometry)) {
      return region;
    }
  }

  return null;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to fetch NYC Open Data: ${response.status} ${body}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeRegionRow(row) {
  return {
    id: String(row.id),
    regionCode: row.region_code,
    regionName: row.region_name,
    boroughName: row.borough_name || "",
    regionType: row.region_type || "",
    geometry:
      typeof row.geometry_json === "string"
        ? JSON.parse(row.geometry_json)
        : row.geometry_json,
    centroidLat: Number(row.centroid_lat),
    centroidLng: Number(row.centroid_lng),
    foodInsecurePercentage:
      row.food_insecure_percentage === null ? null : Number(row.food_insecure_percentage),
    foodNeedScore: Number(row.food_need_score),
    weightedRank: row.weighted_rank === null ? null : Number(row.weighted_rank),
    sourceYear: row.source_year,
  };
}

function calculateGeometryCentroid(geometry) {
  const points = flattenGeometryPoints(geometry);
  if (points.length === 0) return null;

  const totals = points.reduce(
    (accumulator, [lng, lat]) => ({
      lat: accumulator.lat + lat,
      lng: accumulator.lng + lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: totals.lat / points.length,
    lng: totals.lng / points.length,
  };
}

function pointInGeometry(point, geometry) {
  if (!geometry) return false;

  if (geometry.type === "Polygon") {
    return pointInPolygonRings(point, geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.some((polygon) => pointInPolygonRings(point, polygon));
  }

  return false;
}

function pointInPolygonRings(point, polygonRings) {
  if (!Array.isArray(polygonRings) || polygonRings.length === 0) return false;

  const [outerRing, ...holes] = polygonRings;
  if (!pointInRing(point, outerRing)) return false;

  return !holes.some((ring) => pointInRing(point, ring));
}

function pointInRing(point, ring) {
  let inside = false;

  for (
    let currentIndex = 0, previousIndex = ring.length - 1;
    currentIndex < ring.length;
    previousIndex = currentIndex++
  ) {
    const [x1, y1] = ring[currentIndex];
    const [x2, y2] = ring[previousIndex];
    const intersects =
      y1 > point.lat !== y2 > point.lat &&
      point.lng <
        ((x2 - x1) * (point.lat - y1)) / ((y2 - y1) || Number.EPSILON) + x1;

    if (intersects) inside = !inside;
  }

  return inside;
}

function flattenGeometryPoints(geometry) {
  if (geometry.type === "Polygon") {
    return geometry.coordinates.flat();
  }

  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.flat(2);
  }

  return [];
}

module.exports = {
  annotateStoredHotspotsWithNeedRegions,
  findNeedRegionForPoint,
  findNeedRegionForPointInRegions,
  getStoredNeedRegions,
  importNeedRegionsFromNycOpenData,
};
