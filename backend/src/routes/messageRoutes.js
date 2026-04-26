const express = require("express");
const {
  createThread,
  createThreadMessage,
  getThread,
  listThreadMessages,
  listThreads,
  searchUsers,
} = require("../controllers/messageController");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);

router.get("/users/search", searchUsers);
router.get("/threads", listThreads);
router.post("/threads", createThread);
router.get("/threads/:id", getThread);
router.get("/threads/:id/messages", listThreadMessages);
router.post("/threads/:id/messages", createThreadMessage);

module.exports = router;
