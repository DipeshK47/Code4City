const express = require("express");
const {
  createMeetup,
  createMeetupMessage,
  deleteMeetup,
  getMeetup,
  joinMeetup,
  leaveMeetup,
  listMeetupMessages,
  listMeetups,
  updateMeetup,
} = require("../controllers/meetupController");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.get("/", listMeetups);
router.post("/", requireAuth, createMeetup);
router.get("/:id", getMeetup);
router.patch("/:id", requireAuth, updateMeetup);
router.delete("/:id", requireAuth, deleteMeetup);
router.post("/:id/join", requireAuth, joinMeetup);
router.post("/:id/leave", requireAuth, leaveMeetup);
router.get("/:id/messages", requireAuth, listMeetupMessages);
router.post("/:id/messages", requireAuth, createMeetupMessage);

module.exports = router;
