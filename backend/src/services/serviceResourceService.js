const { getPool, query } = require("../db");
const {
  findNeedRegionForPointInRegions,
  getStoredNeedRegions,
} = require("./needRegionService");

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const NYC_BOUNDING_BOX = {
  south: 40.4774,
  west: -74.2591,
  north: 40.9176,
  east: -73.7004,
};

const SERVICE_TYPES = [
  "food",
  "shelter",
  "healthcare",
  "substance_use",
  "mental_health",
  "youth",
  "senior",
];

const NYC_OPEN_DATASETS = [
  {
    serviceType: "shelter",
    sourceDataset: "nyc-open-data:drop-in-centers",
    url: "https://data.cityofnewyork.us/resource/bmxf-3rd4.json?$limit=5000",
    mapRow: (row) => ({
      sourceKey: `drop-in-centers:${row.center_name}-${row.address}`,
      name: row.center_name,
      description: "Drop-in center for homeless individuals",
      address: row.address || "",
      borough: row.borough || "",
      zip: row.postcode || "",
      lat: parseFloat(row.latitude),
      lng: parseFloat(row.longitude),
      phone: "",
      hours: row.comments || "",
      website: "",
      eligibility: "Homeless individuals",
      tags: row,
    }),
  },
  {
    serviceType: "healthcare",
    sourceDataset: "nyc-open-data:health-systems",
    url: "https://data.cityofnewyork.us/resource/gfej-by6h.json?$limit=5000",
    mapRow: (row) => ({
      sourceKey: `health-systems:${row.health_center}-${row.street_address}`,
      name: row.health_center,
      description: "DOHMH Health Center - insurance enrollment & SNAP assistance",
      address: row.street_address || "",
      borough: row.borough || "",
      zip: row.zip_code || "",
      lat: parseFloat(row.latitude),
      lng: parseFloat(row.longitude),
      phone: row.telephone_number || "",
      hours: [row.days_of_operation, row.hours_of_operation].filter(Boolean).join(" · "),
      website: row.website || "",
      eligibility: row.accept_walk_ins || "",
      tags: row,
    }),
  },
  {
    serviceType: "healthcare",
    sourceDataset: "nyc-open-data:flu-vaccinations",
    url: "https://data.cityofnewyork.us/resource/w9ei-idxz.json?$limit=5000",
    mapRow: (row) => ({
      sourceKey: `flu-vaccinations:${row.objectid || `${row.facility_name}-${row.address}`}`,
      name: row.facility_name,
      description: row.service_type || "Vaccination site",
      address: row.address || "",
      borough: row.borough || "",
      zip: row.zip_code || "",
      lat: parseFloat(row.latitude),
      lng: parseFloat(row.longitude),
      phone: row.phone || "",
      hours: row.more_information || "",
      website: typeof row.website === "object" ? row.website?.url || "" : row.website || "",
      eligibility: row.walk_in === "Yes" ? "Walk-ins accepted" : "",
      tags: row,
    }),
  },
  {
    serviceType: "senior",
    sourceDataset: "nyc-open-data:dfta-providers",
    url: "https://data.cityofnewyork.us/resource/cqc8-am9x.json?$limit=5000",
    mapRow: (row) => ({
      sourceKey: `dfta:${row.dfta_id || `${row.programname}-${row.programaddress}`}`,
      name: row.programname,
      description: row.providertype || "",
      address: row.programaddress || "",
      borough: row.borough || "",
      zip: row.programzipcode || "",
      lat: parseFloat(row.latitude),
      lng: parseFloat(row.longitude),
      phone: row.programphone || "",
      hours: composeDftaHours(row),
      website: "",
      eligibility: "Older adults (60+)",
      tags: row,
    }),
  },
  {
    serviceType: "youth",
    sourceDataset: "nyc-open-data:dycd-program-sites",
    url: "https://data.cityofnewyork.us/resource/ebkm-iyma.json?$limit=5000",
    mapRow: (row) => ({
      sourceKey: `dycd:${row.contract || ""}-${row.program_site_name || row.provider}-${row.street_address || ""}`,
      name: row.program_site_name || row.provider,
      description: [row.program_type, row.service_category].filter(Boolean).join(" · "),
      address: row.street_address || "",
      borough: row.borough || "",
      zip: row.zipcode || "",
      lat: parseFloat(row.latitude),
      lng: parseFloat(row.longitude),
      phone: "",
      hours: "",
      website: "",
      eligibility: row.age_range || "Youth",
      tags: row,
    }),
  },
];

