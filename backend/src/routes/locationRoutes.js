const express = require("express");
const router = express.Router();
const {
  getAllLocations,
  importOsmLocations,
  importNycLocations,
  updateLocation,
} = require("../controllers/locationController");

router.get("/", getAllLocations);
router.post("/import/osm", importOsmLocations);
router.post("/import/osm/nyc", importNycLocations);
router.patch("/:id", updateLocation);

module.exports = router;
