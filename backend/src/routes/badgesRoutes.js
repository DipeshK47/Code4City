const express = require("express");
const { getBadges } = require("../controllers/badgesController");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.get("/", requireAuth, getBadges);

module.exports = router;
