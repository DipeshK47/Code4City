const eventService = require("../services/eventService");
const { getOptionalUserFromRequest } = require("../utils/optionalAuth");

function getViewerUserId(req) {
  return getOptionalUserFromRequest(req)?.id ?? null;
}

function handleError(res, error, fallbackMessage) {
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  console.error(fallbackMessage, error);
  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
}

async function listEvents(req, res) {
  try {
    const data = await eventService.listEvents({
      viewerUserId: getViewerUserId(req),
      status: req.query.status,
      category: req.query.category,
      limit: req.query.limit,
      includeCompleted: req.query.includeCompleted === "true",
    });

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load outreach events.");
  }
}

async function listRecommendedEvents(req, res) {
  try {
    const data = await eventService.listRecommendedEvents({
      viewerUserId: getViewerUserId(req),
      lat: req.query.lat,
      lng: req.query.lng,
      category: req.query.category,
      limit: req.query.limit,
    });

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load recommended events.");
  }
}

async function listRecommendedZones(req, res) {
  try {
    const data = await eventService.listRecommendedZones({
      limit: req.query.limit,
    });

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load recommended zones.");
  }
}

async function getEvent(req, res) {
  try {
    const data = await eventService.getEvent(req.params.id, getViewerUserId(req));

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load outreach event.");
  }
}

async function createEvent(req, res) {
  try {
    const data = await eventService.createEvent(req.body, getViewerUserId(req));

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to create outreach event.");
  }
}

async function updateEvent(req, res) {
  try {
    const data = await eventService.updateEvent(
      req.params.id,
      req.body,
      getViewerUserId(req),
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update outreach event.");
  }
}

async function joinEvent(req, res) {
  try {
    const data = await eventService.joinEvent(
      req.params.id,
      getViewerUserId(req),
      req.body,
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to join outreach event.");
  }
}

async function completeStop(req, res) {
  try {
    const data = await eventService.completeStop(
      req.params.id,
      req.params.stopId,
      getViewerUserId(req),
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to complete outreach stop.");
  }
}

async function getOptimizedRoute(req, res) {
  try {
    const data = await eventService.getOptimizedRoute(req.params.id, {
      lat: req.query.lat,
      lng: req.query.lng,
    });

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to optimize outreach route.");
  }
}

module.exports = {
  completeStop,
  createEvent,
  getEvent,
  getOptimizedRoute,
  joinEvent,
  listEvents,
  listRecommendedEvents,
  listRecommendedZones,
  updateEvent,
};
