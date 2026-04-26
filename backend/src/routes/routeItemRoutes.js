const express = require("express");
const {
  clearRouteItems,
  createRouteItem,
  deleteRouteItem,
  getAllRouteItems,
} = require("../controllers/routeItemController");
const { requireAuth } = require("../middleware/requireAuth");

const router = express.Router();

router.use(requireAuth);
router.get("/", getAllRouteItems);
router.post("/", createRouteItem);
router.delete("/", clearRouteItems);
router.delete("/:id", deleteRouteItem);

module.exports = router;
