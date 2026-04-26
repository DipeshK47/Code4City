const express = require("express");
const { getRecentActivity } = require("../controllers/activityController");

const router = express.Router();

router.get("/recent", getRecentActivity);

module.exports = router;
