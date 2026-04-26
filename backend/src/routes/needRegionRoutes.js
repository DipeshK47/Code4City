const express = require("express");
const router = express.Router();
const {
  getAllNeedRegions,
  importNeedRegions,
} = require("../controllers/needRegionController");

router.get("/", getAllNeedRegions);
router.post("/import/nyc-open-data", importNeedRegions);

module.exports = router;
