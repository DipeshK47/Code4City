const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/requireAuth");
const {
  listSuggestions,
  runGenerate,
  approveSuggestion,
  dismiss,
  runSeedDemo,
} = require("../controllers/eventSuggestionController");

router.get("/", listSuggestions);
router.post("/generate", runGenerate);
router.post("/seed-demo", runSeedDemo);
router.post("/:id/approve", requireAuth, approveSuggestion);
router.post("/:id/dismiss", dismiss);

module.exports = router;