function composeDftaHours(row) {
  const days = [
    ["Mon", row.monhouropen, row.monhourclose],
    ["Tue", row.tuehouropen, row.tuehourclose],
    ["Wed", row.wedhouropen, row.wedhourclose],
    ["Thu", row.thuhouropen, row.thuhourclose],
    ["Fri", row.frihouropen, row.frihourclose],
  ];
  const open = days.filter(([, o, c]) => o && c && o !== "00:00");
  if (open.length === 0) return "";
  if (open.length === 5) {
    const first = open[0];
    if (open.every(([, o, c]) => o === first[1] && c === first[2])) {
      return `Mon-Fri ${first[1]}-${first[2]}`;
    }
  }
  return open.map(([d, o, c]) => `${d} ${o}-${c}`).join(", ");
}

const OSM_RESOURCE_QUERIES = [
  {
    serviceType: "healthcare",
    description: "Clinics, hospitals, and doctors offices",
    overpassFilters: [
      'node["amenity"="clinic"]',
      'node["amenity"="hospital"]',
      'node["amenity"="doctors"]',
      'node["healthcare"="clinic"]',
      'node["healthcare"="centre"]',
      'node["healthcare"="hospital"]',
    ],
  },
  {
    serviceType: "shelter",
    description: "Homeless shelters and drop-in centers",
    overpassFilters: [
      'node["amenity"="shelter"]',
      'node["social_facility"="shelter"]',
      'node["social_facility:for"="homeless"]',
      'node["amenity"="social_facility"]["social_facility"="shelter"]',
    ],
  },
  {
    serviceType: "food",
    description: "Soup kitchens and food banks",
    overpassFilters: [
      'node["social_facility"="food_bank"]',
      'node["amenity"="social_facility"]["social_facility"="food_bank"]',
      'node["social_facility:for"="food"]',
    ],
  },
  {
    serviceType: "substance_use",
    description: "Substance abuse treatment centers",
    overpassFilters: [
      'node["healthcare:speciality"="addiction"]',
      'node["amenity"="social_facility"]["social_facility:for"="drug_addicted"]',
    ],
  },
  {
    serviceType: "mental_health",
    description: "Mental health clinics",
    overpassFilters: [
      'node["healthcare"="psychotherapist"]',
      'node["healthcare:speciality"="psychiatry"]',
      'node["amenity"="social_facility"]["social_facility:for"="mental_health"]',
    ],
  },
  {
    serviceType: "youth",
    description: "Youth services and centers",
    overpassFilters: [
      'node["amenity"="social_facility"]["social_facility:for"="juvenile"]',
      'node["amenity"="social_facility"]["social_facility:for"="child"]',
    ],
  },
  {
    serviceType: "senior",
    description: "Senior centers and services",
    overpassFilters: [
      'node["amenity"="social_facility"]["social_facility"="group_home"]["social_facility:for"="senior"]',
      'node["amenity"="social_facility"]["social_facility:for"="senior"]',
      'node["social_facility:for"="senior"]',
    ],
  },
];

const UPSERT_RESOURCE_SQL = `
  INSERT INTO service_resources (
    source_key, source_dataset, service_type, name, description, address,
    borough, zip, lat, lng, phone, hours, website, eligibility, tags_json, updated_at
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, NOW()
  )
  ON CONFLICT (source_key) DO UPDATE SET
    source_dataset = EXCLUDED.source_dataset,
    service_type = EXCLUDED.service_type,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    address = EXCLUDED.address,
    borough = EXCLUDED.borough,
    zip = EXCLUDED.zip,
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    phone = EXCLUDED.phone,
    hours = EXCLUDED.hours,
    website = EXCLUDED.website,
    eligibility = EXCLUDED.eligibility,
    tags_json = EXCLUDED.tags_json,
    updated_at = NOW()
`;

