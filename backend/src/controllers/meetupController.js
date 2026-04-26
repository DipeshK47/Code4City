const meetupService = require("../services/meetupService");
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

async function listMeetups(req, res) {
  try {
    const data = await meetupService.listMeetups({
      viewerUserId: getViewerUserId(req),
      includePast: req.query.includePast === "true",
      limit: req.query.limit,
    });

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load meetups.");
  }
}

async function getMeetup(req, res) {
  try {
    const data = await meetupService.getMeetup(
      req.params.id,
      getViewerUserId(req),
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load meetup.");
  }
}

async function createMeetup(req, res) {
  try {
    const data = await meetupService.createMeetup(req.body, req.user.id);

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to create meetup.");
  }
}

async function updateMeetup(req, res) {
  try {
    const data = await meetupService.updateMeetup(
      req.params.id,
      req.user.id,
      req.body,
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update meetup.");
  }
}

async function deleteMeetup(req, res) {
  try {
    await meetupService.deleteMeetup(req.params.id, req.user.id);

    return res.json({
      success: true,
    });
  } catch (error) {
    return handleError(res, error, "Failed to cancel meetup.");
  }
}

async function joinMeetup(req, res) {
  try {
    const data = await meetupService.joinMeetup(req.params.id, req.user.id);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to join meetup.");
  }
}

async function leaveMeetup(req, res) {
  try {
    const data = await meetupService.leaveMeetup(req.params.id, req.user.id);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to leave meetup.");
  }
}

async function listMeetupMessages(req, res) {
  try {
    const data = await meetupService.listMeetupMessages(
      req.params.id,
      req.user.id,
      req.query.limit,
    );

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load meetup chat messages.");
  }
}

async function createMeetupMessage(req, res) {
  try {
    const data = await meetupService.sendMeetupMessage(
      req.params.id,
      req.user.id,
      req.body.messageText,
    );

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to send meetup message.");
  }
}

module.exports = {
  createMeetup,
  createMeetupMessage,
  deleteMeetup,
  getMeetup,
  joinMeetup,
  leaveMeetup,
  listMeetupMessages,
  listMeetups,
  updateMeetup,
};
