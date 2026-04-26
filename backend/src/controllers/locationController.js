const {
  getStoredHotspots,
  importHotspotsFromOsm,
  updateHotspotStatus,
} = require("../services/osmHotspotService");

const NYC_IMPORT_REGIONS = [
  { name: "Upper Manhattan", lat: 40.8365, lng: -73.9441, radiusMiles: 2.8 },
  { name: "Midtown Manhattan", lat: 40.758, lng: -73.9855, radiusMiles: 2.8 },
  { name: "Lower Manhattan", lat: 40.7132, lng: -74.0048, radiusMiles: 2.6 },
  { name: "South Bronx", lat: 40.8267, lng: -73.9229, radiusMiles: 2.5 },
  { name: "North Bronx", lat: 40.8773, lng: -73.8676, radiusMiles: 2.6 },
  { name: "North Brooklyn", lat: 40.7081, lng: -73.9571, radiusMiles: 2.7 },
  { name: "Central Brooklyn", lat: 40.6698, lng: -73.9442, radiusMiles: 2.8 },
  { name: "South Brooklyn", lat: 40.6135, lng: -73.9896, radiusMiles: 2.8 },
  { name: "Western Queens", lat: 40.7447, lng: -73.9485, radiusMiles: 2.6 },
  { name: "Central Queens", lat: 40.7282, lng: -73.7949, radiusMiles: 2.9 },
  { name: "Eastern Queens", lat: 40.7429, lng: -73.7068, radiusMiles: 2.9 },
  { name: "North Shore Staten Island", lat: 40.6403, lng: -74.0868, radiusMiles: 2.4 },
  { name: "South Staten Island", lat: 40.5512, lng: -74.1728, radiusMiles: 2.5 },
];

const getAllLocations = async (req, res) => {
  try {
    const lat = parseOptionalFloat(req.query.lat);
    const lng = parseOptionalFloat(req.query.lng);
    const radiusMiles = parseOptionalFloat(req.query.radiusMiles);
    const limit = parseOptionalFloat(req.query.limit);
    const locations = await getStoredHotspots({ lat, lng, radiusMiles, limit });

    res.status(200).json({
      success: true,
      count: locations.length,
      data: locations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const importOsmLocations = async (req, res) => {
  try {
    const lat = parseRequiredFloat(req.body.lat, "lat");
    const lng = parseRequiredFloat(req.body.lng, "lng");
    const radiusMiles = parseRequiredFloat(req.body.radiusMiles, "radiusMiles");

    const result = await importHotspotsFromOsm({ lat, lng, radiusMiles });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const importNycLocations = async (req, res) => {
  try {
    const summaries = [];
    const failures = [];
    let importedCount = 0;
    let sourceCount = 0;

    for (const region of NYC_IMPORT_REGIONS) {
      try {
        const result = await importHotspotsFromOsm(region);
        summaries.push({
          region: region.name,
          importedCount: result.importedCount,
          sourceCount: result.sourceCount,
        });
        importedCount += result.importedCount;
        sourceCount += result.sourceCount;
      } catch (error) {
        failures.push({
          region: region.name,
          message: error.message,
        });
      }

      await delay(450);
    }

    if (summaries.length === 0) {
      throw new Error("NYC import failed for all regions. Try again in a minute.");
    }

    res.status(200).json({
      success: true,
      data: {
        importedCount,
        sourceCount,
        regions: summaries,
        failures,
      },
      message:
        failures.length > 0
          ? `Imported ${importedCount} hotspots, but ${failures.length} region${failures.length === 1 ? "" : "s"} failed.`
          : undefined,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

const updateLocation = async (req, res) => {
  try {
    const updated = await updateHotspotStatus(req.params.id, req.body || {});

    if (!updated) {
      res.status(404).json({
        success: false,
        message: "Location not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: updated,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllLocations,
  importOsmLocations,
  importNycLocations,
  updateLocation,
};

function parseOptionalFloat(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseRequiredFloat(value, field) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid numeric field: ${field}`);
  }

  return parsed;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
