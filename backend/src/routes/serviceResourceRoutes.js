const express = require("express");
const router = express.Router();
const {
  listServiceResources,
  importServiceResources,
  importNycOnly,
  importOsmOnly,
} = require("../controllers/serviceResourceController");

router.get("/", listServiceResources);
router.post("/import", importServiceResources);
router.post("/import/nyc-open-data", importNycOnly);
router.post("/import/osm", importOsmOnly);

module.exports = router;