async function importNycOpenDataResources() {
  const datasetReports = [];

  for (const config of NYC_OPEN_DATASETS) {
    try {
      const rows = await fetchJson(config.url);
      const resources = rows
        .map((row) => {
          try {
            return config.mapRow(row);
          } catch {
            return null;
          }
        })
        .filter((resource) => isValidResource(resource))
        .map((resource) => ({
          ...resource,
          serviceType: config.serviceType,
          sourceDataset: config.sourceDataset,
        }));

      const upserted = await upsertResources(resources);
      datasetReports.push({
        sourceDataset: config.sourceDataset,
        serviceType: config.serviceType,
        fetched: rows.length,
        imported: upserted,
      });
    } catch (error) {
      datasetReports.push({
        sourceDataset: config.sourceDataset,
        serviceType: config.serviceType,
        fetched: 0,
        imported: 0,
        error: error.message,
      });
    }
  }

  return datasetReports;
}

async function importOsmResources() {
  const reports = [];

  for (const config of OSM_RESOURCE_QUERIES) {
    try {
      const elements = await fetchOverpassElements(config.overpassFilters);
      const resources = elements
        .map((element) => mapOsmElement(element, config.serviceType))
        .filter((resource) => isValidResource(resource));

      const upserted = await upsertResources(resources);
      reports.push({
        sourceDataset: `osm:${config.serviceType}`,
        serviceType: config.serviceType,
        fetched: elements.length,
        imported: upserted,
      });
    } catch (error) {
      reports.push({
        sourceDataset: `osm:${config.serviceType}`,
        serviceType: config.serviceType,
        fetched: 0,
        imported: 0,
        error: error.message,
      });
    }
  }

  return reports;
}

async function importAllServiceResources() {
  const nycResults = await importNycOpenDataResources();
  const osmResults = await importOsmResources();
  const annotationSummary = await annotateServiceResourcesWithRegions();

  const totals = [...nycResults, ...osmResults].reduce(
    (acc, report) => {
      acc.fetched += report.fetched;
      acc.imported += report.imported;
      if (report.error) acc.failedDatasets.push(report.sourceDataset);
      return acc;
    },
    { fetched: 0, imported: 0, failedDatasets: [] },
  );

  return {
    ...totals,
    annotatedCount: annotationSummary.annotatedCount,
    perDataset: [...nycResults, ...osmResults],
  };
}

async function getServiceResources({ serviceType, near, radiusMiles = 5, limit = 500 } = {}) {
  const params = [];
  const where = [];

  if (serviceType) {
    if (Array.isArray(serviceType)) {
      params.push(serviceType);
      where.push(`service_type = ANY($${params.length}::text[])`);
    } else {
      params.push(serviceType);
      where.push(`service_type = $${params.length}`);
    }
  }

  let orderClause = "ORDER BY name ASC";
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    params.push(near.lat);
    const latIdx = params.length;
    params.push(near.lng);
    const lngIdx = params.length;
    params.push(radiusMiles / 69);
    const radIdx = params.length;
    where.push(
      `(lat BETWEEN $${latIdx} - $${radIdx} AND $${latIdx} + $${radIdx})`,
    );
    where.push(
      `(lng BETWEEN $${lngIdx} - $${radIdx} AND $${lngIdx} + $${radIdx})`,
    );
    orderClause = `ORDER BY (POW(lat - $${latIdx}, 2) + POW(lng - $${lngIdx}, 2)) ASC`;
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  params.push(limit);
  const limitIdx = params.length;

  const result = await query(
    `SELECT * FROM service_resources ${whereClause} ${orderClause} LIMIT $${limitIdx}`,
    params,
  );

  return result.rows.map(normalizeResourceRow);
}

