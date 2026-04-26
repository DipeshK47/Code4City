const express = require("express");
const {
  getAllSessions,
  getSessionById,
  createSession,
  deleteSession,
} = require("../controllers/sessionController");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);
router.get("/", getAllSessions);
router.get("/:id", getSessionById);
router.post("/", createSession);
router.delete("/:id", deleteSession);

module.exports = router;
