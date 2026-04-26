const messageService = require("../services/messageService");

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

async function listThreads(req, res) {
  try {
    const data = await messageService.listThreads(req.user.id);

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load message threads.");
  }
}

async function createThread(req, res) {
  try {
    const data = await messageService.createOrGetThread(
      req.user.id,
      req.body.otherUserId,
    );

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to open direct message thread.");
  }
}

async function getThread(req, res) {
  try {
    const data = await messageService.getThread(req.params.id, req.user.id);

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to load message thread.");
  }
}

async function listThreadMessages(req, res) {
  try {
    const data = await messageService.listThreadMessages(
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
    return handleError(res, error, "Failed to load messages.");
  }
}

async function createThreadMessage(req, res) {
  try {
    const data = await messageService.sendThreadMessage(
      req.params.id,
      req.user.id,
      req.body.messageText,
    );

    return res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to send message.");
  }
}

async function searchUsers(req, res) {
  try {
    const data = await messageService.searchUsers(
      req.user.id,
      req.query.q || "",
    );

    return res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return handleError(res, error, "Failed to search users.");
  }
}

module.exports = {
  createThread,
  createThreadMessage,
  getThread,
  listThreadMessages,
  listThreads,
  searchUsers,
};