async function annotateServiceResourcesWithRegions() {
  const regions = await getStoredNeedRegions();
  if (regions.length === 0) return { annotatedCount: 0 };

  const result = await query(`SELECT id, lat, lng FROM service_resources`);
  let annotatedCount = 0;
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");

    for (const row of result.rows) {
      const assignment = findNeedRegionForPointInRegions(row.lat, row.lng, regions);

      await client.query(
        `UPDATE service_resources
         SET region_code = $1, region_name = $2, region_need_score = $3
         WHERE id = $4`,
        [
          assignment?.regionCode || null,
          assignment?.regionName || null,
          assignment?.compositeNeedScore ?? assignment?.foodNeedScore ?? null,
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

async function upsertResources(resources) {
  if (resources.length === 0) return 0;
  const client = await getPool().connect();
  let count = 0;

  try {
    await client.query("BEGIN");
    for (const resource of resources) {
      await client.query(UPSERT_RESOURCE_SQL, [
        resource.sourceKey,
        resource.sourceDataset,
        resource.serviceType,
        resource.name,
        resource.description || "",
        resource.address || "",
        resource.borough || "",
        resource.zip || "",
        resource.lat,
        resource.lng,
        resource.phone || "",
        resource.hours || "",
        resource.website || "",
        resource.eligibility || "",
        JSON.stringify(resource.tags || {}),
      ]);
      count += 1;
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return count;
}

function isValidResource(resource) {
  if (!resource) return false;
  if (!resource.name || !resource.sourceKey) return false;
  if (!Number.isFinite(resource.lat) || !Number.isFinite(resource.lng)) return false;
  if (
    resource.lat < NYC_BOUNDING_BOX.south ||
    resource.lat > NYC_BOUNDING_BOX.north ||
    resource.lng < NYC_BOUNDING_BOX.west ||
    resource.lng > NYC_BOUNDING_BOX.east
  ) {
    return false;
  }
  return true;
}

function composeAddress(street, borough, zip) {
  const parts = [street, borough, zip].filter(Boolean);
  return parts.join(", ");
}

function mapOsmElement(element, serviceType) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  const name = tags.name || tags["operator"] || tags["alt_name"];

  if (!name) return null;

  return {
    sourceKey: `osm:${element.type}/${element.id}`,
    sourceDataset: `osm:${serviceType}`,
    serviceType,
    name,
    description: tags.description || tags["healthcare:speciality"] || tags["social_facility"] || "",
    address: composeAddress(
      [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
      tags["addr:city"] || tags["addr:suburb"],
      tags["addr:postcode"],
    ),
    borough: tags["addr:city"] || tags["addr:suburb"] || "",
    zip: tags["addr:postcode"] || "",
    lat,
    lng,
    phone: tags.phone || tags["contact:phone"] || "",
    hours: tags.opening_hours || "",
    website: tags.website || tags["contact:website"] || "",
    eligibility: tags["social_facility:for"] || "",
    tags,
  };
}

async function fetchOverpassElements(filters) {
  const bbox = `${NYC_BOUNDING_BOX.south},${NYC_BOUNDING_BOX.west},${NYC_BOUNDING_BOX.north},${NYC_BOUNDING_BOX.east}`;
  const filterClauses = filters.map((filter) => `${filter}(${bbox});`).join("\n");
  const query = `[out:json][timeout:60];\n(\n${filterClauses}\n);\nout body;`;

  let lastError;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      }, 60000);

      if (!response.ok) {
        lastError = new Error(`Overpass ${endpoint} returned ${response.status}`);
        continue;
      }

      const json = await response.json();
      return Array.isArray(json.elements) ? json.elements : [];
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("All Overpass endpoints failed");
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
  }, 45000);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch ${url}: ${response.status} ${body.slice(0, 200)}`);
  }

  return response.json();
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeResourceRow(row) {
  return {
    id: String(row.id),
    sourceKey: row.source_key,
    sourceDataset: row.source_dataset,
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
    regionCode: row.region_code,
    regionName: row.region_name,
    regionNeedScore: row.region_need_score === null ? null : Number(row.region_need_score),
    tags: typeof row.tags_json === "string" ? safeParse(row.tags_json) : row.tags_json,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
  };
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

module.exports = {
  SERVICE_TYPES,
  importAllServiceResources,
  importNycOpenDataResources,
  importOsmResources,
  getServiceResources,
  annotateServiceResourcesWithRegions,
};
