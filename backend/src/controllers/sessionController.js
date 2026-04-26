const {
  listSessions,
  findSessionById,
  saveSession,
  removeSession,
} = require("../services/sessionService");

async function getAllSessions(req, res) {
  try {
    const sessions = await listSessions(req.user.id);

    return res.status(200).json({
      success: true,
      count: sessions.length,
      data: sessions,
    });
  } catch (error) {
    console.error("Get sessions error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not fetch sessions.",
    });
  }
}

async function getSessionById(req, res) {
  try {
    const session = await findSessionById(req.params.id, req.user.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: session,
    });
  } catch (error) {
    console.error("Get session by id error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not fetch session.",
    });
  }
}

async function createSession(req, res) {
  try {
    const session = await saveSession(req.body, req.user.id);

    return res.status(201).json({
      success: true,
      data: session,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Could not save session.",
    });
  }
}

async function deleteSession(req, res) {
  try {
    const deletedSession = await removeSession(req.params.id, req.user.id);

    if (!deletedSession) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: deletedSession,
    });
  } catch (error) {
    console.error("Delete session error:", error);
    return res.status(500).json({
      success: false,
      message: "Could not delete session.",
    });
  }
}

module.exports = {
  getAllSessions,
  getSessionById,
  createSession,
  deleteSession,
};
