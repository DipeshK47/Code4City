const {
  SERVICE_TYPES,
  getServiceResources,
  importAllServiceResources,
  importNycOpenDataResources,
  importOsmResources,
} = require("../services/serviceResourceService");

const listServiceResources = async (req, res) => {
  try {
    const serviceType = parseServiceType(req.query.type);
    const near = parseNear(req.query.near);
    const radiusMiles = parseRadius(req.query.radius);
    const limit = parseLimit(req.query.limit);

    const data = await getServiceResources({
      serviceType,
      near,
      radiusMiles,
      limit,
    });

    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const importServiceResources = async (req, res) => {
  try {
    const result = await importAllServiceResources();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const importNycOnly = async (req, res) => {
  try {
    const result = await importNycOpenDataResources();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const importOsmOnly = async (req, res) => {
  try {
    const result = await importOsmResources();
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

function parseServiceType(value) {
  if (!value) return undefined;
  const tokens = String(value)
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => SERVICE_TYPES.includes(token));
  if (tokens.length === 0) return undefined;
  if (tokens.length === 1) return tokens[0];
  return tokens;
}

function parseNear(value) {
  if (!value) return undefined;
  const parts = String(value).split(",").map((part) => parseFloat(part));
  if (parts.length !== 2 || !parts.every(Number.isFinite)) return undefined;
  return { lat: parts[0], lng: parts[1] };
}

function parseRadius(value) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(parsed, 50);
}

function parseLimit(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.min(parsed, 10000);
}

module.exports = {
  listServiceResources,
  importServiceResources,
  importNycOnly,
  importOsmOnly,
};
