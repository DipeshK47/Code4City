const repository = require("../data/routeItemRepository");

function toFiniteNumber(value, fieldName) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    const error = new Error(`${fieldName} must be a valid number.`);
    error.statusCode = 400;
    throw error;
  }

  return numericValue;
}

function normalizeOptionalText(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildDedupeKey(itemType, payload) {
  if (itemType === "hotspot") {
    const hotspotId = payload.hotspotId ?? payload.hotspot_id ?? payload.id;
    const sourceKey = normalizeOptionalText(payload.sourceKey ?? payload.source_key);

    if (hotspotId != null) return `hotspot:${hotspotId}`;
    if (sourceKey) return `hotspot:${sourceKey}`;
  }

  const sourceId = normalizeOptionalText(payload.sourceId ?? payload.source_id ?? payload.id);
  if (sourceId) {
    return `${itemType}:${sourceId}`;
  }

  const normalizedName = normalizeOptionalText(payload.name)?.toLowerCase() ?? "unknown";
  const lat = toFiniteNumber(payload.lat, "lat").toFixed(6);
  const lng = toFiniteNumber(payload.lng, "lng").toFixed(6);
  return `${itemType}:${normalizedName}:${lat}:${lng}`;
}

function normalizeRouteItemPayload(payload, userId) {
  if (!payload || typeof payload !== "object") {
    const error = new Error("Route item payload is required.");
    error.statusCode = 400;
    throw error;
  }

  const itemType = normalizeOptionalText(payload.itemType ?? payload.item_type);
  if (itemType !== "hotspot" && itemType !== "printer") {
    const error = new Error("itemType must be either 'hotspot' or 'printer'.");
    error.statusCode = 400;
    throw error;
  }

  const name = normalizeOptionalText(payload.name);
  if (!name) {
    const error = new Error("name is required.");
    error.statusCode = 400;
    throw error;
  }

  const lat = toFiniteNumber(payload.lat, "lat");
  const lng = toFiniteNumber(payload.lng, "lng");
  const hotspotIdValue = payload.hotspotId ?? payload.hotspot_id;
  const hotspotId =
    hotspotIdValue == null || hotspotIdValue === ""
      ? null
      : Number.parseInt(String(hotspotIdValue), 10);

  if (itemType === "hotspot" && !Number.isInteger(hotspotId)) {
    const error = new Error("hotspotId is required for hotspot route items.");
    error.statusCode = 400;
    throw error;
  }

  return {
    userId,
    itemType,
    dedupeKey: buildDedupeKey(itemType, payload),
    hotspotId: Number.isInteger(hotspotId) ? hotspotId : null,
    sourceId: normalizeOptionalText(payload.sourceId ?? payload.source_id),
    sourceKey: normalizeOptionalText(payload.sourceKey ?? payload.source_key),
    name,
    address: normalizeOptionalText(payload.address),
    category: normalizeOptionalText(payload.category),
    lat,
    lng,
    regionCode: normalizeOptionalText(payload.regionCode ?? payload.region_code),
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {},
  };
}

function listRouteItems(userId) {
  return repository.getAllRouteItems(userId);
}

function saveRouteItem(payload, userId) {
  return repository.upsertRouteItem(normalizeRouteItemPayload(payload, userId));
}

function removeRouteItem(id, userId) {
  return repository.deleteRouteItem(id, userId);
}

function removeAllRouteItems(userId) {
  return repository.clearRouteItems(userId);
}

module.exports = {
  listRouteItems,
  removeAllRouteItems,
  removeRouteItem,
  saveRouteItem,
};
