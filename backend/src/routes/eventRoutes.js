const express = require("express");
const {
  completeStop,
  createEvent,
  getEvent,
  getOptimizedRoute,
  joinEvent,
  listEvents,
  listRecommendedEvents,
  listRecommendedZones,
  updateEvent,
} = require("../controllers/eventController");

const router = express.Router();

router.get("/", listEvents);
router.post("/", createEvent);
router.get("/recommended", listRecommendedEvents);
router.get("/zones/recommended", listRecommendedZones);
router.get("/:id", getEvent);
router.patch("/:id", updateEvent);
router.post("/:id/join", joinEvent);
router.post("/:id/stops/:stopId/complete", completeStop);
router.get("/:id/optimized-route", getOptimizedRoute);

module.exports = router;
