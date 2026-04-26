const express = require("express");
const { getAdminOverview } = require("../controllers/adminController");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.get("/overview", requireAuth, getAdminOverview);

module.exports = router;
